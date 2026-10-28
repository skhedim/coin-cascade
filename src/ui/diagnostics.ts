import { assetDiagnostics } from '../assets/manifest.ts';

export interface DiagnosticsSource {
  fps(): number;
  quality(): string;
  renderInfo(): { drawCalls: number; triangles: number };
  droppedSeconds(): number;
  sim(): {
    tick: number;
    cycle: number;
    seed: string;
    active: number;
    awake: number;
    pending: number;
    stepP50: number;
    stepP95: number;
    tickMean: number;
    shots: number;
    collected: number;
    lost: number;
    anomalies: number;
    settleDiscarded: number;
    refused: Record<string, number>;
  };
  extra?(): [string, string][];
}

/** Panneau de diagnostic : mesures, compteurs et rechargement d'un scénario par seed. */
export class DiagnosticsPanel {
  readonly element: HTMLElement;
  private readonly list: HTMLElement;
  private readonly seedInput: HTMLInputElement;
  private timer = 0;
  private readonly source: DiagnosticsSource;

  constructor(parent: HTMLElement, source: DiagnosticsSource, onReload: (seed: string) => void) {
    this.source = source;
    this.element = document.createElement('aside');
    this.element.id = 'diag';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Diagnostic');
    this.element.innerHTML = `
      <h2>Diagnostic</h2>
      <dl></dl>
      <h2>Scénario</h2>
      <form>
        <label class="sr-only" for="diag-seed">Seed</label>
        <input id="diag-seed" name="seed" autocomplete="off" spellcheck="false" />
        <button class="btn small" type="submit">Recharger</button>
      </form>
      <form data-random><button class="btn small" type="submit">Nouvelle seed</button></form>`;
    this.list = this.element.querySelector('dl')!;
    this.seedInput = this.element.querySelector('input')!;
    const [reload, random] = this.element.querySelectorAll('form');
    reload!.addEventListener('submit', (e) => {
      e.preventDefault();
      const seed = this.seedInput.value.trim();
      if (seed) onReload(seed);
    });
    random!.addEventListener('submit', (e) => {
      e.preventDefault();
      const seed = `seed-${Date.now().toString(36)}`;
      this.seedInput.value = seed;
      onReload(seed);
    });
    parent.append(this.element);
  }

  get visible(): boolean {
    return !this.element.hidden;
  }

  toggle(force?: boolean): void {
    this.element.hidden = !(force ?? this.element.hidden);
    if (this.visible) {
      this.seedInput.value = this.source.sim().seed;
      this.refresh();
      this.timer = window.setInterval(() => this.refresh(), 250);
    } else {
      clearInterval(this.timer);
    }
  }

  private refresh(): void {
    const s = this.source.sim();
    const r = this.source.renderInfo();
    const refused = Object.entries(s.refused)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
    const rows: [string, string, boolean?][] = [
      ['FPS', this.source.fps().toFixed(0), this.source.fps() < 45],
      ['Qualité', this.source.quality()],
      ['Appels de dessin', `${r.drawCalls}`],
      ['Triangles', r.triangles.toLocaleString('fr-FR')],
      ['Pas physique p50', `${s.stepP50.toFixed(2)} ms`],
      ['Pas physique p95', `${s.stepP95.toFixed(2)} ms`, s.stepP95 > 8],
      ['Tick complet moyen', `${s.tickMean.toFixed(2)} ms`],
      ['Temps abandonné', `${this.source.droppedSeconds().toFixed(2)} s`, this.source.droppedSeconds() > 0.5],
      ['Corps actifs', `${s.active}`],
      ['Corps éveillés', `${s.awake}`],
      ['Créations en attente', `${s.pending}`],
      ['Tick / cycle', `${s.tick} / ${s.cycle}`],
      ['Tirs acceptés', `${s.shots}`],
      ['Collectées', `${s.collected}`],
      ['Perdues (côtés)', `${s.lost}`],
      ['Anomalies', `${s.anomalies}`, s.anomalies > 0],
      ['Écartées à la stabilisation', `${s.settleDiscarded}`],
      ['Tirs refusés', refused || '0'],
      ...(this.source.extra?.() ?? []),
      ...assetDiagnostics.map((line): [string, string, boolean] => ['Asset', line, true]),
    ];
    this.list.innerHTML = rows.map(([k, v, warn]) => `<dt>${k}</dt><dd${warn ? ' class="warn"' : ''}>${v}</dd>`).join('');
  }
}
