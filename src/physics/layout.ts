import type { GameConfig, ObjectType } from '../config/schema.ts';
import { pickWeighted, Rng } from '../engine/rng.ts';
import type { MachineGeometry } from './geometry.ts';
import type { Quat, Vec3 } from './machine.ts';

export interface Placement {
  type: ObjectType;
  /** Couleur de gemme ou pouvoir ; null pour les autres types. */
  variant: string | null;
  position: Vec3;
  rotation: Quat;
}

/** Sous-type d'un objet : gemme tirée dans la collection, pouvoir selon ses poids. */
export function drawVariant(config: GameConfig, rng: Rng, type: ObjectType): string | null {
  if (type === 'gem') return config.collection.gemIds[rng.int(config.collection.gemIds.length)]!;
  if (type === 'power') return pickWeighted(rng, config.distribution.powerWeights);
  return null;
}

const COVETED: readonly ObjectType[] = ['chest', 'gem', 'wheel', 'star', 'power'];

/** Rotation aléatoire autour de Y, avec une légère inclinaison facultative. */
export function randomYaw(rng: Rng, tilt = 0): Quat {
  const yaw = rng.range(0, Math.PI * 2);
  const qy = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
  if (tilt === 0) return qy;
  const a = rng.range(-tilt, tilt);
  const qx = { x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) };
  // qy * qx
  return {
    x: qy.w * qx.x + qy.x * qx.w + qy.y * qx.z - qy.z * qx.y,
    y: qy.w * qx.y - qy.x * qx.z + qy.y * qx.w + qy.z * qx.x,
    z: qy.w * qx.z + qy.x * qx.y - qy.y * qx.x + qy.z * qx.w,
    w: qy.w * qx.w - qy.x * qx.x - qy.y * qx.y - qy.z * qx.z,
  };
}

interface Region {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

/** Points d'une grille hexagonale bruitée couvrant la région, triés de l'avant vers l'arrière. */
function hexPoints(region: Region, spacing: number, jitter: number, rng: Rng): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const rowStep = spacing * Math.sqrt(3) / 2;
  let row = 0;
  for (let z = region.maxZ; z >= region.minZ - 1e-9; z -= rowStep, row++) {
    const offset = row % 2 ? spacing / 2 : 0;
    for (let x = region.minX + offset; x <= region.maxX + 1e-9; x += spacing) {
      const px = Math.min(region.maxX, Math.max(region.minX, x + rng.range(-jitter, jitter)));
      const pz = Math.min(region.maxZ, Math.max(region.minZ, z + rng.range(-jitter, jitter)));
      pts.push({ x: px, z: pz });
    }
  }
  return pts;
}

/**
 * Disposition initiale reproductible : composition et positions ont des flux
 * séparés. La première couche remplit chaque plateau de l'avant vers l'arrière,
 * le surplus forme une seconde couche posée dessus.
 */
