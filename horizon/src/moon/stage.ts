import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * The stage the moon is drawn on: one WebGL scene with a soft glow, a night
 * backdrop, text labels kept in the page (so they stay crisp), a tap, and a
 * frame loop. Framework-free. (It began in the lab, where each concept for
 * the home was a small class on top of it.)
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
  private paused = false;
  /** Called if the browser takes the WebGL context away: the home then shows the island. */
  onLost: (() => void) | null = null;

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
    el.addEventListener('webglcontextlost', e => { e.preventDefault(); this.onLost?.(); });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
  }

  /** Stop drawing while something covers the picture (a sheet over the home): nothing moves, nothing is spent. */
  setPaused(p: boolean) { this.paused = p; }

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
    // Real time, even where frames are slow (an old phone, software drawing): the eases are exact at any step, so a
    // quarter of a second is safe, and the light arrives when it should instead of crawling.
    const dt = Math.min(0.25, (now - this.last) / 1000); this.last = now;
    if (!document.hidden && !this.paused) { this.update(now / 1000, dt); this.composer.render(); this.layout(); }
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

const NOISE = `
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  vec3 hash3(vec3 p){ return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
  // Craters at one scale: a bowl with a raised rim, in about half the cells of a grid.
  float craters(vec3 p, float scale, float seed){ vec3 q = p * scale + seed, i = floor(q), f = fract(q); float h = 0.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z)), o = hash3(i + g); if (o.z > 0.3) continue;
      float r = 0.1 + 0.36 * o.x * o.x, d = length(g + o - f) / r;
      h += (d < 1.0 ? -(1.0 - d * d) * 0.6 : 0.0) + exp(-pow((d - 1.0) / 0.2, 2.0)) * 0.3; }
    return h; }
  float seas(vec3 p){ return smoothstep(0.44, 0.62, fbm(p * 1.15 + 4.0)); }
  float height(vec3 p){ float m = seas(p); return 0.25 * (fbm(p * 5.0 + 9.0) - 0.5) + (craters(p, 3.0, 1.0) + 0.6 * craters(p, 6.5, 7.0) + 0.18 * craters(p, 13.0, 3.0)) * 0.2 * (1.0 - 0.65 * m) - 0.05 * m; }`;

/**
 * The moon's surface, worked out once on the graphics card and kept as a
 * picture: how bright the ground is (seas dark, highlands pale, a little
 * brighter round a crater) and which way it slopes, east and north. Every
 * moon on the screen then reads its surface from this, which costs two
 * lookups a pixel instead of the hundred sums it takes to make.
 */
export function bakeMoon(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(1024, 512, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, wrapS: THREE.RepeatWrapping, depthBuffer: false });
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vU; ${NOISE}
      void main(){ float lon = vU.x * 6.2831853, lat = (vU.y - 0.5) * 3.14159265;
        vec3 p = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
        vec3 east = vec3(cos(lon), 0.0, -sin(lon)), north = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));
        float e = 0.006, h = height(p), dE = (height(normalize(p + east * e)) - h) / e, dN = (height(normalize(p + north * e)) - h) / e;
        float m = seas(p), albedo = clamp(0.84 - 0.58 * m + 0.34 * (fbm(p * 2.6 + 9.0) - 0.5) + 0.16 * (fbm(p * 9.0 + 2.0) - 0.5) + 0.4 * max(h, 0.0), 0.0, 1.0);
        gl_FragColor = vec4(albedo, 0.5 + 0.5 * clamp(dE * 0.3, -1.0, 1.0), 0.5 + 0.5 * clamp(dN * 0.3, -1.0, 1.0), 1.0); }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), scene = new THREE.Scene(); scene.add(quad);
  const was = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)); renderer.setRenderTarget(was);
  quad.geometry.dispose(); mat.dispose();
  return rt;
}

/**
 * A sphere lit like the moon: the share `p` of its face is lit, from the
 * right, and the rest is night, a little above the sky's own colour, with
 * the seas just showing and a faint rim so the whole disc still reads. The
 * light's angle is set so the lit share of the disc is exactly p (a half
 * moon is 50); the ground's slopes catch the light, which breaks the edge of
 * the shadow the way craters do, without moving it.
 *
 * (Two design critics, 21 November 2026: the first render was "a two-tone
 * mustard-and-navy ball"; the dark side was a flat navy brighter than the sky.)
 */
