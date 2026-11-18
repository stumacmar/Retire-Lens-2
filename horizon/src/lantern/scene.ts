import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { LanternModel, SourceKey, WindowState } from './model';
import { MEDIAN_WINDOW, WINDOWS } from './adapter';

/**
 * The Lantern, drawn: a four-sided glass tower of retirement years. One
 * floor a year; the width of a floor is that year's planned spend, so the
 * tower steps in where spending steps down. Each face is a flat chart read
 * square-on, and turning the tower is how the lens changes:
 *
 *   0 front  "Will it pay?"         20 windows a floor, worst future to best
 *   1 right  "Where it comes from"  the central case's spending by source
 *   2 back   "What's left"          money left: middle bar, 10th to 90th halo
 *   3 left   "Stress"               the windows again, under the stress
 *
 * The floor you tap opens up: it and its neighbours grow taller, so its 20
 * windows are large enough to count and their states can be told apart by
 * shape as well as colour (full height, half height, dark with an ember
 * foot). The other floors stay slim: texture that shows where the lights go
 * out, not marks to be read one by one.
 *
 * Framework-free: it is given a host element, an overlay for text labels and
 * a view model, and knows nothing about React or the engine.
 */
const W0 = 20;          // width of the widest floor, in window cells
const GAP = 0.4;        // dark band between one floor's windows and the next
const EPS = 0.03;       // how far face content sits outside the glass
const FOV = 22;
const TILT = (8 * Math.PI) / 180;   // seen slightly from below
const QUARTER = Math.PI / 2;
/** Height of the open floor, its neighbours and theirs; every other floor is 1. */
const OPEN = [3.4, 1.7, 1.25];
const EXTRA = (OPEN[0] - 1) + 2 * (OPEN[1] - 1) + 2 * (OPEN[2] - 1);
/** Outward normal of each face as (x, z). */
const NORMALS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
/** Which corners carry which State Pension: one of each on every face. */
const CORNERS: Record<'sp' | 'partnerSp', [number, number][]> = { sp: [[-1, 1], [1, -1]], partnerSp: [[1, 1], [-1, -1]] };

const hex = (h: number, k = 1) => new THREE.Color(h).multiplyScalar(k);
const WHITE = new THREE.Color(1, 1, 1);
const COL = {
  full: hex(0xffb02e, 0.95),
  floor: hex(0xcfe0ff, 0.62),
  short: hex(0x0b1226, 1),
  ember: hex(0xe2553a, 0.85),
  median: hex(0xffffff, 0.9),
  halo: hex(0x4f74d8, 0.62),
  wealth: hex(0x8fdcff, 0.95),
  marker: hex(0xffffff, 1.0),
};
const SOURCE_COL: Record<SourceKey, THREE.Color> = {
  pension: hex(0x3fd8ff, 0.8), isa: hex(0xf2d06b, 0.8), cash: hex(0xb9c2d0, 0.7), scheme: hex(0xffa62e, 0.9),
  work: hex(0x55e08a, 0.85), sp: hex(0x9a6bff, 0.95), partnerSp: hex(0xcdb4ff, 0.8),
};
const STRIP_COL = { sp: SOURCE_COL.sp.clone().multiplyScalar(0.8), partnerSp: SOURCE_COL.partnerSp.clone().multiplyScalar(0.75) };
const RANK: Record<WindowState, number> = { short: 0, floor: 1, full: 2 };

type Inst = { m: THREE.Matrix4; c: THREE.Color };
type Layer = 'quads' | 'frames' | 'glass' | 'rims' | 'strips' | 'stone' | 'amber';

export type SceneOpts = {
  reducedMotion: boolean;
  /** The home's panel: the left 43% is kept clear for the answer and the key, so the tower stands in the right 57% with its age labels on its right. */
  compact?: boolean;
  /** The face nearest the camera; `settled` once the tower is at rest on it. */
  onFace: (face: number, settled: boolean) => void;
  onSelect: (floor: number) => void;
  onLost: () => void;
};

const UP = new THREE.Vector3(0, 1, 0), NOROT = new THREE.Quaternion();

