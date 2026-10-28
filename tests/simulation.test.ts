import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { FixedLoop } from '../src/game/loop.ts';
import { Simulation } from '../src/game/simulation.ts';
import { generateInitialLayout } from '../src/physics/layout.ts';
import { loadConfig } from './helpers.ts';

beforeAll(async () => {
  await RAPIER.init();
});

const config = loadConfig();
const newSim = (patch?: Parameters<typeof loadConfig>[0], mode: 'free' | 'challenge' | 'sandbox' = 'free') =>
  new Simulation(RAPIER, patch ? loadConfig(patch) : config, { seed: 'sim-test', mode, settleSeconds: 0.2 });

/** Place un objet actif à une position donnée, immobile (franchissement forcé du plan de sortie). */
function teleport(sim: Simulation, x: number, y: number, z: number) {
  const obj = [...sim.objects.values()].find((o) => o.state === 'active' && o.body)!;
  obj.body!.setTranslation({ x, y, z }, true);
  obj.body!.setLinvel({ x: 0, y: 0, z: 0 }, true);
  return obj;
}

describe('tirs', () => {
  it('débite une unité à la création et rien pour un tir refusé par la cadence', () => {
    const sim = newSim();
    sim.requestShot();
    sim.step();
    expect(sim.rules.state.reserve).toBe(119);
    sim.requestShot();
    sim.step();
    expect(sim.stats.shotsRefused.cadence).toBe(1);
    expect(sim.rules.state.reserve).toBe(119);
    expect(sim.stats.shotsAccepted).toBe(1);
  });

  it('refuse sans débit ni charge consommée quand la capacité est atteinte', () => {
    const sim = newSim((c) => (c.simulation.maxPhysicalObjects = c.machine.initialObjects));
    sim.rules.state.charges.freeShots = 3;
    sim.rules.state.charges.goldenShots = 2;
    sim.requestShot();
    sim.step();
    expect(sim.stats.shotsRefused.capacity).toBe(1);
    expect(sim.rules.state.reserve).toBe(120);
    expect(sim.rules.state.charges).toMatchObject({ freeShots: 3, goldenShots: 2 });
  });

  it('crée le tir dans la goulotte avec l’origine décidée par les règles', () => {
    const sim = newSim();
    sim.rules.state.charges.freeShots = 1;
    sim.requestShot();
    sim.step();
    const shot = [...sim.objects.values()].find((o) => o.origin === 'free-shot');
    expect(shot?.state).toBe('active');
    expect(shot!.body!.translation().y).toBeGreaterThan(sim.geometry.upperY);
  });
});

describe('sorties', () => {
  it('collecte une seule fois un objet passé sous le bord avant', () => {
    const sim = newSim();
    const g = sim.geometry;
    const obj = teleport(sim, 0, g.exitPlaneY - 0.02, g.frontZ + 0.05);
    sim.step();
    expect(sim.exitLog.map((e) => [e.id, e.kind])).toEqual([[obj.id, 'collected']]);
    expect(sim.objects.has(obj.id)).toBe(false);
    const collected = sim.rules.state.stats.collected.initial;
    sim.step();
    expect(sim.rules.state.stats.collected.initial).toBe(collected);
    expect(collected).toBe(1);
  });

  it('classe une chute dans une gouttière latérale en perte sans gain', () => {
    const sim = newSim();
    const g = sim.geometry;
    const reserve = sim.rules.state.reserve;
    const obj = teleport(sim, g.deckHalfWidth + g.sideLossWidth / 2, g.exitPlaneY - 0.02, g.frontZ - 0.1);
    sim.step();
    expect(sim.exitLog.map((e) => [e.id, e.kind])).toEqual([[obj.id, 'lost']]);
    expect(sim.rules.state.reserve).toBe(reserve);
    expect(sim.rules.state.score).toBe(0);
  });

  it('trie les sorties d’un même pas par identifiant stable', () => {
    const sim = newSim();
    const g = sim.geometry;
    const objs = [...sim.objects.values()].slice(0, 4).reverse();
    objs.forEach((o, i) => {
      o.body!.setTranslation({ x: -0.3 + i * 0.15, y: g.exitPlaneY - 0.02, z: g.frontZ + 0.05 }, true);
    });
    sim.step();
    const ids = sim.exitLog.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(ids).toHaveLength(4);
  });

  it('signale séparément une chute anormale hors des zones de sortie', () => {
    const sim = newSim();
    const g = sim.geometry;
    teleport(sim, 0, g.safetyMin[1] - 0.1, 0);
    sim.step();
    expect(sim.stats.anomalies).toBe(1);
    expect(sim.rules.state.stats.anomalies).toBe(1);
  });
});

describe('physique', () => {
  it('produit la même disposition initiale pour une même seed', () => {
    const g = newSim().geometry;
    const a = generateInitialLayout(config, g, 'graine-a');
    const b = generateInitialLayout(config, g, 'graine-a');
    const c = generateInitialLayout(config, g, 'graine-b');
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
    expect(a).toHaveLength(config.machine.initialObjects);
  });

  it('reste stable 20 s avec tirs : pas d’anomalie, pas de NaN, pas de fuite massive', () => {
    const sim = newSim(undefined, 'sandbox');
    const g = sim.geometry;
    for (let i = 0; i < 20 * 60; i++) {
      if (i % 40 === 0) {
        sim.setRampTarget(Math.sin(i / 97) * g.chute.maxX);
        sim.requestShot();
      }
      sim.step();
      const spin = sim.rules.pendingSpin();
      if (spin) sim.rules.payWheel(spin.spin.id);
    }
    expect(sim.stats.anomalies).toBe(0);
    for (const o of sim.objects.values()) {
      const t = o.body!.translation();
      expect(Number.isFinite(t.x + t.y + t.z)).toBe(true);
    }
    // Pertes latérales minoritaires face à la collecte avant.
    expect(sim.stats.lost).toBeLessThan(sim.stats.collected);
  }, 60_000);

  it('applique une onde de choc bornée sans téléporter les objets', () => {
    const sim = newSim();
    const before = new Map([...sim.objects.values()].map((o) => [o.id, o.body!.translation()]));
    const touched = sim.shockwave(0);
    sim.step();
    expect(touched).toBeGreaterThan(0);
    for (const o of sim.objects.values()) {
      const a = before.get(o.id);
      if (!a || !o.body) continue;
      const b = o.body.translation();
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.05);
    }
  });
});

