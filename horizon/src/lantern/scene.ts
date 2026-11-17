import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { LanternModel, SourceKey, WindowState } from './model';
import { MEDIAN_WINDOW, WINDOWS } from './model';

/**
 * The Lantern, drawn: a four-sided glass tower of retirement years. One
 * floor a year; the width of a floor is that year's planned spend, so the
 * tower steps in where spending steps down. Each face is a flat chart read
 * square-on, and turning the tower is how the lens changes:
 *
 *   0 front  "Will it pay?"         20 windows a floor, worst future to best
 *   1 right  "Where it comes from"  the middle future's income by source
 *   2 back   "What's left"          money left: middle bar, 10th to 90th halo
 *   3 left   "Stress"               the windows again, under the stress
 *
 * Framework-free: it is given a host element, an overlay for text labels and
 * a view model, and knows nothing about React or the engine.
 */
const W0 = 20;          // width of the widest floor, in window cells
const H = 1;            // height of a floor
const EPS = 0.03;       // how far face content sits outside the glass
const FOV = 22;
const TILT = (8 * Math.PI) / 180;   // seen slightly from below
const QUARTER = Math.PI / 2;
/** Outward normal of each face as (x, z). */
const NORMALS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

const hex = (h: number, k = 1) => new THREE.Color(h).multiplyScalar(k);
const COL = {
  full: hex(0xffb02e, 0.95),
  floor: hex(0xcfe0ff, 0.6),
  short: hex(0x0b1226, 1),
  ember: hex(0xe2553a, 0.8),
  ring: hex(0xffffff, 0.85),
  essential: hex(0xbfe6ff, 0.7),
  halo: hex(0x3d5fb8, 0.55),
  wealth: hex(0x8fdcff, 0.9),
  marker: hex(0xffffff, 1.0),
};
const SOURCE_COL: Record<SourceKey, THREE.Color> = {
  gilt: hex(0xffa62e, 0.9), equity: hex(0x3fd8ff, 0.8), gold: hex(0xf2d06b, 0.8), mmf: hex(0xb9c2d0, 0.7),
  sp: hex(0x9a6bff, 0.95), partnerSp: hex(0xcdb4ff, 0.8), work: hex(0x55e08a, 0.85), downsize: hex(0xf6f5ea, 0.9),
};
const RANK: Record<WindowState, number> = { short: 0, floor: 1, full: 2 };

type Quad = { m: THREE.Matrix4; c: THREE.Color };

export type SceneOpts = {
  reducedMotion: boolean;
  /** The face nearest the camera; `settled` once the tower is at rest on it. */
  onFace: (face: number, settled: boolean) => void;
  onSelect: (floor: number) => void;
  onLost: () => void;
};

