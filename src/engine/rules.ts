import type { GameConfig, GameMode, JackpotTier, ObjectType, PowerType, RewardEntry, SpecialType } from '../config/schema.ts';
import { pickWeighted, pickWeightedEntry, Rng, type RngState } from './rng.ts';

// Moteur de règles pur (docs/02-REGLES.md) : ni DOM, ni Three.js, ni Rapier.
// Toutes les durées sont en temps simulé ; chaque appel public est une transaction complète.

export type ObjectOrigin = 'initial' | 'paid-shot' | 'free-shot' | 'bonus';
export type ExitKind = 'collected' | 'lost' | 'anomaly';

export interface ExitInput {
  id: number;
  kind: ExitKind;
  type: ObjectType;
  origin: ObjectOrigin;
  variant: string | null;
}

export interface SpawnRequest {
  type: ObjectType;
  origin: ObjectOrigin;
  variant: string | null;
}

/** Travail de distribution physique : agrégé par lot (une pluie = un seul travail). */
export interface DistributionJob {
  id: number;
  kind: 'rain' | 'special';
  type: ObjectType;
  variant: string | null;
  remaining: number;
}

export interface WheelSpin {
  id: number;
  rewardId: string;
  /** Index du secteur, pour que la roue affiche le résultat déjà décidé. */
  index: number;
  paid: boolean;
}

export type ChallengePhase = 'playing' | 'resolving' | 'ended';

export interface RulesState {
  version: 1;
  mode: GameMode;
  reserve: number;
  score: number;
  charges: { freeShots: number; goldenShots: number; barriers: number; superPush: number; shockwave: number };
  /** Droits acquis au-delà des plafonds : versés dès que la charge redescend. */
  overflow: { freeShots: number; goldenShots: number; barriers: number; superPush: number; shockwave: number; barrierCycles: number; superPushCycles: number };
  barrierCycles: number;
  superPushCycles: number;
  barriersRaised: boolean;
  combo: { count: number; timer: number; multiplier: number };
  fever: { active: boolean; remaining: number; extensionsUsed: number; stars: number; pendingStart: boolean };
  wheel: { tokens: number; spins: WheelSpin[]; nextSpinId: number };
  gems: { session: string[]; album: string[] };
  paidShotsSinceOffer: number;
  jobs: DistributionJob[];
  nextJobId: number;
  challenge: { phase: ChallengePhase; quietCycles: number; phaseSeconds: number; timedOut: boolean; endedTick: number | null };
  /** Session personnalisée : réglage de règles modifié, import, forçage. Exclue des records standard. */
  custom: boolean;
  stats: RulesStats;
  rng: { distribution: RngState; chest: RngState; wheel: RngState };
}

export interface RulesStats {
  paidShots: number;
  freeShots: number;
  goldenShots: number;
  collected: Record<ObjectOrigin, number>;
  collectedByType: Partial<Record<ObjectType, number>>;
  lost: Record<ObjectOrigin, number>;
  anomalies: number;
  reserveFromCollection: number;
  reserveFromBonus: number;
  pointsFromCollection: number;
  pointsFromJackpots: number;
  jackpots: Partial<Record<JackpotTier, number>>;
  chests: number;
  wheelSpins: number;
  bestCombo: number;
  feverSequences: number;
  specialsOffered: number;
}

export type RulesEvent =
  | { type: 'ShotAccepted'; origin: ObjectOrigin; objectType: ObjectType; cost: number }
  | { type: 'ObjectCollected'; id: number; objectType: ObjectType; variant: string | null; points: number; reserve: number; multiplier: number }
  | { type: 'ObjectLost'; id: number; objectType: ObjectType }
  | { type: 'ComboChanged'; count: number; multiplier: number }
  | { type: 'ComboEnded'; count: number }
  | { type: 'FeverStarted'; seconds: number }
  | { type: 'FeverExtended'; seconds: number; extensionsUsed: number }
  | { type: 'FeverEnded' }
  | { type: 'BonusQueued'; job: DistributionJob }
  | { type: 'BonusStarted'; bonus: 'barriers' | 'superPush' | 'shockwave'; cycles: number }
  | { type: 'BonusEnded'; bonus: 'barriers' | 'superPush' }
  | { type: 'ChargesAdded'; charge: keyof RulesState['charges']; added: number; deferred: number }
  | { type: 'ChestOpened'; id: number; reward: RewardEntry }
  | { type: 'WheelResultCommitted'; spin: WheelSpin; reward: RewardEntry }
  | { type: 'WheelPaid'; spin: WheelSpin; reward: RewardEntry }
  | { type: 'GemAdded'; gem: string; session: string[]; newInAlbum: boolean }
  | { type: 'JackpotAwarded'; tier: JackpotTier; reserve: number; points: number }
  | { type: 'ChallengePhase'; phase: ChallengePhase; timedOut: boolean };

