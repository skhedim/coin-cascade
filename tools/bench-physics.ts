// Mesures physiques sans navigateur : `npm run bench:physics -- [options]`
//   --scenario=idle|play|perf|long   (défaut : play ; long = partie longue avec un bonus forcé par minute)
//   --shape=round|cylinder|hull (défaut : round)
//   --seconds=N                 durée simulée
//   --objects=N                 objets initiaux
//   --seed=texte
//   --rate=N                    tirs par seconde (play)
//   --set=chemin:valeur,...     surcharge de config/game.yaml, ex. machine.deckFriction:0.2
//   --trace=N                   affiche l'état toutes les N secondes simulées
//   --exitH=m --exitZ=m --launch=m/s   réglages d'étude de l'alimentation (goulotte)
//   --static=x                  rampe immobile en x (pire cas : tous les tirs au même endroit)
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { validateConfig } from '../src/config/schema.ts';
import { Simulation } from '../src/game/simulation.ts';
import type { CoinShape } from '../src/physics/machine.ts';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
) as Record<string, string>;

await RAPIER.init();
const raw = parseYaml(readFileSync(new URL('../config/game.yaml', import.meta.url), 'utf8')) as Record<string, unknown>;
for (const pair of (args.set ?? '').split(',').filter(Boolean)) {
  const [path, value] = pair.split(':') as [string, string];
  const keys = path.split('.');
  let node = raw;
  for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
  node[keys.at(-1)!] = Number.isNaN(Number(value)) ? value : Number(value);
}
const config = validateConfig(raw);
const scenario = args.scenario ?? 'play';
const shape = (args.shape ?? 'round') as CoinShape;
const seed = args.seed ?? config.seed;

interface RunResult {
  objects: number;
  seconds: number;
  shots: number;
  collected: number;
  lost: number;
  anomalies: number;
  settleDiscarded: number;
  awakeEnd: number;
  activeEnd: number;
  stepP50: number;
  stepP95: number;
  stepMax: number;
  sinking: number;
  fastOnDeck: number;
  restSpeed: number;
  wallMs: number;
}

