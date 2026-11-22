import * as THREE from 'three';
import { Stage, bakeMoon, phaseMaterial, setChange, setPhase } from './stage';

/**
 * The moon. The share of it that is lit is the share of your futures in
 * which the money lasts: full is certain, half is a coin toss, a sliver is a
 * long shot. Everyone has read a moon. Change when you stop or what you ask
 * and the light moves across it.
 *
 * Depth is time. Open the moon and it becomes the years of your retirement,
 * a row of moons, full while every future still pays and darkening where
 * they stop. Press an age and a large moon lifts out of it, lit as that age
 * is, and is read out in words.
 *
 *   level 0  the answer      one moon
 *   level 1  the years       the phases in a row
 *   level 2  one year        a large moon above the whole row, with its words
 *
 * (The first version sent the row away into the distance. All three lay
 * readers took the smaller moons to mean less money, so the row is level.)
 *
 * The scene fills the whole home, so its glow has no edge; the moon itself
 * is laid out inside `frame`, an empty box in the page's own layout, so it
 * always sits clear of the words whatever the size of the screen.
 */
export type MoonData = { p: number; years: { age: number; p: number }[] };
type Year = { mesh: THREE.Mesh; age: number; p: number; label: HTMLSpanElement; pos: THREE.Vector3; r: number; flash: number };

export class MoonStage extends Stage {
  private geo = new THREE.SphereGeometry(1, 96, 64);
  private main: THREE.Mesh;
  private halo: THREE.Mesh;
  private stars: THREE.Points;
  private years: Year[] = [];
  private level = 0; private sel = -1;
  private mainR = 0.0001; private pNow: number;
  private mainAt = new THREE.Vector3(); private placed = false;
  private flash = 0; private rose = 1;
  private spare = 0; private spareNow = 0;
  private box = { cx: 0, cy: 0, w: 1, h: 1 };
  private boxRo: ResizeObserver;
  private surface: THREE.WebGLRenderTarget;