const DEFAULT_STATS = (): RulesStats => ({
  paidShots: 0,
  freeShots: 0,
  goldenShots: 0,
  collected: { initial: 0, 'paid-shot': 0, 'free-shot': 0, bonus: 0 },
  collectedByType: {},
  lost: { initial: 0, 'paid-shot': 0, 'free-shot': 0, bonus: 0 },
  anomalies: 0,
  reserveFromCollection: 0,
  reserveFromBonus: 0,
  pointsFromCollection: 0,
  pointsFromJackpots: 0,
  jackpots: {},
  chests: 0,
  wheelSpins: 0,
  bestCombo: 0,
  feverSequences: 0,
  specialsOffered: 0,
});

export function initialRulesState(config: GameConfig, mode: GameMode, seed: string): RulesState {
  const reserve = mode === 'challenge' ? config.economy.challengeInitialReserve : config.economy.freeInitialReserve;
  return {
    version: 1,
    mode,
    reserve,
    score: 0,
    charges: { freeShots: 0, goldenShots: 0, barriers: 0, superPush: 0, shockwave: 0 },
    overflow: { freeShots: 0, goldenShots: 0, barriers: 0, superPush: 0, shockwave: 0, barrierCycles: 0, superPushCycles: 0 },
    barrierCycles: 0,
    superPushCycles: 0,
    barriersRaised: false,
    combo: { count: 0, timer: 0, multiplier: 1 },
    fever: { active: false, remaining: 0, extensionsUsed: 0, stars: 0, pendingStart: false },
    wheel: { tokens: 0, spins: [], nextSpinId: 1 },
    gems: { session: [], album: [] },
    paidShotsSinceOffer: 0,
    jobs: [],
    nextJobId: 1,
    challenge: { phase: 'playing', quietCycles: 0, phaseSeconds: 0, timedOut: false, endedTick: null },
    custom: mode === 'sandbox',
    stats: DEFAULT_STATS(),
    rng: {
      distribution: Rng.fromSeed(seed, 'distribution').getState(),
      chest: Rng.fromSeed(seed, 'chest').getState(),
      wheel: Rng.fromSeed(seed, 'wheel').getState(),
    },
  };
}

/** Plafond de chaque charge stockée. */
function chargeCap(config: GameConfig, charge: keyof RulesState['charges']): number {
  switch (charge) {
    case 'freeShots':
      return config.bonus.freeShots.maxCharges;
    case 'goldenShots':
      return config.bonus.goldenShots.maxCharges;
    case 'shockwave':
      return config.bonus.shockwave.maxCharges;
    default:
      return 3;
  }
}

export class GameRules {
  readonly config: GameConfig;
  state: RulesState;
  private readonly rngDistribution: Rng;
  private readonly rngChest: Rng;
  private readonly rngWheel: Rng;
  /** Événements émis depuis le dernier `drainEvents` (présentation, audio, sauvegarde). */
  private events: RulesEvent[] = [];
  /** Une collecte a eu lieu pendant le pas courant (fin de défi). */
  private collectedThisTick = false;
  private collectedThisCycle = false;
  /** Identifiants déjà réglés : une sortie en double n'est jamais payée deux fois. */
  private readonly settled = new Set<number>();
  private readonly settledOrder: number[] = [];

  constructor(config: GameConfig, state: RulesState) {
    this.config = config;
    this.state = state;
    this.rngDistribution = new Rng(state.rng.distribution);
    this.rngChest = new Rng(state.rng.chest);
    this.rngWheel = new Rng(state.rng.wheel);
  }

  drainEvents(): RulesEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(event: RulesEvent): void {
    this.events.push(event);
  }

  /** Synchronise les états RNG sérialisables (à appeler avant une sauvegarde). */
  snapshot(): RulesState {
    this.state.rng = { distribution: this.rngDistribution.getState(), chest: this.rngChest.getState(), wheel: this.rngWheel.getState() };
    return structuredClone(this.state);
  }

