import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { GameConfig, GameMode, ObjectType } from '../src/config/schema.ts';
import { validateConfig } from '../src/config/schema.ts';
import { GameRules, initialRulesState, type ExitInput, type ObjectOrigin } from '../src/engine/rules.ts';

export const configText = readFileSync(new URL('../config/game.yaml', import.meta.url), 'utf8');

/** Configuration publiée, éventuellement modifiée par `patch` sur l'objet brut. */
export function loadConfig(patch?: (raw: Record<string, any>) => void): GameConfig {
  const raw = parse(configText) as Record<string, any>;
  patch?.(raw);
  return validateConfig(raw);
}

export function makeRules(mode: GameMode = 'free', patch?: (raw: Record<string, any>) => void, seed = 'test-seed'): GameRules {
  const config = loadConfig(patch);
  return new GameRules(config, initialRulesState(config, mode, seed));
}

let nextId = 1;
export function exit(type: ObjectType, kind: ExitInput['kind'] = 'collected', variant: string | null = null, origin: ObjectOrigin = 'paid-shot', id = nextId++): ExitInput {
  return { id, kind, type, origin, variant };
}

/** Avance les minuteries de `seconds` en pas fixes. */
export function run(rules: GameRules, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    rules.beginTick();
    rules.advance(dt, 0);
  }
}