export function phaseMaterial(p: number, surface: THREE.Texture, o: { gain?: number; bump?: number } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uLight: { value: new THREE.Vector3() }, uMap: { value: surface },
      uHigh: { value: new THREE.Color(0xfbf6ea) }, uSea: { value: new THREE.Color(0xc4b08a) }, uDark: { value: new THREE.Color(0x1a2348) }, uRim: { value: new THREE.Color(0x7f98e6) },
      uFrom: { value: new THREE.Vector3(0, 0, 1) }, uFlash: { value: 0 },
      uGain: { value: o.gain ?? 1.0 }, uBump: { value: o.bump ?? 1.0 }, uDim: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vE; varying vec3 vT; varying vec3 vP;
      void main(){ vec3 n = normalize(position), e = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-5, 0.0, 0.0));
        vN = normalize(normalMatrix * n); vE = normalMatrix * e; vT = normalMatrix * cross(n, e); vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uLight; uniform sampler2D uMap; uniform vec3 uHigh; uniform vec3 uSea; uniform vec3 uDark; uniform vec3 uRim; uniform float uGain; uniform float uBump; uniform float uDim; uniform vec3 uFrom; uniform float uFlash;
      varying vec3 vN; varying vec3 vE; varying vec3 vT; varying vec3 vP;
      void main(){ vec3 n = normalize(vN), q = normalize(vP), L = normalize(uLight);
        vec4 t = texture2D(uMap, vec2(atan(q.x, q.z) / 6.2831853 + 0.5, asin(clamp(q.y, -1.0, 1.0)) / 3.14159265 + 0.5));
        vec2 slope = (t.gb - 0.5) * 2.0;
        vec3 nb = normalize(n - uBump * (slope.x * normalize(vE) + slope.y * normalize(vT)));
        float dM = dot(n, L), dB = dot(nb, L), facing = max(n.z, 0.0);
        // The shadow's edge is soft, a penumbra a few hundredths of the disc wide, and the ground's slopes show most
        // beside it, where the light is low: crater rims catch it there. Out in full light the ground is calm.
        float low = 1.0 - smoothstep(0.0, 0.55, dM);
        float lit = smoothstep(-0.05, 0.11, dM + (dB - dM) * 0.09);
        float limb = pow(facing, 0.5);
        vec3 ground = mix(uSea, uHigh, t.r);
        vec3 bright = ground * uGain * (0.62 + 0.38 * limb) * clamp(1.0 + (0.45 + 1.6 * low) * (dB - dM), 0.55, 1.4) * (0.9 + 0.1 * smoothstep(0.0, 0.45, dM));
        // Night: a little above the sky, the seas just showing by earthshine, and a faint rim so the whole disc still reads.
        // (Owner, 21 November 2026: "The moon isn't sensitive enough." With the night side at the sky's own colour a
        // moon at 90 or 96 looked full. The night side is now plainly darker than the lit and plainly lighter than the
        // sky, and a thin bright rim closes the disc, so the unlit sliver is seen for what it is.)
        vec3 shade = uDark * (0.6 + 0.7 * t.r) * (0.5 + 0.5 * limb) + uRim * pow(1.0 - facing, 5.0) * 0.9;
        vec3 col = mix(shade, bright, lit);
        // A change shows itself: for a moment after the count moves, the ground just gained blazes and the ground just
        // lost glows like an ember, so even a step of two in 100 is seen where it happened.
        float was = smoothstep(-0.05, 0.11, dot(n, normalize(uFrom)));
        col += uFlash * (max(lit - was, 0.0) * vec3(1.0, 0.82, 0.45) * 0.9 + max(was - lit, 0.0) * vec3(0.5, 0.22, 0.08) * 0.55);
        gl_FragColor = vec4(col * uDim, 1.0); }`,
  });
  setPhase(m, p); return m;
}

const light = (p: number, out: THREE.Vector3) => { const phi = Math.acos(Math.max(-1, Math.min(1, 2 * Math.max(0, Math.min(1, p)) - 1))); return out.set(Math.sin(phi), 0.1, Math.cos(phi)); };
export function setPhase(m: THREE.ShaderMaterial, p: number) { light(p, m.uniforms.uLight.value as THREE.Vector3); }
/** Mark what the moon showed before a change (`from`), and how strongly the change still shows (1 just after it, fading to 0). */
export function setChange(m: THREE.ShaderMaterial, from: number | null, flash: number) { if (from != null) light(from, m.uniforms.uFrom.value as THREE.Vector3); m.uniforms.uFlash.value = flash; }