  get unlimitedReserve(): boolean {
    return this.state.mode === 'sandbox';
  }

  // --- Tirs ----------------------------------------------------------------------

  /** Ressource disponible pour un tir (sans débit). Pendant une roue, aucun tir. */
  canShoot(): boolean {
    const s = this.state;
    if (s.challenge.phase === 'ended') return false;
    if (this.hasUnpaidSpin()) return false;
    return s.charges.freeShots > 0 || this.unlimitedReserve || s.reserve >= this.config.economy.shotCost;
  }

  /**
   * Débit atomique d'un tir dont la création physique est garantie : charge gratuite
   * d'abord, sinon réserve ; charge dorée consommée indépendamment.
   */
  commitShot(): SpawnRequest {
    const s = this.state;
    let origin: ObjectOrigin;
    let cost = 0;
    if (s.charges.freeShots > 0) {
      s.charges.freeShots--;
      this.refill('freeShots');
      origin = 'free-shot';
      s.stats.freeShots++;
    } else {
      cost = this.unlimitedReserve ? 0 : this.config.economy.shotCost;
      s.reserve -= cost;
      origin = 'paid-shot';
      s.stats.paidShots++;
      s.paidShotsSinceOffer++;
    }
    let type: ObjectType = 'normal';
    if (s.charges.goldenShots > 0) {
      s.charges.goldenShots--;
      this.refill('goldenShots');
      type = 'gold';
      s.stats.goldenShots++;
    }
    s.challenge.phaseSeconds = 0;
    if (s.challenge.phase === 'resolving') this.setPhase('playing');
    this.emit({ type: 'ShotAccepted', origin, objectType: type, cost });
    this.offerSpecials();
    return { type, origin, variant: null };
  }

  /** Recharge manuelle gratuite du mode libre. */
  manualRefill(): boolean {
    const s = this.state;
    if (s.mode !== 'free') return false;
    s.reserve += this.config.economy.freeManualRefill;
    return true;
  }

  // --- Distribution gratuite -------------------------------------------------------

  private offerSpecials(): void {
    const s = this.state;
    const every = this.config.distribution.paidShotsPerSpecialOffer;
    // File pleine : l'opportunité est reportée (le compteur reste acquis).
    while (s.paidShotsSinceOffer >= every && s.jobs.length < this.config.simulation.maxPendingRewards) {
      s.paidShotsSinceOffer -= every;
      const type: SpecialType = pickWeighted(this.rngDistribution, this.config.distribution.specialWeights);
      const variant = this.drawVariant(type);
      s.stats.specialsOffered++;
      this.queueJob('special', type, variant, 1);
    }
  }

  private drawVariant(type: ObjectType): string | null {
    if (type === 'gem') return this.config.collection.gemIds[this.rngDistribution.int(this.config.collection.gemIds.length)]!;
    if (type === 'power') return pickWeighted(this.rngDistribution, this.config.distribution.powerWeights);
    return null;
  }

  private queueJob(kind: DistributionJob['kind'], type: ObjectType, variant: string | null, count: number): void {
    const s = this.state;
    // Une pluie se cumule avec la pluie déjà en file : un seul travail agrégé.
    const existing = kind === 'rain' ? s.jobs.find((j) => j.kind === 'rain') : undefined;
    if (existing) {
      existing.remaining += count;
      this.emit({ type: 'BonusQueued', job: { ...existing } });
      return;
    }
    const job: DistributionJob = { id: s.nextJobId++, kind, type, variant, remaining: count };
    s.jobs.push(job);
    this.emit({ type: 'BonusQueued', job: { ...job } });
  }

  /** Prochaine création de distribution (la simulation choisit quand et où). */
  peekSpawn(): SpawnRequest | null {
    const job = this.state.jobs[0];
    return job ? { type: job.type, origin: 'bonus', variant: job.variant } : null;
  }

  confirmSpawn(): void {
    const s = this.state;
    const job = s.jobs[0];
    if (!job) return;
    job.remaining--;
    if (job.remaining <= 0) {
      s.jobs.shift();
      this.offerSpecials();
    }
  }

  pendingSpawnCount(): number {
    return this.state.jobs.reduce((n, j) => n + j.remaining, 0);
  }

  // --- Sorties ---------------------------------------------------------------------

