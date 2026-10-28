import { parse as parseYaml } from 'yaml';
import { ConfigError, validateConfig, type GameConfig } from './schema.ts';

// Réglages opérateur : surcharges locales validées par le même schéma que config/game.yaml.
// Les appliquer reconstruit la machine (nouvel identifiant de règles, records séparés).

export interface OperatorParam {
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  group: 'Économie' | 'Bonus' | 'Machine';
  help: string;
}

export const OPERATOR_PARAMS: readonly OperatorParam[] = [
  { path: 'economy.freeInitialReserve', label: 'Réserve initiale (libre)', min: 10, max: 2000, step: 10, group: 'Économie', help: 'Pièces disponibles au début d’une partie libre.' },
  { path: 'economy.freeManualRefill', label: 'Recharge gratuite (libre)', min: 10, max: 1000, step: 10, group: 'Économie', help: 'Pièces ajoutées par le bouton de recharge.' },
  { path: 'machine.shotIntervalSeconds', label: 'Intervalle entre tirs (s)', min: 0.25, max: 1.5, step: 0.05, group: 'Économie', help: 'En dessous de 0,35 s, la goulotte se bouche souvent (mesuré).' },
  { path: 'distribution.paidShotsPerSpecialOffer', label: 'Tirs payés par objet offert', min: 3, max: 60, step: 1, group: 'Bonus', help: 'Fréquence des objets spéciaux distribués au fond du plateau.' },
  { path: 'bonus.fever.starsRequired', label: 'Étoiles pour la Fever', min: 2, max: 15, step: 1, group: 'Bonus', help: 'Étoiles collectées nécessaires.' },
  { path: 'bonus.fever.durationSeconds', label: 'Durée de Fever (s)', min: 5, max: 60, step: 1, group: 'Bonus', help: 'Temps simulé, figé pendant les pauses.' },
  { path: 'bonus.coinRain.count', label: 'Pièces par pluie', min: 5, max: 80, step: 5, group: 'Bonus', help: 'Distribuées progressivement, dans la limite de capacité.' },
  { path: 'wheel.tokensRequired', label: 'Jetons pour la roue', min: 1, max: 8, step: 1, group: 'Bonus', help: 'Jetons roue collectés par tirage.' },
  { path: 'combo.windowSeconds', label: 'Fenêtre de combo (s)', min: 1, max: 6, step: 0.5, group: 'Bonus', help: 'Prolongée à chaque pièce normale ou dorée.' },
  { path: 'machine.pusherPeriodSeconds', label: 'Période du pousseur (s)', min: 1.6, max: 4, step: 0.1, group: 'Machine', help: 'Un cycle complet aller-retour.' },
  { path: 'machine.pusherStroke', label: 'Course du pousseur (m)', min: 0.1, max: 0.2, step: 0.01, group: 'Machine', help: 'Largeur de la bande balayée par le mur de fond.' },
  { path: 'machine.sideGuardDepth', label: 'Joues latérales (m)', min: 0.2, max: 0.65, step: 0.05, group: 'Machine', help: 'Plus longues = moins de pertes sur les côtés.' },
  { path: 'machine.coin.friction', label: 'Frottement des pièces', min: 0.08, max: 0.3, step: 0.01, group: 'Machine', help: 'Sensible : au-delà de ~0,2 les tas bouchent la goulotte.' },
  { path: 'machine.initialObjects', label: 'Objets au départ', min: 60, max: 300, step: 10, group: 'Machine', help: 'Disposition initiale reproductible par seed.' },
];

export const PRESETS: Record<string, { label: string; description: string; values: Record<string, number> }> = {
  classic: { label: 'Classique', description: 'Profil de base calibré au prototype.', values: {} },
  generous: {
    label: 'Généreux',
    description: 'Plus de réserve, d’objets offerts et de pluie ; moins de pertes latérales.',
    values: { 'economy.freeInitialReserve': 250, 'distribution.paidShotsPerSpecialOffer': 8, 'bonus.coinRain.count': 40, 'machine.sideGuardDepth': 0.55 },
  },
  chaos: {
    label: 'Chaos',
    description: 'Événements fréquents, mêmes garde-fous de capacité et de file.',
    values: { 'distribution.paidShotsPerSpecialOffer': 5, 'bonus.fever.starsRequired': 4, 'wheel.tokensRequired': 2, 'bonus.coinRain.count': 50, 'machine.pusherPeriodSeconds': 2 },
  },
  relax: {
    label: 'Détente',
    description: 'Réserve abondante, rythme posé. Ce n’est pas un profil de défi standard.',
    values: { 'economy.freeInitialReserve': 500, 'economy.freeManualRefill': 300, 'machine.shotIntervalSeconds': 0.5, 'bonus.fever.durationSeconds': 30 },
  },
};

export interface Overrides {
  version: 1;
  preset: string;
  /** Ajustements manuels au-delà du préréglage : rendent les sessions personnalisées. */
  values: Record<string, number>;
}

const STORAGE_KEY = 'coin-cascade-overrides';

export function loadOverrides(): Overrides | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : null;
  } catch {
    return null;
  }
}

export function saveOverrides(o: Overrides | null): void {
  try {
    if (o) localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : réglages de cette visite seulement */
  }
}

function setPath(target: Record<string, unknown>, path: string, value: number): void {
  const keys = path.split('.');
  let node = target;
  for (const k of keys.slice(0, -1)) {
    if (typeof node[k] !== 'object' || node[k] === null) throw new ConfigError('Réglage inconnu', path);
    node = node[k] as Record<string, unknown>;
  }
  node[keys.at(-1)!] = value;
}

/**
 * Configuration publiée + préréglage + ajustements, validée par le schéma.
 * Lève ConfigError si le résultat est invalide : la configuration active reste alors celle publiée.
 */
export function buildConfig(yamlText: string, overrides: Overrides | null): GameConfig {
  const raw = parseYaml(yamlText) as Record<string, unknown>;
  if (overrides) {
    if (overrides.version !== 1) throw new ConfigError('Réglages incompatibles', `version ${String(overrides.version)}`);
    const known = new Set(OPERATOR_PARAMS.map((p) => p.path));
    const preset = PRESETS[overrides.preset] ?? PRESETS.classic!;
    for (const [path, value] of Object.entries({ ...preset.values, ...overrides.values })) {
      if (!known.has(path)) throw new ConfigError('Réglage inconnu', path);
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new ConfigError('Valeur invalide', path);
      setPath(raw, path, value);
    }
  }
  return validateConfig(raw);
}

export function readPath(config: unknown, path: string): number {
  return path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], config) as number;
}
