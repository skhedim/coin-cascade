import { z } from 'zod';

// Schéma de config/game.yaml. Contrat de règles : docs/02-REGLES.md.
// Zod 4 refuse déjà NaN et ±Infinity pour z.number().

export const OBJECT_TYPES = ['normal', 'gold', 'star', 'wheel', 'gem', 'chest', 'power'] as const;
export const SPECIAL_TYPES = ['gold', 'star', 'wheel', 'gem', 'chest', 'power'] as const;
export const POWER_TYPES = ['barriers', 'superPush', 'shockwave'] as const;
export const JACKPOT_TIERS = ['mini', 'minor', 'major', 'grand'] as const;
export const GAME_MODES = ['free', 'challenge', 'sandbox'] as const;
export const QUALITY_LEVELS = ['auto', 'low', 'medium', 'high'] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];
export type SpecialType = (typeof SPECIAL_TYPES)[number];
export type PowerType = (typeof POWER_TYPES)[number];
export type JackpotTier = (typeof JACKPOT_TIERS)[number];
export type GameMode = (typeof GAME_MODES)[number];
export type QualityLevel = (typeof QUALITY_LEVELS)[number];

const objectTypeEnum = z.enum(OBJECT_TYPES);
const specialTypeEnum = z.enum(SPECIAL_TYPES);
const powerTypeEnum = z.enum(POWER_TYPES);
const jackpotTierEnum = z.enum(JACKPOT_TIERS);

const pos = () => z.number().positive();
const nonNeg = () => z.number().nonnegative();
const count = () => z.int().nonnegative();
const posCount = () => z.int().positive();
const weight = () => z.number().nonnegative();

const coinSchema = z.strictObject({
  radius: pos(),
  thickness: pos(),
  mass: pos(),
  friction: nonNeg(),
  restitution: z.number().min(0).max(1),
  linearDamping: nonNeg().default(0.1),
  angularDamping: nonNeg().default(0.4),
});

const machineSchema = z.strictObject({
  width: pos(),
  depth: pos(),
  upperDeckDepth: pos().default(0.5),
  upperDeckHeight: pos(),
  lowerDeckHeight: z.number(),
  sideLossWidth: pos(),
  /** Longueur des joues pleines sur l'arrière du plateau bas, devant le pousseur rentré. */
  sideGuardDepth: nonNeg().default(0.25),
  pusherPeriodSeconds: pos(),
  pusherStroke: pos(),
  shotIntervalSeconds: pos(),
  rampSpeed: pos().default(1.2),
  deckFriction: nonNeg().default(0.35),
  initialObjects: count(),
  coin: coinSchema,
  /** Le coffre a explicitement son propre collider (boîte) et sa propre masse. */
  chest: z
    .strictObject({ width: pos(), height: pos(), depth: pos(), mass: pos() })
    .default({ width: 0.1, height: 0.065, depth: 0.075, mass: 0.06 }),
  initialCompositionWeights: z.record(objectTypeEnum, weight()),
});

const simulationSchema = z.strictObject({
  fixedStepSeconds: z.number().min(1 / 240).max(1 / 20),
  maxCatchUpSteps: z.int().min(1).max(20),
  gravityY: z.number().negative(),
  maxPhysicalObjects: posCount(),
  maxPendingRewards: posCount(),
  maxSpawnsPerSecond: pos(),
  lengthUnit: pos().default(0.1),
  solverIterations: z.int().min(1).max(16).default(4),
  softCcdPrediction: nonNeg().default(0.02),
});

const objectRewardSchema = z.strictObject({
  reserve: count(),
  points: count(),
  feverCharge: count().optional(),
  wheelCharge: count().optional(),
});

const rewardBase = { id: z.string().min(1), weight: weight() };
const rewardSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...rewardBase, kind: z.literal('reserve'), amount: posCount() }),
  z.strictObject({ ...rewardBase, kind: z.literal('coinRain') }),
  z.strictObject({ ...rewardBase, kind: z.literal('barriers') }),
  z.strictObject({ ...rewardBase, kind: z.literal('superPush') }),
  z.strictObject({ ...rewardBase, kind: z.literal('shockwave'), amount: posCount().default(1) }),
  z.strictObject({ ...rewardBase, kind: z.literal('freeShots') }),
  z.strictObject({ ...rewardBase, kind: z.literal('goldenShots') }),
  z.strictObject({ ...rewardBase, kind: z.literal('jackpot'), tier: jackpotTierEnum }),
]);