function run(objects: number, seconds: number, shotsPerSecond: number): RunResult {
  const started = performance.now();
  const num = (k: string) => (args[k] !== undefined ? Number(args[k]) : undefined);
  const sim = new Simulation(RAPIER, config, {
    seed,
    mode: 'sandbox',
    coinShape: shape,
    initialObjects: objects,
    noSleep: args.nosleep === 'true',
    tuning: { chuteExitHeight: num('exitH'), chuteExitInset: num('exitZ'), spawnSpeed: num('launch') },
  });
  const g = sim.geometry;
  const steps = Math.round(seconds / sim.dt);
  const shotEvery = shotsPerSecond > 0 ? Math.max(1, Math.round(1 / (shotsPerSecond * sim.dt))) : Infinity;
  const all: number[] = [];
  let sinking = 0;
  let fastOnDeck = 0;
  let sweep = 0;
  for (let i = 0; i < steps; i++) {
    if (shotEvery !== Infinity && i % shotEvery === 0) {
      sweep += 0.37;
      sim.setRampTarget(args.static !== undefined ? Number(args.static) : Math.sin(sweep) * g.chute.maxX);
      sim.requestShot();
    }
    const t0 = performance.now();
    sim.step();
    all.push(performance.now() - t0);
    // Pas de présentation dans le banc : une roue engagée est payée aussitôt.
    const spin = sim.rules.pendingSpin();
    if (spin) sim.rules.payWheel(spin.spin.id);
    if (args.trace && i > 0 && i % Math.round(Number(args.trace) / sim.dt) === 0) {
      const s = sim.stats;
      console.log(`  t=${Math.round(i * sim.dt)}s actifs=${sim.activeCount} tirs=${s.shotsAccepted} collectées=${s.collected} perdues=${s.lost} refus=${JSON.stringify(s.shotsRefused)}`);
    }
    if (i % 30 === 0) {
      for (const o of sim.objects.values()) {
        if (!o.body) continue;
        const t = o.body.translation();
        const v = o.body.linvel();
        // Loin des bords : une pièce qui bascule dans une gouttière ou par l'avant n'est pas « enfoncée ».
        const onLower = t.y < g.upperY - 0.02 && t.z > g.pusher.retractedZ && Math.abs(t.x) < g.deckHalfWidth - g.coinRadius;
        // Pièce enfoncée dans le plateau bas : son centre passe sous la demi-épaisseur.
        if (onLower && t.y < g.lowerY + g.coinHalfThickness * 0.5 && t.z < g.frontZ - g.coinRadius) sinking++;
        if (onLower && Math.hypot(v.x, v.y, v.z) > 2.5) fastOnDeck++;
      }
    }
  }
  // Vitesse résiduelle des pièces loin du pousseur (tremblement permanent).
  let restSum = 0;
  let restN = 0;
  const calmZ = g.pusher.retractedZ + g.pusher.maxStroke + 4 * g.coinRadius;
  for (const o of sim.objects.values()) {
    if (!o.body) continue;
    const t = o.body.translation();
    if (t.y < g.upperY - 0.02 && t.z > calmZ && t.z < g.frontZ - 3 * g.coinRadius) {
      const v = o.body.linvel();
      restSum += Math.hypot(v.x, v.y, v.z);
      restN++;
    }
  }
  all.sort((a, b) => a - b);
  const result: RunResult = {
    objects,
    seconds,
    shots: sim.stats.shotsAccepted,
    collected: sim.stats.collected,
    lost: sim.stats.lost,
    anomalies: sim.stats.anomalies,
    settleDiscarded: sim.stats.settleDiscarded,
    awakeEnd: sim.countAwake(),
    activeEnd: sim.activeCount,
    stepP50: all[Math.floor(all.length * 0.5)]!,
    stepP95: all[Math.floor(all.length * 0.95)]!,
    stepMax: all[all.length - 1]!,
    sinking,
    fastOnDeck,
    restSpeed: restN ? restSum / restN : 0,
    wallMs: performance.now() - started,
  };
  sim.dispose();
  return result;
}

function print(r: RunResult): void {
  const f = (n: number, d = 2) => n.toFixed(d);
  console.log(
    [
      `objets=${r.objects}`,
      `durée=${r.seconds}s`,
      `tirs=${r.shots}`,
      `collectées=${r.collected}`,
      `perdues=${r.lost}`,
      `anomalies=${r.anomalies}`,
      `écartées-stabilisation=${r.settleDiscarded}`,
      `actives-fin=${r.activeEnd}`,
      `éveillées-fin=${r.awakeEnd}`,
      `pas p50=${f(r.stepP50)}ms p95=${f(r.stepP95)}ms max=${f(r.stepMax)}ms`,
      `enfoncées=${r.sinking}`,
      `rapides=${r.fastOnDeck}`,
      `vitesse-repos=${f(r.restSpeed, 4)}m/s`,
      `mur=${f(r.wallMs / 1000, 1)}s`,
    ].join('  '),
  );
}

/**
 * Partie longue : tirs continus en balayage et un bonus forcé chaque minute (pluie, barrières,
 * super poussée, onde de choc, Fever, roue, coffre). Vérifie plafonds, files bornées,
 * anomalies et dérive mémoire. Le temps de pas est relevé par minute.
 */
