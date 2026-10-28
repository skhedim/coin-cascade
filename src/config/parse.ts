import { parse as parseYaml } from 'yaml';
import { canonicalJson, hashHex } from '../engine/hash.ts';
import { ConfigError, validateConfig, type GameConfig } from './schema.ts';

/** Lit un texte YAML et le valide. Lève ConfigError si la syntaxe ou les valeurs sont invalides. */
export function parseConfigYaml(text: string): GameConfig {
  let raw: unknown;
  try {
    raw = parseYaml(text, { prettyErrors: true });
  } catch (error) {
    throw new ConfigError('YAML illisible', error instanceof Error ? error.message : String(error));
  }
  return validateConfig(raw);
}

/**
 * Identifiant des règles : configuration normalisée privée des options purement
 * visuelles/audio et de la seed (le scénario est une clé de record séparée).
 */
export function computeRulesId(config: GameConfig): string {
  const { presentation: _p, seed: _s, locale: _l, defaultMode: _d, persistence: _x, ...rules } = config;
  return `${config.rulesVersion}#${hashHex(canonicalJson(rules))}`;
}
