import type RAPIER_NS from '@dimforge/rapier3d-compat';
import type { Collider, ColliderDesc, Cylinder, RigidBody, World } from '@dimforge/rapier3d-compat';
import type { GameConfig } from '../config/schema.ts';
import { chuteFrame, computeGeometry, pusherFrontZ, type MachineGeometry } from './geometry.ts';

export type Rapier = typeof RAPIER_NS;
export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };

export type CoinShape = 'cylinder' | 'round' | 'hull';

export interface BodySpec {
  position: Vec3;
  rotation: Quat;
  linvel?: Vec3;
  angvel?: Vec3;
  sleeping?: boolean;
}

export interface MachineOptions {
  coinShape?: CoinShape;
  /** Désactive le sommeil des pièces (mesure de référence). */
  noSleep?: boolean;
  /** Réglages d'étude du banc physique (valeurs par défaut de geometry.ts sinon). */
  tuning?: { chuteExitHeight?: number; chuteExitInset?: number; spawnSpeed?: number };
}

const quatAboutX = (angle: number): Quat => ({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) });

/**
 * Monde Rapier de la borne : décors fixes, pousseur et goulotte cinématiques,
 * barrières latérales. Ne connaît ni les règles ni les gains.
 */
export class MachinePhysics {
  readonly world: World;
  readonly geometry: MachineGeometry;
  readonly dt: number;

  private readonly pusher: RigidBody;
  private readonly chute: RigidBody;
  private readonly barriers: RigidBody[] = [];
  private readonly coinCollider: () => ColliderDesc;
  private readonly testShape: Cylinder;

  /** Phase du cycle de pousseur dans [0, 1) ; 0 = rentré. */
  pusherPhase = 0;
  pusherStroke: number;
  /** Cycles complets depuis la création. */
  cycle = 0;
  chuteX = 0;
  chuteTargetX = 0;
  /** 0 = barrières baissées, 1 = levées. */
  barrierLevel = 0;
  barrierTarget = 0;
  /** Course utilisée pour le prochain cycle (modifiée aux frontières de cycle uniquement). */
  nextStroke: number;

  private readonly R: Rapier;
  readonly config: GameConfig;
  private readonly options: MachineOptions;

  constructor(R: Rapier, config: GameConfig, options: MachineOptions = {}) {
    this.R = R;
    this.config = config;
    this.options = options;
    const g = (this.geometry = computeGeometry(config));
    const t = options.tuning;
    if (t?.chuteExitHeight !== undefined) g.chute.exitY = g.upperY + t.chuteExitHeight;
    if (t?.chuteExitInset !== undefined) g.chute.exitZ = g.backZ + t.chuteExitInset;
    if (t?.spawnSpeed !== undefined) g.chute.spawnSpeed = t.spawnSpeed;
    const sim = config.simulation;
    this.dt = sim.fixedStepSeconds;
    this.pusherStroke = this.nextStroke = g.pusher.stroke;

    const world = (this.world = new R.World({ x: 0, y: sim.gravityY, z: 0 }));
    world.timestep = this.dt;
    world.lengthUnit = sim.lengthUnit;
    world.numSolverIterations = sim.solverIterations;

    this.buildStatic();
    this.pusher = this.buildPusher();
    this.chute = this.buildChute();
    this.buildBarriers();

    const coin = config.machine.coin;
    const shape = options.coinShape ?? 'round';
    const halfT = g.coinHalfThickness;
    const r = g.coinRadius;
    this.coinCollider = () => {
      let desc: ColliderDesc | null;
      if (shape === 'cylinder') desc = R.ColliderDesc.cylinder(halfT, r);
      else if (shape === 'round') {
        const border = Math.min(0.002, halfT * 0.3);
        desc = R.ColliderDesc.roundCylinder(halfT - border, r - border, border);
      } else desc = R.ColliderDesc.convexHull(prismPoints(r, halfT, 14));
      if (!desc) throw new Error('Collider de pièce impossible');
      return desc.setMass(coin.mass).setFriction(coin.friction).setRestitution(coin.restitution);
    };
    this.testShape = new R.Cylinder(halfT, r);
  }

