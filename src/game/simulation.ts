import type { RigidBody } from '@dimforge/rapier3d-compat';
import type { GameConfig, GameMode, ObjectType } from '../config/schema.ts';
import { GameRules, initialRulesState, type ExitKind, type ObjectOrigin, type RulesState, type SpawnRequest } from '../engine/rules.ts';
import { generateInitialLayout } from '../physics/layout.ts';
import { MachinePhysics, type MachineOptions, type Quat, type Rapier, type Vec3 } from '../physics/machine.ts';

export type { ExitKind, ObjectOrigin, SpawnRequest };
export type ObjectState = 'pendingSpawn' | 'active' | 'collected' | 'lost' | 'removed';

export interface SimObject {
  readonly id: number;
  type: ObjectType;
  origin: ObjectOrigin;
  state: ObjectState;
  /** Sous-type : couleur de gemme ou pouvoir. */
  variant: string | null;
  body: RigidBody | null;
  spawnTick: number;
  /** Pose précédente et courante : position (3) + quaternion (4). */
  readonly prev: Float32Array;
  readonly curr: Float32Array;
}

export interface ExitRecord {
  id: number;
  kind: ExitKind;
  tick: number;
  type: ObjectType;
  origin: ObjectOrigin;
  variant: string | null;
  position: Vec3;
  velocity: Vec3;
  rotation: Quat;
}

export type ShotRefusal = 'paused' | 'cadence' | 'capacity' | 'chute-busy' | 'rules';

class RingStats {
  private readonly values: Float64Array;
  private index = 0;
  private filled = 0;
  constructor(size: number) {
    this.values = new Float64Array(size);
  }
  push(v: number): void {
    this.values[this.index] = v;
    this.index = (this.index + 1) % this.values.length;
    this.filled = Math.min(this.filled + 1, this.values.length);
  }
  percentile(p: number): number {
    if (this.filled === 0) return 0;
    const sorted = Array.from(this.values.subarray(0, this.filled)).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  }
  mean(): number {
    let s = 0;
    for (let i = 0; i < this.filled; i++) s += this.values[i]!;
    return this.filled ? s / this.filled : 0;
  }
}

/** Instantané physique et logique, sérialisable en JSON (sauvegarde, export). */
export interface SimulationSnapshot {
  format: 'coin-cascade-sim';
  version: 1;
  seed: string;
  tick: number;
  nextId: number;
  lastShotTick: number;
  machine: { phase: number; stroke: number; cycle: number; chuteX: number; barrierLevel: number; barrierTarget: number };
  objects: {
    id: number;
    type: ObjectType;
    origin: ObjectOrigin;
    variant: string | null;
    /** position (3), quaternion (4), vitesse (3), vitesse angulaire (3) */
    pose: number[];
    sleeping: boolean;
  }[];
  rules: RulesState;
}

export interface SimulationOptions extends MachineOptions {
  seed: string;
  mode?: GameMode;
  /** Reprise exacte des positions/vitesses d'une sauvegarde (pas de disposition ni de stabilisation). */
  restore?: SimulationSnapshot;
  /** Nombre d'objets de départ (par défaut config.machine.initialObjects). */
  initialObjects?: number;
  /** Durée simulée de stabilisation avant la partie, pousseur à l'arrêt. */
  settleSeconds?: number;
  now?: () => number;
}

export class Simulation {
  readonly physics: MachinePhysics;
  readonly objects = new Map<number, SimObject>();
  readonly dt: number;
  tick = 0;
  private nextId = 1;
  private lastShotTick = -Infinity;
  private shotRequested = false;
  /** Tir maintenu : une tentative à chaque fin de cadence, sans compter les refus de cadence. */
  holdFire = false;
  private holdRetryTick = 0;
  private readonly shotIntervalTicks: number;
  private spawnBudget = 0;
  private readonly now: () => number;
  readonly rules: GameRules;

  /** Sorties du dernier pas (consommées par la présentation). */
  readonly exitLog: ExitRecord[] = [];
  readonly stats = {
    shotsAccepted: 0,
    shotsRefused: { paused: 0, cadence: 0, capacity: 0, 'chute-busy': 0, rules: 0 } as Record<ShotRefusal, number>,
    collected: 0,
    lost: 0,
    anomalies: 0,
    settleDiscarded: 0,
    bonusSpawned: 0,
    stepMs: new RingStats(600),
    tickMs: new RingStats(600),
  };
  /** Pose cinématique précédente/courante pour l'interpolation : pousseur Z, goulotte X, barrières. */
  readonly kinematics = { prevPusherZ: 0, pusherZ: 0, prevChuteX: 0, chuteX: 0, prevBarrier: 0, barrier: 0 };

