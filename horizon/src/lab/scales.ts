import * as THREE from 'three';
import { Stage } from './stage';

/**
 * Concept "Scales". What you have against what you need, on a balance.
 * Heavier is lower: when what you have outweighs what you need, the scales
 * tip your way. They do not stand still, because the future does not: they
 * sway between the unlucky and the lucky futures. A plan that is safe stays
 * tipped your way through the whole sway. A plan that is touch and go
 * crosses level and tips against you part of the time. The movement is the
 * uncertainty.
 *
 * Depth is contents: press a pan and it opens into what is in it.
 */
export type ScalesData = { lo: number; mid: number; hi: number };   // have ÷ need: unlucky 1 in 10, the middle, lucky 1 in 10

const PIVOT = 1.05, HANG = 1.15;
const tilt = (cover: number) => Math.max(-0.38, Math.min(0.38, (cover - 1) * 0.95));

export class ScalesStage extends Stage {
  private root = new THREE.Group();
  private beam = new THREE.Group();
  private pans: { g: THREE.Group; side: -1 | 1; label: HTMLSpanElement; hitbox: THREE.Mesh }[] = [];
  private L = 1.5; private angle = 0; private open: 'need' | 'have' | null = null;

  constructor(host: HTMLElement, overlay: HTMLElement, private data: ScalesData, private on: (which: 'need' | 'have' | null) => void) {
    super(host, overlay, { fov: 30, distance: 9.5, bloom: [0.32, 0.6, 0.85] });
    this.scene.add(this.root);
    this.scene.add(new THREE.AmbientLight(0xbfd0ff, 0.55));
    const key = new THREE.DirectionalLight(0xfff0d0, 2.2); key.position.set(-4, 6, 8); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f8cff, 1.1); rim.position.set(5, 2, -4); this.scene.add(rim);
    const brass = new THREE.MeshStandardMaterial({ color: 0xcfa851, metalness: 0.55, roughness: 0.32 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.14, 48), brass); base.position.y = -2.0; this.root.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, PIVOT + 2.0, 24), brass); post.position.y = (PIVOT - 2.0) / 2; this.root.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), brass); cap.position.y = PIVOT; this.root.add(cap);
    // Level, for the eye to judge the tilt against.
    const level = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x4a5c9c })); level.position.set(0, PIVOT, -0.4); this.root.add(level);
    // Where the beam goes in the unlucky and the lucky futures: the ends of the sway, drawn faintly.
    for (const c of [data.lo, data.hi]) { const g = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xcfa851, transparent: true, opacity: 0.16 })); g.position.set(0, PIVOT, -0.2); g.rotation.z = -tilt(c); this.root.add(g); }

    this.beam.position.y = PIVOT; this.root.add(this.beam);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07), brass); bar.name = 'bar'; this.beam.add(bar);

    for (const side of [-1, 1] as const) {
      const g = new THREE.Group();
      const pts: number[] = [];
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.5; pts.push(0, 0, 0, Math.cos(a) * 0.6, -HANG, Math.sin(a) * 0.6); }
      const chains = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: 0xcfa851 }));
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.5, 0.07, 48), brass); dish.position.y = -HANG;
      g.add(chains, dish);
      if (side < 0) {
        // What you need: a block of slate glass.
        const need = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.66), new THREE.MeshStandardMaterial({ color: 0x4a5d99, metalness: 0.1, roughness: 0.35 }));
        need.position.y = -HANG + 0.37; need.rotation.y = 0.5; g.add(need);
      } else {
        // What you have: gold, and it glows.
        const r = 0.4 * Math.cbrt(Math.max(0.3, Math.min(2, data.mid)));
        const have = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc94d).multiplyScalar(1.25), toneMapped: false }));
        have.position.y = -HANG + 0.035 + r; g.add(have);
        const glow = new THREE.PointLight(0xffc94d, 6, 4); glow.position.y = -HANG + 0.6; g.add(glow);
      }
      const hitbox = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hitbox.position.y = -HANG + 0.3; g.add(hitbox);
      this.root.add(g);
      const label = this.label('font-size:15px;font-weight:700;text-align:center;');
      label.textContent = side < 0 ? 'You need' : 'You have';
      this.pans.push({ g, side, label, hitbox });
    }
    this.angle = tilt(data.mid);
    this.start();
  }

  protected fit() { this.root.scale.setScalar(Math.min(1, this.span / 4.6)); this.root.position.y = 0.25; this.L = 1.6; (this.beam.getObjectByName('bar') as THREE.Mesh).scale.x = this.L * 2 + 0.1; }

  protected update(t: number, dt: number) {
    const lo = tilt(this.data.lo), hi = tilt(this.data.hi);
    // The sway: from the unlucky futures to the lucky ones and back, lingering near the middle.
    const s = Math.sin(t * 0.85), to = this.reduced ? tilt(this.data.mid) : (lo + hi) / 2 + ((hi - lo) / 2) * s * (0.55 + 0.45 * Math.abs(s));
    this.angle = this.ease(this.angle, to, dt, 4);
    this.beam.rotation.z = -this.angle;
    for (const p of this.pans) {
      p.g.position.set(p.side * this.L * Math.cos(this.angle), PIVOT - p.side * this.L * Math.sin(this.angle), 0);
      const lift = this.open === (p.side < 0 ? 'need' : 'have') ? 1.12 : 1;
      p.g.scale.setScalar(this.ease(p.g.scale.x, lift, dt, 8));
    }
  }

  protected layout() {
    for (const p of this.pans) this.place(p.label, this.root.localToWorld(new THREE.Vector3(p.g.position.x, p.g.position.y - HANG - 0.1, 0)), 0, 22);
  }

  protected onTap(x: number, y: number) {
    const got = this.hit(x, y, this.pans.map(p => p.hitbox)), p = got ? this.pans.find(v => v.hitbox === got) : null;
    const which = p ? (p.side < 0 ? 'need' : 'have') : null;
    this.open = which === this.open ? null : which; this.on(this.open);
  }
  set(which: 'need' | 'have' | null) { this.open = which; this.on(which); }
}
