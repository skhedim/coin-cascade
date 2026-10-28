import * as THREE from 'three';
import { reportAssetFailure, resolveAsset } from '../assets/manifest.ts';
import type { GameConfig, ObjectType } from '../config/schema.ts';
import type { ExitRecord, Simulation } from '../game/simulation.ts';
import { createChestGeometry, createCoinGeometry, createGemGeometry } from './geometries.ts';
import { classicFace, goldFace, paintFace, powerFace, starFace, wheelFace, type FacePainter } from './textures.ts';

export type VisualKind = 'normal' | 'gold' | 'star' | 'wheel' | 'gem' | 'chest' | 'power-barriers' | 'power-superPush' | 'power-shockwave';

export function visualKindOf(type: ObjectType, variant: string | null): VisualKind {
  if (type === 'power') return `power-${variant ?? 'shockwave'}` as VisualKind;
  return type;
}

export const GEM_COLORS: Record<string, string> = {
  ruby: '#ff2d6f',
  sapphire: '#3d6bff',
  emerald: '#1fd38a',
  amethyst: '#a66bff',
  diamond: '#e6fbff',
};

interface ExitAnim {
  kind: VisualKind;
  variant: string | null;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Quaternion;
  spin: THREE.Quaternion;
  age: number;
  life: number;
}

const tmpPos = new THREE.Vector3();
const tmpPos2 = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpQuat2 = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();

/** Pièces et objets spéciaux : un maillage instancié par apparence. */
export class ObjectRenderer {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<VisualKind, THREE.InstancedMesh>();
  private readonly counts = new Map<VisualKind, number>();
  private readonly exits: ExitAnim[] = [];
  private readonly sparks: Sparks;
  reducedEffects = false;
  private goldGlow: THREE.MeshStandardMaterial[] = [];
  private time = 0;