describe('bonus mécaniques', () => {
  it('lève les barrières à la frontière de cycle, sans éjection, et les baisse après leurs cycles', () => {
    const sim = newSim(undefined, 'sandbox');
    sim.rules.applyReward({ id: 't', weight: 1, kind: 'barriers' });
    sim.step();
    expect(sim.physics.barrierTarget).toBe(0); // pas avant la frontière de cycle
    let maxSpeed = 0;
    for (let i = 0; i < 3.2 * 60; i++) {
      sim.step();
      for (const o of sim.objects.values()) if (o.body) maxSpeed = Math.max(maxSpeed, Math.hypot(o.body.linvel().x, o.body.linvel().y, o.body.linvel().z));
    }
    expect(sim.physics.barrierLevel).toBe(1);
    expect(sim.rules.state.barriersRaised).toBe(true);
    expect(maxSpeed).toBeLessThan(2);
    for (let i = 0; i < 9 * 2.4 * 60; i++) sim.step();
    expect(sim.rules.state.barrierCycles).toBe(0);
    expect(sim.physics.barrierTarget).toBe(0);
  }, 60_000);

  it('allonge la course du pousseur pendant la super poussée, puis revient à la course de base', () => {
    const sim = newSim(undefined, 'sandbox');
    const base = sim.geometry.pusher.stroke;
    sim.rules.applyReward({ id: 't', weight: 1, kind: 'superPush' });
    for (let i = 0; i < 2.5 * 60; i++) sim.step();
    expect(sim.physics.pusherStroke).toBeCloseTo(base * sim.config.bonus.superPush.strokeFactor, 6);
    for (let i = 0; i < 4 * 2.4 * 60; i++) sim.step();
    expect(sim.physics.pusherStroke).toBeCloseTo(base, 6);
    expect(sim.stats.anomalies).toBe(0);
  }, 60_000);
});

describe('sauvegarde', () => {
  it('reprend exactement la machine et les règles depuis un instantané JSON', () => {
    const a = newSim(undefined, 'free');
    for (let i = 0; i < 240; i++) {
      if (i % 30 === 0) a.requestShot();
      a.step();
    }
    const snap = JSON.parse(JSON.stringify(a.snapshot()));
    const b = new Simulation(RAPIER, config, { seed: snap.seed, restore: snap });
    expect(b.tick).toBe(a.tick);
    expect(b.rules.state).toEqual(a.rules.snapshot());
    // Positions et orientations identiques au micromètre ; le cache de contacts du solveur
    // n'est pas sauvegardé, la suite n'est donc pas garantie identique bit à bit.
    const pa = a.snapshot().objects;
    const pb = b.snapshot().objects;
    expect(pb.map((o) => [o.id, o.type, o.origin, o.variant])).toEqual(pa.map((o) => [o.id, o.type, o.origin, o.variant]));
    pb.forEach((o, i) => o.pose.slice(0, 7).forEach((v, k) => expect(v).toBeCloseTo(pa[i]!.pose[k]!, 5)));
    for (let i = 0; i < 180; i++) {
      if (i % 30 === 0) b.requestShot();
      b.step();
    }
    expect(b.stats.anomalies).toBe(0);
    // Tirs repris normalement (un refus « goulotte occupée » reste possible selon les contacts).
    expect(b.rules.state.stats.paidShots).toBeGreaterThanOrEqual(a.rules.state.stats.paidShots + 5);
  });

  it('refuse une sauvegarde mal formée ou trop grande', async () => {
    const { checkSave } = await import('../src/persistence/store.ts');
    expect(checkSave({ format: 'autre' }).ok).toBe(false);
    const sim = newSim();
    const env = { format: 'coin-cascade-save', formatVersion: 1, savedAt: 'x', rulesId: 'r', overrides: null, sim: JSON.parse(JSON.stringify(sim.snapshot())) };
    expect(checkSave(env).ok).toBe(true);
    env.sim.objects[0].pose[0] = 'NaN';
    expect(checkSave(env).ok).toBe(false);
    expect(checkSave({ ...env, formatVersion: 99 }).ok).toBe(false);
  });
});

describe('boucle à pas fixe', () => {
  it('borne le rattrapage après une longue image et n’avance pas en pause', () => {
    let steps = 0;
    let paused = false;
    const loop = new FixedLoop({ step: () => steps++, render: () => {}, canStep: () => !paused }, 1 / 60, 5);
    expect(loop.advance(10)).toBe(5);
    expect(loop.droppedSeconds).toBeGreaterThan(9);
    paused = true;
    expect(loop.advance(1)).toBe(0);
    paused = false;
    expect(loop.advance(1 / 60)).toBe(1);
    expect(steps).toBe(6);
  });
});