  /** Sorties d'un pas, déjà dédupliquées et triées par identifiant. */
  applyExits(exits: readonly ExitInput[]): void {
    for (const exit of exits) {
      if (this.settled.has(exit.id)) continue;
      this.settled.add(exit.id);
      this.settledOrder.push(exit.id);
      if (this.settledOrder.length > 4096) this.settled.delete(this.settledOrder.shift()!);
      if (exit.kind === 'collected') this.collect(exit);
      else if (exit.kind === 'lost') {
        this.state.stats.lost[exit.origin]++;
        this.emit({ type: 'ObjectLost', id: exit.id, objectType: exit.type });
      } else {
        this.state.stats.anomalies++;
      }
    }
  }

  private collect(exit: ExitInput): void {
    const s = this.state;
    const cfg = this.config;
    const reward = cfg.objects[exit.type];
    this.collectedThisTick = true;
    this.collectedThisCycle = true;
    s.stats.collected[exit.origin]++;
    s.stats.collectedByType[exit.type] = (s.stats.collectedByType[exit.type] ?? 0) + 1;

    // Le combo est mis à jour avant de payer l'objet qui le fait progresser.
    if (cfg.combo.eligibleTypes.includes(exit.type)) {
      s.combo.count++;
      s.combo.timer = cfg.combo.windowSeconds;
      const mult = this.comboMultiplierFor(s.combo.count);
      if (mult !== s.combo.multiplier || s.combo.count === 1) this.emit({ type: 'ComboChanged', count: s.combo.count, multiplier: mult });
      s.combo.multiplier = mult;
      s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo.count);
    }
    const multiplier = this.currentMultiplier();
    const points = Math.floor(reward.points * multiplier);
    s.score += points;
    s.reserve += reward.reserve;
    s.stats.pointsFromCollection += points;
    s.stats.reserveFromCollection += reward.reserve;
    if (s.challenge.phase === 'resolving' && reward.reserve > 0) this.setPhase('playing');
    this.emit({ type: 'ObjectCollected', id: exit.id, objectType: exit.type, variant: exit.variant, points, reserve: reward.reserve, multiplier });