  constructor(config: GameConfig, capacity: number) {
    const coin = config.machine.coin;
    const coinGeo = createCoinGeometry(coin.radius, coin.thickness);
    const faceMaterials = (painter: FacePainter, rim: THREE.MeshStandardMaterialParameters, assetId?: string) => {
      const tex = paintFace(painter);
      // Métal légèrement diffus : la face reste lisible même face à un reflet sombre.
      const face = new THREE.MeshStandardMaterial({ map: tex.map, roughnessMap: tex.data, metalnessMap: tex.data, metalness: 0.82, roughness: 1.25 });
      const asset = assetId ? resolveAsset(assetId) : null;
      if (asset?.kind === 'file') {
        // Image livrée : carte couleur seulement (aucune carte PBR déduite de l'illustration).
        new THREE.TextureLoader().load(
          asset.url,
          (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 4;
            // La lueur éventuelle (pièce dorée) suit l'image livrée.
            if (face.emissiveMap) face.emissiveMap = t;
            face.map = t;
            face.roughnessMap = face.metalnessMap = null;
            face.metalness = 0.6;
            face.roughness = 0.38;
            face.needsUpdate = true;
          },
          undefined,
          () => reportAssetFailure(assetId!, 'chargement impossible'),
        );
      }
      return [face, new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.32, ...rim })];
    };
    const kinds: [VisualKind, THREE.BufferGeometry, THREE.Material | THREE.Material[]][] = [
      ['normal', coinGeo, faceMaterials(classicFace, { color: '#d9d2bf' }, 'coin.face.classic')],
      ['gold', coinGeo, faceMaterials(goldFace, { color: '#ffc44d', roughness: 0.22, emissive: '#ff9d00', emissiveIntensity: 0.45 }, 'coin.face.gold')],
      ['star', coinGeo, faceMaterials(starFace, { color: '#ed69c1', metalness: 0.2, roughness: 0.25, emissive: '#5a0a3a', emissiveIntensity: 0.5 })],
      ['wheel', coinGeo, faceMaterials(wheelFace, { color: '#54e5ec', metalness: 0.4, roughness: 0.25, emissive: '#06383c', emissiveIntensity: 0.6 })],
      ['power-barriers', coinGeo, faceMaterials(powerFace('barriers'), { color: '#54e5ec', metalness: 0.6 })],
      ['power-superPush', coinGeo, faceMaterials(powerFace('superPush'), { color: '#f6bd54', metalness: 0.9 })],
      ['power-shockwave', coinGeo, faceMaterials(powerFace('shockwave'), { color: '#ed69c1', metalness: 0.5 })],
      [
        'gem',
        createGemGeometry(coin.radius, coin.thickness),
        new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          metalness: 0,
          roughness: 0.04,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          iridescence: 0.4,
          emissive: '#ffffff',
          emissiveIntensity: 0.12,
          flatShading: true,
        }),
      ],
      [
        'chest',
        createChestGeometry(config.machine.chest.width, config.machine.chest.height, config.machine.chest.depth),
        new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.45 }),
      ],
    ];
    // Lueur chaude de la pièce dorée : suit le dessin de la face (carte couleur en émissive).
    const [goldFaceMat, goldRimMat] = kinds.find(([k]) => k === 'gold')![2] as THREE.MeshStandardMaterial[];
    goldFaceMat!.emissive.set('#ff9d00');
    goldFaceMat!.emissiveMap = goldFaceMat!.map;
    goldFaceMat!.emissiveIntensity = 0.3;
    this.goldGlow = [goldFaceMat!, goldRimMat!];
    for (const [kind, geo, mat] of kinds) {
      const size = kind === 'normal' || kind === 'gold' ? capacity : Math.max(16, Math.ceil(capacity / 4));
      const mesh = new THREE.InstancedMesh(geo, mat, size);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      if (kind === 'gem') mesh.setColorAt(0, tmpColor.set('#ffffff'));
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
    this.sparks = new Sparks(600);
    this.group.add(this.sparks.points);
  }

  private put(kind: VisualKind, variant: string | null, matrix: THREE.Matrix4): void {
    const mesh = this.meshes.get(kind)!;
    const i = this.counts.get(kind) ?? 0;
    if (i >= mesh.instanceMatrix.count) return; // capacité visuelle atteinte : l'objet reste simulé
    mesh.setMatrixAt(i, matrix);
    if (kind === 'gem') mesh.setColorAt(i, tmpColor.set(GEM_COLORS[variant ?? ''] ?? '#ffffff'));
    this.counts.set(kind, i + 1);
  }

  /** Lance les animations de sortie pour les objets retirés au dernier pas. */
  addExits(exits: readonly ExitRecord[]): void {
    for (const e of exits) {
      const kind = visualKindOf(e.type, e.variant);
      const spinAxis = new THREE.Vector3(1, 0, 0.3).normalize();
      this.exits.push({
        kind,
        variant: e.variant,
        position: new THREE.Vector3(e.position.x, e.position.y, e.position.z),
        velocity: new THREE.Vector3(e.velocity.x, Math.min(e.velocity.y, 0), e.velocity.z),
        rotation: new THREE.Quaternion(e.rotation.x, e.rotation.y, e.rotation.z, e.rotation.w),
        spin: new THREE.Quaternion().setFromAxisAngle(spinAxis, e.kind === 'collected' ? 0.12 : 0.06),
        age: 0,
        life: 0.45,
      });
      if (e.kind === 'collected') {
        const gold = e.type === 'gold' || e.type === 'chest';
        this.sparks.burst(e.position, gold ? '#ffd27a' : '#fff3c9', this.reducedEffects ? 4 : gold ? 22 : 12, 0.9);
      } else if (e.kind === 'lost') {
        this.sparks.burst(e.position, '#ed69c1', this.reducedEffects ? 2 : 6, 0.5);
      }
    }
  }

  update(sim: Simulation, alpha: number, frameDt: number): void {
    this.time += frameDt;
    // Scintillement discret des pièces dorées (désactivé en effets réduits).
    const shimmer = this.reducedEffects ? 0 : Math.sin(this.time * 4.5) * 0.12;
    if (this.goldGlow.length === 2) {
      this.goldGlow[0]!.emissiveIntensity = 0.3 + shimmer;
      this.goldGlow[1]!.emissiveIntensity = 0.45 + shimmer;
    }
    this.counts.clear();
    for (const obj of sim.objects.values()) {
      if (obj.state !== 'active') continue;
      const p = obj.prev;
      const c = obj.curr;
      tmpPos.set(p[0]!, p[1]!, p[2]!).lerp(tmpPos2.set(c[0]!, c[1]!, c[2]!), alpha);
      tmpQuat.set(p[3]!, p[4]!, p[5]!, p[6]!).slerp(tmpQuat2.set(c[3]!, c[4]!, c[5]!, c[6]!), alpha);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      this.put(visualKindOf(obj.type, obj.variant), obj.variant, tmpMatrix);
    }
    // Chute visuelle après le plan de sortie : balistique, rétrécissement, sans physique.
    for (let i = this.exits.length - 1; i >= 0; i--) {
      const e = this.exits[i]!;
      e.age += frameDt;
      if (e.age >= e.life) {
        this.exits.splice(i, 1);
        continue;
      }
      e.velocity.y -= 9.81 * frameDt;
      e.position.addScaledVector(e.velocity, frameDt);
      e.rotation.multiply(e.spin);
      const s = 1 - (e.age / e.life) ** 2;
      tmpMatrix.compose(e.position, e.rotation, tmpPos.set(s, s, s));
      this.put(e.kind, e.variant, tmpMatrix);
    }
    for (const [kind, mesh] of this.meshes) {
      mesh.count = this.counts.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (kind === 'gem' && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.sparks.update(frameDt);
  }
}

/** Étincelles additives : un seul `Points`, couleurs atténuées jusqu'au noir. */
class Sparks {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly base: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly max: Float32Array;
  private cursor = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.base = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity).fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size: 0.018,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: sparkSprite(),
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  burst(at: { x: number; y: number; z: number }, color: string, n: number, speed: number): void {
    const c = tmpColor.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.8;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([at.x, Math.max(at.y, -0.02), at.z], i * 3);
      this.vel.set([Math.cos(a) * v * 0.6, up * v, Math.sin(a) * v * 0.6 + 0.15], i * 3);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.life[i] = this.max[i] = 0.35 + Math.random() * 0.35;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i]! <= 0) {
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.life[i]! -= dt;
      const k = Math.max(0, this.life[i]! / this.max[i]!);
      this.vel[i * 3 + 1]! -= 3.5 * dt;
      for (let a = 0; a < 3; a++) {
        this.pos[i * 3 + a]! += this.vel[i * 3 + a]! * dt;
        this.col[i * 3 + a] = this.base[i * 3 + a]! * k;
      }
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    this.points.geometry.attributes.color!.needsUpdate = true;
  }
}

function sparkSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
