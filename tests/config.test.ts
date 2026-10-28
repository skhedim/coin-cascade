import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeRulesId, parseConfigYaml } from '../src/config/parse.ts';
import { ConfigError } from '../src/config/schema.ts';
import { assetManifest, resolveAsset } from '../src/assets/manifest.ts';
import { configText, loadConfig } from './helpers.ts';

const rejects = (patch: (raw: Record<string, any>) => void) => expect(() => loadConfig(patch)).toThrow(ConfigError);

describe('configuration', () => {
  it('valide le fichier publié', () => {
    const config = parseConfigYaml(configText);
    expect(config.machine.initialObjects).toBeLessThanOrEqual(config.simulation.maxPhysicalObjects);
  });

  it('refuse les valeurs incohérentes avec un message explicite', () => {
    rejects((c) => (c.machine.width = -1));
    rejects((c) => (c.machine.coin.radius = Number.NaN));
    rejects((c) => (c.machine.coin.mass = Number.POSITIVE_INFINITY));
    rejects((c) => (c.distribution.specialWeights = { gold: 0, star: 0, wheel: 0, gem: 0, chest: 0, power: 0 }));
    rejects((c) => (c.combo.thresholds = [{ count: 1, multiplier: 1 }, { count: 1, multiplier: 2 }]));
    rejects((c) => (c.bonus.freeShots.count = 99));
    rejects((c) => (c.machine.unknownKey = 3));
    rejects((c) => (c.wheel.rewards[0].kind = 'teleport'));
  });

  it('rend une erreur lisible pour un YAML cassé', () => {
    try {
      parseConfigYaml('machine: [1, 2');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).details.length).toBeGreaterThan(0);
    }
  });

  it('identifie les règles sans tenir compte des options visuelles ni de la seed', () => {
    const base = computeRulesId(loadConfig());
    expect(computeRulesId(loadConfig((c) => (c.presentation.quality = 'low')))).toBe(base);
    expect(computeRulesId(loadConfig((c) => (c.seed = 'autre')))).toBe(base);
    expect(computeRulesId(loadConfig((c) => (c.objects.gold.points = 60)))).not.toBe(base);
    expect(computeRulesId(loadConfig((c) => (c.machine.coin.friction = 0.18)))).not.toBe(base);
  });
});

describe('manifeste des assets', () => {
  it('a des identifiants et chemins uniques, relatifs à public/', () => {
    const ids = assetManifest.assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of assetManifest.assets) expect(a.path.startsWith('/')).toBe(false);
  });

  it('résout un asset planifié vers son fallback, sans URL réseau', () => {
    const planned = assetManifest.assets.find((a) => a.status === 'planned')!;
    const r = resolveAsset(planned.id);
    expect(r.kind).toBe('fallback');
    if (r.kind === 'fallback') expect(r.fallback).toBe(planned.fallback);
    expect(resolveAsset('inexistant').kind).toBe('fallback');
  });

  it('résout un asset prêt vers une URL relative à la base Vite, dont le fichier existe', () => {
    for (const a of assetManifest.assets.filter((x) => x.status === 'ready')) {
      const r = resolveAsset(a.id);
      expect(r.kind).toBe('file');
      // Construite depuis la base Vite (`./` au build, contrôlé sous sous-chemin par check:browser).
      if (r.kind === 'file') expect(r.url).toBe(`${import.meta.env.BASE_URL}${a.path}`);
      expect(existsSync(new URL(`../public/${a.path}`, import.meta.url))).toBe(true);
    }
  });
});

describe('réglages opérateur', async () => {
  const { buildConfig, PRESETS } = await import('../src/config/overrides.ts');

  it('construit chaque préréglage comme une variante valide aux règles identifiées séparément', () => {
    const ids = new Set<string>();
    for (const preset of Object.keys(PRESETS)) ids.add(computeRulesId(buildConfig(configText, { version: 1, preset, values: {} })));
    expect(ids.size).toBe(Object.keys(PRESETS).length);
  });

  it('refuse un réglage inconnu, non fini ou hors schéma sans toucher à la configuration publiée', () => {
    expect(() => buildConfig(configText, { version: 1, preset: 'classic', values: { 'machine.width': 3 } })).toThrow(ConfigError);
    expect(() => buildConfig(configText, { version: 1, preset: 'classic', values: { 'bonus.fever.starsRequired': Number.NaN } })).toThrow(ConfigError);
    expect(() => buildConfig(configText, { version: 1, preset: 'classic', values: { 'machine.initialObjects': 999 } })).toThrow(ConfigError);
    expect(computeRulesId(buildConfig(configText, null))).toBe(computeRulesId(loadConfig()));
  });
});

describe('thèmes', async () => {
  const { THEMES, themeById, themeUnlocked } = await import('../src/render/themes.ts');

  it('propose le thème de la configuration publiée par défaut, sans effet sur les règles', () => {
    const config = loadConfig();
    expect(themeById(config.presentation.theme).id).toBe(config.presentation.theme);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(computeRulesId(loadConfig((c) => (c.presentation.theme = 'rubis')))).toBe(computeRulesId(config));
  });

  it('ne débloque un thème qu’avec son trophée', () => {
    const rubis = themeById('rubis');
    expect(themeUnlocked(rubis, {})).toBe(false);
    expect(themeUnlocked(rubis, { firstGrand: '2026-10-28' })).toBe(true);
    expect(themeUnlocked(themeById('neon-gold'), {})).toBe(true);
  });
});
