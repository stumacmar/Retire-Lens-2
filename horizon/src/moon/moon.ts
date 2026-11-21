import * as THREE from 'three';
import { Stage, phaseMaterial, setPhase } from './stage';

/**
 * The moon. The share of it that is lit is the share of your futures in
 * which the money lasts: full is certain, half is a coin toss, a sliver is a
 * long shot. Everyone has read a moon. Change when you stop or what you ask
 * and the light moves across it.
 *
 * Depth is time. Open the moon and it becomes the years of your retirement,
 * a row of moons, full while every future still pays and darkening where
 * they stop. Press a year and it rises and is read out in words.
 *
 *   level 0  the answer      one moon
 *   level 1  the years       the phases in a row
 *   level 2  one year        that moon rises above the row, with its words
 *
 * (The first version sent the row away into the distance. All three lay
 * readers took the smaller moons to mean less money, so the row is level.)
 *
 * The scene fills the whole home, so its glow has no edge; the moon itself
 * is laid out inside `frame`, an empty box in the page's own layout, so it
 * always sits clear of the words whatever the size of the screen.
 */
export type MoonData = { p: number; years: { age: number; p: number }[] };
type Year = { mesh: THREE.Mesh; age: number; p: number; label: HTMLSpanElement; pos: THREE.Vector3; r: number };

export class MoonStage extends Stage {
  private geo = new THREE.SphereGeometry(1, 96, 64);
  private main: THREE.Mesh;
  private halo: THREE.Mesh;
  private stars: THREE.Points;
  private years: Year[] = [];
  private level = 0; private sel = -1;
  private mainR = 0.0001; private pNow: number;
  private box = { cx: 0, cy: 0, w: 1, h: 1 };
  private boxRo: ResizeObserver;