export class LanternScene {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 600);
  private tower = new THREE.Group();
  private dust: THREE.Points | null = null;
  private selBox: THREE.LineSegments | null = null;
  private labels: { el: HTMLSpanElement; floor: number }[] = [];
  private selLabel: HTMLSpanElement;
  private w: number[] = [];
  private n: number;
  private cw = 1; private ch = 1;
  private rot = 0; private zoom = 1;
  private tween: { from: number; to: number; t0: number; dur: number } | null = null;
  private raf = 0; private idle = 0;
  private selected = -1;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; rot: number; moved: boolean; lastX: number; lastT: number; v: number } | null = null;
  private pinch: { d: number; zoom: number } | null = null;
  private lastTap = 0;
  private ro: ResizeObserver;
  private disposed = false;

  constructor(private host: HTMLElement, private overlay: HTMLElement, private model: LanternModel, private opts: SceneOpts) {
    this.n = model.floors.length;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const el = this.renderer.domElement;
    el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    el.setAttribute('aria-hidden', 'true');
    host.appendChild(el);

    this.scene.background = backdrop();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffe2b8, 1.2); sun.position.set(-10, 24, 30); this.scene.add(sun);
    this.scene.add(this.tower);
    this.build();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.28, 0.34);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.selLabel = this.makeLabel(true);
    this.selLabel.style.display = 'none';

    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('webglcontextlost', this.onLost);
    document.addEventListener('visibilitychange', this.onVisible);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    // Dust drifts very slowly while nothing else moves; reduced motion keeps it still.
    if (!opts.reducedMotion) this.idle = window.setInterval(() => {
      if (document.hidden || this.raf || !this.dust) return;
      this.dust.rotation.y += 0.0012; this.invalidate();
    }, 100);
  }

  // ── Building the tower ──────────────────────────────────────────────────
  private quad(face: number, floor: number, u: number, yc: number, sx: number, sy: number, c: THREE.Color, out = 0): Quad {
    const [nx, nz] = NORMALS[face], d = this.w[floor] / 2 + EPS + out;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(nx * d + nz * u, yc, nz * d - nx * u),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(nx, nz)),
      new THREE.Vector3(sx, sy, 1));
    return { m, c };
  }

  private instanced(geo: THREE.BufferGeometry, quads: Quad[], mat?: THREE.Material) {
    const mesh = new THREE.InstancedMesh(geo, mat || new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, quads.length));
    mesh.count = quads.length;
    quads.forEach((q, i) => { mesh.setMatrixAt(i, q.m); mesh.setColorAt(i, q.c); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.tower.add(mesh);
    return mesh;
  }

  private build() {
    const M = this.model, F = M.floors, n = this.n;
    const maxSpend = Math.max(...F.map(f => f.spend));
    this.w = F.map(f => (W0 * f.spend) / maxSpend);
    const wMin = Math.min(...this.w), we = (W0 * M.essential) / maxSpend;

    const quads: Quad[] = [], rings: Quad[] = [], frames: Quad[] = [];
    const windowsOn = (face: number, i: number, states: WindowState[], base?: WindowState[]) => {
      const cw = this.w[i] / WINDOWS, yc = i * H + H / 2;
      states.forEach((s, j) => {
        const u = (j - (WINDOWS - 1) / 2) * cw;
        // Never colour alone: essentials-only windows are smaller and softer, dark ones carry an ember edge.
        if (s === 'full') quads.push(this.quad(face, i, u, yc, cw * 0.68, 0.58, COL.full));
        else if (s === 'floor') quads.push(this.quad(face, i, u, yc, cw * 0.46, 0.4, COL.floor));
        else {
          quads.push(this.quad(face, i, u, yc, cw * 0.74, 0.62, COL.short));
          quads.push(this.quad(face, i, u, yc - 0.27, cw * 0.74, 0.08, COL.ember, 0.005));
        }
        if (j === MEDIAN_WINDOW) rings.push(this.quad(face, i, u, yc, cw * 1.02, 0.96, COL.ring, 0.012));
        // The ghost of the base plan: an outline where a light that was on has dimmed or gone out.
        if (base && RANK[s] < RANK[base[j]]) frames.push(this.quad(face, i, u, yc, cw * 0.82, 0.7, (base[j] === 'full' ? COL.full : COL.floor).clone().multiplyScalar(0.42), 0.012));
      });
    };

    const maxP90 = Math.max(...F.map(f => f.wealth.p90), 1), wScale = (wMin * 0.94) / maxP90, u0 = -(wMin * 0.94) / 2;
    F.forEach((f, i) => {
      const w = this.w[i], yc = i * H + H / 2;
      windowsOn(0, i, f.windows);
      windowsOn(3, i, f.stress, f.windows);

      // Face 1: the middle future's income by source, left to right; a gap at the right is a shortfall.
      const scale = (w * 0.94) / f.spend; let x = -(w * 0.94) / 2;
      for (const s of f.sources) {
        const len = s.amount * scale;
        if (len > 0.12) quads.push(this.quad(1, i, x + len / 2, yc, len - 0.06, 0.62, SOURCE_COL[s.key]));
        x += len;
      }

      // Face 2: money left. A soft halo from the 10th to the 90th percentile, the middle as a bright bar.
      const { p10, p50, p90 } = f.wealth;
      if (p90 > p10) quads.push(this.quad(2, i, u0 + ((p10 + p90) / 2) * wScale, yc, (p90 - p10) * wScale, 0.62, COL.halo));
      if (p50 > 0) quads.push(this.quad(2, i, u0 + (p50 / 2) * wScale, yc, p50 * wScale, 0.26, COL.wealth, 0.01));
      if (i === n - 1) quads.push(this.quad(2, i, u0 + p50 * wScale, yc, 0.34, 0.9, COL.marker, 0.02));

      // The essential floor: a thin bright line up both sides of every face.
      const ue = Math.min(we, w - 0.1) / 2;
      for (let face = 0; face < 4; face++) for (const sgn of [-1, 1]) quads.push(this.quad(face, i, sgn * ue, yc, 0.07, H, COL.essential, 0.016));
    });

    const plane = new THREE.PlaneGeometry(1, 1);
    this.instanced(plane, quads);
    this.instanced(new THREE.RingGeometry(0.42, 0.47, 28), rings);
    this.instanced(new THREE.RingGeometry(0.6, 0.68, 4, 1, Math.PI / 4), frames);

    // Glass: low-opacity faces, thin bright edges, a plate under every floor.
    const box = new THREE.BoxGeometry(1, 1, 1);
    const at = (x: number, y: number, z: number, sx: number, sy: number, sz: number): Quad =>
      ({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)), c: new THREE.Color(1, 1, 1) });
    this.instanced(box, this.w.map((w, i) => at(0, i * H + H / 2, 0, w, H * 0.98, w)),
      new THREE.MeshBasicMaterial({ color: 0x1c2f66, transparent: true, opacity: 0.16, depthWrite: false }));
    // A rim under every floor rather than a slab, so the core stays visible from below.
    const rims: Quad[] = [];
    [...this.w.map((w, i) => [w, i * H] as [number, number]), [this.w[n - 1], n * H] as [number, number]].forEach(([w, y]) => {
      for (const sgn of [-1, 1]) { rims.push(at(0, y, sgn * w / 2, w + 0.12, 0.05, 0.12)); rims.push(at(sgn * w / 2, y, 0, 0.12, 0.05, w + 0.12)); }
    });
    this.instanced(box, rims, new THREE.MeshBasicMaterial({ color: 0x3a52a0 }));
    const edge: number[] = [];
    this.w.forEach((w, i) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) edge.push(sx * w / 2, i * H, sz * w / 2, sx * w / 2, (i + 1) * H, sz * w / 2); });
    this.tower.add(lines(edge, 0x8fb0ff, 0.6));

    // The gilt ladder: a warm stone plinth with corner buttresses; where it ends is a visible event.
    const stone = new THREE.MeshLambertMaterial({ color: 0x6e5536, emissive: 0x1c1004 });
    const amber = new THREE.MeshBasicMaterial({ color: hex(0xffb347, 0.9), toneMapped: false });
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); this.tower.add(m); return m; };
    add(new THREE.BoxGeometry(W0 + 3.2, 0.5, W0 + 3.2), stone, 0, -0.25, 0);
    const gh = M.giltFloors * H, c = W0 / 2 + 0.45;
    if (gh > 0) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(new THREE.BoxGeometry(1.5, gh, 1.5), stone, sx * c, gh / 2, sz * c);
        add(new THREE.BoxGeometry(1.5, 0.1, 1.5), amber, sx * c, gh + 0.05, sz * c);
      }
      const band = W0 + 0.9;
      for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(band, 0.09, 0.09), amber, 0, gh, s * (W0 / 2 + 0.2));
        add(new THREE.BoxGeometry(0.09, 0.09, band), amber, s * (W0 / 2 + 0.2), gh, 0);
      }
    }

    // The working years: dim scaffolding under the tower.
    const sc: number[] = [], sw = (W0 * 0.9) / 2;
    for (let l = 0; l < M.workingYears; l++) {
      const y1 = -0.5 - l * H, y0 = y1 - H;
      const corners: [number, number][] = [[-sw, -sw], [sw, -sw], [sw, sw], [-sw, sw]];
      corners.forEach(([x, z], k) => {
        const [x2, z2] = corners[(k + 1) % 4];
        sc.push(x, y0, z, x, y1, z, x, y0, z, x2, y0, z2, x, y0, z, x2, y1, z2);
      });
    }
    if (sc.length) this.tower.add(lines(sc, 0x5b6c9c, 0.45));

    // The State Pensions: glowing spines in the core, as thick as the income they bring.
    const spineW = M.spines.map(s => (W0 * s.income) / maxSpend);
    M.spines.forEach((s, k) => {
      const a = spineW[k], y0 = s.fromFloor * H, y1 = n * H + (s.key === 'sp' ? 0.9 : 0.5);
      const x = M.spines.length === 1 ? 0 : s.key === 'sp' ? a / 2 + 0.25 : -(a / 2 + 0.25);
      add(new THREE.BoxGeometry(a, y1 - y0, a), new THREE.MeshBasicMaterial({ color: SOURCE_COL[s.key].clone().multiplyScalar(0.24), toneMapped: false }), x, (y0 + y1) / 2, 0);
      const lit = new THREE.MeshBasicMaterial({ color: SOURCE_COL[s.key], toneMapped: false });
      add(new THREE.BoxGeometry(a, 0.14, a), lit, x, y0 + 0.07, 0);
      add(new THREE.BoxGeometry(a, 0.3, a), lit, x, y1 - 0.15, 0);
    });

    // Faint dust, far and near.
    if (!this.opts.reducedMotion) {
      const p: number[] = []; let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 240; i++) p.push((rnd() - 0.5) * 70, -8 + rnd() * (n + 16), (rnd() - 0.5) * 70);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8ea4e6, size: 1.1 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false, transparent: true, opacity: 0.3, depthWrite: false }));
      this.scene.add(this.dust);
    }

    // Age labels (text stays in the page, so it is crisp and the glow never touches it).
    let prev = -1;
    F.forEach((f, i) => {
      const step = i > 0 && f.spend !== F[i - 1].spend;
      if (!(i % 5 === 0 || step || i === n - 1)) return;
      const el = this.makeLabel(false);
      el.textContent = f.partnerAge != null ? `${f.age} · ${f.partnerAge}` : String(f.age);
      this.labels.push({ el, floor: i }); prev = i;
    });
    void prev;
  }

  private makeLabel(strong: boolean) {
    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums;line-height:1;transform-origin:right center;` +
      (strong ? 'font-size:11px;font-weight:700;color:#ffffff;background:#16224a;border-radius:6px;padding:3px 5px;' : 'font-size:10px;font-weight:600;color:#9fb0d9;');
    this.overlay.appendChild(el);
    return el;
  }

  // ── Camera and drawing ──────────────────────────────────────────────────
  private get bottom() { return -0.5 - this.model.workingYears * H; }
  private get top() { return this.n * H + 1.2; }

  private resize() {
    if (this.disposed) return;
    const r = this.host.getBoundingClientRect();
    this.cw = Math.max(1, r.width); this.ch = Math.max(1, r.height);
    this.renderer.setSize(this.cw, this.ch, false);
    this.composer.setSize(this.cw, this.ch);
    this.camera.aspect = this.cw / this.ch;
    this.fit(); this.invalidate();
  }

  private fit() {
    const t = Math.tan((FOV * Math.PI) / 360);
    const halfH = ((this.top - this.bottom) / 2) * 1.09, halfW = W0 / 2 + 2.2;
    // Room on both sides for the age labels, so the tower stays centred.
    const room = Math.max(0.2, (this.cw - 108) / this.ch);
    const d = Math.max(halfH / t, halfW / (t * room)) / this.zoom;
    const cy = (this.top + this.bottom) / 2;
    this.camera.position.set(0, cy - d * Math.sin(TILT), d * Math.cos(TILT));
    this.camera.lookAt(0, cy, 0);
    this.camera.updateProjectionMatrix();
  }

  private project(x: number, y: number, z: number, local: boolean) {
    const v = new THREE.Vector3(x, y, z);
    if (local) v.applyMatrix4(this.tower.matrixWorld);
    v.project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.cw, (-v.y * 0.5 + 0.5) * this.ch] as [number, number];
  }

  /** Screen position of a floor: its vertical centre on the surface facing the camera, and its left and right silhouette. */
  private floorOnScreen(i: number) {
    const w = this.w[i], yc = i * H + H / 2, o = i < this.model.giltFloors ? W0 + 2.4 : w;   // clear the buttresses
    let minX = Infinity, maxX = -Infinity;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [x] = this.project(sx * o / 2, yc, sz * o / 2, true); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const [, y] = this.project(0, yc, w / 2, false);
    return { minX, maxX, y };
  }

  private place(el: HTMLSpanElement, i: number) {
    const p = this.floorOnScreen(i);
    el.style.transform = `translate(${Math.round(p.minX - 6)}px, ${Math.round(p.y)}px) translate(-100%, -50%)`;
  }

  private draw() {
    this.tower.rotation.y = this.rot;
    this.tower.updateMatrixWorld(true);
    this.composer.render();
    for (const l of this.labels) { l.el.style.visibility = l.floor === this.selected ? 'hidden' : 'visible'; this.place(l.el, l.floor); }
    if (this.selected >= 0) this.place(this.selLabel, this.selected);
  }

  private frame = (t: number) => {
    this.raf = 0;
    if (this.disposed) return;
    let moving = false;
    if (this.tween) {
      const k = Math.min(1, Math.max(0, (t - this.tween.t0) / this.tween.dur)), e = 1 - Math.pow(1 - k, 3);
      this.rot = this.tween.from + (this.tween.to - this.tween.from) * e;
      if (k >= 1) { this.tween = null; this.opts.onFace(this.face, true); } else { moving = true; this.opts.onFace(this.face, false); }
    }
    this.draw();
    if (moving) this.raf = requestAnimationFrame(this.frame);
  };

  private invalidate() { if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.frame); }

  /** The face nearest the camera. */
  get face() { return ((Math.round(-this.rot / QUARTER) % 4) + 4) % 4; }

  private turnTo(target: number) {
    if (this.opts.reducedMotion) {
      // Reduced motion: no spin. The picture cross-fades to the new face.
      const el = this.renderer.domElement;
      el.style.transition = 'none'; el.style.opacity = '0.15'; void el.offsetWidth;
      el.style.transition = 'opacity 220ms ease'; el.style.opacity = '1';
      this.tween = null; this.rot = target; this.opts.onFace(this.face, true); this.invalidate();
      return;
    }
    this.tween = { from: this.rot, to: target, t0: performance.now(), dur: 350 };
    this.invalidate();
  }

  /** Turn to a lens by the shortest way round. */
  setLens(k: number) {
    const base = -k * QUARTER, turns = Math.round((this.rot - base) / (2 * Math.PI));
    const target = base + turns * 2 * Math.PI;
    if (Math.abs(target - this.rot) < 1e-4 && !this.tween) return;
    this.turnTo(target);
  }

  select(i: number) {
    this.selected = i >= 0 && i < this.n ? i : -1;
    if (this.selBox) { this.tower.remove(this.selBox); this.selBox.geometry.dispose(); (this.selBox.material as THREE.Material).dispose(); this.selBox = null; }
    if (this.selected < 0) { this.selLabel.style.display = 'none'; this.invalidate(); return; }
    const f = this.model.floors[this.selected], w = this.w[this.selected] + 0.3;
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, H, w));
    this.selBox = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: hex(0xffffff, 1.6), toneMapped: false }));
    this.selBox.position.set(0, this.selected * H + H / 2, 0);
    this.tower.add(this.selBox);
    this.selLabel.textContent = f.partnerAge != null ? `${f.age} · ${f.partnerAge}` : String(f.age);
    this.selLabel.style.display = '';
    this.invalidate();
  }

  // ── Gestures ────────────────────────────────────────────────────────────
  private onDown = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom }; this.drag = null;
    } else if (this.pointers.size === 1) {
      this.tween = null;
      this.drag = { x: e.clientX, y: e.clientY, rot: this.rot, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      this.zoom = Math.max(0.8, Math.min(2.5, this.pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d)));
      this.fit(); this.invalidate(); return;
    }
    const d = this.drag; if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    d.moved = true;
    // The surface follows the finger: 60% of the width turns one face.
    this.rot = d.rot + dx * (QUARTER / (this.cw * 0.6));
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = ((e.clientX - d.lastX) * (QUARTER / (this.cw * 0.6))) / dt; d.lastX = e.clientX; d.lastT = e.timeStamp;
    this.opts.onFace(this.face, false);
    this.invalidate();
  };

  private onUp = (e: PointerEvent) => {
    const had = this.pointers.delete(e.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.drag = null; return; }
    const d = this.drag; this.drag = null;
    if (!had || !d || e.type === 'pointercancel') { if (d?.moved) this.turnTo(Math.round(this.rot / QUARTER) * QUARTER); return; }
    if (d.moved) {
      // Snap to the nearest face, leaning the way the finger was going.
      this.turnTo(Math.round((this.rot + d.v * 120) / QUARTER) * QUARTER);
      return;
    }
    const now = e.timeStamp;
    if (now - this.lastTap < 320) { this.lastTap = 0; this.zoom = 1; this.fit(); this.setLens(0); this.invalidate(); return; }
    this.lastTap = now;
    const r = this.host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      const p = this.floorOnScreen(i);
      if (x < p.minX - 28 || x > p.maxX + 28) continue;
      const dy = Math.abs(p.y - y); if (dy < bd) { bd = dy; best = i; }
    }
    if (best >= 0 && bd < 26) this.opts.onSelect(best);
  };

  private onLost = (e: Event) => { e.preventDefault(); this.opts.onLost(); };
  private onVisible = () => { if (!document.hidden) this.invalidate(); };

  dispose() {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.idle) clearInterval(this.idle);
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVisible);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown); el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp); el.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('webglcontextlost', this.onLost);
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose?.();
    });
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.composer.dispose();
    this.renderer.dispose();
    el.remove();
    this.overlay.replaceChildren();
  }
}

function lines(positions: number[], colour: number, opacity: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity }));
  l.frustumCulled = false;
  return l;
}

/** Dark navy, a little lighter towards the foot of the tower. */
function backdrop() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const x = c.getContext('2d')!, g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#060B1A'); g.addColorStop(1, '#0B1430');
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