  constructor(host: HTMLElement, overlay: HTMLElement, private frameEl: HTMLElement, private data: MoonData, private on: (level: number, sel: number) => void) {
    // A long lens (6 degrees, from far away): with a wide one, a moon at the right-hand end of the row is seen a little
    // from its dark side and looks less lit than its count (a reader caught it: "the moon marked 57 looks less than half").
    super(host, overlay, { fov: 6, distance: 46, bloom: [0.16, 0.5, 0.9] });
    this.surface = bakeMoon(this.renderer);
    // The light comes across the moon as the count counts up: it starts dark (unless motion is unwelcome).
    this.pNow = this.reduced ? data.p : 0;
    this.main = new THREE.Mesh(this.geo, phaseMaterial(this.pNow, this.surface.texture));
    this.scene.add(this.main);
    // The moon's own light in the night air: a soft glow behind it, as strong as the moon is lit.
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 }, uP: { value: 0 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // It comes off the lit side only: all round a full moon, to the right of a half one, almost nothing from a dark one.
      fragmentShader: 'uniform float uK; uniform float uP; varying vec2 vU; void main(){ float d = length(vU); float a = pow(max(0.0, 1.0 - d), 3.0); float side = vU.x / max(d, 0.001), cover = 2.0 * uP - 1.0; float w = smoothstep(-cover - 0.9, -cover + 0.1, side); gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a * w * uK, 1.0); }',
    }));
    this.halo.position.z = -0.5; this.scene.add(this.halo);
    // A few faint stars, far behind, thinning out toward the middle of the sky, so none sits beside a label or a word (a critic: "stars land beside the numerals and read as punctuation"). The same sky every time.
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const N = 220, pos = new Float32Array(N * 3), tw = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = rnd(); pos[i * 3 + 1] = rnd(); pos[i * 3 + 2] = 0; tw[i] = rnd(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() }, uFoot: { value: 0.5 } },
      // Positions are fractions of the sky (x across, y down from the top to the foot of the moon's box), so it fits any screen.
      vertexShader: 'attribute float aTw; uniform float uT; uniform float uPx; uniform float uFoot; varying float vA; void main(){ float big = pow(aTw, 6.0); vA = (0.1 + 0.16 * aTw + 0.6 * big) * (0.85 + 0.15 * sin(uT * (0.4 + aTw) + aTw * 40.0)) * smoothstep(0.62, 0.2, position.y); gl_PointSize = (0.9 + 0.5 * aTw + 1.5 * big) * uPx; gl_Position = vec4(position.x * 2.0 - 1.0, 1.0 - position.y * uFoot * 2.0, 0.999, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), vA * smoothstep(0.5, 0.1, d)); }',
    }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -1; this.scene.add(this.stars);
    this.build();
    this.boxRo = new ResizeObserver(() => this.fit()); this.boxRo.observe(frameEl);
    this.start();
  }

  private build() {
    for (const y of this.years) { this.scene.remove(y.mesh); (y.mesh.material as THREE.Material).dispose(); y.label.remove(); }
    const c = this.at(this.box.cx, this.box.cy);
    this.years = this.data.years.map(y => {
      const mesh = new THREE.Mesh(this.geo, phaseMaterial(y.p, this.surface.texture, { bump: 0.45 }));   // small: the relief is quieter
      mesh.scale.setScalar(0.0001); mesh.position.copy(c); this.scene.add(mesh);
      // The age, and under it how many times in 100 the money is still paying then: all three readers asked for the number.
      const label = this.label('visibility:hidden;text-align:center;');
      label.dataset.yearAge = String(y.age);
      label.innerHTML = `<b style="display:block;font-size:16px;font-weight:700">${y.age}</b><span data-n style="display:block;font-size:13px">${Math.round(y.p * 100)}</span>`;
      return { mesh, age: y.age, p: y.p, label, pos: c.clone(), r: 0.0001, flash: 0 };
    });
  }

  /** How much is to spare beyond a full moon, 0 to 1: the glow widens and brightens with it. */
  setSpare(v: number) { this.spare = Math.max(0, Math.min(1, v || 0)); }

  /** New figures (a stepper moved): the light moves across the moon; the years are rebuilt where they are. */
  setData(data: MoonData) {
    const same = data.years.length === this.data.years.length && data.years.every((y, i) => y.age === this.data.years[i].age);
    // The change shows itself (see the shader): the large moon from what it is showing now, each year from what it showed.
    if (!this.reduced && this.level === 0 && Math.abs(data.p - this.data.p) > 0.004) { this.flash = 1; this.rose = data.p > this.data.p ? 1 : -1; setChange(this.main.material as THREE.ShaderMaterial, this.pNow, 1); }
    this.data = data;
    if (same) this.years.forEach((y, i) => { const was = y.p; y.p = data.years[i].p; const m = y.mesh.material as THREE.ShaderMaterial;
      if (!this.reduced && Math.abs(y.p - was) > 0.004) { y.flash = 1; setChange(m, was, 1); }
      setPhase(m, y.p); const n = y.label.querySelector('[data-n]'); if (n) n.textContent = String(Math.round(y.p * 100)); });
    else { const open = this.level === 2; this.build(); if (open) this.setLevel(2, this.years.length - 1); }
  }

  // ── Layout, in the page's own pixels ────────────────────────────────────────
  protected fit() {
    const b = this.frameEl.getBoundingClientRect(), o = this.host.getBoundingClientRect();
    this.box = { cx: b.left - o.left + b.width / 2, cy: b.top - o.top + b.height / 2, w: Math.max(1, b.width), h: Math.max(1, b.height) };
    if (this.stars) (this.stars.material as THREE.ShaderMaterial).uniforms.uFoot.value = Math.min(1, (b.bottom - o.top) / Math.max(1, o.height));
  }
  /** World units to a pixel, at the depth everything is drawn at. */
  private get u() { return (2 * this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360)) / this.h; }
  private at(px: number, py: number) { const u = this.u; return new THREE.Vector3((px - this.w / 2) * u, (this.h / 2 - py) * u, 0); }
  private get rowPx() { return Math.min(26, (this.box.w * 0.94) / Math.max(1, this.years.length) / 2.2); }
  /** The one moon at rest: room above it for the name and below it for the count. */
  private get restPx() { return Math.min(this.box.w * 0.36, this.box.h * 0.45); }
  private get chosenPx() { return Math.min(this.box.w * 0.19, this.box.h * 0.22); }
  /**
   * Where a year's moon sits: a level row, the day you stop on the left. (It was a shallow arc; three of four
   * readers asked whether the height meant something.) It stands at the foot of the box, just above its words, whether or not an age is chosen (it used to jump down when one was).
   */
  private homePx(i: number) {
    const b = this.box, n = this.years.length, t = n > 1 ? i / (n - 1) : 0.5, r = this.rowPx, half = b.w / 2 - r - 6;
    return { x: b.cx - half + 2 * half * t, y: b.cy + b.h / 2 - 44 - r };
  }

  /**
   * Two levels since 22 November 2026: the answer (0), and the years with one age chosen (2). Opening the years chooses
   * the last age, which is the headline count: the one moon shrinks and travels to stand above it, so there is never
   * an empty sky where it was (a reader: "it looked like something had failed to load"), and no screen that only says
   * "press one". Level 1, the row with nothing chosen, is no longer reached.
   */
  setLevel(level: number, sel = -1) { this.level = level; this.sel = level === 2 ? sel : -1; this.on(this.level, this.sel); }

  protected update(t: number, dt: number) {
    const u = this.u, b = this.box, c = this.at(b.cx, b.cy);
    // The one large moon is the answer (level 0), then the last year of the row, which is the same count (level 1),
    // then whichever year is chosen, lifted above the row (level 2). It never vanishes; the light moves across it.
    const n = this.years.length, open0 = this.level >= 1 && n > 0, year = this.level === 2 ? this.years[this.sel] : undefined;
    const lastPx = open0 ? this.homePx(n - 1) : null;
    const goal = year ? this.at(Math.max(b.cx - b.w / 2 + this.chosenPx, Math.min(b.cx + b.w / 2 - this.chosenPx, this.homePx(this.sel).x)), b.cy - b.h / 2 + this.chosenPx + 6) : lastPx ? this.at(lastPx.x, lastPx.y) : new THREE.Vector3(c.x, c.y + (this.reduced ? 0 : Math.sin(t * 0.6) * 3 * u), 0);
    const goalR = (year ? this.chosenPx : open0 ? this.rowPx : this.restPx) * u;
    this.pNow = this.ease(this.pNow, year ? year.p : this.data.p, dt, 3.5); setPhase(this.main.material as THREE.ShaderMaterial, this.pNow);
    this.mainR = this.ease(this.mainR, goalR, dt, 6);
    this.mainAt.set(this.ease(this.mainAt.x, goal.x, dt, 6), this.ease(this.mainAt.y, goal.y, dt, 6), 0.02);
    if (!this.placed) { this.mainAt.set(goal.x, goal.y, 0.02); this.placed = this.box.w > 1; }
    this.main.scale.setScalar(this.mainR); this.main.position.copy(this.mainAt);
    // How lit the large moon is drawn this frame, of 100: the tests wait for it before they photograph the screen.
    const drawn = String(Math.round(this.pNow * 100)); if (this.host.dataset.lit !== drawn) this.host.dataset.lit = drawn;
    this.main.rotation.y = this.reduced ? 0 : Math.sin(t * 0.05) * 0.25;
    // In the row, once it has arrived, the last year's own moon stands in for it.
    const arrived = this.level === 1 && n > 0 && Math.abs(this.mainR - goalR) < goalR * 0.06 && this.mainAt.distanceTo(goal) < goalR * 0.3;
    this.main.visible = !arrived;
    this.halo.position.set(this.main.position.x, this.main.position.y, -0.5); this.spareNow = this.ease(this.spareNow, this.level === 0 ? this.spare : 0, dt, 3); this.halo.scale.setScalar(this.mainR * (2.2 + 0.9 * this.spareNow)); this.halo.visible = this.main.visible;
    // The mark of a change fades over a couple of seconds; the glow swells with a gain and sinks with a loss while it does.
    this.flash = this.flash < 0.01 ? 0 : this.flash * Math.exp(-dt * 0.9); setChange(this.main.material as THREE.ShaderMaterial, null, this.level === 0 ? this.flash : 0);
    // The whole face answers too: a little brighter for a gain, a little dimmer for a loss, while the mark lasts.
    (this.main.material as THREE.ShaderMaterial).uniforms.uGain.value = 1 + (this.level === 0 ? 0.22 * this.flash * this.rose : 0);
    const hu = (this.halo.material as THREE.ShaderMaterial).uniforms; hu.uK.value = (0.03 + 0.36 * this.pNow) * (1 + 0.9 * this.flash * this.rose) * (1 + 0.7 * this.spareNow); hu.uP.value = this.pNow;
    (this.stars.material as THREE.ShaderMaterial).uniforms.uT.value = this.reduced ? 0 : t;
    this.years.forEach((y, i) => {
      const open = this.level >= 1, chosen = this.level === 2 && i === this.sel, h = this.homePx(i);
      const to = !open ? c : this.at(h.x, h.y);
      y.pos.set(this.ease(y.pos.x, to.x, dt, 5), this.ease(y.pos.y, to.y, dt, 5), 0);
      y.r = this.ease(y.r, open ? this.rowPx * u : 0.0001, dt, 5);
      y.mesh.position.copy(y.pos); y.mesh.scale.setScalar(y.r); y.mesh.visible = y.r > 0.01 && (i < n - 1 || this.level !== 1 || !this.main.visible);
      if (y.flash > 0) { y.flash = y.flash < 0.01 ? 0 : y.flash * Math.exp(-dt * 0.9); setChange(y.mesh.material as THREE.ShaderMaterial, null, y.flash); }
      const dim = (y.mesh.material as THREE.ShaderMaterial).uniforms.uDim;
      dim.value = this.ease(dim.value, this.level === 2 && !chosen ? 0.72 : 1, dt, 6);
    });
  }

  protected layout() {
    const r = this.rowPx;
    this.years.forEach((y, i) => {
      const h = this.homePx(i), show = this.level >= 1 && y.r > r * this.u * 0.7;
      y.label.style.visibility = show ? 'visible' : 'hidden';
      // The chosen year is said in white; the others stay readable (never dimmed with opacity).
      y.label.style.color = this.level === 2 && i !== this.sel ? '#9FB0D9' : '#F4F6FF';
      const n = y.label.querySelector('[data-n]') as HTMLElement | null; if (n) n.style.color = this.level === 2 && i !== this.sel ? '#9FB0D9' : '#C9D4F2';
      y.label.style.transform = `translate(${Math.round(h.x)}px, ${Math.round(h.y + r + 22)}px) translate(-50%, -50%)`;
    });
  }

  protected onTap(x: number, y: number) {
    // A press anywhere in the moon's own space opens it: a finger need not land on the disc.
    if (this.level === 0) { const b = this.box; if (Math.abs(x - b.cx) <= b.w / 2 && Math.abs(y - b.cy) <= b.h / 2) this.enter(); return; }
    // A year's moon is small: take the nearest one within a thumb's width.
    let best = -1, bd = 34;
    this.years.forEach((v, i) => { const p = v.mesh.position.clone().project(this.camera), dx = (p.x * 0.5 + 0.5) * this.w - x, dy = (-p.y * 0.5 + 0.5) * this.h - y, d = Math.hypot(dx, dy) - v.r / this.u; if (d < bd) { bd = d; best = i; } });
    // The lifted moon, or its own year in the row, pressed again: put it back.
    // The large moon pressed: back to the answer.
    if (best < 0) { if (this.hit(x, y, [this.main])) this.setLevel(0); return; }
    if (best !== this.sel) this.setLevel(2, best);
  }

  /** For the buttons, the keyboard and the tests. */
  enter() { if (this.level === 0 && this.years.length) this.setLevel(2, this.years.length - 1); }
  back() { this.setLevel(0); }
  select(i: number) { if (this.years.length) this.setLevel(2, Math.max(0, Math.min(this.years.length - 1, i))); }
  /** Step along the years: from the row, right takes the first year and left the last. */
  step(d: number) {
    if (this.level === 0) return;
    this.select(this.sel + d);
  }

  dispose() { this.boxRo.disconnect(); this.surface.dispose(); super.dispose(); }
}