  constructor(host: HTMLElement, overlay: HTMLElement, private frameEl: HTMLElement, private data: MoonData, private on: (level: number, sel: number) => void) {
    super(host, overlay, { fov: 30, distance: 9, bloom: [0.28, 0.55, 0.86] });
    this.pNow = data.p;
    this.main = new THREE.Mesh(this.geo, phaseMaterial(data.p));
    this.scene.add(this.main);
    // The moon's own light in the night air: a soft glow behind it, as strong as the moon is lit.
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uK; varying vec2 vU; void main(){ float d = length(vU); float a = pow(max(0.0, 1.0 - d), 2.2); gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * a * uK, 1.0); }',
    }));
    this.halo.position.z = -0.5; this.scene.add(this.halo);
    // A few faint stars, far behind, only in the sky above the words. The same sky every time.
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const N = 70, pos = new Float32Array(N * 3), tw = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = rnd(); pos[i * 3 + 1] = rnd(); pos[i * 3 + 2] = 0; tw[i] = rnd(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() }, uFoot: { value: 0.5 } },
      // Positions are fractions of the sky (x across, y down from the top to the foot of the moon's box), so it fits any screen.
      vertexShader: 'attribute float aTw; uniform float uT; uniform float uPx; uniform float uFoot; varying float vA; void main(){ vA = (0.25 + 0.55 * aTw) * (0.8 + 0.2 * sin(uT * (0.4 + aTw) + aTw * 40.0)); gl_PointSize = (1.0 + 1.6 * aTw * aTw) * uPx; gl_Position = vec4(position.x * 2.0 - 1.0, 1.0 - position.y * uFoot * 2.0, 0.999, 1.0); }',
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
      const mesh = new THREE.Mesh(this.geo, phaseMaterial(y.p));
      mesh.scale.setScalar(0.0001); mesh.position.copy(c); this.scene.add(mesh);
      // The age, and under it how many times in 100 the money is still paying then: all three readers asked for the number.
      const label = this.label('visibility:hidden;text-align:center;');
      label.dataset.yearAge = String(y.age);
      label.innerHTML = `<b style="display:block;font-size:16px;font-weight:700">${y.age}</b><span data-n style="display:block;font-size:13px">${Math.round(y.p * 100)}</span>`;
      return { mesh, age: y.age, p: y.p, label, pos: c.clone(), r: 0.0001 };
    });
  }

  /** New figures (a stepper moved): the light moves across the moon; the years are rebuilt where they are. */
  setData(data: MoonData) {
    const same = data.years.length === this.data.years.length && data.years.every((y, i) => y.age === this.data.years[i].age);
    this.data = data;
    if (same) this.years.forEach((y, i) => { y.p = data.years[i].p; setPhase(y.mesh.material as THREE.ShaderMaterial, y.p); const n = y.label.querySelector('[data-n]'); if (n) n.textContent = String(Math.round(y.p * 100)); });
    else { if (this.level === 2) this.setLevel(1); this.build(); }
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
  private get rowPx() { return Math.min(26, (this.box.w * 0.9) / Math.max(1, this.years.length) / 2.3); }
  private get chosenPx() { return Math.min(this.box.w * 0.2, this.box.h * 0.24); }
  /** Where a year's moon sits: a level row on a shallow arc, the day you stop on the left. With a year chosen, the row drops to the foot of the box. */
  private homePx(i: number) {
    const b = this.box, n = this.years.length, t = n > 1 ? i / (n - 1) : 0.5, r = this.rowPx, half = b.w / 2 - r - 6;
    return { x: b.cx - half + 2 * half * t, y: this.level === 2 ? b.cy + b.h / 2 - 44 - r : b.cy - 4 - 16 * Math.sin(Math.PI * t) };
  }

  setLevel(level: number, sel = -1) { this.level = level; this.sel = level === 2 ? sel : -1; this.on(this.level, this.sel); }

  protected update(t: number, dt: number) {
    const u = this.u, b = this.box, c = this.at(b.cx, b.cy);
    this.pNow = this.ease(this.pNow, this.data.p, dt, 3.5); setPhase(this.main.material as THREE.ShaderMaterial, this.pNow);
    this.mainR = this.ease(this.mainR, this.level === 0 ? Math.min(b.w * 0.33, b.h * 0.46) * u : 0.0001, dt, 6);
    this.main.scale.setScalar(this.mainR); this.main.position.set(c.x, c.y + (this.reduced ? 0 : Math.sin(t * 0.6) * 3 * u), 0);
    this.main.rotation.y = this.reduced ? 0 : Math.sin(t * 0.05) * 0.25;
    this.main.visible = this.mainR > 0.01;
    this.halo.position.set(this.main.position.x, this.main.position.y, -0.5); this.halo.scale.setScalar(this.mainR * 2.3); this.halo.visible = this.main.visible;
    (this.halo.material as THREE.ShaderMaterial).uniforms.uK.value = 0.03 + 0.37 * this.pNow;
    (this.stars.material as THREE.ShaderMaterial).uniforms.uT.value = this.reduced ? 0 : t;
    this.years.forEach((y, i) => {
      const open = this.level >= 1, chosen = this.level === 2 && i === this.sel, h = this.homePx(i);
      const to = !open ? c : chosen ? this.at(b.cx, b.cy - b.h / 2 + this.chosenPx + 6) : this.at(h.x, h.y);
      y.pos.set(this.ease(y.pos.x, to.x, dt, 5), this.ease(y.pos.y, to.y, dt, 5), 0);
      y.r = this.ease(y.r, open ? (chosen ? this.chosenPx : this.rowPx) * u : 0.0001, dt, 5);
      y.mesh.position.copy(y.pos); y.mesh.scale.setScalar(y.r); y.mesh.visible = y.r > 0.01;
      const dim = (y.mesh.material as THREE.ShaderMaterial).uniforms.uDim;
      dim.value = this.ease(dim.value, this.level === 2 && !chosen ? 0.5 : 1, dt, 6);
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
    if (this.level === 0) { if (this.hit(x, y, [this.main])) this.setLevel(1); return; }
    // A year's moon is small: take the nearest one within a thumb's width.
    let best = -1, bd = 34;
    this.years.forEach((v, i) => { const p = v.mesh.position.clone().project(this.camera), dx = (p.x * 0.5 + 0.5) * this.w - x, dy = (-p.y * 0.5 + 0.5) * this.h - y, d = Math.hypot(dx, dy) - v.r / this.u; if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    if (this.level === 2 && best === this.sel) this.setLevel(1); else this.setLevel(2, best);
  }

  /** For the buttons, the keyboard and the tests. */
  enter() { if (this.level === 0) this.setLevel(1); }
  back() { this.setLevel(Math.max(0, this.level - 1)); }
  select(i: number) { if (this.years.length) this.setLevel(2, Math.max(0, Math.min(this.years.length - 1, i))); }
  /** Step along the years: from the row, right takes the first year and left the last. */
  step(d: number) {
    if (this.level === 0) return;
    if (this.level === 1) { this.select(d > 0 ? 0 : this.years.length - 1); return; }
    this.select(this.sel + d);
  }

  dispose() { this.boxRo.disconnect(); super.dispose(); }
}
