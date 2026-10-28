import type { GameConfig } from '../config/schema.ts';

/**
 * Cotes dérivées de la configuration, partagées par la physique et le rendu.
 * Repère : X gauche→droite, Y vertical, Z vers le joueur. Le bord de collecte
 * est en +Z, le mur de fond du plateau haut en −Z.
 */
export interface MachineGeometry {
  coinRadius: number;
  coinHalfThickness: number;
  /** Demi-largeur des plateaux jouables (bord des gouttières latérales). */
  deckHalfWidth: number;
  /** Face intérieure des parois extérieures (fond des gouttières). */
  outerHalfWidth: number;
  sideLossWidth: number;
  /** Les gouttières latérales s'ouvrent à partir de ce Z (joues pleines avant). */
  sideOpenZ: number;
  /** Face avant du mur de fond qui racle le plateau haut. */
  backZ: number;
  /** Bord de collecte du plateau bas. */
  frontZ: number;
  lowerY: number;
  upperY: number;
  pusher: {
    /** Position Z de la face avant à la phase 0 (rentré). */
    retractedZ: number;
    stroke: number;
    maxStroke: number;
    /** Profondeur totale du bloc : il reste sous le mur de fond même sorti au maximum. */
    depth: number;
    period: number;
  };
  /** Sous ce plan, un objet a franchi le rebord : collecte ou perte définitive. */
  exitPlaneY: number;
  /** Un objet terminal est retiré sous cette hauteur (ou après un délai). */
  removeY: number;
  safetyMin: [number, number, number];
  safetyMax: [number, number, number];
  wallHeight: number;
  chute: {
    angle: number;
    length: number;
    halfWidth: number;
    railThickness: number;
    railHeight: number;
    floorThickness: number;
    exitY: number;
    exitZ: number;
    minX: number;
    maxX: number;
    speed: number;
    /** Distance de la position d'apparition depuis le haut de la goulotte, le long de la pente. */
    spawnOffset: number;
    spawnSpeed: number;
  };
  /** Entrées des distributions gratuites, au fond du plateau haut. */
  bonusEntry: { y: number; z: number; minX: number; maxX: number };
  barrier: { thickness: number; raisedTop: number; loweredTop: number; riseSeconds: number };
}

export function computeGeometry(config: GameConfig): MachineGeometry {
  const m = config.machine;
  const r = m.coin.radius;
  const halfT = m.coin.thickness / 2;
  const outerHalfWidth = m.width / 2;
  const deckHalfWidth = outerHalfWidth - m.sideLossWidth;
  const backZ = -m.depth / 2;
  const frontZ = m.depth / 2;
  const maxStroke = m.pusherStroke * config.bonus.superPush.strokeFactor;
  const lowerY = m.lowerDeckHeight;
  const upperY = m.upperDeckHeight;

  // La rampe descend de l'avant vers le mur de fond : la pièce se dépose dans la bande
  // balayée par le mur (course du pousseur), seule zone où elle fait avancer le tapis.
  const chuteAngle = (28 * Math.PI) / 180;
  const chuteLength = 0.25;
  const chuteHalfWidth = r + 0.012;
  const railThickness = 0.008;
  const exitZ = backZ + 0.15;
  const chuteReach = deckHalfWidth - chuteHalfWidth - railThickness - 0.004;

  return {
    coinRadius: r,
    coinHalfThickness: halfT,
    deckHalfWidth,
    outerHalfWidth,
    sideLossWidth: m.sideLossWidth,
    sideOpenZ: backZ + m.upperDeckDepth + m.sideGuardDepth,
    backZ,
    frontZ,
    lowerY,
    upperY,
    pusher: {
      retractedZ: backZ + m.upperDeckDepth,
      stroke: m.pusherStroke,
      maxStroke,
      depth: m.upperDeckDepth + maxStroke + 0.12,
      period: m.pusherPeriodSeconds,
    },
    exitPlaneY: lowerY - 0.03,
    removeY: lowerY - 0.16,
    safetyMin: [-outerHalfWidth - 0.5, lowerY - 1.5, backZ - 1],
    safetyMax: [outerHalfWidth + 0.5, upperY + 1.5, frontZ + 1],
    wallHeight: 0.42,
    chute: {
      angle: chuteAngle,
      length: chuteLength,
      halfWidth: chuteHalfWidth,
      railThickness,
      railHeight: 0.035,
      floorThickness: 0.01,
      exitY: upperY + 0.07,
      exitZ,
      minX: -chuteReach,
      maxX: chuteReach,
      speed: m.rampSpeed,
      spawnOffset: r + 0.012,
      spawnSpeed: 0.35,
    },
    bonusEntry: {
      y: upperY + 0.2,
      z: backZ + r + 0.012,
      minX: -deckHalfWidth + r + 0.01,
      maxX: deckHalfWidth - r - 0.01,
    },
    barrier: { thickness: 0.008, raisedTop: lowerY + 0.045, loweredTop: lowerY - 0.2, riseSeconds: 0.45 },
  };
}

/** Position Z de la face avant du pousseur pour une phase de cycle dans [0, 1). */
export function pusherFrontZ(g: MachineGeometry, phase: number, stroke: number): number {
  return g.pusher.retractedZ + (stroke * (1 - Math.cos(2 * Math.PI * phase))) / 2;
}

/**
 * Repère de la goulotte (indépendant de X) : `dir` descend la pente vers le mur de fond,
 * `normal` est la normale du plancher orientée vers le haut, `tilt` l'angle de rotation autour de X.
 */
export function chuteFrame(g: MachineGeometry) {
  const { angle, length, exitY, exitZ } = g.chute;
  const dir = { y: -Math.sin(angle), z: -Math.cos(angle) };
  const normal = { y: Math.cos(angle), z: -Math.sin(angle) };
  const top = { y: exitY - dir.y * length, z: exitZ - dir.z * length };
  return { dir, normal, top, exit: { y: exitY, z: exitZ }, tilt: -angle };
}
