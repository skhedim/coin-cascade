import type { GameConfig, RewardEntry } from '../config/schema.ts';

const JACKPOT_NAMES = { mini: 'Mini', minor: 'Minor', major: 'Major', grand: 'Grand' } as const;

/** Libellé court d'une récompense (secteurs de roue, coffres). */
export function rewardLabel(r: RewardEntry, config: GameConfig): string {
  switch (r.kind) {
    case 'reserve':
      return `+${r.amount} pièces`;
    case 'coinRain':
      return `Pluie de ${config.bonus.coinRain.count}`;
    case 'barriers':
      return 'Barrières';
    case 'superPush':
      return 'Super poussée';
    case 'shockwave':
      return r.amount > 1 ? `${r.amount} ondes de choc` : 'Onde de choc';
    case 'freeShots':
      return `${config.bonus.freeShots.count} tirs gratuits`;
    case 'goldenShots':
      return `${config.bonus.goldenShots.count} tirs dorés`;
    case 'jackpot':
      return `Jackpot ${JACKPOT_NAMES[r.tier]}`;
  }
}

/** Libellé de secteur, assez court pour tenir dans la roue. */
function sectorLabel(r: RewardEntry): string {
  switch (r.kind) {
    case 'reserve':
      return `+${r.amount}`;
    case 'coinRain':
      return 'Pluie';
    case 'barriers':
      return 'Barrières';
    case 'superPush':
      return 'Poussée';
    case 'shockwave':
      return 'Onde';
    case 'freeShots':
      return 'Gratuits';
    case 'goldenShots':
      return 'Dorés';
    case 'jackpot':
      return JACKPOT_NAMES[r.tier];
  }
}

const SECTOR_COLORS = ['#1f6f8b', '#c98d1d', '#1c3551', '#a12a78', '#13284a', '#2a7f62', '#7a3d1f', '#3d2a7a'];

/**
 * Présente un tirage de roue déjà décidé : la décélération vise le secteur engagé,
 * elle ne décide jamais du gain. Le bouton « Passer » abrège l'animation.
 */
export class WheelPresenter {
  private readonly overlay: HTMLElement;
  private readonly disc: SVGGElement;
  private readonly result: HTMLElement;
  private readonly skip: HTMLButtonElement;
  private readonly close: HTMLButtonElement;
  private readonly rewards: readonly RewardEntry[];
  private raf = 0;
  private finish: (() => void) | null = null;
  active = false;
  onTick?: () => void;

  constructor(root: HTMLElement, config: GameConfig) {
    this.rewards = config.wheel.rewards;
    const n = this.rewards.length;
    const sectors = this.rewards
      .map((r, i) => {
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
        const a1 = a0 + (Math.PI * 2) / n;
        const p = (a: number, rad: number) => `${(Math.cos(a) * rad).toFixed(2)} ${(Math.sin(a) * rad).toFixed(2)}`;
        const mid = (a0 + a1) / 2;
        const deg = (mid * 180) / Math.PI;
        const jackpot = r.kind === 'jackpot';
        return `<path d="M0 0 L${p(a0, 100)} A100 100 0 0 1 ${p(a1, 100)} Z" fill="${jackpot ? '#f2b640' : SECTOR_COLORS[i % SECTOR_COLORS.length]}" stroke="#f6bd54" stroke-width="1.2"/>
          <text transform="rotate(${deg.toFixed(1)}) translate(58 0)" text-anchor="middle" dominant-baseline="middle" class="${jackpot ? 'jp' : ''}">${sectorLabel(r)}</text>`;
      })
      .join('');
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay wheel-overlay';
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <div class="card wheel-card" role="dialog" aria-modal="true" aria-labelledby="wheel-title">
        <h2 id="wheel-title">Roue Cascade</h2>
        <div class="wheel-wrap">
          <svg viewBox="-110 -110 220 220" class="wheel-svg" aria-hidden="true">
            <g class="wheel-disc">${sectors}</g>
            <circle r="16" fill="#0f1d33" stroke="#f6bd54" stroke-width="3"/>
            <path d="M0 -112 L-9 -96 L9 -96 Z" fill="#54e5ec" stroke="#eef5ff" stroke-width="1.5"/>
          </svg>
        </div>
        <p class="wheel-result" aria-live="assertive"></p>
        <div class="row">
          <button type="button" class="btn" data-action="skip">Passer</button>
          <button type="button" class="btn primary" data-action="close" hidden>Continuer</button>
        </div>
      </div>`;
    root.append(this.overlay);
    this.disc = this.overlay.querySelector('.wheel-disc')!;
    this.result = this.overlay.querySelector('.wheel-result')!;
    this.skip = this.overlay.querySelector('[data-action="skip"]')!;
    this.close = this.overlay.querySelector('[data-action="close"]')!;
    this.skip.addEventListener('click', () => this.finish?.());
    this.close.addEventListener('click', () => this.done?.());
  }

  private done: (() => void) | null = null;

  /** Anime la roue jusqu'au secteur `index`, affiche `label`, puis appelle `onClosed` à la fermeture. */
  present(index: number, label: string, short: boolean, onClosed: () => void): void {
    const n = this.rewards.length;
    this.active = true;
    this.overlay.hidden = false;
    this.result.textContent = '';
    this.close.hidden = true;
    this.skip.hidden = false;
    this.skip.focus();
    const turns = short ? 1 : 4;
    const target = 360 * turns + (360 - (index * 360) / n);
    const duration = short ? 900 : 3600;
    const start = performance.now();
    let lastSector = -1;
    const ease = (t: number) => 1 - (1 - t) ** 4;
    const end = () => {
      cancelAnimationFrame(this.raf);
      this.disc.setAttribute('transform', `rotate(${target % 360})`);
      this.finish = null;
      this.result.textContent = label;
      this.skip.hidden = true;
      this.close.hidden = false;
      this.close.focus();
    };
    this.finish = end;
    this.done = () => {
      this.overlay.hidden = true;
      this.active = false;
      this.done = null;
      onClosed();
    };
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const angle = target * ease(t);
      this.disc.setAttribute('transform', `rotate(${angle % 360})`);
      const sector = Math.floor((angle + 180 / n) / (360 / n));
      if (sector !== lastSector) {
        lastSector = sector;
        this.onTick?.();
      }
      if (t < 1) this.raf = requestAnimationFrame(frame);
      else end();
    };
    this.raf = requestAnimationFrame(frame);
  }
}