const stackSchema = z.strictObject({ cycles: posCount(), maxStackedCycles: posCount() });

export const gameConfigSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    rulesVersion: z.string().min(1),
    locale: z.literal('fr'),
    defaultMode: z.enum(GAME_MODES),
    seed: z.string().min(1).max(120),
    economy: z.strictObject({
      freeInitialReserve: count(),
      challengeInitialReserve: count(),
      freeManualRefill: count(),
      shotCost: posCount(),
    }),
    simulation: simulationSchema,
    machine: machineSchema,
    objects: z.record(objectTypeEnum, objectRewardSchema),
    distribution: z.strictObject({
      paidShotsPerSpecialOffer: posCount(),
      specialWeights: z.record(specialTypeEnum, weight()),
      powerWeights: z.record(powerTypeEnum, weight()),
    }),
    combo: z.strictObject({
      windowSeconds: pos(),
      eligibleTypes: z.array(objectTypeEnum).min(1),
      thresholds: z.array(z.strictObject({ count: posCount(), multiplier: z.number().min(1) })).min(1),
      maxCombinedMultiplier: z.number().min(1),
    }),
    bonus: z.strictObject({
      coinRain: z.strictObject({ count: posCount() }),
      barriers: stackSchema,
      superPush: stackSchema.extend({ strokeFactor: z.number().min(1).max(2) }),
      shockwave: z.strictObject({ maxCharges: posCount(), impulse: pos() }),
      freeShots: z.strictObject({ count: posCount(), maxCharges: posCount() }),
      goldenShots: z.strictObject({ count: posCount(), maxCharges: posCount() }),
      fever: z.strictObject({
        starsRequired: posCount(),
        durationSeconds: pos(),
        pointMultiplier: z.number().min(1),
        extensionSeconds: nonNeg(),
        maxExtensions: count(),
      }),
    }),
    wheel: z.strictObject({ tokensRequired: posCount(), rewards: z.array(rewardSchema).min(1) }),
    chest: z.strictObject({ rewards: z.array(rewardSchema).min(1) }),
    collection: z.strictObject({ gemIds: z.array(z.string().min(1)).min(1), completedSetJackpot: jackpotTierEnum }),
    jackpots: z.record(jackpotTierEnum, z.strictObject({ reserve: count(), points: count() })),
    challenge: z.strictObject({
      quietCyclesToEnd: posCount(),
      maxResolutionSeconds: pos(),
      allowManualRefill: z.boolean(),
    }),
    presentation: z.strictObject({
      theme: z.string().min(1),
      quality: z.enum(QUALITY_LEVELS),
      reducedEffects: z.boolean(),
      audio: z.strictObject({
        master: z.number().min(0).max(1),
        effects: z.number().min(0).max(1),
        music: z.number().min(0).max(1),
      }),
    }),
    persistence: z.strictObject({
      formatVersion: posCount(),
      checkpointIntervalSeconds: pos(),
      maxImportBytes: posCount(),
    }),
  })
  .superRefine((cfg, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const positiveSum = (values: Record<string, number>, path: (string | number)[]) => {
      if (!(Object.values(values).reduce((a, b) => a + b, 0) > 0)) issue(path, 'au moins un poids doit être strictement positif');
    };
    const m = cfg.machine;
    positiveSum(m.initialCompositionWeights, ['machine', 'initialCompositionWeights']);
    positiveSum(cfg.distribution.specialWeights, ['distribution', 'specialWeights']);
    positiveSum(cfg.distribution.powerWeights, ['distribution', 'powerWeights']);
    positiveSum(Object.fromEntries(cfg.wheel.rewards.map((r) => [r.id, r.weight])), ['wheel', 'rewards']);
    positiveSum(Object.fromEntries(cfg.chest.rewards.map((r) => [r.id, r.weight])), ['chest', 'rewards']);
    for (const [name, list] of [['wheel', cfg.wheel.rewards], ['chest', cfg.chest.rewards]] as const) {
      const ids = list.map((r) => r.id);
      if (new Set(ids).size !== ids.length) issue([name, 'rewards'], 'identifiants de récompense en double');
    }

    const playWidth = m.width - 2 * m.sideLossWidth;
    if (playWidth < 6 * m.coin.radius) issue(['machine', 'sideLossWidth'], 'plateau trop étroit pour les pièces');
    if (m.sideLossWidth < 2 * m.coin.thickness) issue(['machine', 'sideLossWidth'], 'gouttière latérale plus fine que deux épaisseurs de pièce');
    if (m.upperDeckDepth >= m.depth - 4 * m.coin.radius) issue(['machine', 'upperDeckDepth'], 'plateau haut trop profond pour laisser un plateau bas');
    if (m.upperDeckDepth < 4 * m.coin.radius) issue(['machine', 'upperDeckDepth'], 'plateau haut trop court');
    if (m.sideGuardDepth > m.depth - m.upperDeckDepth - 4 * m.coin.radius) issue(['machine', 'sideGuardDepth'], 'les joues latérales couvrent tout le plateau bas');
    if (m.upperDeckHeight - m.lowerDeckHeight < 4 * m.coin.thickness) issue(['machine', 'upperDeckHeight'], 'marche entre plateaux trop basse');
    if (m.pusherStroke * cfg.bonus.superPush.strokeFactor > m.depth - m.upperDeckDepth - 2 * m.coin.radius) {
      issue(['machine', 'pusherStroke'], 'course du pousseur (super poussée incluse) trop longue pour le plateau bas');
    }
    if (m.coin.thickness >= m.coin.radius) issue(['machine', 'coin', 'thickness'], 'une pièce doit être plus large qu’épaisse');
    if (m.initialObjects > cfg.simulation.maxPhysicalObjects) issue(['machine', 'initialObjects'], 'dépasse simulation.maxPhysicalObjects');

    const thresholds = cfg.combo.thresholds;
    for (let i = 1; i < thresholds.length; i++) {
      if (thresholds[i]!.count <= thresholds[i - 1]!.count) issue(['combo', 'thresholds', i, 'count'], 'les seuils doivent être strictement croissants');
      if (thresholds[i]!.multiplier < thresholds[i - 1]!.multiplier) issue(['combo', 'thresholds', i, 'multiplier'], 'les multiplicateurs ne doivent pas décroître');
    }
    if (thresholds[0]!.count !== 1) issue(['combo', 'thresholds', 0, 'count'], 'le premier seuil doit valoir 1');

    const b = cfg.bonus;
    if (b.barriers.cycles > b.barriers.maxStackedCycles) issue(['bonus', 'barriers'], 'durée supérieure au plafond');
    if (b.superPush.cycles > b.superPush.maxStackedCycles) issue(['bonus', 'superPush'], 'durée supérieure au plafond');
    if (b.freeShots.count > b.freeShots.maxCharges) issue(['bonus', 'freeShots'], 'lot supérieur au plafond');
    if (b.goldenShots.count > b.goldenShots.maxCharges) issue(['bonus', 'goldenShots'], 'lot supérieur au plafond');

    const gems = cfg.collection.gemIds;
    if (new Set(gems).size !== gems.length) issue(['collection', 'gemIds'], 'gemmes en double');
    if (cfg.economy.challengeInitialReserve < 1) issue(['economy', 'challengeInitialReserve'], 'un défi doit commencer avec au moins un tir');
  });

export type GameConfig = z.output<typeof gameConfigSchema>;
export type RewardEntry = GameConfig['wheel']['rewards'][number];

export class ConfigError extends Error {
  readonly details: string;
  constructor(message: string, details: string) {
    super(message);
    this.name = 'ConfigError';
    this.details = details;
  }
}

/** Valide un objet déjà désérialisé. Lève ConfigError avec un message lisible. */
export function validateConfig(raw: unknown): GameConfig {
  const result = gameConfigSchema.safeParse(raw);
  if (!result.success) throw new ConfigError('Configuration invalide', z.prettifyError(result.error));
  return result.data;
}
