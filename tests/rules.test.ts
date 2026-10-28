import { describe, expect, it } from 'vitest';
import { GameRules } from '../src/engine/rules.ts';
import { exit, makeRules, run } from './helpers.ts';

describe('collecte et comptabilité', () => {
  it('ne paie qu’une fois deux sorties du même objet', () => {
    const rules = makeRules();
    const e = exit('gold');
    rules.applyExits([e]);
    rules.applyExits([e, { ...e }]);
    expect(rules.state.stats.collected['paid-shot']).toBe(1);
    expect(rules.state.score).toBe(50);
    expect(rules.state.reserve).toBe(120 + 5);
  });

  it('n’accorde rien pour une perte latérale, même d’un objet spécial', () => {
    const rules = makeRules();
    const before = structuredClone(rules.state);
    rules.applyExits([exit('star', 'lost'), exit('wheel', 'lost'), exit('gem', 'lost', 'ruby'), exit('chest', 'lost'), exit('power', 'lost', 'shockwave')]);
    const s = rules.state;
    expect(s.score).toBe(0);
    expect(s.reserve).toBe(before.reserve);
    expect(s.fever.stars).toBe(0);
    expect(s.wheel.tokens).toBe(0);
    expect(s.gems.session).toEqual([]);
    expect(s.charges).toEqual(before.charges);
    expect(s.stats.lost['paid-shot']).toBe(5);
  });

  it('applique points = base × combo × Fever, plafonné, sans multiplier la réserve', () => {
    const rules = makeRules('free', (c) => (c.combo.maxCombinedMultiplier = 4));
    rules.state.fever = { active: true, remaining: 10, extensionsUsed: 0, stars: 0, pendingStart: false };
    // 5 pièces normales : la 5e passe le combo à ×2, donc ×4 avec la Fever.
    for (let i = 0; i < 4; i++) rules.applyExits([exit('normal')]);
    const scoreAt4 = rules.state.score; // 4 × 10 × 1 × 2
    rules.applyExits([exit('normal')]);
    expect(scoreAt4).toBe(80);
    expect(rules.state.score - scoreAt4).toBe(40);
    // 12e pièce : combo ×3 × Fever ×2 = ×6, plafonné à ×4.
    for (let i = 0; i < 7; i++) rules.applyExits([exit('normal')]);
    expect(rules.currentMultiplier()).toBe(4);
    expect(rules.state.reserve).toBe(120 + 12);
  });

  it('met à jour le combo avant de payer et laisse les spéciaux sans prolonger la fenêtre', () => {
    const rules = makeRules();
    for (let i = 0; i < 5; i++) rules.applyExits([exit('normal')]);
    expect(rules.state.combo).toMatchObject({ count: 5, multiplier: 2 });
    run(rules, 2.0);
    const timer = rules.state.combo.timer;
    rules.applyExits([exit('star')]);
    expect(rules.state.score).toBe(4 * 10 + 1 * 20 + 25 * 2);
    expect(rules.state.combo.timer).toBe(timer);
    run(rules, 0.6);
    expect(rules.state.combo).toMatchObject({ count: 0, multiplier: 1 });
  });

  it('donne un résultat indépendant de l’ordre brut des sorties d’un même pas', () => {
    const exits = [exit('normal', 'collected', null, 'paid-shot', 101), exit('star', 'collected', null, 'paid-shot', 102), exit('gold', 'collected', null, 'paid-shot', 103), exit('normal', 'lost', null, 'paid-shot', 104)];
    const sorted = (list: typeof exits) => [...list].sort((a, b) => a.id - b.id);
    const a = makeRules();
    const b = makeRules();
    a.applyExits(sorted(exits));
    b.applyExits(sorted([...exits].reverse()));
    expect(b.state).toEqual(a.state);
  });
});