  readonly config: GameConfig;
  readonly options: SimulationOptions;

  constructor(R: Rapier, config: GameConfig, options: SimulationOptions) {
    this.config = config;
    this.options = options;
    this.physics = new MachinePhysics(R, config, options);
    this.dt = this.physics.dt;
    this.shotIntervalTicks = Math.max(1, Math.round(config.machine.shotIntervalSeconds / this.dt));
    this.now = options.now ?? (() => performance.now());
    const restore = options.restore;
    this.rules = new GameRules(config, restore ? structuredClone(restore.rules) : initialRulesState(config, options.mode ?? config.defaultMode, options.seed));

    if (restore) {
      this.restoreObjects(restore);
    } else {
      const layout = generateInitialLayout(config, this.physics.geometry, options.seed, options.initialObjects);
      for (const p of layout) this.addObject({ type: p.type, origin: 'initial', variant: p.variant }, { position: p.position, rotation: p.rotation });
      this.settle(options.settleSeconds ?? 1);
    }
    this.syncKinematics(true);
  }

  private restoreObjects(snap: SimulationSnapshot): void {
    const m = snap.machine;
    this.tick = snap.tick;
    this.lastShotTick = snap.lastShotTick;
    this.physics.setKinematicState(m.phase, m.stroke, m.cycle, m.chuteX, m.barrierLevel);
    this.physics.barrierTarget = m.barrierTarget;
    for (const o of snap.objects) {
      const p = o.pose;
      this.nextId = o.id;
      const obj = this.addObject(
        { type: o.type, origin: o.origin, variant: o.variant },
        {
          position: { x: p[0]!, y: p[1]!, z: p[2]! },
          rotation: { x: p[3]!, y: p[4]!, z: p[5]!, w: p[6]! },
          linvel: { x: p[7]!, y: p[8]!, z: p[9]! },
        },
      );
      obj.body!.setAngvel({ x: p[10]!, y: p[11]!, z: p[12]! }, false);
      if (o.sleeping) obj.body!.sleep();
    }
    this.nextId = Math.max(this.nextId, snap.nextId);
  }

  /** Instantané à une frontière de pas (jamais au milieu d'un paiement). */
  snapshot(): SimulationSnapshot {
    const p = this.physics;
    const objects: SimulationSnapshot['objects'] = [];
    for (const o of this.objects.values()) {
      if (o.state !== 'active' || !o.body) continue;
      const t = o.body.translation();
      const q = o.body.rotation();
      const v = o.body.linvel();
      const w = o.body.angvel();
      const pose = [t.x, t.y, t.z, q.x, q.y, q.z, q.w, v.x, v.y, v.z, w.x, w.y, w.z].map((n) => Math.round(n * 1e6) / 1e6);
      objects.push({ id: o.id, type: o.type, origin: o.origin, variant: o.variant, pose, sleeping: o.body.isSleeping() });
    }
    return {
      format: 'coin-cascade-sim',
      version: 1,
      seed: this.options.seed,
      tick: this.tick,
      nextId: this.nextId,
      lastShotTick: Number.isFinite(this.lastShotTick) ? this.lastShotTick : -1e9,
      machine: { phase: p.pusherPhase, stroke: p.pusherStroke, cycle: p.cycle, chuteX: p.chuteX, barrierLevel: p.barrierLevel, barrierTarget: p.barrierTarget },
      objects,
      rules: this.rules.snapshot(),
    };
  }

  get geometry() {
    return this.physics.geometry;
  }

  get activeCount(): number {
    let n = 0;
    for (const o of this.objects.values()) if (o.state === 'active') n++;
    return n;
  }

  get pendingSpawns(): number {
    return this.rules.pendingSpawnCount();
  }

  setRampTarget(x: number): void {
    this.physics.chuteTargetX = x;
  }

  /** Demande un tir au prochain pas. Les demandes répétées dans la cadence sont ignorées sans débit. */
  requestShot(): void {
    this.shotRequested = true;
  }

  private addObject(req: SpawnRequest, pose: { position: Vec3; rotation: Quat; linvel?: Vec3 }): SimObject {
    const body = this.physics.createObjectBody(pose, req.type === 'chest' ? 'chest' : 'coin');
    const obj: SimObject = {
      id: this.nextId++,
      type: req.type,
      origin: req.origin,
      state: 'active',
      variant: req.variant ?? null,
      body,
      spawnTick: this.tick,
      prev: new Float32Array(7),
      curr: new Float32Array(7),
    };
    writePose(obj.curr, pose.position, pose.rotation);
    obj.prev.set(obj.curr);
    this.objects.set(obj.id, obj);
    return obj;
  }

