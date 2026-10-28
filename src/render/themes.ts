import type { TrophyId } from '../persistence/profile.ts';

/**
 * Apparences de la borne : couleurs des éclairages et de la coque uniquement.
 * Purement visuelles : exclues de l'identifiant de règles et des records.
 */
export interface Theme {
  id: string;
  label: string;
  /** Trophée qui débloque le thème (null = disponible d'emblée). */
  unlock: TrophyId | null;
  leds: { cyan: string; magenta: string; gold: string };
  hull: string;
  panel: string;
}

export const THEMES: readonly Theme[] = [
  { id: 'neon-gold', label: 'Néon or', unlock: null, leds: { cyan: '#54e5ec', magenta: '#ed69c1', gold: '#f6bd54' }, hull: '#14243d', panel: '#1c3551' },
  { id: 'saphir', label: 'Saphir', unlock: 'firstChest', leds: { cyan: '#6fa8ff', magenta: '#9b7bff', gold: '#d8e4ff' }, hull: '#101a3a', panel: '#1a2a5c' },
  { id: 'emeraude', label: 'Émeraude', unlock: 'chain30', leds: { cyan: '#3dffb0', magenta: '#2fd3c8', gold: '#e6d27a' }, hull: '#0d2622', panel: '#143a33' },
  { id: 'rubis', label: 'Rubis', unlock: 'firstGrand', leds: { cyan: '#ff6b6b', magenta: '#ff9a3d', gold: '#ffd27a' }, hull: '#2a1018', panel: '#401a26' },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

/** Vrai si le thème est utilisable avec les trophées débloqués du profil. */
export function themeUnlocked(theme: Theme, trophies: Record<string, string>): boolean {
  return theme.unlock === null || Boolean(trophies[theme.unlock]);
}