export function generateInitialLayout(config: GameConfig, g: MachineGeometry, seed: string, count = config.machine.initialObjects): Placement[] {
  const composition = Rng.fromSeed(seed, 'layout-composition');
  const rng = Rng.fromSeed(seed, 'layout-position');
  const r = g.coinRadius;
  const halfT = g.coinHalfThickness;
  const types: ObjectType[] = [];
  for (let i = 0; i < count; i++) types.push(pickWeighted(composition, config.machine.initialCompositionWeights));

  const gap = 0.006;
  const spacing = 2 * r + gap;
  const xMin = -g.deckHalfWidth + r + 0.003;
  const xMax = g.deckHalfWidth - r - 0.003;
  const lower: Region = { minX: xMin, maxX: xMax, minZ: g.pusher.retractedZ + r + 0.004, maxZ: g.frontZ - 0.3 * r, y: g.lowerY };
  const upper: Region = { minX: xMin, maxX: xMax, minZ: g.backZ + r + 0.004, maxZ: g.pusher.retractedZ - 0.35 * r, y: g.upperY };

  const lowerPts = hexPoints(lower, spacing, gap / 2, rng);
  const upperPts = hexPoints(upper, spacing, gap / 2, rng);
  const lowerArea = (lower.maxX - lower.minX) * (lower.maxZ - lower.minZ);
  const upperArea = (upper.maxX - upper.minX) * (upper.maxZ - upper.minZ);

  // Répartition proportionnelle à la surface, bornée par la capacité de la première couche.
  let nLower = Math.round((count * lowerArea) / (lowerArea + upperArea));
  let nUpper = count - nLower;
  const placements: Placement[] = [];
  // Couches successives sur grilles hexagonales décalées : chaque couche repose sur la précédente.
  const layer = (pts: { x: number; z: number }[], n: number, region: Region) => {
    let placed = 0;
    for (let k = 0; placed < n && k < 4; k++) {
      const grid = k === 0 ? pts : hexPoints({ ...region, minX: region.minX + spacing / 2, maxZ: region.maxZ - r * (0.4 + 0.3 * k) }, spacing, gap / 2, rng);
      const take = grid.slice(0, n - placed);
      for (const p of take) {
        placements.push({
          type: 'normal',
          variant: null,
          position: { x: p.x, y: region.y + (2 * k + 1) * halfT + 0.0005 + k * 0.003, z: p.z },
          rotation: randomYaw(rng, k === 0 ? 0 : 0.05),
        });
      }
      placed += take.length;
    }
    return placed;
  };
  nLower = layer(lowerPts, nLower, lower);
  nUpper = layer(upperPts, nUpper, upper);

  // Types : quelques objets convoités sur la première couche du plateau bas, près du bord.
  const order = placements.map((_, i) => i);
  const nearFront = order
    .slice(0, nLower)
    .filter((i) => {
      const z = placements[i]!.position.z;
      return z < g.frontZ - 2 * r && z > g.frontZ - 5 * r && placements[i]!.position.y < g.lowerY + 2 * halfT + 0.002;
    });
  const covetedIdx = types.map((t, i) => (COVETED.includes(t) ? i : -1)).filter((i) => i >= 0);
  const assigned = new Set<number>();
  for (let k = 0; k < Math.min(2, covetedIdx.length, nearFront.length); k++) {
    const slot = nearFront.splice(rng.int(nearFront.length), 1)[0]!;
    placements[slot]!.type = types[covetedIdx[k]!]!;
    assigned.add(covetedIdx[k]!);
  }
  const free = order.filter((i) => placements[i]!.type === 'normal');
  // Mélange de Fisher-Yates des emplacements restants.
  for (let i = free.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [free[i], free[j]] = [free[j]!, free[i]!];
  }
  const firstLayer = (i: number) => {
    const p = placements[i]!.position;
    const base = p.y > g.upperY - 0.01 ? g.upperY : g.lowerY;
    return p.y < base + 2 * halfT;
  };
  let cursor = 0;
  types.forEach((t, i) => {
    if (assigned.has(i)) return;
    // Un coffre (collider boîte) ne se pose que sur la première couche.
    const k = t === 'chest' ? free.findIndex((slot, j) => j >= cursor && firstLayer(slot)) : cursor;
    if (k < 0 || k >= free.length) return;
    [free[cursor], free[k]] = [free[k]!, free[cursor]!];
    placements[free[cursor++]!]!.type = t;
  });
  for (const p of placements) p.variant = drawVariant(config, composition, p.type);
  const chest = config.machine.chest;
  const reach = r + Math.hypot(chest.width, chest.depth) / 2;
  for (const p of placements) {
    if (p.type !== 'chest') continue;
    const base = p.position.y > g.upperY - 0.01 ? g.upperY : g.lowerY;
    p.position.y = base + chest.height / 2 + 0.001;
    // Les pièces de seconde couche au-dessus du coffre sont posées sur son couvercle.
    for (const q of placements) {
      if (q === p || q.type === 'chest') continue;
      const close = (q.position.x - p.position.x) ** 2 + (q.position.z - p.position.z) ** 2 < reach * reach;
      if (close && q.position.y > base + 2 * halfT) q.position.y = base + chest.height + halfT + 0.004;
    }
  }
  return placements;
}