  /** Stabilise la disposition sans pousseur ni comptabilité (objets initiaux). */
  private settle(seconds: number): void {
    const steps = Math.round(seconds / this.dt);
    for (let i = 0; i < steps; i++) {
      this.physics.world.step();
      for (const exit of this.scanExits()) {
        const obj = this.objects.get(exit.id)!;
        this.physics.removeBody(obj.body!);
        obj.body = null;
        this.objects.delete(obj.id);
        this.stats.settleDiscarded++;
      }
    }
    for (const obj of this.objects.values()) {
      readPose(obj);
      obj.prev.set(obj.curr);
    }
  }

  private tryShot(): ShotRefusal | null {
    if (this.tick - this.lastShotTick < this.shotIntervalTicks) return 'cadence';
    // Les créations en attente comptent dans la capacité.
    if (this.activeCount + this.pendingSpawns >= this.config.simulation.maxPhysicalObjects) return 'capacity';
    if (!this.rules.canShoot()) return 'rules';
    const pose = this.physics.chuteSpawnPose();
    if (!this.physics.isClear(pose.position, pose.rotation)) return 'chute-busy';
    // Création garantie : le débit et la création forment une seule opération.
    this.addObject(this.rules.commitShot(), pose);
    this.lastShotTick = this.tick;
    this.stats.shotsAccepted++;
    return null;
  }

  private spawnBonus(): void {
    const req = this.rules.peekSpawn();
    if (!req) {
      this.spawnBudget = 0;
      return;
    }
    this.spawnBudget = Math.min(2, this.spawnBudget + this.config.simulation.maxSpawnsPerSecond * this.dt);
    if (this.spawnBudget < 1) return;
    if (this.activeCount >= this.config.simulation.maxPhysicalObjects) return;
    const g = this.geometry;
    const e = g.bonusEntry;
    // Couloirs régulièrement espacés, en évitant la goulotte ; premier couloir libre.
    const lanes = 7;
    const start = this.tick % lanes;
    for (let k = 0; k < lanes; k++) {
      const lane = (start + k * 3) % lanes;
      const x = e.minX + ((e.maxX - e.minX) * lane) / (lanes - 1);
      if (Math.abs(x - this.physics.chuteX) < g.chute.halfWidth + g.coinRadius + 0.03) continue;
      const position = { x, y: e.y, z: e.z };
      const rotation = { x: 0, y: 0, z: 0, w: 1 };
      if (!this.physics.isClear(position, rotation, 0.01)) continue;
      this.rules.confirmSpawn();
      this.addObject(req, { position, rotation, linvel: { x: 0, y: -0.4, z: 0.15 } });
      this.spawnBudget -= 1;
      this.stats.bonusSpawned++;
      return;
    }
  }

