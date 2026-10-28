// Contrôle de livraison graphique uniquement. Ne modifie ni le code ni les sauvegardes utilisateur.
// Fige la boucle après chargement pour éviter le coût des captures en rendu logiciel WSL.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const source = fileURLToPath(new URL('./', import.meta.url));
const dist = fileURLToPath(new URL('../../../dist/', import.meta.url));
const qa = resolve(source, 'qa');
await mkdir(qa, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const reports = [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

try {
  for (const prefix of ['/', '/coin-cascade/']) {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith(prefix)) return res.writeHead(404).end();
        const file = resolve(dist, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
        if (!file.startsWith(dist.endsWith(sep) ? dist : dist + sep)) return res.writeHead(403).end();
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(data);
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const device of ['desktop', 'mobile']) {
        const context = await browser.newContext({
          viewport: device === 'desktop' ? { width: 1280, height: 800 } : { width: 390, height: 844 },
          deviceScaleFactor: 1,
          isMobile: device === 'mobile',
          hasTouch: device === 'mobile',
        });
        try {
          const page = await context.newPage();
          const issues = [];
          const assetResponses = [];
          page.on('pageerror', e => issues.push(e.message));
          page.on('console', m => { if (m.type() === 'error' || m.text().startsWith('[assets]')) issues.push(m.text()); });
          page.on('requestfailed', r => issues.push(`failed ${r.url()}`));
          page.on('request', r => { if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url())) issues.push(`external ${r.url()}`); });
          page.on('response', r => {
            if (r.status() >= 400) issues.push(`HTTP ${r.status()} ${r.url()}`);
            if (/classic-face\.png|arcade-(landscape|portrait)\.webp/.test(r.url())) assetResponses.push({ url: new URL(r.url()).pathname, status: r.status() });
          });
          await page.goto(`${origin}${prefix}?quality=low&seed=art001-review`);
          await page.waitForFunction(() => window.coinCascade?.loop, undefined, { timeout: 90000 });
          await page.evaluate(() => window.coinCascade.loop.stop());
          await page.waitForFunction(() => {
            const app = window.coinCascade;
            const first = app?.renderer.objects.group.children.find(o => o.isInstancedMesh);
            return first?.material?.[0]?.map?.image?.naturalWidth === 512 && document.querySelector('#app').style.backgroundImage.includes('arcade-');
          }, undefined, { timeout: 30000 });
          await page.evaluate(() => window.coinCascade.renderer.render(window.coinCascade.sim, 0, 0));
          const label = prefix === '/' ? 'root' : 'subpath';
          const screenshot = `assets-${label}-${device}.png`;
          await page.screenshot({ path: resolve(qa, screenshot), animations: 'disabled', timeout: 30000 });
          if (!assetResponses.some(r => r.url.endsWith('classic-face.png') && r.status === 200)) issues.push('coin PNG not loaded');
          const expected = device === 'desktop' ? 'arcade-landscape.webp' : 'arcade-portrait.webp';
          if (!assetResponses.some(r => r.url.endsWith(expected) && r.status === 200)) issues.push('expected background not loaded');
          const report = { prefix, device, quality: 'low', loopFrozenForCapture: true, assetResponses, screenshot, issues };
          reports.push(report);
          console.log(JSON.stringify(report));
        } finally { await context.close(); }
      }
    } finally { await new Promise(r => server.close(r)); }
  }
} finally {
  await browser.close();
  await writeFile(resolve(qa, 'browser-report.json'), JSON.stringify(reports, null, 2) + '\n');
}
if (reports.length !== 4 || reports.some(r => r.issues.length)) process.exitCode = 1;
