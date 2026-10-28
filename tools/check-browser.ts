// Vérifie le build statique dans Chromium : `npm run build && npm run check:browser -- [options]`
//   --bases=/,/coin-cascade/   préfixes sous lesquels servir dist/ (racine et sous-chemin)
//   --out=dossier              captures d'écran (défaut : test-results/browser)
//   --seconds=N                durée de jeu simulée par tirs maintenus (défaut 6)
//   --quality=low|medium|high  qualité forcée (défaut low : Chromium headless rend sans GPU ici)
//   --devices=desktop,mobile   formats testés
// Contrôles : chargement complet, aucune erreur console, aucune requête en échec ni hors origine.
import { createServer, type Server } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const bases = (args.bases ?? '/,/coin-cascade/').split(',');
const outDir = args.out ?? 'test-results/browser';
const seconds = Number(args.seconds ?? 6);
const quality = args.quality ?? 'low';
const devices = (args.devices ?? 'desktop,mobile').split(',') as ('desktop' | 'mobile')[];
const dist = new URL('../dist/', import.meta.url).pathname;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.md': 'text/markdown',
};

function serve(prefix: string): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404).end('hors préfixe');
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(dist, rel));
    if (!file.startsWith(dist)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('absent');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port })));
}

/**
 * Capture fiable sous rendu logiciel : la boucle est figée, une image est rendue,
 * puis la boucle reprend (méthode des contrôles ART-001 de Codex).
 */
async function capture(page: Page, path: string): Promise<void> {
  type Win = { coinCascade?: { loop: { stop(): void; start(): void }; renderer: { render(sim: unknown, a: number, d: number): void }; sim: unknown } };
  await page.evaluate(() => {
    const app = (window as unknown as Win).coinCascade;
    app?.loop.stop();
    app?.renderer.render(app.sim, 1, 0);
  });
  await page.screenshot({ path, timeout: 120_000 });
  await page.evaluate(() => (window as unknown as Win).coinCascade?.loop.start());
}

async function stats(page: Page) {
  return page.evaluate(() => {
    const app = (window as unknown as { coinCascade?: { sim: { stats: Record<string, unknown>; activeCount: number; tick: number } } }).coinCascade;
    if (!app) return null;
    const s = app.sim.stats as { shotsAccepted: number; collected: number; lost: number; anomalies: number; shotsRefused: unknown };
    return { tick: app.sim.tick, active: app.sim.activeCount, shots: s.shotsAccepted, collected: s.collected, lost: s.lost, anomalies: s.anomalies, refused: s.shotsRefused };
  });
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failures = 0;

for (const prefix of bases) {
  const { server, port } = await serve(prefix);
  const origin = `http://127.0.0.1:${port}`;
  const label = prefix === '/' ? 'racine' : prefix.replaceAll('/', '');
  for (const device of devices) {
    const context = await browser.newContext(
      device === 'desktop'
        ? { viewport: { width: 1280, height: 800 } }
        : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    );
    const page = await context.newPage();
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`échec: ${r.url()} ${r.failure()?.errorText ?? ''}`));
    page.on('response', (r) => {
      if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
    });
    page.on('request', (r) => {
      if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) problems.push(`hors origine: ${r.url()}`);
    });

    const started = Date.now();
    await page.goto(`${origin}${prefix}?quality=${quality}`);
    try {
      await page.waitForSelector('#loading', { state: 'hidden', timeout: 90_000 });
    } catch {
      problems.push('écran de chargement toujours visible après 90 s');
    }
    const fatal = await page.locator('#fatal').isVisible();
    if (fatal) problems.push(`écran d'erreur : ${await page.locator('#fatal').innerText()}`);
    const loadMs = Date.now() - started;
    await page.waitForTimeout(1500);
    const earlyFps = await page.evaluate(() => (window as unknown as { coinCascade?: { loop?: { fps: number } } }).coinCascade?.loop?.fps ?? null);
    console.log(`  (${label}/${device}) chargé en ${loadMs} ms, ${earlyFps?.toFixed(1) ?? '?'} FPS avant capture`);
    await capture(page, `${outDir}/${label}-${device}-depart.png`);

    // Tirs maintenus en balayant la rampe.
    if (device === 'desktop') {
      await page.locator('#scene').focus();
      await page.keyboard.down('Space');
      for (let t = 0; t < seconds; t++) {
        await page.mouse.move(400 + ((t * 170) % 480), 420);
        await page.waitForTimeout(1000);
      }
      await page.keyboard.up('Space');
    } else {
      const fire = page.locator('.fire');
      const box = (await fire.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(seconds * 1000);
      await page.mouse.up();
    }
    await page.waitForTimeout(1500);
    await capture(page, `${outDir}/${label}-${device}-jeu.png`);
    const s = await stats(page);
    const gl = await page.evaluate(() => {
      const c = document.createElement('canvas').getContext('webgl2');
      const ext = c?.getExtension('WEBGL_debug_renderer_info');
      return ext ? String(c!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'inconnu';
    });
    const fps = await page.evaluate(() => (window as unknown as { coinCascade?: { loop?: { fps: number } } }).coinCascade?.loop?.fps ?? null);
    console.log(`[${label} / ${device}] chargement ${loadMs} ms, GL ${gl}, fps ${fps?.toFixed?.(0) ?? '?'}, état ${JSON.stringify(s)}`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    if (problems.length) failures++;
    else console.log('  ✓ aucune erreur, aucune requête en échec ni hors origine');
    await context.close();
  }
  server.close();
}

await browser.close();
console.log(failures ? `${failures} contrôle(s) en échec` : 'Tous les contrôles navigateur sont passés.');
process.exit(failures ? 1 : 0);