describe('tirs et charges', () => {
  it('consomme une charge gratuite et une charge dorée sans débiter la réserve', () => {
    const rules = makeRules();
    rules.state.charges.freeShots = 2;
    rules.state.charges.goldenShots = 1;
    const shot = rules.commitShot();
    expect(shot).toMatchObject({ origin: 'free-shot', type: 'gold' });
    expect(rules.state.reserve).toBe(120);
    expect(rules.state.charges).toMatchObject({ freeShots: 1, goldenShots: 0 });
  });

  it('fait payer un tir doré non gratuit', () => {
    const rules = makeRules();
    rules.state.charges.goldenShots = 1;
    expect(rules.commitShot()).toMatchObject({ origin: 'paid-shot', type: 'gold' });
    expect(rules.state.reserve).toBe(119);
  });

  it('propose un objet spécial tous les 12 tirs payés, sans compter les tirs gratuits', () => {
    const rules = makeRules();
    for (let i = 0; i < 11; i++) rules.commitShot();
    expect(rules.state.jobs).toHaveLength(0);
    rules.state.charges.freeShots = 5;
    for (let i = 0; i < 5; i++) rules.commitShot();
    expect(rules.state.jobs).toHaveLength(0);
    rules.commitShot();
    expect(rules.state.jobs).toHaveLength(1);
    expect(rules.state.jobs[0]!.type).not.toBe('normal');
  });

  it('reporte les offres quand la file de distribution est pleine, sans perdre le droit', () => {
    const rules = makeRules('free', (c) => (c.simulation.maxPendingRewards = 2));
    for (let i = 0; i < 48; i++) rules.commitShot();
    expect(rules.state.jobs).toHaveLength(2);
    expect(rules.state.paidShotsSinceOffer).toBe(24);
    rules.confirmSpawn();
    expect(rules.state.jobs).toHaveLength(2);
    expect(rules.state.paidShotsSinceOffer).toBe(12);
  });

  it('conserve l’excédent au plafond et le verse quand la charge redescend', () => {
    const rules = makeRules();
    for (let i = 0; i < 6; i++) rules.applyReward({ id: 'f', weight: 1, kind: 'freeShots' });
    expect(rules.state.charges.freeShots).toBe(50);
    expect(rules.state.overflow.freeShots).toBe(10);
    rules.commitShot();
    expect(rules.state.charges.freeShots).toBe(50);
    expect(rules.state.overflow.freeShots).toBe(9);
  });

  it('borne les cycles de barrières et de super poussée', () => {
    const rules = makeRules();
    for (let i = 0; i < 5; i++) rules.applyReward({ id: 'b', weight: 1, kind: 'barriers' });
    expect(rules.state.barrierCycles).toBe(24);
    expect(rules.state.overflow.barrierCycles).toBe(16);
    for (let i = 0; i < 4; i++) rules.applyReward({ id: 's', weight: 1, kind: 'superPush' });
    expect(rules.state.superPushCycles).toBe(9);
    // Les barrières ne montent qu'à une frontière de cycle.
    expect(rules.state.barriersRaised).toBe(false);
    expect(rules.onCycleEnd()).toEqual({ barriers: true, superPush: true });
  });
});

describe('Fever', () => {
  it('démarre au pas suivant le sixième étoile et consomme six étoiles', () => {
    const rules = makeRules();
    for (let i = 0; i < 6; i++) rules.applyExits([exit('star')]);
    rules.advance(1 / 60, 1);
    expect(rules.state.fever.active).toBe(false);
    rules.beginTick();
    expect(rules.state.fever).toMatchObject({ active: true, stars: 0, remaining: 20 });
  });

  it('se prolonge deux fois au plus puis garde le reliquat pour la séquence suivante', () => {
    const rules = makeRules();
    rules.state.fever = { active: true, remaining: 20, extensionsUsed: 0, stars: 0, pendingStart: false };
    for (let i = 0; i < 18; i++) rules.applyExits([exit('star')]);
    expect(rules.state.fever).toMatchObject({ extensionsUsed: 2, remaining: 40, stars: 6 });
    run(rules, 40.1);
    // Fin de séquence : le reliquat déclenche une nouvelle séquence au pas suivant.
    expect(rules.state.fever.active).toBe(true);
    expect(rules.state.fever.stars).toBe(0);
  });
});

