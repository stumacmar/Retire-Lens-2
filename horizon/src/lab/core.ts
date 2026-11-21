import * as THREE from 'three';
import { Stage, phaseMaterial } from './stage';

/**
 * Concept "Core". Your income as one sphere of glass with a solid core.
 * The core is what is guaranteed for life whatever markets do (State
 * Pensions, scheme pensions, annuities): it is always fully alight, and its
 * size is its share of what you ask. The glass around it is what must come
 * from your pots, lit like a moon by the share of futures in which it lasts.
 * A big bright core in a half-lit shell says: the floor is safe, the rest is
 * a coin toss.
 *
 * Depth is literal: press it and the shell parts to show what is inside.
 */
export type CoreData = { p: number; share: number };   // share of futures the pots last; share of the ask that is guaranteed

const R = 1.4;

export class CoreStage extends Stage {
  private core: THREE.Mesh; private halves: THREE.Mesh[] = [];
  private labels: { el: HTMLSpanElement; at: () => THREE.Vector3; dx: number; anchor: string }[] = [];
  private open = false; private gap = 0; private s = 1;

  constructor(host: HTMLElement, overlay: HTMLElement, private data: CoreData, private words: { core: string; shell: string }, private on: (open: boolean) => void) {
    super(host, overlay, { fov: 30, distance: 9, bloom: [0.4, 0.6, 0.8] });
    const rc = R * Math.sqrt(Math.max(0.02, Math.min(1, data.share))) * 0.97;
    this.core = new THREE.Mesh(new THREE.SphereGeometry(rc, 64, 48), phaseMaterial(1, { lit: 0xffe6ad, gain: 1.12 }));
    this.scene.add(this.core);
    for (const side of [-1, 1]) {
      // Left and right halves of one shell, so it can part down the middle.
      const geo = new THREE.SphereGeometry(R, 72, 48, side < 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI);
      const mat = phaseMaterial(data.p, { alpha: 0.42, gain: 0.85 }); mat.side = THREE.DoubleSide;
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; this.scene.add(m); this.halves.push(m);
    }
    const mk = (html: string, at: () => THREE.Vector3, dx: number, anchor: string) => { const el = this.label('opacity:0;font-size:13px;max-width:44%;white-space:normal;'); el.innerHTML = html; this.labels.push({ el, at, dx, anchor }); };
    mk(words.core, () => this.core.position.clone().add(new THREE.Vector3(0, -rc * this.s * 1.12 - 0.12, 0)), 0, 'translate(-50%, 0)');
    mk(words.shell, () => new THREE.Vector3(0, R * this.s + 0.2, 0), 0, 'translate(-50%, -100%)');
    this.start();
  }

  protected fit() { this.s = Math.min(1, this.span / 3.7); }

  protected update(t: number, dt: number) {
    this.gap = this.ease(this.gap, this.open ? 1 : 0, dt, 5);
    const bob = this.reduced ? 0 : Math.sin(t * 0.6) * 0.04, pulse = this.reduced ? 1 : 1 + Math.sin(t * 1.4) * 0.012;
    this.core.position.set(0, 0.05 + bob, 0); this.core.scale.setScalar(this.s * pulse * (1 + 0.12 * this.gap));
    this.halves.forEach((m, i) => {
      const side = i === 0 ? -1 : 1;
      m.position.set(side * this.gap * 0.95 * this.s, 0.05 + bob, 0); m.rotation.y = side * this.gap * 0.55; m.scale.setScalar(this.s);
    });
  }

  protected layout() {
    for (const l of this.labels) { l.el.style.opacity = this.gap > 0.7 ? '1' : '0'; l.el.style.textAlign = 'center'; this.place(l.el, l.at(), l.dx, 0, l.anchor); }
  }

  protected onTap() { this.set(!this.open); }
  set(open: boolean) { this.open = open; this.on(open); }
}
