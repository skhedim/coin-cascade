import type { QualityLevel } from '../config/schema.ts';
import type { RulesEvent, RulesState } from '../engine/rules.ts';

/** Progression persistante, séparée de la machine en cours. */
export interface Profile {
  version: 1;
  /** Gemmes découvertes au moins une fois (album). */
  album: string[];
  trophies: Record<string, string>;
  /** Records de défi : clé `rulesId|seed`, sessions standard uniquement. */
  records: Record<string, { score: number; shots: number; date: string; timedOut: boolean }>;
}

export interface Settings {
  version: 1;
  master: number;
  effects: number;
  music: number;
  quality: QualityLevel;
  reducedEffects: boolean;
  /** Apparence de la borne (voir src/render/themes.ts). */
  theme: string;
  /** Conseils contextuels activés, et identifiants déjà montrés. */
  tips: boolean;
  tipsSeen: string[];
}

export const TROPHIES = [
  { id: 'chain30', label: 'Cascade de 30', description: 'Enchaîner 30 pièces dans un même combo.' },
  { id: 'firstChest', label: 'Premier coffre', description: 'Faire tomber un coffre dans le bac.' },
  { id: 'firstGrand', label: 'Premier Grand', description: 'Compléter les cinq gemmes.' },
  { id: 'chestSaved', label: 'Coffre sauvé', description: 'Collecter un coffre pendant les barrières.' },
] as const;

export type TrophyId = (typeof TROPHIES)[number]['id'];

export function emptyProfile(): Profile {
  return { version: 1, album: [], trophies: {}, records: {} };
}

export function defaultSettings(audio: { master: number; effects: number; music: number }, quality: QualityLevel, reducedEffects: boolean, theme: string): Settings {
  return { version: 1, ...audio, quality, reducedEffects, theme, tips: true, tipsSeen: [] };
}

/** Met à jour l'album et les trophées d'après les événements de règles. Retourne les trophées débloqués. */
export function applyProgress(profile: Profile, events: readonly RulesEvent[], rules: RulesState): TrophyId[] {
  const unlocked: TrophyId[] = [];
  const unlock = (id: TrophyId) => {
    if (profile.trophies[id]) return;
    profile.trophies[id] = new Date().toISOString();
    unlocked.push(id);
  };
  for (const e of events) {
    if (e.type === 'GemAdded' && !profile.album.includes(e.gem)) profile.album.push(e.gem);
    else if (e.type === 'ComboChanged' && e.count >= 30) unlock('chain30');
    else if (e.type === 'ObjectCollected' && e.objectType === 'chest') {
      unlock('firstChest');
      if (rules.barriersRaised) unlock('chestSaved');
    } else if (e.type === 'JackpotAwarded' && e.tier === 'grand') unlock('firstGrand');
  }
  return unlocked;
}
