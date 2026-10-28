import * as THREE from 'three';
import type { GameConfig, QualityLevel } from '../config/schema.ts';
import type { Simulation } from '../game/simulation.ts';
import type { MachineGeometry } from '../physics/geometry.ts';
import { buildCabinet, updateCabinet, type CabinetParts } from './cabinet.ts';
import { THEMES, type Theme } from './themes.ts';
import { ObjectRenderer } from './objects.ts';

export interface ViewMargins {
  /** Pixels CSS réservés en haut (compteurs) et en bas (commandes). */
  top: number;
  bottom: number;
}

export type ResolvedQuality = Exclude<QualityLevel, 'auto'>;

const QUALITY = {
  low: { pixelRatio: 1, shadows: false, shadowSize: 0, antialias: false },
  medium: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, antialias: true },
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, antialias: true },
} as const;

/** Qualité initiale « auto » : prudente sur petit écran tactile. */
export function resolveQuality(level: QualityLevel): ResolvedQuality {
  if (level !== 'auto') return level;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse) return cores >= 8 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}

/**
 * Scène Three.js : consomme l'état de la simulation et ne décide jamais d'un gain.
 */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);
  readonly objects: ObjectRenderer;
  readonly cabinet: CabinetParts;
  private readonly key: THREE.DirectionalLight;
  private readonly accentLights: THREE.PointLight[] = [];
  private theme: Theme = THEMES[0]!;
  private readonly g: MachineGeometry;
  private margins: ViewMargins = { top: 0, bottom: 0 };
  quality: ResolvedQuality;

  constructor(canvas: HTMLCanvasElement, config: GameConfig, g: MachineGeometry, quality: ResolvedQuality) {
    this.g = g;
    this.quality = quality;
    const q = QUALITY[quality];
    // Canvas transparent : le fond de page (dégradé CSS ou image `background.*`) reste visible autour de la borne.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = null;
    this.scene.fog = new THREE.Fog('#080d1b', 2.4, 5);
    this.scene.environment = arcadeEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.9;

    const hemi = new THREE.HemisphereLight('#8fb2ff', '#0b1020', 0.55);
    this.scene.add(hemi);
    this.key = new THREE.DirectionalLight('#fff3e2', 2.4);
    this.key.position.set(-0.7, 2.2, 1.4);
    this.key.target.position.set(0, 0, -0.1);
    this.key.castShadow = q.shadows;
    if (q.shadows) {
      const s = this.key.shadow;
      s.mapSize.set(q.shadowSize, q.shadowSize);
      s.camera.left = -0.85;
      s.camera.right = 0.85;
      s.camera.top = 0.95;
      s.camera.bottom = -0.95;
      s.camera.near = 0.5;
      s.camera.far = 4.5;
      s.bias = -0.0004;
      s.normalBias = 0.012;
      s.radius = 3;
    }
    this.scene.add(this.key, this.key.target);
    const cyan = new THREE.PointLight('#54e5ec', 0.9, 2.2, 1.6);
    cyan.position.set(-0.75, 0.55, 0.35);
    const magenta = new THREE.PointLight('#ed69c1', 0.8, 2.2, 1.6);
    magenta.position.set(0.75, 0.55, 0.35);
    const warm = new THREE.PointLight('#ffcf7a', 0.6, 1.8, 1.4);
    warm.position.set(0, 0.45, g.frontZ + 0.35);
    this.scene.add(cyan, magenta, warm);
    this.accentLights.push(cyan, magenta);

    this.cabinet = buildCabinet(g);
    this.scene.add(this.cabinet.root);
    this.objects = new ObjectRenderer(config, config.simulation.maxPhysicalObjects);
    this.scene.add(this.objects.group);
  }

  /** Change la qualité sans toucher à la simulation. */
  setQuality(quality: ResolvedQuality): void {
    this.quality = quality;
    const q = QUALITY[quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    if (this.renderer.shadowMap.enabled !== q.shadows) {
      this.renderer.shadowMap.enabled = q.shadows;
      this.key.castShadow = q.shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true;
      });
    }
    if (q.shadows && this.key.shadow.mapSize.x !== q.shadowSize) {
      this.key.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
  }

  /** Applique un thème (couleurs seulement : aucune incidence sur la simulation). */
  applyTheme(theme: Theme): void {
    this.theme = theme;
    const c = this.cabinet;
    c.leds.cyan.color.set(theme.leds.cyan).multiplyScalar(1.4);
    c.leds.magenta.color.set(theme.leds.magenta).multiplyScalar(1.3);
    c.leds.gold.color.set(theme.leds.gold).multiplyScalar(1.3);
    c.hull.color.set(theme.hull);
    c.panel.color.set(theme.panel);
    this.accentLights[0]?.color.set(theme.leds.cyan);
    this.accentLights[1]?.color.set(theme.leds.magenta);
  }

  /** Ambiance lumineuse : Fever (pulsation magenta/or), super poussée (liseré du pousseur). */
  setMood(fever: boolean, superPush: boolean, time: number, reduced: boolean): void {
    const leds = this.cabinet.leds;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 6);
    if (fever) leds.cyan.color.setRGB(1.3 + 0.4 * pulse, 0.45 + 0.3 * pulse, 1.1);
    else leds.cyan.color.set(this.theme.leds.cyan).multiplyScalar(1.4);
    leds.gold.color.set(superPush ? '#ffe7a6' : this.theme.leds.gold).multiplyScalar(superPush ? 1.6 + 0.4 * pulse : 1.3);
  }

  /** Anneau lumineux bref sur le plateau bas (onde de choc). */
  pulseRing(x: number, z: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.02, 0.035, 48),
      new THREE.MeshBasicMaterial({ color: '#ed69c1', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, this.g.lowerY + 0.03, z);
    this.scene.add(ring);
    const start = performance.now();
    const grow = () => {
      const t = (performance.now() - start) / 600;
      if (t >= 1) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
        return;
      }
      ring.scale.setScalar(1 + t * 11);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      requestAnimationFrame(grow);
    };
    requestAnimationFrame(grow);
  }

  setMargins(m: ViewMargins): void {
    this.margins = m;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.frameCamera(width, height);
  }

  /**
   * Cadrage fixe : direction de vue constante, distance et décalage vertical calculés
   * pour que la borne utile tienne entre les compteurs et les commandes, en paysage comme en portrait.
   */
  private frameCamera(width: number, height: number): void {
    const g = this.g;
    const cam = this.camera;
    const xs = g.outerHalfWidth + 0.03;
    const keyPoints = [
      new THREE.Vector3(-xs, g.lowerY - 0.04, g.frontZ + 0.26),
      new THREE.Vector3(xs, g.lowerY - 0.04, g.frontZ + 0.26),
      new THREE.Vector3(-xs, g.upperY + 0.27, g.backZ),
      new THREE.Vector3(xs, g.upperY + 0.27, g.backZ),
      new THREE.Vector3(0, g.upperY + g.wallHeight + 0.1, g.backZ),
    ];
    const portrait = height > width;
    const dir = new THREE.Vector3(0, portrait ? 0.78 : 0.62, portrait ? 0.62 : 0.78).normalize();
    const target = new THREE.Vector3(0, 0.06, -0.02);
    const topLimit = 1 - (2 * this.margins.top) / height - 0.02;
    const bottomLimit = -1 + (2 * this.margins.bottom) / height + 0.02;
    const available = Math.max(0.4, topLimit - bottomLimit);
    cam.clearViewOffset();
    const ndc = new THREE.Vector3();
    const measure = (d: number) => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let minY = Infinity;
      let maxY = -Infinity;
      let maxX = 0;
      for (const p of keyPoints) {
        ndc.copy(p).project(cam);
        minY = Math.min(minY, ndc.y);
        maxY = Math.max(maxY, ndc.y);
        maxX = Math.max(maxX, Math.abs(ndc.x));
      }
      return { minY, maxY, maxX };
    };
    let lo = 0.6;
    let hi = 8;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const m = measure(mid);
      if (m.maxX <= 0.97 && m.maxY - m.minY <= available) hi = mid;
      else lo = mid;
    }
    const m = measure(hi);
    // Le brouillard ne touche que le décor lointain, quelle que soit la distance de cadrage.
    const fog = this.scene.fog as THREE.Fog;
    fog.near = hi + 0.9;
    fog.far = hi + 3.6;
    // Décalage vertical de l'image pour centrer la borne dans la zone libre.
    const shiftNdc = (topLimit + bottomLimit) / 2 - (m.maxY + m.minY) / 2;
    cam.setViewOffset(width, height, 0, (-shiftNdc * height) / 2, width, height);
    cam.updateProjectionMatrix();
  }

  render(sim: Simulation, alpha: number, frameDt: number): void {
    const k = sim.kinematics;
    updateCabinet(this.cabinet, this.g, {
      pusherZ: k.prevPusherZ + (k.pusherZ - k.prevPusherZ) * alpha,
      chuteX: k.prevChuteX + (k.chuteX - k.prevChuteX) * alpha,
      barrier: k.prevBarrier + (k.barrier - k.prevBarrier) * alpha,
    });
    this.objects.update(sim, alpha, frameDt);
    this.renderer.render(this.scene, this.camera);
  }

  /** Projette un point du monde en pixels CSS (positions de libellés HTML). */
  project(p: THREE.Vector3Like, width: number, height: number): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  }

  /** X monde sur la ligne de la goulotte correspondant à une abscisse écran (visée à la souris). */
  screenToChuteX(clientX: number, clientY: number, rect: DOMRect): number {
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.g.upperY + 0.12));
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, hit) ? hit.x : 0;
  }

  info(): { drawCalls: number; triangles: number; textures: number; geometries: number } {
    const i = this.renderer.info;
    return { drawCalls: i.render.calls, triangles: i.render.triangles, textures: i.memory.textures, geometries: i.memory.geometries };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

/** Environnement de reflets procédural : salle sombre et panneaux lumineux cyan/magenta/or. */
function arcadeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: '#0b1426', side: THREE.BackSide }));
  env.add(room);
  const panel = (color: string, intensity: number, w: number, h: number, pos: [number, number, number], rotY = 0, rotX = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(rotX, rotY, 0);
    env.add(m);
  };
  panel('#fff1dc', 3.0, 4, 2.2, [0, 2.9, 0.6], 0, Math.PI / 2);
  panel('#54e5ec', 2.4, 2.6, 1.4, [-4.9, 1.2, 0], Math.PI / 2);
  panel('#ed69c1', 2.2, 2.6, 1.4, [4.9, 1.2, 0], -Math.PI / 2);
  panel('#f6bd54', 2.0, 5, 0.8, [0, 0.6, 4.9], Math.PI);
  // Grande source chaude derrière/au-dessus de la borne : c'est elle que reflètent les faces
  // horizontales vues depuis la caméra (sinon le métal paraît noir).
  panel('#ffe6b8', 2.6, 7, 2.6, [0, 2.4, -4.9]);
  panel('#9fc4ff', 1.4, 7, 1.2, [0, 0.9, -4.9]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return texture;
}
