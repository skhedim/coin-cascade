import type { GameConfig, PowerType } from '../config/schema.ts';
import type { RulesState } from '../engine/rules.ts';
import { GEM_COLORS } from '../render/objects.ts';
import { ICONS } from './icons.ts';

const fmt = (n: number) => n.toLocaleString('fr-FR');

/** Compteurs, jauges et commandes de pouvoir. Lit l'état des règles, ne décide de rien. */
export class Hud {
  readonly element: HTMLElement;
  readonly status: HTMLElement;
  readonly powers: HTMLElement;
  private readonly values = new Map<string, HTMLElement>();
  private readonly cache = new Map<string, string>();
  private readonly toasts: HTMLElement;
  private readonly floats: HTMLElement;
  private readonly config: GameConfig;

  constructor(root: HTMLElement, config: GameConfig, actions: { menu(): void; diag(): void; refill(): void; power(p: PowerType): void }) {
    this.config = config;
    this.element = document.createElement('header');
    this.element.id = 'hud';
    this.element.innerHTML = `
      <div class="counters" role="group" aria-label="Compteurs">
        <div class="counter reserve"><span class="label">Réserve</span><span class="value" data-v="reserve">0</span></div>
        <div class="counter score"><span class="label">Score</span><span class="value" data-v="score">0</span></div>
        <div class="counter combo" data-v-box="combo" hidden><span class="label">Combo</span><span class="value" data-v="combo">×1</span><span class="combo-bar"><span data-v="comboBar"></span></span></div>
      </div>
      <div class="hud-side">
        <button type="button" class="btn small refill" data-action="refill" hidden title="Recharge gratuite du mode libre">+${config.economy.freeManualRefill}</button>
        <button type="button" class="icon-btn" data-action="diag" aria-label="Diagnostic" aria-pressed="false" title="Diagnostic (D)">${ICONS.diag}</button>
        <button type="button" class="icon-btn" data-action="menu" aria-label="Menu et pause" title="Menu (Échap)">${ICONS.menu}</button>
      </div>`;

    this.status = document.createElement('div');
    this.status.id = 'status';
    this.status.setAttribute('role', 'group');
    this.status.setAttribute('aria-label', 'Bonus en cours');
    this.status.innerHTML = `
      <div class="chip fever" title="Fever : ${config.bonus.fever.starsRequired} étoiles collectées → points ×${config.bonus.fever.pointMultiplier}">
        ${ICONS.star}<span class="gauge"><span data-v="feverBar"></span></span><span data-v="fever">0/${config.bonus.fever.starsRequired}</span>
      </div>
      <div class="chip wheel" title="Roue : ${config.wheel.tokensRequired} jetons roue → un tirage">${ICONS.wheel}<span data-v="wheel">0/${config.wheel.tokensRequired}</span></div>
      <div class="chip gems" title="Collection : les ${config.collection.gemIds.length} gemmes → jackpot ${config.collection.completedSetJackpot}">
        ${config.collection.gemIds.map((g) => `<span class="gem" data-gem="${g}" style="--gem:${GEM_COLORS[g] ?? '#fff'}" title="${g}"></span>`).join('')}
      </div>
      <div class="chip free" data-v-box="free" hidden title="Tirs gratuits">${ICONS.free}<span data-v="free">0</span></div>
      <div class="chip golden" data-v-box="golden" hidden title="Tirs dorés">${ICONS.golden}<span data-v="golden">0</span></div>
      <div class="chip barrier" data-v-box="barrierCycles" hidden title="Barrières actives (cycles)">${ICONS.barriers}<span data-v="barrierCycles">0</span></div>
      <div class="chip push" data-v-box="pushCycles" hidden title="Super poussée (cycles)">${ICONS.superPush}<span data-v="pushCycles">0</span></div>`;

    this.powers = document.createElement('div');
    this.powers.className = 'powers';
    this.powers.setAttribute('role', 'group');
    this.powers.setAttribute('aria-label', 'Pouvoirs');
    const powerLabels: Record<PowerType, string> = { barriers: 'Barrières', superPush: 'Super poussée', shockwave: 'Onde de choc' };
    this.powers.innerHTML = (['barriers', 'superPush', 'shockwave'] as const)
      .map((p) => `<button type="button" class="power ${p}" data-power="${p}" hidden aria-label="${powerLabels[p]}" title="${powerLabels[p]}">${ICONS[p]}<span class="n" data-v="power-${p}">0</span></button>`)
      .join('');

    this.toasts = document.createElement('div');
    this.toasts.className = 'toasts';
    this.toasts.setAttribute('aria-live', 'polite');
    this.floats = document.createElement('div');
    this.floats.className = 'floats';
    this.floats.setAttribute('aria-hidden', 'true');

    root.append(this.element, this.status, this.toasts, this.floats);
    for (const el of root.querySelectorAll<HTMLElement>('[data-v]')) this.values.set(el.dataset.v!, el);
    for (const el of this.powers.querySelectorAll<HTMLElement>('[data-v]')) this.values.set(el.dataset.v!, el);

    this.element.querySelector('[data-action="menu"]')!.addEventListener('click', () => actions.menu());
    this.element.querySelector('[data-action="diag"]')!.addEventListener('click', () => actions.diag());
    this.element.querySelector('[data-action="refill"]')!.addEventListener('click', () => actions.refill());
    for (const b of this.powers.querySelectorAll<HTMLButtonElement>('[data-power]')) b.addEventListener('click', () => actions.power(b.dataset.power as PowerType));
  }