function runLong(minutes: number): void {
  const sim = new Simulation(RAPIER, config, { seed, mode: 'sandbox', coinShape: shape });
  const g = sim.geometry;
  const r = sim.rules;
  const bonuses = ['rain', 'barriers', 'superPush', 'shockwave', 'fever', 'wheel', 'chest'] as const;
  (globalThis as { gc?: () => void }).gc?.();
  const heap0 = process.memoryUsage().heapUsed;
  let maxActive = 0;
  let maxPending = 0;
  let maxJobs = 0;
  let sweep = 0;
  let minute: number[] = [];
  const perMinute = Math.round(60 / sim.dt);
  for (let i = 0; i < minutes * perMinute; i++) {
    if (i % 30 === 0) {
      sweep += 0.37;
      sim.setRampTarget(Math.sin(sweep) * g.chute.maxX);
      sim.requestShot();
    }
    if (i % perMinute === perMinute / 2) {
      const b = bonuses[Math.floor(i / perMinute) % bonuses.length]!;
      if (b === 'rain') r.applyReward({ id: 'banc', weight: 1, kind: 'coinRain' });
      else if (b === 'barriers' || b === 'superPush') r.applyReward({ id: 'banc', weight: 1, kind: b });
      else if (b === 'shockwave') sim.shockwave(sim.physics.chuteX);
      else if (b === 'fever') r.grantStars(config.bonus.fever.starsRequired);
      else if (b === 'wheel') r.grantWheelTokens(config.wheel.tokensRequired);
      else r.forceChest();
    }
    const t0 = performance.now();
    sim.step();
    minute.push(performance.now() - t0);
    const spin = r.pendingSpin();
    if (spin) r.payWheel(spin.spin.id);
    r.drainEvents();
    maxActive = Math.max(maxActive, sim.activeCount);
    maxPending = Math.max(maxPending, sim.pendingSpawns);
    maxJobs = Math.max(maxJobs, r.state.jobs.length);
    if ((i + 1) % perMinute === 0) {
      // Avec `node --expose-gc`, le tas mesuré est le tas retenu (sans déchets en attente).
      (globalThis as { gc?: () => void }).gc?.();
      minute.sort((a, b) => a - b);
      const s = sim.stats;
      console.log(
        `  min ${(i + 1) / perMinute} : actifs=${sim.activeCount} attente=${sim.pendingSpawns} tirs=${s.shotsAccepted} collectées=${s.collected} perdues=${s.lost} anomalies=${s.anomalies} pas p50=${minute[Math.floor(minute.length / 2)]!.toFixed(2)} p95=${minute[Math.floor(minute.length * 0.95)]!.toFixed(2)} ms tas JS=${((process.memoryUsage().heapUsed - heap0) / 1e6).toFixed(1)} Mo`,
      );
      minute = [];
    }
  }
  const nan = [...sim.objects.values()].some((o) => o.body && !Number.isFinite(o.body.translation().y));
  console.log(
    `bilan : ${minutes} min simulées, actifs max ${maxActive}/${config.simulation.maxPhysicalObjects}, créations en attente max ${maxPending}, travaux max ${maxJobs}/${config.simulation.maxPendingRewards}, anomalies ${sim.stats.anomalies}, NaN ${nan ? 'oui' : 'non'}, collectées ${sim.stats.collected}, perdues ${sim.stats.lost}, Fever ${r.state.stats.feverSequences}, roues ${r.state.stats.wheelSpins}`,
  );
  sim.dispose();
}

console.log(`Coin Cascade — banc physique (${scenario}, collider ${shape}, seed ${seed}, Node ${process.version}, Rapier ${RAPIER.version()})${args.set ? ` surcharges ${args.set}` : ''}`);
if (scenario === 'idle') {
  print(run(Number(args.objects ?? config.machine.initialObjects), Number(args.seconds ?? 60), 0));
} else if (scenario === 'long') {
  runLong(Number(args.minutes ?? 15));
} else if (scenario === 'perf') {
  for (const n of [100, 160, 250, 320]) print(run(n, Number(args.seconds ?? 30), Number(args.rate ?? 3)));
} else {
  print(run(Number(args.objects ?? config.machine.initialObjects), Number(args.seconds ?? 180), Number(args.rate ?? 2)));
}