  /** Parcourt les objets actifs : franchissement du plan de sortie ou sortie de la boîte de sécurité. */
  private scanExits(): ExitRecord[] {
    const g = this.geometry;
    const exits: ExitRecord[] = [];
    for (const obj of this.objects.values()) {
      if (obj.state !== 'active' || !obj.body) continue;
      const t = obj.body.translation();
      let kind: ExitKind | null = null;
      const finite = Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z);
      if (
        !finite ||
        t.x < g.safetyMin[0] || t.y < g.safetyMin[1] || t.z < g.safetyMin[2] ||
        t.x > g.safetyMax[0] || t.y > g.safetyMax[1] || t.z > g.safetyMax[2]
      ) {
        kind = 'anomaly';
      } else if (t.y < g.exitPlaneY) {
        if (t.z >= g.frontZ) kind = 'collected';
        else if (Math.abs(t.x) >= g.deckHalfWidth) kind = 'lost';
        else kind = 'anomaly';
      }
      if (!kind) continue;
      const v = obj.body.linvel();
      exits.push({
        id: obj.id,
        kind,
        tick: this.tick,
        type: obj.type,
        origin: obj.origin,
        variant: obj.variant,
        position: { x: t.x, y: t.y, z: t.z },
        velocity: { x: v.x, y: v.y, z: v.z },
        rotation: obj.body.rotation(),
      });
    }
    // Ordre stable, indépendant de l'itération du moteur.
    return exits.sort((a, b) => a.id - b.id);
  }

  private syncKinematics(reset = false): void {
    const k = this.kinematics;
    const p = this.physics;
    const pusherZ = p.pusherZ();
    k.prevPusherZ = reset ? pusherZ : k.pusherZ;
    k.prevChuteX = reset ? p.chuteX : k.chuteX;
    k.prevBarrier = reset ? p.barrierLevel : k.barrier;
    k.pusherZ = pusherZ;
    k.chuteX = p.chuteX;
    k.barrier = p.barrierLevel;
  }

  /**
   * Un pas fixe : entrées acceptées → physique → sorties dédupliquées/triées →
   * comptabilité → effets programmés. L'appelant ne fait pas avancer un jeu en pause.
   */
  step(): void {
    const t0 = this.now();
    this.exitLog.length = 0;
    this.rules.beginTick();
    const cadenceReady = this.tick - this.lastShotTick >= this.shotIntervalTicks;
    if (this.shotRequested || (this.holdFire && cadenceReady && this.tick >= this.holdRetryTick)) {
      const explicit = this.shotRequested;
      this.shotRequested = false;
      const refusal = this.tryShot();
      if (refusal) {
        if (explicit || refusal !== 'cadence') this.stats.shotsRefused[refusal]++;
        // Un tir maintenu refusé réessaie au rythme de la cadence, pas à chaque pas.
        if (!explicit) this.holdRetryTick = this.tick + this.shotIntervalTicks;
      }
    }
    this.spawnBonus();

    const t1 = this.now();
    const cycleEnded = this.physics.step();
    this.stats.stepMs.push(this.now() - t1);
    this.tick++;

    const exits = this.scanExits();
    for (const exit of exits) {
      const obj = this.objects.get(exit.id)!;
      if (obj.state !== 'active') continue; // doublon impossible, garde défensive
      obj.state = exit.kind === 'collected' ? 'collected' : 'lost';
      if (exit.kind === 'collected') this.stats.collected++;
      else if (exit.kind === 'lost') this.stats.lost++;
      else this.stats.anomalies++;
      this.physics.removeBody(obj.body!);
      obj.body = null;
      this.exitLog.push(exit);
    }
    if (exits.length) this.rules.applyExits(exits);
    if (cycleEnded) {
      // Frontière de cycle : le pousseur est rentré, barrières et course changent sans discontinuité.
      const mech = this.rules.onCycleEnd();
      this.physics.barrierTarget = mech.barriers ? 1 : 0;
      this.physics.pusherStroke = this.physics.nextStroke = this.geometry.pusher.stroke * (mech.superPush ? this.config.bonus.superPush.strokeFactor : 1);
    }
    this.rules.advance(this.dt, this.tick);
    // Retrait définitif : l'état terminal a été appliqué dans le même pas.
    for (const exit of exits) {
      const obj = this.objects.get(exit.id)!;
      obj.state = 'removed';
      this.objects.delete(exit.id);
    }

    for (const obj of this.objects.values()) {
      if (!obj.body) continue;
      obj.prev.set(obj.curr);
      readPose(obj);
    }
    this.syncKinematics();
    this.stats.tickMs.push(this.now() - t0);
  }

  /**
   * Onde de choc : impulsion bornée vers l'avant sur les objets du plateau bas proches
   * du point visé. Jamais de téléportation ; l'amplitude décroît avec la distance.
   */
  shockwave(centerX: number): number {
    const g = this.geometry;
    const impulse = this.config.bonus.shockwave.impulse;
    const cz = (g.pusher.retractedZ + g.pusher.maxStroke + g.frontZ) / 2;
    const radius = 0.38;
    let touched = 0;
    for (const obj of this.objects.values()) {
      if (obj.state !== 'active' || !obj.body) continue;
      const t = obj.body.translation();
      if (t.y > g.upperY - 0.02) continue;
      const dx = t.x - centerX;
      const dz = t.z - cz;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const k = impulse * (1 - d / radius) * (obj.type === 'chest' ? 2 : 1);
      const n = d > 1e-4 ? 1 / d : 0;
      obj.body.applyImpulse({ x: dx * n * k * 0.5, y: k * 0.45, z: k * 0.9 + Math.max(0, dz) * n * k * 0.3 }, true);
      touched++;
    }
    return touched;
  }

  /** Corps éveillés (diagnostic ; parcours complet, à ne pas appeler à chaque image). */
  countAwake(): number {
    let n = 0;
    for (const obj of this.objects.values()) if (obj.body && !obj.body.isSleeping()) n++;
    return n;
  }

  dispose(): void {
    this.physics.dispose();
    this.objects.clear();
  }
}

function writePose(target: Float32Array, p: Vec3, q: Quat): void {
  target[0] = p.x;
  target[1] = p.y;
  target[2] = p.z;
  target[3] = q.x;
  target[4] = q.y;
  target[5] = q.z;
  target[6] = q.w;
}

function readPose(obj: SimObject): void {
  const body = obj.body!;
  writePose(obj.curr, body.translation(), body.rotation());
}