export class LanternScene {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 600);
  private tower = new THREE.Group();
  private dust: THREE.Points | null = null;
  private meshes = new Map<Layer, THREE.InstancedMesh>();
  private edges: THREE.LineSegments | null = null;
  private labels: { el: HTMLSpanElement; floor: number }[] = [];
  private selLabel: HTMLSpanElement;
  private n = 0;
  private w: number[] = [];
  private maxSpend = 1;
  private h: number[] = []; private y: number[] = []; private total = 0;
  private grow: { from: number[]; to: number[]; t0: number; dur: number } | null = null;
  private cw = 1; private ch = 1;
  private rot = 0; private zoom = 1;
  private turn: { from: number; to: number; t0: number; dur: number } | null = null;
  private raf = 0; private idle = 0;
  private selected = -1;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; rot: number; moved: boolean; lastX: number; lastT: number; v: number } | null = null;
  private pinch: { d: number; zoom: number } | null = null;
  private lastTap = 0;
  private ro: ResizeObserver;
  private disposed = false;

  constructor(private host: HTMLElement, private overlay: HTMLElement, private model: LanternModel, private opts: SceneOpts) {
    this.load(model);

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
    this.buildDust();
    this.buildLabels();
    this.selLabel = this.makeLabel(true);
    this.selLabel.style.display = 'none';
    this.apply();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.28, 0.34));
    this.composer.addPass(new OutputPass());

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

  // ── The model ───────────────────────────────────────────────────────────
  private load(model: LanternModel) {
    this.model = model;
    this.n = model.floors.length;
    this.maxSpend = Math.max(1, ...model.floors.map(f => f.spend));
    this.w = model.floors.map(f => Math.max(4, (W0 * f.spend) / this.maxSpend));
    if (this.selected >= this.n) this.selected = -1;
    this.setHeights(this.heightsFor(this.selected));
  }

  /** A new plan or new futures: the same renderer, a rebuilt tower. The open floor stays open where it still exists. */
  setModel(model: LanternModel) {
    if (this.disposed || model === this.model) return;
    this.meshes.forEach(m => { this.tower.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
    this.meshes.clear();
    if (this.edges) { this.tower.remove(this.edges); this.edges.geometry.dispose(); (this.edges.material as THREE.Material).dispose(); this.edges = null; }
    for (const l of this.labels) l.el.remove();
    this.labels = []; this.grow = null;
    this.load(model);
    this.buildLabels(); this.nameSelected();
    this.apply(); this.fit(); this.invalidate();
  }

  private nameSelected() {
    const f = this.selected >= 0 ? this.model.floors[this.selected] : null;
    if (f) { this.selLabel.textContent = f.partnerAge != null ? `${f.age} · ${f.partnerAge}` : String(f.age); this.selLabel.style.display = ''; }
    else this.selLabel.style.display = 'none';
  }

  // ── Layout: how tall each floor is ──────────────────────────────────────
  private setHeights(h: number[]) {
    this.h = h; let y = 0;
    this.y = h.map(v => { const b = y; y += v; return b; });
    this.total = y;
  }

  private heightsFor(sel: number) {
    return this.model.floors.map((_f, i) => { const d = Math.abs(i - sel); return sel >= 0 && d < OPEN.length ? OPEN[d] : 1; });
  }

  // ── Composing the tower for the current layout ──────────────────────────
  private quad(face: number, floor: number, u: number, yc: number, sx: number, sy: number, c: THREE.Color, out = 0): Inst {
    const [nx, nz] = NORMALS[face], d = this.w[floor] / 2 + EPS + out;
    return {
      m: new THREE.Matrix4().compose(
        new THREE.Vector3(nx * d + nz * u, yc, nz * d - nx * u),
        new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(nx, nz)),
        new THREE.Vector3(sx, sy, 1)),
      c,
    };
  }

  private box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c?: THREE.Color): Inst {
    return { m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), NOROT, new THREE.Vector3(sx, sy, sz)), c: c || WHITE };
  }

  private compose() {
    const M = this.model, F = M.floors, n = this.n;
    const L: Record<Layer, Inst[]> = { quads: [], frames: [], glass: [], rims: [], strips: [], stone: [], amber: [] };
    const edge: number[] = [];
    const wMin = Math.min(...this.w);
    const maxP90 = Math.max(1, ...F.map(f => f.wealth.p90)), wScale = (wMin * 0.94) / maxP90, u0 = -(wMin * 0.94) / 2;

    const windowsOn = (face: number, i: number, states: WindowState[], base?: WindowState[]) => {
      const cw = this.w[i] / WINDOWS, body = this.h[i] - GAP, yb = this.y[i] + GAP / 2, mid = yb + body / 2;
      states.forEach((s, j) => {
        const u = (j - (WINDOWS - 1) / 2) * cw;
        // Never colour alone: an essentials-only window is half the height and narrower; a dark one has an ember foot.
        if (s === 'full') L.quads.push(this.quad(face, i, u, mid, cw * 0.68, body, COL.full));
        else if (s === 'floor') L.quads.push(this.quad(face, i, u, yb + body * 0.25, cw * 0.5, body * 0.5, COL.floor));
        else {
          L.quads.push(this.quad(face, i, u, mid, cw * 0.68, body, COL.short));
          L.quads.push(this.quad(face, i, u, yb + 0.04, cw * 0.68, 0.08, COL.ember, 0.005));
        }
        // The ghost of the base plan: an outline where a light that was on has dimmed or gone out.
        if (base && RANK[s] < RANK[base[j]]) L.frames.push(this.quad(face, i, u, mid, cw * 0.82, (body + 0.08) / 0.962, (base[j] === 'full' ? COL.full : COL.floor).clone().multiplyScalar(0.7), 0.012));
        // The middle future, marked on the open floor only.
        if (i === this.selected && j === MEDIAN_WINDOW) L.frames.push(this.quad(face, i, u, mid, cw * 0.99, (body + 0.26) / 0.962, COL.median, 0.016));
      });
    };

    F.forEach((f, i) => {
      const w = this.w[i], hh = this.h[i], y0 = this.y[i], body = hh - GAP, mid = y0 + hh / 2;
      windowsOn(0, i, f.windows);
      windowsOn(3, i, f.stress, f.windows);

      // Face 1: the central case's spending by source, left to right; a gap at the right is a shortfall.
      // (A structured plan's rules can raise spending above the plan in good futures; the row is then scaled to fit.)
      const scale = (w * 0.94) / Math.max(1, f.spend, f.sources.reduce((a, s) => a + s.amount, 0)); let x = -(w * 0.94) / 2;
      for (const s of f.sources) {
        const len = s.amount * scale;
        if (len > 0.12) L.quads.push(this.quad(1, i, x + len / 2, mid, len - 0.06, body, SOURCE_COL[s.key]));
        x += len;
      }

      // Face 2: money left. A halo from the 10th to the 90th percentile, the middle as a bright bar.
      const { p10, p50, p90 } = f.wealth;
      if (p90 > p10) L.quads.push(this.quad(2, i, u0 + ((p10 + p90) / 2) * wScale, mid, Math.max(0.1, (p90 - p10) * wScale), body, COL.halo));
      if (p50 > 0) L.quads.push(this.quad(2, i, u0 + (p50 / 2) * wScale, mid, Math.max(0.1, p50 * wScale), body * 0.45, COL.wealth, 0.01));
      if (i === n - 1) L.quads.push(this.quad(2, i, u0 + p50 * wScale, mid, 0.34, body + 0.3, COL.marker, 0.02));

      // Glass: a low-opacity box, a rim under it (not a slab, so nothing hides the floor above), bright corner edges.
      L.glass.push(this.box(0, mid, 0, w, hh * 0.98, w));
      for (const sgn of [-1, 1]) { L.rims.push(this.box(0, y0, sgn * w / 2, w + 0.12, 0.05, 0.12)); L.rims.push(this.box(sgn * w / 2, y0, 0, 0.12, 0.05, w + 0.12)); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) edge.push(sx * w / 2, y0, sz * w / 2, sx * w / 2, y0 + hh, sz * w / 2);

      // The State Pensions: strips of light up the corners from the year each starts, as thick as the income.
      for (const sp of M.spines) {
        if (i < sp.fromFloor) continue;
        const side = Math.max(0.16, Math.min(0.42, ((W0 * sp.income) / this.maxSpend) * 0.07));
        for (const [sx, sz] of CORNERS[sp.key]) L.strips.push(this.box(sx * (w / 2 + side / 2), mid, sz * (w / 2 + side / 2), side, hh, side, STRIP_COL[sp.key]));
      }
    });
    const wt = this.w[n - 1];
    for (const sgn of [-1, 1]) { L.rims.push(this.box(0, this.total, sgn * wt / 2, wt + 0.12, 0.08, 0.12)); L.rims.push(this.box(sgn * wt / 2, this.total, 0, 0.12, 0.08, wt + 0.12)); }

    // The ground, and a structured plan's safe ladder: stone buttresses as tall as the years it holds, capped in amber.
    L.stone.push(this.box(0, -0.25, 0, W0 + 4.4, 0.5, W0 + 4.4));
    const lf = Math.min(n, M.ladderFloors), gh = lf > 0 ? this.y[lf - 1] + this.h[lf - 1] : 0, c = W0 / 2 + 1.35;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      L.stone.push(this.box(sx * c, gh / 2, sz * c, 1.3, Math.max(0.001, gh), 1.3));
      L.amber.push(this.box(sx * c, gh + 0.05, sz * c, 1.3, gh > 0 ? 0.1 : 0.001, 1.3));
    }
    return { L, edge };
  }

  /** Write the composed tower into the meshes (made on first use; the counts never change after that). */
  private apply() {
    const { L, edge } = this.compose();
    const make = (layer: Layer): THREE.InstancedMesh => {
      const cap = L[layer].length + (layer === 'frames' ? 2 : 0);
      const geo = layer === 'quads' ? new THREE.PlaneGeometry(1, 1) : layer === 'frames' ? new THREE.RingGeometry(0.6, 0.68, 4, 1, Math.PI / 4) : new THREE.BoxGeometry(1, 1, 1);
      const mat = layer === 'glass' ? new THREE.MeshBasicMaterial({ color: 0x1c2f66, transparent: true, opacity: 0.16, depthWrite: false })
        : layer === 'rims' ? new THREE.MeshBasicMaterial({ color: 0x3a52a0 })
          : layer === 'stone' ? new THREE.MeshLambertMaterial({ color: 0x6e5536, emissive: 0x1c1004 })
            : layer === 'amber' ? new THREE.MeshBasicMaterial({ color: hex(0xffb347, 0.9), toneMapped: false })
              : new THREE.MeshBasicMaterial({ toneMapped: false });
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, cap));
      mesh.frustumCulled = false;
      this.tower.add(mesh); this.meshes.set(layer, mesh);
      return mesh;
    };
    (Object.keys(L) as Layer[]).forEach(layer => {
      const mesh = this.meshes.get(layer) || make(layer), list = L[layer];
      const count = Math.min(list.length, mesh.instanceMatrix.count);
      for (let i = 0; i < count; i++) { mesh.setMatrixAt(i, list[i].m); mesh.setColorAt(i, list[i].c); }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    if (!this.edges) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
      this.edges = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0.6 }));
      this.edges.frustumCulled = false; this.tower.add(this.edges);
    } else {
      const a = this.edges.geometry.getAttribute('position') as THREE.BufferAttribute;
      (a.array as Float32Array).set(edge); a.needsUpdate = true;
    }
  }

  private buildDust() {
    if (this.opts.reducedMotion) return;
    const p: number[] = []; let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 240; i++) p.push((rnd() - 0.5) * 70, -8 + rnd() * (this.n + 16), (rnd() - 0.5) * 70);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8ea4e6, size: 1.1 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false, transparent: true, opacity: 0.3, depthWrite: false }));
    this.scene.add(this.dust);
  }

  /** Age labels (text stays in the page, so it is crisp and the glow never touches it). */
  private buildLabels() {
    const F = this.model.floors;
    F.forEach((f, i) => {
      const step = i > 0 && f.spend !== F[i - 1].spend;
      if (!(f.age % 5 === 0 || step || i === 0 || i === this.n - 1)) return;
      if (i > 0 && this.labels.length && this.labels[this.labels.length - 1].floor === i - 1) return;   // never two on adjacent floors
      const el = this.makeLabel(false);
      el.textContent = f.partnerAge != null ? `${f.age} · ${f.partnerAge}` : String(f.age);
      this.labels.push({ el, floor: i });
    });
  }

  private makeLabel(strong: boolean) {
    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums;line-height:1;` +
      (strong ? 'font-size:11px;font-weight:700;color:#ffffff;background:#16224a;border-radius:6px;padding:3px 5px;' : 'font-size:10px;font-weight:600;color:#9fb0d9;');
    this.overlay.appendChild(el);
    return el;
  }

  // ── Camera and drawing ──────────────────────────────────────────────────
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
    // Framed for the tallest the tower gets (a floor open), so opening a floor never rescales it.
    const top = this.n + EXTRA + 0.4, bottom = -0.5;
    const t = Math.tan((FOV * Math.PI) / 360);
    const halfH = ((top - bottom) / 2) * 1.14, halfW = W0 / 2 + 2.3;   // the near face stands taller than the axis
    // Room on both sides for the age labels, so the tower stays centred.
    const compact = !!this.opts.compact, LEFT = 0.43, LABELS = 50;
    const region = compact ? this.cw * (1 - LEFT) : this.cw;
    const room = Math.max(0.2, (region - (compact ? LABELS + 8 : 108)) / this.ch);
    const d = Math.max(halfH / t, halfW / (t * room)) / this.zoom;
    const cy = (top + bottom) / 2;
    // Compact: the tower is centred in what is left of the right-hand region once its labels have their room.
    const centrePx = compact ? this.cw * LEFT + (region - LABELS) / 2 : this.cw / 2;
    const shift = -((centrePx - this.cw / 2) * 2 * d * t) / this.ch;
    this.camera.position.set(shift, cy - d * Math.sin(TILT), d * Math.cos(TILT));
    this.camera.lookAt(shift, cy, 0);
    this.camera.updateProjectionMatrix();
  }

  private project(x: number, y: number, z: number, local: boolean) {
    const v = new THREE.Vector3(x, y, z);
    if (local) v.applyMatrix4(this.tower.matrixWorld);
    v.project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.cw, (-v.y * 0.5 + 0.5) * this.ch] as [number, number];
  }

  /** A floor on screen: its vertical extent on the surface facing the camera, and its left and right silhouette. */
  private floorOnScreen(i: number) {
    const w = this.w[i], y0 = this.y[i], y1 = y0 + this.h[i], yc = (y0 + y1) / 2;
    const o = i < this.model.ladderFloors ? W0 + 4 : w + 1;   // clear the buttresses and the corner strips
    let minX = Infinity, maxX = -Infinity;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [x] = this.project(sx * o / 2, yc, sz * o / 2, true); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const [, top] = this.project(0, y1, w / 2, false), [, bot] = this.project(0, y0, w / 2, false);
    return { minX, maxX, top, bot, y: (top + bot) / 2 };
  }

  private place(el: HTMLSpanElement, i: number) {
    const p = this.floorOnScreen(i);
    el.style.transform = this.opts.compact
      ? `translate(${Math.round(p.maxX + 5)}px, ${Math.round(p.y)}px) translate(0, -50%)`
      : `translate(${Math.round(p.minX - 6)}px, ${Math.round(p.y)}px) translate(-100%, -50%)`;
  }

  private draw() {
    this.tower.rotation.y = this.rot;
    this.tower.updateMatrixWorld(true);
    this.composer.render();
    for (const l of this.labels) {
      const near = this.selected >= 0 && Math.abs(l.floor - this.selected) <= 1;
      l.el.style.visibility = near ? 'hidden' : 'visible'; this.place(l.el, l.floor);
    }
    if (this.selected >= 0) this.place(this.selLabel, this.selected);
  }

  private frame = (t: number) => {
    this.raf = 0;
    if (this.disposed) return;
    let moving = false;
    if (this.turn) {
      const k = Math.min(1, Math.max(0, (t - this.turn.t0) / this.turn.dur)), e = 1 - Math.pow(1 - k, 3);
      this.rot = this.turn.from + (this.turn.to - this.turn.from) * e;
      if (k >= 1) { this.turn = null; this.opts.onFace(this.face, true); } else { moving = true; this.opts.onFace(this.face, false); }
    }
    if (this.grow) {
      const g = this.grow, k = Math.min(1, Math.max(0, (t - g.t0) / g.dur)), e = 1 - Math.pow(1 - k, 3);
      this.setHeights(g.to.map((v, i) => g.from[i] + (v - g.from[i]) * e));
      this.apply();
      if (k >= 1) this.grow = null; else moving = true;
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
      this.turn = null; this.rot = target; this.opts.onFace(this.face, true); this.invalidate();
      return;
    }
    this.turn = { from: this.rot, to: target, t0: performance.now(), dur: 350 };
    this.invalidate();
  }

  /** Turn to a lens by the shortest way round. */
  setLens(k: number) {
    const base = -k * QUARTER, turns = Math.round((this.rot - base) / (2 * Math.PI));
    const target = base + turns * 2 * Math.PI;
    if (Math.abs(target - this.rot) < 1e-4 && !this.turn) return;
    this.turnTo(target);
  }

  /** Open a floor: it and its neighbours grow, the rest stay slim. */
  select(i: number) {
    const next = i >= 0 && i < this.n ? i : -1;
    if (next === this.selected && !this.grow) return;
    this.selected = next;
    this.nameSelected();
    const to = this.heightsFor(next);
    if (this.opts.reducedMotion) { this.grow = null; this.setHeights(to); this.apply(); }
    else this.grow = { from: this.h.slice(), to, t0: performance.now(), dur: 260 };
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
      this.turn = null;
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
      const dy = y < p.top ? p.top - y : y > p.bot ? y - p.bot : 0;
      if (dy < bd) { bd = dy; best = i; }
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

/** Dark navy, a little lighter towards the foot of the tower. */
function backdrop() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const x = c.getContext('2d')!, g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#060B1A'); g.addColorStop(1, '#0B1430');
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