    if (reward.feverCharge) this.addStars(reward.feverCharge);
    if (reward.wheelCharge) {
      s.wheel.tokens += reward.wheelCharge;
      this.scheduleSpins();
    }
    if (exit.type === 'gem' && exit.variant) this.addGem(exit.variant);
    if (exit.type === 'power' && exit.variant) this.addCharge(exit.variant as PowerType, 1);
    if (exit.type === 'chest') {
      s.stats.chests++;
      // Résultat tiré et appliqué dans la même transaction que la collecte.
      const entry = pickWeightedEntry(this.rngChest, cfg.chest.rewards, (r) => r.weight);
      this.emit({ type: 'ChestOpened', id: exit.id, reward: entry });
      this.applyReward(entry);
    }
  }

  comboMultiplierFor(count: number): number {
    let mult = 1;
    for (const t of this.config.combo.thresholds) if (count >= t.count) mult = t.multiplier;
    return mult;
  }

  /** Multiplicateur de points courant : combo × Fever, plafonné. */
  currentMultiplier(): number {
    const s = this.state;
    const combo = s.combo.count > 0 ? s.combo.multiplier : 1;
    const fever = s.fever.active ? this.config.bonus.fever.pointMultiplier : 1;
    return Math.min(this.config.combo.maxCombinedMultiplier, combo * fever);
  }

  // --- Fever -------------------------------------------------------------------------

  private addStars(n: number): void {
    const f = this.state.fever;
    const cfg = this.config.bonus.fever;
    f.stars += n;
    if (f.active) {
      // Prolongation pendant la séquence, dans la limite autorisée ; sinon reliquat conservé.
      while (f.stars >= cfg.starsRequired && f.extensionsUsed < cfg.maxExtensions) {
        f.stars -= cfg.starsRequired;
        f.extensionsUsed++;
        f.remaining += cfg.extensionSeconds;
        this.emit({ type: 'FeverExtended', seconds: cfg.extensionSeconds, extensionsUsed: f.extensionsUsed });
      }
    } else if (f.stars >= cfg.starsRequired) {
      // Prend effet au pas suivant.
      f.pendingStart = true;
    }
  }

  // --- Roue ----------------------------------------------------------------------------

  private scheduleSpins(): void {
    const w = this.state.wheel;
    const need = this.config.wheel.tokensRequired;
    // Un seul tirage engagé à la fois : les jetons suivants restent dans le compteur.
    if (w.tokens >= need && !this.hasUnpaidSpin()) {
      w.tokens -= need;
      const rewards = this.config.wheel.rewards;
      const entry = pickWeightedEntry(this.rngWheel, rewards, (r) => r.weight);
      const spin: WheelSpin = { id: w.nextSpinId++, rewardId: entry.id, index: rewards.indexOf(entry), paid: false };
      w.spins.push(spin);
      this.state.stats.wheelSpins++;
      this.emit({ type: 'WheelResultCommitted', spin: { ...spin }, reward: entry });
    }
  }

  hasUnpaidSpin(): boolean {
    return this.state.wheel.spins.some((s) => !s.paid);
  }

  /** Tirage engagé à présenter (résultat déjà fixé et sauvegardable). */
  pendingSpin(): { spin: WheelSpin; reward: RewardEntry } | null {
    const spin = this.state.wheel.spins.find((s) => !s.paid);
    if (!spin) return null;
    const reward = this.config.wheel.rewards.find((r) => r.id === spin.rewardId) ?? this.config.wheel.rewards[spin.index]!;
    return { spin, reward };
  }

  /** Paie le tirage présenté, une seule fois, puis engage le suivant si des jetons attendent. */
  payWheel(spinId: number): boolean {
    const w = this.state.wheel;
    const spin = w.spins.find((s) => s.id === spinId);
    if (!spin || spin.paid) return false;
    const reward = this.config.wheel.rewards.find((r) => r.id === spin.rewardId) ?? this.config.wheel.rewards[spin.index]!;
    spin.paid = true;
    this.applyReward(reward);
    this.emit({ type: 'WheelPaid', spin: { ...spin }, reward });
    // Historique court : seuls les tirages non payés comptent pour la reprise.
    w.spins = w.spins.filter((s) => !s.paid);
    this.scheduleSpins();
    return true;
  }

  // --- Gemmes et jackpots -------------------------------------------------------------------

  private addGem(gem: string): void {
    const g = this.state.gems;
    const newInAlbum = !g.album.includes(gem);
    if (newInAlbum) g.album.push(gem);
    if (!g.session.includes(gem)) g.session.push(gem);
    this.emit({ type: 'GemAdded', gem, session: [...g.session], newInAlbum });
    const all = this.config.collection.gemIds;
    if (all.every((id) => g.session.includes(id))) {
      // Grand payé une fois par ensemble complet ; l'ensemble de session repart à zéro, l'album reste.
      g.session = [];
      this.awardJackpot(this.config.collection.completedSetJackpot);
    }
  }

  private awardJackpot(tier: JackpotTier): void {
    const s = this.state;
    const j = this.config.jackpots[tier];
    s.reserve += j.reserve;
    s.score += j.points; // points fixes, jamais multipliés
    s.stats.reserveFromBonus += j.reserve;
    s.stats.pointsFromJackpots += j.points;
    s.stats.jackpots[tier] = (s.stats.jackpots[tier] ?? 0) + 1;
    if (s.challenge.phase === 'resolving' && j.reserve > 0) this.setPhase('playing');
    this.emit({ type: 'JackpotAwarded', tier, reserve: j.reserve, points: j.points });
  }

  // --- Récompenses et charges ---------------------------------------------------------------------

  applyReward(r: RewardEntry): void {
    const s = this.state;
    const b = this.config.bonus;
    switch (r.kind) {
      case 'reserve':
        s.reserve += r.amount;
        s.stats.reserveFromBonus += r.amount;
        if (s.challenge.phase === 'resolving') this.setPhase('playing');
        break;
      case 'coinRain':
        this.queueJob('rain', 'normal', null, b.coinRain.count);
        break;
      case 'barriers':
        this.addCycles('barriers', b.barriers.cycles);
        break;
      case 'superPush':
        this.addCycles('superPush', b.superPush.cycles);
        break;
      case 'shockwave':
        this.addCharge('shockwave', r.amount);
        break;
      case 'freeShots':
        this.addCharge('freeShots', b.freeShots.count);
        break;
      case 'goldenShots':
        this.addCharge('goldenShots', b.goldenShots.count);
        break;
      case 'jackpot':
        this.awardJackpot(r.tier);
        break;
    }
  }

  /** Ajoute une charge ; l'excédent au plafond est conservé et versé plus tard. */
  addCharge(charge: keyof RulesState['charges'], n: number): void {
    const s = this.state;
    const cap = chargeCap(this.config, charge);
    const room = Math.max(0, cap - s.charges[charge]);
    const added = Math.min(room, n);
    s.charges[charge] += added;
    s.overflow[charge] += n - added;
    this.emit({ type: 'ChargesAdded', charge, added, deferred: n - added });
    if (charge === 'freeShots' && s.challenge.phase === 'resolving' && added > 0) this.setPhase('playing');
  }

  private refill(charge: keyof RulesState['charges']): void {
    const s = this.state;
    const room = chargeCap(this.config, charge) - s.charges[charge];
    const moved = Math.min(room, s.overflow[charge]);
    if (moved > 0) {
      s.charges[charge] += moved;
      s.overflow[charge] -= moved;
    }
  }

  private addCycles(bonus: 'barriers' | 'superPush', cycles: number): void {
    const s = this.state;
    const cap = bonus === 'barriers' ? this.config.bonus.barriers.maxStackedCycles : this.config.bonus.superPush.maxStackedCycles;
    const key = bonus === 'barriers' ? 'barrierCycles' : 'superPushCycles';
    const room = Math.max(0, cap - s[key]);
    const added = Math.min(room, cycles);
    s[key] += added;
    s.overflow[key] += cycles - added;
    this.emit({ type: 'BonusStarted', bonus, cycles: added });
  }

  /** Active une charge de pouvoir stockée (bouton joueur). L'onde de choc est appliquée par la simulation. */
  activatePower(power: PowerType): boolean {
    const s = this.state;
    if (s.charges[power] <= 0 || s.challenge.phase === 'ended' || this.hasUnpaidSpin()) return false;
    s.charges[power]--;
    this.refill(power);
    if (power === 'barriers') this.addCycles('barriers', this.config.bonus.barriers.cycles);
    else if (power === 'superPush') this.addCycles('superPush', this.config.bonus.superPush.cycles);
    else this.emit({ type: 'BonusStarted', bonus: 'shockwave', cycles: 0 });
    return true;
  }

  // --- Temps et cycles -----------------------------------------------------------------------------

  /**
   * Frontière de cycle du pousseur : décompte des barrières/super poussée et
   * décision de la course du cycle qui commence. Retourne l'état mécanique voulu.
   */
  onCycleEnd(): { barriers: boolean; superPush: boolean } {
    const s = this.state;
    if (s.barriersRaised) {
      s.barrierCycles = Math.max(0, s.barrierCycles - 1);
      if (s.barrierCycles === 0 && s.overflow.barrierCycles > 0) {
        const moved = Math.min(this.config.bonus.barriers.maxStackedCycles, s.overflow.barrierCycles);
        s.barrierCycles += moved;
        s.overflow.barrierCycles -= moved;
      }
    }
    const raise = s.barrierCycles > 0;
    if (s.barriersRaised && !raise) this.emit({ type: 'BonusEnded', bonus: 'barriers' });
    s.barriersRaised = raise;

    let superPush = false;
    if (s.superPushCycles > 0) {
      s.superPushCycles--;
      superPush = true;
      if (s.superPushCycles === 0) {
        const moved = Math.min(this.config.bonus.superPush.maxStackedCycles, s.overflow.superPushCycles);
        s.superPushCycles += moved;
        s.overflow.superPushCycles -= moved;
        if (s.superPushCycles === 0) this.emit({ type: 'BonusEnded', bonus: 'superPush' });
      }
    }

    if (s.mode === 'challenge' && s.challenge.phase === 'resolving') {
      s.challenge.quietCycles = this.collectedThisCycle ? 0 : s.challenge.quietCycles + 1;
    }
    this.collectedThisCycle = false;
    return { barriers: raise, superPush };
  }

  /**
   * Début de pas : une Fever atteinte au pas précédent prend effet maintenant,
   * avant les sorties de ce pas.
   */
  beginTick(): void {
    const s = this.state;
    const f = s.fever;
    const fcfg = this.config.bonus.fever;
    if (!f.active && f.pendingStart) {
      f.pendingStart = false;
      if (f.stars >= fcfg.starsRequired) {
        f.stars -= fcfg.starsRequired;
        f.active = true;
        f.remaining = fcfg.durationSeconds;
        f.extensionsUsed = 0;
        s.stats.feverSequences++;
        this.emit({ type: 'FeverStarted', seconds: fcfg.durationSeconds });
        // Étoiles déjà en attente au démarrage : prolongations immédiates possibles.
        this.addStars(0);
      }
    }
  }

  /** Avance les minuteries de jeu d'un pas simulé (jamais pendant une pause). */
  advance(dt: number, tick: number): void {
    const s = this.state;
    const f = s.fever;
    const fcfg = this.config.bonus.fever;
    if (this.collectedThisTick && s.challenge.phase === 'resolving') s.challenge.quietCycles = 0;
    if (f.active) {
      f.remaining -= dt;
      if (f.remaining <= 0) {
        f.active = false;
        f.remaining = 0;
        f.extensionsUsed = 0;
        this.emit({ type: 'FeverEnded' });
        if (f.stars >= fcfg.starsRequired) f.pendingStart = true;
      }
    }
    if (s.combo.count > 0) {
      s.combo.timer -= dt;
      if (s.combo.timer <= 0) {
        this.emit({ type: 'ComboEnded', count: s.combo.count });
        s.combo = { count: 0, timer: 0, multiplier: 1 };
      }
    }
    this.updateChallenge(dt, tick);
    this.collectedThisTick = false;
  }

  // --- Fin de défi -----------------------------------------------------------------------------------

  private setPhase(phase: ChallengePhase): void {
    const c = this.state.challenge;
    if (c.phase === phase || c.phase === 'ended') return;
    c.phase = phase;
    c.phaseSeconds = 0;
    c.quietCycles = 0;
    this.emit({ type: 'ChallengePhase', phase, timedOut: c.timedOut });
  }

  /** Vrai si un effet engagé reste à résoudre (distribution, roue, Fever, barrières…). */
  hasPendingWork(): boolean {
    const s = this.state;
    return s.jobs.length > 0 || this.hasUnpaidSpin() || s.fever.active || s.fever.pendingStart || s.barrierCycles > 0 || s.superPushCycles > 0;
  }

  private updateChallenge(dt: number, tick: number): void {
    const s = this.state;
    const c = s.challenge;
    if (s.mode !== 'challenge' || c.phase === 'ended') return;
    const out = s.reserve < this.config.economy.shotCost && s.charges.freeShots === 0;
    if (c.phase === 'playing') {
      if (out) this.setPhase('resolving');
      return;
    }
    if (!out) {
      this.setPhase('playing');
      return;
    }
    c.phaseSeconds += dt;
    const quiet = c.quietCycles >= this.config.challenge.quietCyclesToEnd;
    if (quiet && !this.hasPendingWork()) this.endChallenge(tick, false);
    else if (c.phaseSeconds >= this.config.challenge.maxResolutionSeconds && !this.hasUnpaidSpin()) {
      // Limite de résolution : fin au point de transaction sûr (fin de pas), effets futurs abandonnés.
      this.endChallenge(tick, true);
    }
  }

  private endChallenge(tick: number, timedOut: boolean): void {
    const c = this.state.challenge;
    c.timedOut = timedOut;
    c.endedTick = tick;
    c.phase = 'ended';
    this.state.jobs = [];
    this.emit({ type: 'ChallengePhase', phase: 'ended', timedOut });
  }

  markCustom(): void {
    this.state.custom = true;
  }

  // --- Forçages du bac à sable (session personnalisée) ----------------------------------

  grantStars(n: number): void {
    this.markCustom();
    this.addStars(n);
  }

  grantWheelTokens(n: number): void {
    this.markCustom();
    this.state.wheel.tokens += n;
    this.scheduleSpins();
  }

  /** Ouvre un coffre sans objet physique : même table, même flux aléatoire. */
  forceChest(): RewardEntry {
    this.markCustom();
    const entry = pickWeightedEntry(this.rngChest, this.config.chest.rewards, (r) => r.weight);
    this.emit({ type: 'ChestOpened', id: 0, reward: entry });
    this.applyReward(entry);
    return entry;
  }

  /** Ajoute un objet à la file de distribution (arrive par l'entrée du fond). */
  queueSpecial(type: ObjectType): boolean {
    if (this.state.jobs.length >= this.config.simulation.maxPendingRewards) return false;
    this.markCustom();
    this.queueJob('special', type, this.drawVariant(type), 1);
    return true;
  }
}