  setDiagPressed(on: boolean): void {
    this.element.querySelector('[data-action="diag"]')!.setAttribute('aria-pressed', String(on));
  }

  private set(key: string, text: string): void {
    if (this.cache.get(key) === text) return;
    this.cache.set(key, text);
    const el = this.values.get(key);
    if (el) el.textContent = text;
  }

  private show(box: string, visible: boolean): void {
    const el = this.element.querySelector<HTMLElement>(`[data-v-box="${box}"]`) ?? this.status.querySelector<HTMLElement>(`[data-v-box="${box}"]`);
    if (el && el.hidden === visible) el.hidden = !visible;
  }

  update(s: RulesState, unlimited: boolean): void {
    const cfg = this.config;
    this.set('reserve', unlimited ? '∞' : fmt(s.reserve));
    this.set('score', fmt(s.score));
    this.show('combo', s.combo.count > 0);
    this.set('combo', `×${s.combo.multiplier} · ${s.combo.count}`);
    const bar = this.values.get('comboBar');
    if (bar) bar.style.transform = `scaleX(${Math.max(0, s.combo.timer / cfg.combo.windowSeconds).toFixed(3)})`;

    const fever = this.status.querySelector<HTMLElement>('.fever')!;
    const req = cfg.bonus.fever.starsRequired;
    fever.classList.toggle('active', s.fever.active);
    this.set('fever', s.fever.active ? `${Math.ceil(s.fever.remaining)} s` : `${Math.min(s.fever.stars, req)}/${req}`);
    const fb = this.values.get('feverBar');
    if (fb) fb.style.transform = `scaleX(${(s.fever.active ? s.fever.remaining / cfg.bonus.fever.durationSeconds : Math.min(1, s.fever.stars / req)).toFixed(3)})`;
    this.set('wheel', `${s.wheel.tokens}/${cfg.wheel.tokensRequired}`);
    for (const el of this.status.querySelectorAll<HTMLElement>('[data-gem]')) el.classList.toggle('owned', s.gems.session.includes(el.dataset.gem!));

    this.show('free', s.charges.freeShots > 0);
    this.set('free', fmt(s.charges.freeShots + s.overflow.freeShots));
    this.show('golden', s.charges.goldenShots > 0);
    this.set('golden', fmt(s.charges.goldenShots + s.overflow.goldenShots));
    this.show('barrierCycles', s.barrierCycles > 0);
    this.set('barrierCycles', `${s.barrierCycles}`);
    this.show('pushCycles', s.superPushCycles > 0);
    this.set('pushCycles', `${s.superPushCycles}`);
    for (const p of ['barriers', 'superPush', 'shockwave'] as const) {
      const n = s.charges[p];
      this.set(`power-${p}`, `${n}`);
      const b = this.powers.querySelector<HTMLButtonElement>(`[data-power="${p}"]`)!;
      if (b.hidden === n > 0) b.hidden = n <= 0;
    }
    const refill = this.element.querySelector<HTMLButtonElement>('[data-action="refill"]')!;
    const showRefill = s.mode === 'free' && s.reserve < cfg.economy.freeManualRefill;
    if (refill.hidden === showRefill) refill.hidden = !showRefill;
  }

  bump(key: 'reserve' | 'score'): void {
    const el = this.values.get(key)?.parentElement;
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /** Message bref, au-dessus de la scène sans couvrir durablement le bord du plateau. */
  toast(text: string, tone: 'info' | 'good' | 'big' | 'warn' = 'info', ms = 2200): void {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.textContent = text;
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild!.remove();
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 400);
  }

  /** Gain flottant près du point de sortie (coordonnées écran). */
  float(x: number, y: number, text: string, tone: 'normal' | 'gold' | 'special' | 'lost'): void {
    if (this.floats.childElementCount > 40) return;
    const el = document.createElement('div');
    el.className = `float ${tone}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.floats.append(el);
    setTimeout(() => el.remove(), 900);
  }
}