  // --- Construction -------------------------------------------------------

  private fixedBox(body: RigidBody, min: Vec3, max: Vec3, friction = this.config.machine.deckFriction): Collider {
    const desc = this.R.ColliderDesc.cuboid((max.x - min.x) / 2, (max.y - min.y) / 2, (max.z - min.z) / 2)
      .setTranslation((max.x + min.x) / 2, (max.y + min.y) / 2, (max.z + min.z) / 2)
      .setFriction(friction)
      .setRestitution(0.05);
    return this.world.createCollider(desc, body);
  }

  private buildStatic(): void {
    const g = this.geometry;
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.fixed());
    const top = g.upperY + g.wallHeight;
    const farBack = g.pusher.retractedZ - g.pusher.depth - 0.1;
    // Plateau bas : épais pour exclure tout passage à travers.
    this.fixedBox(body, { x: -g.deckHalfWidth, y: g.lowerY - 0.12, z: farBack }, { x: g.deckHalfWidth, y: g.lowerY, z: g.frontZ });
    // Parois extérieures (fond des gouttières latérales).
    for (const s of [-1, 1]) {
      const inner = s * g.outerHalfWidth;
      const outer = s * (g.outerHalfWidth + 0.06);
      this.fixedBox(
        body,
        { x: Math.min(inner, outer), y: g.lowerY - 0.5, z: farBack },
        { x: Math.max(inner, outer), y: top, z: g.frontZ + 0.3 },
        0.2,
      );
      // Joues au-dessus du plateau haut : pas de perte latérale depuis le niveau supérieur.
      const reach = g.pusher.retractedZ + g.pusher.maxStroke + 0.01;
      const a = s * g.deckHalfWidth;
      this.fixedBox(
        body,
        { x: Math.min(a, inner), y: g.upperY + 0.002, z: farBack },
        { x: Math.max(a, inner), y: top, z: reach },
        0.2,
      );
      // Joues basses : la gouttière ne s'ouvre que sur l'avant du plateau bas.
      this.fixedBox(
        body,
        { x: Math.min(a, inner), y: g.lowerY - 0.12, z: g.pusher.retractedZ },
        { x: Math.max(a, inner), y: g.upperY + 0.002, z: g.sideOpenZ },
        0.2,
      );
    }
    // Mur de fond : son arête basse frôle le dessus du pousseur et racle les pièces.
    this.fixedBox(body, { x: -g.outerHalfWidth, y: g.upperY + 0.002, z: g.backZ - 0.06 }, { x: g.outerHalfWidth, y: top, z: g.backZ }, 0.25);
    // Bac de collecte et fosse des gouttières (filet de sécurité sous le plan de sortie).
    this.fixedBox(body, { x: -g.outerHalfWidth, y: g.lowerY - 0.62, z: farBack }, { x: g.outerHalfWidth, y: g.lowerY - 0.5, z: g.frontZ + 0.3 });
    this.fixedBox(body, { x: -g.outerHalfWidth, y: g.lowerY - 0.5, z: g.frontZ + 0.24 }, { x: g.outerHalfWidth, y: g.lowerY - 0.03, z: g.frontZ + 0.3 });
  }

  private buildPusher(): RigidBody {
    const g = this.geometry;
    const body = this.world.createRigidBody(
      this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, g.pusher.retractedZ),
    );
    const h = g.upperY - g.lowerY - 0.001;
    const desc = this.R.ColliderDesc.cuboid(g.deckHalfWidth, h / 2, g.pusher.depth / 2)
      .setTranslation(0, g.lowerY + 0.001 + h / 2, -g.pusher.depth / 2)
      .setFriction(this.config.machine.deckFriction)
      .setRestitution(0.05);
    this.world.createCollider(desc, body);
    return body;
  }

  private buildChute(): RigidBody {
    const g = this.geometry;
    const c = g.chute;
    const f = chuteFrame(g);
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased());
    const rot = quatAboutX(f.tilt);
    const midY = (f.top.y + f.exit.y) / 2;
    const midZ = (f.top.z + f.exit.z) / 2;
    const add = (hx: number, hy: number, hz: number, x: number, along: number) => {
      // `along` décale selon la normale du plancher de la goulotte.
      const desc = this.R.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, midY + f.normal.y * along, midZ + f.normal.z * along)
        .setRotation(rot)
        .setFriction(0.25)
        .setRestitution(0.02);
      this.world.createCollider(desc, body);
    };
    const outer = c.halfWidth + c.railThickness;
    add(outer, c.floorThickness / 2, c.length / 2, 0, -c.floorThickness / 2);
    for (const s of [-1, 1]) add(c.railThickness / 2, c.railHeight / 2, c.length / 2, s * (c.halfWidth + c.railThickness / 2), c.railHeight / 2);
    return body;
  }

  private buildBarriers(): void {
    const g = this.geometry;
    const b = g.barrier;
    const height = b.raisedTop - (g.lowerY - 0.26);
    for (const s of [-1, 1]) {
      const body = this.world.createRigidBody(
        this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(s * (g.deckHalfWidth + b.thickness / 2), b.loweredTop - height / 2, 0),
      );
      const z0 = g.pusher.retractedZ;
      const desc = this.R.ColliderDesc.cuboid(b.thickness / 2, height / 2, (g.frontZ - z0) / 2)
        .setTranslation(0, 0, (g.frontZ + z0) / 2)
        .setFriction(0.2);
      this.world.createCollider(desc, body);
      this.barriers.push(body);
    }
  }

  // --- Objets dynamiques ---------------------------------------------------

  createObjectBody(spec: BodySpec, shape: 'coin' | 'chest' = 'coin'): RigidBody {
    const coin = this.config.machine.coin;
    const sim = this.config.simulation;
    const desc = this.R.RigidBodyDesc.dynamic()
      .setTranslation(spec.position.x, spec.position.y, spec.position.z)
      .setRotation(spec.rotation)
      .setLinearDamping(coin.linearDamping)
      .setAngularDamping(coin.angularDamping)
      .setSoftCcdPrediction(sim.softCcdPrediction)
      .setCanSleep(!this.options.noSleep)
      .setSleeping(spec.sleeping ?? false);
    if (spec.linvel) desc.setLinvel(spec.linvel.x, spec.linvel.y, spec.linvel.z);
    if (spec.angvel) desc.setAngvel(spec.angvel);
    const body = this.world.createRigidBody(desc);
    if (shape === 'chest') {
      const c = this.config.machine.chest;
      const collider = this.R.ColliderDesc.roundCuboid(c.width / 2 - 0.003, c.height / 2 - 0.003, c.depth / 2 - 0.003, 0.003)
        .setMass(c.mass)
        .setFriction(coin.friction)
        .setRestitution(coin.restitution);
      this.world.createCollider(collider, body);
    } else {
      this.world.createCollider(this.coinCollider(), body);
    }
    return body;
  }

  removeBody(body: RigidBody): void {
    this.world.removeRigidBody(body);
  }

  /** Vrai si aucun objet dynamique n'occupe le volume d'une pièce à cette pose. */
  isClear(position: Vec3, rotation: Quat, margin = 0.004): boolean {
    const shape = this.testShape;
    shape.radius = this.geometry.coinRadius + margin;
    shape.halfHeight = this.geometry.coinHalfThickness + margin;
    const hit = this.world.intersectionWithShape(position, rotation, shape, this.R.QueryFilterFlags.ONLY_DYNAMIC);
    return hit === null;
  }

  /** Pose d'apparition d'un tir, en haut de la goulotte à sa position courante. */
  chuteSpawnPose(): Required<Pick<BodySpec, 'position' | 'rotation' | 'linvel'>> {
    const g = this.geometry;
    const f = chuteFrame(g);
    const along = g.chute.spawnOffset;
    const lift = g.coinHalfThickness + 0.0015;
    return {
      position: {
        x: this.chuteX,
        y: f.top.y + f.dir.y * along + f.normal.y * lift,
        z: f.top.z + f.dir.z * along + f.normal.z * lift,
      },
      rotation: quatAboutX(f.tilt),
      linvel: { x: 0, y: f.dir.y * g.chute.spawnSpeed, z: f.dir.z * g.chute.spawnSpeed },
    };
  }

  // --- Pas de simulation ---------------------------------------------------

  /**
   * Avance les éléments cinématiques puis le monde d'un pas fixe.
   * Retourne vrai si un cycle complet de pousseur s'est terminé pendant ce pas.
   */
  step(): boolean {
    const g = this.geometry;
    let cycleEnded = false;
    this.pusherPhase += this.dt / g.pusher.period;
    if (this.pusherPhase >= 1) {
      this.pusherPhase -= 1;
      this.cycle++;
      cycleEnded = true;
      // Frontière de cycle : le pousseur est rentré, changer la course est continu.
      this.pusherStroke = this.nextStroke;
    }
    this.pusher.setNextKinematicTranslation({ x: 0, y: 0, z: pusherFrontZ(g, this.pusherPhase, this.pusherStroke) });

    const maxMove = g.chute.speed * this.dt;
    const target = Math.min(g.chute.maxX, Math.max(g.chute.minX, this.chuteTargetX));
    this.chuteX += Math.max(-maxMove, Math.min(maxMove, target - this.chuteX));
    this.chute.setNextKinematicTranslation({ x: this.chuteX, y: 0, z: 0 });

    if (this.barrierLevel !== this.barrierTarget) {
      const rate = this.dt / g.barrier.riseSeconds;
      this.barrierLevel += Math.max(-rate, Math.min(rate, this.barrierTarget - this.barrierLevel));
      const height = g.barrier.raisedTop - (g.lowerY - 0.26);
      const top = g.barrier.loweredTop + (g.barrier.raisedTop - g.barrier.loweredTop) * this.barrierLevel;
      for (const b of this.barriers) {
        const t = b.translation();
        b.setNextKinematicTranslation({ x: t.x, y: top - height / 2, z: t.z });
      }
    }

    this.world.step();
    return cycleEnded;
  }

  pusherZ(): number {
    return this.pusher.translation().z;
  }

  barrierTop(): number {
    const g = this.geometry;
    return g.barrier.loweredTop + (g.barrier.raisedTop - g.barrier.loweredTop) * this.barrierLevel;
  }

  /** Remet le pousseur et la goulotte dans un état donné (reprise de sauvegarde). */
  setKinematicState(phase: number, stroke: number, cycle: number, chuteX: number, barrierLevel: number): void {
    const g = this.geometry;
    this.pusherPhase = phase;
    this.pusherStroke = this.nextStroke = stroke;
    this.cycle = cycle;
    this.chuteX = this.chuteTargetX = chuteX;
    this.barrierLevel = this.barrierTarget = barrierLevel;
    this.pusher.setTranslation({ x: 0, y: 0, z: pusherFrontZ(g, phase, stroke) }, true);
    this.chute.setTranslation({ x: chuteX, y: 0, z: 0 }, true);
    const height = g.barrier.raisedTop - (g.lowerY - 0.26);
    const top = this.barrierTop();
    for (const b of this.barriers) {
      const t = b.translation();
      b.setTranslation({ x: t.x, y: top - height / 2, z: t.z }, true);
    }
  }

  dispose(): void {
    this.world.free();
  }
}

/** Sommets d'un prisme régulier approchant un cylindre d'axe Y. */
function prismPoints(radius: number, halfHeight: number, sides: number): Float32Array {
  const pts = new Float32Array(sides * 2 * 3);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pts.set([x, halfHeight, z, x, -halfHeight, z], i * 6);
  }
  return pts;
}
