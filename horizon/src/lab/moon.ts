import * as THREE from 'three';
import { Stage, phaseMaterial, setPhase } from './stage';

/**
 * Concept "Moon". One moon. The share of it that is lit is the share of your
 * futures in which the money lasts: full is certain, half is a coin toss, a
 * sliver is a long shot. Everyone has read a moon. Change when you stop or
 * what you ask and the light moves across it.
 *
 * Depth is time. Press the moon and it becomes the years of your retirement,
 * a row of moons, full while every future pays and darkening where they
 * stop. Press a year and it rises and is read out in words.
 *
 *   level 0  the answer      one moon
 *   level 1  the years       the phases in a row
 *   level 2  one year        that moon rises above the row, with its words
 *
 * (The first version sent the row away into the distance. All three lay
 * readers took the smaller moons to mean less money, so the row is level.)
 */
export type MoonData = { p: number; years: { age: number; p: number; index: number }[] };
type Year = { mesh: THREE.Mesh; age: number; p: number; index: number; label: HTMLSpanElement; pos: THREE.Vector3; r: number };

const TOP = 1.05;   // where the moon sits, above the middle of the screen: the words go under it

export class MoonStage extends Stage {
  private geo = new THREE.SphereGeometry(1, 96, 64);
  private main: THREE.Mesh;
  private years: Year[] = [];
  private level = 0; private sel = -1;
  private mainR = 0.9; private pNow: number;

  constructor(host: HTMLElement, overlay: HTMLElement, private data: MoonData, private on: (level: number, index: number) => void) {
    super(host, overlay, { fov: 30, distance: 9, bloom: [0.28, 0.55, 0.86] });
    this.pNow = data.p;
    this.main = new THREE.Mesh(this.geo, phaseMaterial(data.p));
    this.scene.add(this.main);
    this.build();
    this.start();
  }

  private build() {
    for (const y of this.years) { this.scene.remove(y.mesh); (y.mesh.material as THREE.Material).dispose(); y.label.remove(); }
    this.years = this.data.years.map(y => {
      const mesh = new THREE.Mesh(this.geo, phaseMaterial(y.p));
      mesh.scale.setScalar(0.0001); mesh.position.set(0, TOP, 0); this.scene.add(mesh);
      const label = this.label('opacity:0;font-size:14px;font-weight:700;');
      label.textContent = String(y.age);
      return { mesh, age: y.age, p: y.p, index: y.index, label, pos: new THREE.Vector3(0, TOP, 0), r: 0.0001 };
    });
  }

  /** New figures (a stepper moved): the light moves across the moon; the years are rebuilt where they are. */
  setData(data: MoonData) {
    const same = data.years.length === this.data.years.length && data.years.every((y, i) => y.age === this.data.years[i].age);
    this.data = data;
    if (same) this.years.forEach((y, i) => { y.p = data.years[i].p; setPhase(y.mesh.material as THREE.ShaderMaterial, y.p); });
    else { if (this.level === 2) this.setLevel(1); this.build(); }
  }

  private get rowR() { return Math.min(0.2, (this.span * 0.84) / Math.max(1, this.years.length) / 2.3); }

  /** Where a year's moon sits: a level row on a shallow arc, the day you stop on the left. */
  private home(i: number) {
    const n = this.years.length, t = n > 1 ? i / (n - 1) : 0.5, half = this.span * 0.5 - this.rowR - 0.16;
    return new THREE.Vector3(-half + 2 * half * t, (this.level === 2 ? -0.05 : TOP - 0.1) + 0.16 * Math.sin(Math.PI * t), 0);
  }

  setLevel(level: number, sel = -1) { this.level = level; this.sel = sel; this.on(level, sel >= 0 ? this.years[sel].index : -1); }

  protected update(t: number, dt: number) {
    const bob = this.reduced ? 0 : Math.sin(t * 0.6) * 0.035;
    this.pNow = this.ease(this.pNow, this.data.p, dt, 3.5); setPhase(this.main.material as THREE.ShaderMaterial, this.pNow);
    this.mainR = this.ease(this.mainR, this.level === 0 ? this.span * 0.3 : 0.0001, dt, 6);
    this.main.scale.setScalar(this.mainR); this.main.position.set(0, TOP + bob, 0); this.main.rotation.y = this.reduced ? 0 : Math.sin(t * 0.05) * 0.25;
    this.main.visible = this.mainR > 0.01;
    this.years.forEach((y, i) => {
      const open = this.level >= 1, chosen = this.level === 2 && i === this.sel;
      const to = !open ? new THREE.Vector3(0, TOP, 0) : chosen ? new THREE.Vector3(0, TOP + 0.25, 0) : this.home(i);
      y.pos.set(this.ease(y.pos.x, to.x, dt, 5), this.ease(y.pos.y, to.y, dt, 5), this.ease(y.pos.z, to.z, dt, 5));
      y.r = this.ease(y.r, open ? (chosen ? this.span * 0.2 : this.rowR) : 0.0001, dt, 5);
      y.mesh.position.copy(y.pos); y.mesh.scale.setScalar(y.r); y.mesh.visible = y.r > 0.01;
      const u = (y.mesh.material as THREE.ShaderMaterial).uniforms.uDim;
      u.value = this.ease(u.value, this.level === 2 && !chosen ? 0.5 : 1, dt, 6);
    });
  }

  protected layout() {
    this.years.forEach((y, i) => {
      const show = this.level >= 1;
      y.label.style.opacity = show && y.r > this.rowR * 0.7 ? (this.level === 2 && i !== this.sel ? '0.55' : '1') : '0';
      this.place(y.label, this.home(i), 0, this.pixels(this.home(i), this.rowR) + 13);
    });
  }

  protected onTap(x: number, y: number) {
    if (this.level === 0) { if (this.hit(x, y, [this.main])) this.setLevel(1); return; }
    // A year's moon is small: take the nearest one within a thumb's width.
    let best = -1, bd = 34;
    this.years.forEach((v, i) => { const p = v.mesh.position.clone().project(this.camera), dx = (p.x * 0.5 + 0.5) * this.w - x, dy = (-p.y * 0.5 + 0.5) * this.h - y, d = Math.hypot(dx, dy) - this.pixels(v.mesh.position, v.r); if (d < bd) { bd = d; best = i; } });
    if (this.level === 1) { if (best >= 0) this.setLevel(2, best); else if (y < this.h * 0.55) this.setLevel(0); return; }
    if (best >= 0 && best !== this.sel) this.setLevel(2, best); else if (y < this.h * 0.55) this.setLevel(1);
  }

  /** For the keyboard and the tests: go in, come out, or step along the years. */
  step(d: number) {
    if (this.level === 0) { if (d > 0) this.setLevel(1); return; }
    if (this.level === 1) { if (d > 0) this.setLevel(2, 0); else this.setLevel(0); return; }
    const n = this.sel + d; if (n < 0 || n >= this.years.length) this.setLevel(1); else this.setLevel(2, n);
  }
  back() { this.setLevel(Math.max(0, this.level - 1)); }
}