describe('roue, coffres, gemmes', () => {
  it('engage le résultat avant la présentation et ne le paie qu’une fois, même après reprise', () => {
    const rules = makeRules();
    for (let i = 0; i < 3; i++) rules.applyExits([exit('wheel')]);
    const pending = rules.pendingSpin();
    expect(pending).not.toBeNull();
    expect(rules.canShoot()).toBe(false);
    // Reprise depuis la sauvegarde : même résultat.
    const restored = new GameRules(rules.config, rules.snapshot());
    expect(restored.pendingSpin()?.reward.id).toBe(pending!.reward.id);
    const reserveBefore = restored.state.reserve;
    expect(restored.payWheel(pending!.spin.id)).toBe(true);
    expect(restored.payWheel(pending!.spin.id)).toBe(false);
    expect(restored.pendingSpin()).toBeNull();
    expect(restored.canShoot()).toBe(true);
    if (pending!.reward.kind === 'reserve') expect(restored.state.reserve).toBe(reserveBefore + pending!.reward.amount);
  });

  it('garde les jetons supplémentaires tant qu’un tirage est en cours', () => {
    const rules = makeRules();
    for (let i = 0; i < 7; i++) rules.applyExits([exit('wheel')]);
    expect(rules.state.wheel.spins.filter((s) => !s.paid)).toHaveLength(1);
    expect(rules.state.wheel.tokens).toBe(4);
    rules.payWheel(rules.pendingSpin()!.spin.id);
    expect(rules.pendingSpin()).not.toBeNull();
    expect(rules.state.wheel.tokens).toBe(1);
  });

  it('tire une seule récompense de coffre, reproductible avec la même seed', () => {
    const a = makeRules('free', undefined, 'graine');
    const b = makeRules('free', undefined, 'graine');
    a.applyExits([exit('chest', 'collected', null, 'paid-shot', 7)]);
    b.applyExits([exit('chest', 'collected', null, 'paid-shot', 7)]);
    const ea = a.drainEvents().filter((e) => e.type === 'ChestOpened');
    expect(ea).toHaveLength(1);
    expect(b.drainEvents().filter((e) => e.type === 'ChestOpened')).toEqual(ea);
  });

  it('paie un Grand par collection complète, remet la session à zéro et garde l’album', () => {
    const rules = makeRules();
    const gems = rules.config.collection.gemIds;
    rules.applyExits([exit('gem', 'collected', gems[0]!)]);
    rules.applyExits([exit('gem', 'collected', gems[0]!)]);
    for (const g of gems.slice(1)) rules.applyExits([exit('gem', 'collected', g)]);
    expect(rules.state.stats.jackpots.grand).toBe(1);
    expect(rules.state.gems.session).toEqual([]);
    expect(rules.state.gems.album).toHaveLength(gems.length);
    const grand = rules.config.jackpots.grand;
    expect(rules.state.score).toBe(6 * 100 + grand.points);
    expect(rules.state.reserve).toBe(120 + grand.reserve);
  });
});

describe('fin de défi', () => {
  const challenge = () => makeRules('challenge');

  it('passe en résolution à réserve vide, puis reprend les tirs après une collecte tardive', () => {
    const rules = challenge();
    for (let i = 0; i < 100; i++) rules.commitShot();
    rules.state.jobs = [];
    run(rules, 1 / 60);
    expect(rules.state.challenge.phase).toBe('resolving');
    expect(rules.canShoot()).toBe(false);
    rules.applyExits([exit('normal')]);
    run(rules, 1 / 60);
    expect(rules.state.challenge.phase).toBe('playing');
    expect(rules.canShoot()).toBe(true);
  });

  it('se termine après trois cycles sans collecte et sans travail en attente', () => {
    const rules = challenge();
    rules.state.reserve = 0;
    run(rules, 1 / 60);
    for (let c = 0; c < 2; c++) rules.onCycleEnd();
    run(rules, 1 / 60);
    expect(rules.state.challenge.phase).toBe('resolving');
    rules.onCycleEnd();
    run(rules, 1 / 60);
    expect(rules.state.challenge).toMatchObject({ phase: 'ended', timedOut: false });
  });

  it('applique la limite de résolution et la signale au bilan', () => {
    const rules = challenge();
    rules.state.reserve = 0;
    rules.state.barrierCycles = 5; // effet engagé qui empêche la fin « calme »
    run(rules, 46);
    expect(rules.state.challenge).toMatchObject({ phase: 'ended', timedOut: true });
    expect(rules.canShoot()).toBe(false);
  });
});
