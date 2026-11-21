import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * The lab's stage: one WebGL scene with a soft glow, a night backdrop, text
 * labels kept in the page (so they stay crisp), a tap, and a frame loop. Each
 * concept is a small class on top of it. Framework-free.
 */
export abstract class Stage {
  protected renderer: THREE.WebGLRenderer;
  protected composer: EffectComposer;
  protected scene = new THREE.Scene();
  protected camera: THREE.PerspectiveCamera;
  protected w = 1; protected h = 1;
  protected reduced: boolean;
  private raf = 0; private last = 0; private ro: ResizeObserver; private gone = false;
  private down: { x: number; y: number } | null = null;
  private ray = new THREE.Raycaster();

  constructor(protected host: HTMLElement, protected overlay: HTMLElement, o: { fov?: number; distance?: number; bloom?: [number, number, number] } = {}) {
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const el = this.renderer.domElement;
    el.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
    el.setAttribute('aria-hidden', 'true');
    host.appendChild(el);
    this.camera = new THREE.PerspectiveCamera(o.fov ?? 30, 1, 0.1, 200);
    this.camera.position.set(0, 0, o.distance ?? 9);
    this.scene.background = backdrop();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const [s, r, t] = o.bloom ?? [0.3, 0.5, 0.8];
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), s, r, t));
    this.composer.addPass(new OutputPass());
    el.addEventListener('pointerdown', e => { this.down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', e => {
      const d = this.down; this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
      const b = this.host.getBoundingClientRect(); this.onTap(e.clientX - b.left, e.clientY - b.top);
    });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
  }

  /** Call once the subclass has built its scene. */
  protected start() { this.resize(); this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }

  private resize() {
    if (this.gone) return;
    const r = this.host.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.renderer.setSize(this.w, this.h, false); this.composer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    this.fit();
  }

  private frame = (now: number) => {
    if (this.gone) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!document.hidden) { this.update(now / 1000, dt); this.composer.render(); this.layout(); }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Ease a value toward a target, the same at any frame rate. */
  protected ease(v: number, to: number, dt: number, k = 7) { return this.reduced ? to : v + (to - v) * (1 - Math.exp(-dt * k)); }

  protected label(css = '') {
    const el = document.createElement('span');
    el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums;line-height:1.15;color:#F4F6FF;transition:opacity 200ms;' + css;
    this.overlay.appendChild(el); return el;
  }

  /** Put a label at a point in the scene, offset in pixels; `anchor` is a CSS translate for its own box. */
  protected place(el: HTMLElement, p: THREE.Vector3, dx = 0, dy = 0, anchor = 'translate(-50%, -50%)') {
    const v = p.clone().project(this.camera);
    el.style.transform = `translate(${Math.round((v.x * 0.5 + 0.5) * this.w + dx)}px, ${Math.round((-v.y * 0.5 + 0.5) * this.h + dy)}px) ${anchor}`;
  }

  /** Radius in pixels of a sphere of world radius r at point p. */
  protected pixels(p: THREE.Vector3, r: number) {
    const d = this.camera.position.distanceTo(p);
    return (r / (d * Math.tan((this.camera.fov * Math.PI) / 360))) * (this.h / 2);
  }

  protected hit(x: number, y: number, objects: THREE.Object3D[]) {
    this.ray.setFromCamera(new THREE.Vector2((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1), this.camera);
    const got = this.ray.intersectObjects(objects, true)[0];
    return got ? got.object : null;
  }

  /** The scene's width at the origin, in world units: use it to size things to a narrow phone. */
  protected get span() { return 2 * this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect; }

  protected fit() { /* subclasses may reframe on resize */ }
  protected layout() { /* subclasses place their labels */ }
  protected abstract update(t: number, dt: number): void;
  protected abstract onTap(x: number, y: number): void;

  dispose() {
    this.gone = true; cancelAnimationFrame(this.raf); this.ro.disconnect();
    this.scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose?.(); });
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.composer.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.overlay.replaceChildren();
  }
}

/** Night: deep navy, a little lighter toward the foot. */
function backdrop() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const x = c.getContext('2d')!, g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#050916'); g.addColorStop(0.55, '#070C1F'); g.addColorStop(1, '#0C1638');
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * A sphere lit like the moon: the share `p` of its face is lit, from the
 * right, and the rest is a dim slate you can still see. The light's angle is
 * set so the lit share of the disc is exactly p (a half moon is 50).
 */
export function phaseMaterial(p: number, o: { lit?: number; dark?: number; gain?: number; alpha?: number } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: o.alpha != null, depthWrite: o.alpha == null,
    uniforms: { uLight: { value: new THREE.Vector3() }, uLit: { value: new THREE.Color(o.lit ?? 0xffd27a) }, uDark: { value: new THREE.Color(o.dark ?? 0x25305a) },
      uGain: { value: o.gain ?? 1.0 }, uDim: { value: 1 }, uAlpha: { value: o.alpha ?? 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uLight; uniform vec3 uLit; uniform vec3 uDark; uniform float uGain; uniform float uDim; uniform float uAlpha; varying vec3 vN; varying vec3 vP;
      void main(){ vec3 n = normalize(vN); float d = dot(n, normalize(uLight)); float lit = smoothstep(-0.035, 0.05, d);
        float limb = pow(max(n.z, 0.0), 0.4);
        float mott = sin(vP.x * 9.0 + sin(vP.y * 7.0) * 2.0) * sin(vP.y * 11.0 + sin(vP.z * 5.0) * 2.0);
        float maria = 0.5 + 0.5 * sin(vP.x * 3.1 + 1.7 + sin(vP.y * 2.3) * 1.6) * sin(vP.y * 2.7 + sin(vP.z * 3.3 + vP.x) * 1.4);
        vec3 bright = uLit * uGain * (0.7 + 0.3 * limb) * (0.86 + 0.14 * maria) * (1.0 + 0.04 * mott);
        vec3 shade = uDark * (0.55 + 0.45 * limb);
        gl_FragColor = vec4(mix(shade, bright, lit) * uDim, uAlpha); }`,
  });
  setPhase(m, p); return m;
}

export function setPhase(m: THREE.ShaderMaterial, p: number) {
  const phi = Math.acos(Math.max(-1, Math.min(1, 2 * Math.max(0, Math.min(1, p)) - 1)));
  (m.uniforms.uLight.value as THREE.Vector3).set(Math.sin(phi), 0.1, Math.cos(phi));
}
