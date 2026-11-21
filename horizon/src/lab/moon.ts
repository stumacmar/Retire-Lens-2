import * as THREE from 'three';
import { Stage, phaseMaterial } from './stage';

/**
 * Concept "Moon". One moon. The share of it that is lit is the share of your
 * futures in which the money lasts: full is certain, half is a coin toss, a
 * sliver is a long shot. Everyone has read a moon.
 *
 * Depth is time. Press the moon and you travel into it: it becomes the years
 * of your retirement, a line of moons going away from you into the dark,
 * full while every future pays and waning where they stop. Press a year and
 * it comes to you and is read out in words. Press again to come back out.
 *
 *   level 0  the answer      one moon
 *   level 1  the years       the phases in a row, an arc going away from you
 *   level 2  one year        that moon rises above the row, with its words
 */
export type MoonData = { p: number; years: { age: number; p: number; index: number }[] };

const R0 = 1.4, RY = 0.26;

export class MoonStage extends Stage {
  private main: THREE.Mesh;
  private years: { mesh: THREE.Mesh; age: number; p: number; index: number; label: HTMLSpanElement; pos: THREE.Vector3; r: number }[] = [];
  private level = 0; private sel = -1;
  private mainR = R0;

  constructor(host: HTMLElement, overlay: HTMLElement, private data: MoonData, private on: (level: number, index: number) => void) {
    super(host, overlay, { fov: 30, distance: 9, bloom: [0.3, 0.55, 0.82] });
    const geo = new THREE.SphereGeometry(1, 72, 48);
    this.main = new THREE.Mesh(geo, phaseMaterial(data.p));
    this.scene.add(this.main);
    data.years.forEach(y => {
      const mesh = new THREE.Mesh(geo, phaseMaterial(y.p));
      mesh.scale.setScalar(0.0001); this.scene.add(mesh);
      const label = this.label('opacity:0;text-align:left;');
      label.style.cssText += 'font-size:14px;font-weight:700;';
      label.textContent = String(y.age);
      this.years.push({ mesh, age: y.age, p: y.p, index: y.index, label, pos: new THREE.Vector3(), r: 0.0001 });
    });
    this.start();
  }

  /** Where a year's moon sits: a row like a chart of the moon's phases, on an arc that goes away from you to the right. */
  private home(i: number) {
    const n = this.years.length, t = n > 1 ? i / (n - 1) : 0, half = this.span * 0.36;
    return new THREE.Vector3(-half + 2 * half * t + 0.42 * t * t * half, -0.75 + 0.5 * Math.sin(Math.PI * t) + 0.45 * t, 0.4 - 5.5 * t);
  }

  setLevel(level: number, sel = -1) { this.level = level; this.sel = sel; this.on(level, sel >= 0 ? this.years[sel].index : -1); }

  protected update(t: number, dt: number) {
    const bob = this.reduced ? 0 : Math.sin(t * 0.6) * 0.04;
    const s0 = Math.min(1, this.span / 3.7);
    this.mainR = this.ease(this.mainR, this.level === 0 ? R0 * s0 : 0.0001, dt, 6);
    this.main.scale.setScalar(this.mainR); this.main.position.set(0, 0.05 + bob, 0);
    this.main.visible = this.mainR > 0.01;
    this.years.forEach((y, i) => {
      const open = this.level >= 1, chosen = this.level === 2 && i === this.sel;
      const to = !open ? new THREE.Vector3(0, 0.05, 0) : chosen ? new THREE.Vector3(0, 0.95, 0) : this.home(i);
      y.pos.set(this.ease(y.pos.x, to.x, dt, 5), this.ease(y.pos.y, to.y, dt, 5), this.ease(y.pos.z, to.z, dt, 5));
      y.r = this.ease(y.r, open ? (chosen ? Math.min(0.85, this.span * 0.25) : RY) : 0.0001, dt, 5);
      y.mesh.position.copy(y.pos); y.mesh.position.y += open && !chosen ? bob * (0.4 + (i % 3) * 0.3) : 0;
      y.mesh.scale.setScalar(y.r); y.mesh.visible = y.r > 0.01;
      const u = (y.mesh.material as THREE.ShaderMaterial).uniforms.uDim;
      u.value = this.ease(u.value, this.level === 2 && !chosen ? 0.45 : 1, dt, 6);
    });
  }

  protected layout() {
    this.years.forEach((y, i) => {
      const show = this.level >= 1 && !(this.level === 2 && i === this.sel);
      y.label.style.opacity = show && y.r > RY * 0.8 ? (this.level === 2 ? '0.6' : '1') : '0';
      this.place(y.label, this.home(i), 0, this.pixels(this.home(i), RY) + 14);
    });
  }

  protected onTap(x: number, y: number) {
    if (this.level === 0) { this.setLevel(1); return; }
    const got = this.hit(x, y, this.years.map(v => v.mesh)), i = got ? this.years.findIndex(v => v.mesh === got) : -1;
    if (this.level === 1) { if (i >= 0) this.setLevel(2, i); else this.setLevel(0); return; }
    if (i >= 0 && i !== this.sel) this.setLevel(2, i); else this.setLevel(1);
  }

  /** For the keyboard and the tests: go in, come out, or step along the years. */
  step(d: number) {
    if (this.level === 0) { if (d > 0) this.setLevel(1); return; }
    if (this.level === 1) { if (d > 0) this.setLevel(2, 0); else this.setLevel(0); return; }
    const n = this.sel + d; if (n < 0 || n >= this.years.length) this.setLevel(1); else this.setLevel(2, n);
  }
  back() { this.setLevel(Math.max(0, this.level - 1)); }
}
