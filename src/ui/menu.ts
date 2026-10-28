import { OPERATOR_PARAMS, PRESETS, type Overrides } from '../config/overrides.ts';
import type { GameMode, QualityLevel } from '../config/schema.ts';
import { TROPHIES, type Profile, type Settings } from '../persistence/profile.ts';
import { GEM_COLORS } from '../render/objects.ts';
import { THEMES, themeUnlocked } from '../render/themes.ts';

export type SandboxAction =
  | 'rain'
  | 'barriers'
  | 'superPush'
  | 'shockwave'
  | 'freeShots'
  | 'goldenShots'
  | 'fever'
  | 'wheel'
  | 'chest'
  | 'mini'
  | 'minor'
  | 'major'
  | 'grand'
  | 'drop-gold'
  | 'drop-star'
  | 'drop-wheel'
  | 'drop-gem'
  | 'drop-chest'
  | 'drop-power';

export interface MenuActions {
  resume(): void;
  newGame(mode: GameMode): void;
  settings(s: Partial<Settings>): void;
  exportSave(): void;
  importSave(file: File): void;
  resetMachine(): void;
  sandbox(action: SandboxAction): void;
  operatorApply(o: Overrides | null): void;
  operatorExport(): void;
  operatorImport(file: File): void;
}

export interface MenuContext {
  mode: GameMode;
  seed: string;
  rulesId: string;
  custom: boolean;
  persistent: boolean;
  readOnly: boolean;
  settings: Settings;
  profile: Profile;
  gemIds: readonly string[];
  operator: { overrides: Overrides | null; defaults: Record<string, number> };
}

const MODE_LABEL: Record<GameMode, string> = { free: 'Libre', challenge: 'Défi', sandbox: 'Bac à sable' };

/** Menu de pause en onglets. La simulation est arrêtée tant qu'il est ouvert. */
export class Menu {
  readonly element: HTMLElement;
  private readonly body: HTMLElement;
  private tab = 'game';
  private ctx!: MenuContext;
  private draft: Overrides = { version: 1, preset: 'classic', values: {} };
  private readonly actions: MenuActions;

  constructor(root: HTMLElement, actions: MenuActions) {
    this.actions = actions;
    this.element = document.createElement('div');
    this.element.className = 'overlay menu-overlay';
    this.element.hidden = true;
    this.element.innerHTML = `
      <div class="card menu-card" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <div class="menu-head">
          <h2 id="menu-title">Pause</h2>
          <button type="button" class="btn primary" data-action="resume">Reprendre</button>
        </div>
        <nav class="tabs" role="tablist">
          ${[
            ['game', 'Partie'],
            ['settings', 'Réglages'],
            ['save', 'Sauvegarde'],
            ['sandbox', 'Bac à sable'],
            ['progress', 'Progression'],
            ['operator', 'Opérateur'],
          ]
            .map(([id, label]) => `<button type="button" role="tab" data-tab="${id}">${label}</button>`)
            .join('')}
        </nav>
        <div class="menu-body"></div>
      </div>`;
    root.append(this.element);
    this.body = this.element.querySelector('.menu-body')!;
    this.element.querySelector('[data-action="resume"]')!.addEventListener('click', () => actions.resume());
    for (const b of this.element.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab!;
        this.render();
      });
    }
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.body.addEventListener('input', (e) => this.onInput(e));
    this.body.addEventListener('change', (e) => this.onChange(e));
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  show(ctx: MenuContext): void {
    this.ctx = ctx;
    this.draft = structuredClone(ctx.operator.overrides ?? { version: 1, preset: 'classic', values: {} });
    this.element.hidden = false;
    this.render();
    this.element.querySelector<HTMLButtonElement>('[data-action="resume"]')!.focus();
  }

  hide(): void {
    this.element.hidden = true;
  }

  private render(): void {
    const c = this.ctx;
    for (const b of this.element.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      b.setAttribute('aria-selected', String(b.dataset.tab === this.tab));
      if (b.dataset.tab === 'sandbox') b.hidden = c.mode !== 'sandbox';
    }
    if (this.tab === 'sandbox' && c.mode !== 'sandbox') this.tab = 'game';
    const s = c.settings;
    switch (this.tab) {
      case 'game':
        this.body.innerHTML = `
          <p class="meta">Mode <strong>${MODE_LABEL[c.mode]}</strong>${c.custom ? ' · <span class="tag">personnalisé</span>' : ''} · seed <code>${escapeHtml(c.seed)}</code></p>
          ${c.readOnly ? '<p class="warn">Cette fenêtre est en lecture seule : une autre fenêtre détient la partie.</p>' : ''}
          <h3>Nouvelle partie</h3>
          <div class="mode-grid">
            <button type="button" class="mode" data-new="free"><strong>Libre</strong><span>Réserve persistante, recharge gratuite.</span></button>
            <button type="button" class="mode" data-new="challenge"><strong>Défi</strong><span>Réserve initiale de 100, pas de recharge. Score enregistré.</span></button>
            <button type="button" class="mode" data-new="sandbox"><strong>Bac à sable</strong><span>Réserve illimitée, bonus à la demande. Hors records.</span></button>
          </div>
          <p class="hint-text">Une nouvelle partie remplace la machine en cours. Exportez-la d'abord si besoin.</p>`;
        break;
      case 'settings':
        this.body.innerHTML = `
          <label class="field">Volume général <input type="range" min="0" max="1" step="0.05" data-set="master" value="${s.master}"></label>
          <label class="field">Effets sonores <input type="range" min="0" max="1" step="0.05" data-set="effects" value="${s.effects}"></label>
          <label class="field">Musique (Fever) <input type="range" min="0" max="1" step="0.05" data-set="music" value="${s.music}"></label>
          <label class="field">Qualité visuelle
            <select data-set="quality">${(['auto', 'low', 'medium', 'high'] as QualityLevel[])
              .map((q) => `<option value="${q}" ${q === s.quality ? 'selected' : ''}>${{ auto: 'Automatique', low: 'Basse', medium: 'Moyenne', high: 'Haute' }[q]}</option>`)
              .join('')}</select>
          </label>
          <label class="field check"><input type="checkbox" data-set="reducedEffects" ${s.reducedEffects ? 'checked' : ''}> Effets réduits (moins de particules et de flashs)</label>
          <label class="field check"><input type="checkbox" data-set="tips" ${s.tips ? 'checked' : ''}> Conseils contextuels (cocher à nouveau pour les revoir)</label>
          <label class="field">Thème de la borne
            <select data-set="theme">${THEMES.map((t) => {
              const open = themeUnlocked(t, c.profile.trophies);
              const trophy = TROPHIES.find((x) => x.id === t.unlock);
              return `<option value="${t.id}" ${t.id === s.theme ? 'selected' : ''} ${open ? '' : 'disabled'}>${t.label}${open ? '' : ` — trophée « ${trophy?.label ?? ''} »`}</option>`;
            }).join('')}</select>
          </label>
          <p class="hint-text">La qualité visuelle ne modifie jamais la physique ni les règles.</p>`;
        break;
      case 'save':
        this.body.innerHTML = `
          <p class="meta">${c.persistent ? 'Sauvegarde automatique locale (IndexedDB) toutes les quelques secondes et à la mise en arrière-plan. Une fermeture brutale peut perdre les dernières secondes.' : '<span class="warn">Stockage local indisponible : la partie n’est conservée qu’en mémoire.</span>'}</p>
          <div class="row">
            <button type="button" class="btn" data-do="export">Exporter la partie (JSON)</button>
            <label class="btn file">Importer…<input type="file" accept="application/json,.json" data-do="import" hidden></label>
          </div>
          <p class="hint-text">L’import affiche un récapitulatif avant de remplacer la partie ; une copie de secours de la partie actuelle est conservée. Chaque site (Render, GitHub Pages…) a son propre stockage : utilisez l’export pour changer d’adresse.</p>
          <h3>Machine</h3>
          <button type="button" class="btn danger" data-do="reset">Réinitialiser la machine…</button>`;
        break;
      case 'sandbox':
        this.body.innerHTML = `
          <h3>Déclencher</h3>
          <div class="grid">${(
            [
              ['rain', 'Pluie'],
              ['barriers', 'Barrières'],
              ['superPush', 'Super poussée'],
              ['shockwave', '+1 onde'],
              ['freeShots', 'Tirs gratuits'],
              ['goldenShots', 'Tirs dorés'],
              ['fever', 'Fever'],
              ['wheel', 'Roue'],
              ['chest', 'Coffre'],
              ['mini', 'Mini'],
              ['minor', 'Minor'],
              ['major', 'Major'],
              ['grand', 'Grand'],
            ] as const
          )
            .map(([a, l]) => `<button type="button" class="btn small" data-sandbox="${a}">${l}</button>`)
            .join('')}</div>
          <h3>Lâcher un objet au fond du plateau</h3>
          <div class="grid">${(
            [
              ['drop-gold', 'Pièce dorée'],
              ['drop-star', 'Étoile'],
              ['drop-wheel', 'Jeton roue'],
              ['drop-gem', 'Gemme'],
              ['drop-chest', 'Coffre'],
              ['drop-power', 'Pouvoir'],
            ] as const
          )
            .map(([a, l]) => `<button type="button" class="btn small" data-sandbox="${a}">${l}</button>`)
            .join('')}</div>`;
        break;
      case 'operator': {
        const d = this.draft;
        const preset = PRESETS[d.preset] ?? PRESETS.classic!;
        const value = (path: string) => d.values[path] ?? preset.values[path] ?? c.operator.defaults[path]!;
        const groups = [...new Set(OPERATOR_PARAMS.map((p) => p.group))];
        this.body.innerHTML = `
          <p class="meta">Réglages locaux, validés par le schéma de <code>config/game.yaml</code>. Appliquer reconstruit la machine ; chaque profil a ses propres records. Un ajustement manuel rend les nouvelles parties personnalisées (hors records standard).</p>
          <div class="mode-grid">${Object.entries(PRESETS)
            .map(([id, p]) => `<button type="button" class="mode ${id === d.preset ? 'selected' : ''}" data-preset="${id}"><strong>${p.label}</strong><span>${p.description}</span></button>`)
            .join('')}</div>
          ${groups
            .map(
              (g) => `<h3>${g}</h3>${OPERATOR_PARAMS.filter((p) => p.group === g)
                .map(
                  (p) => `<label class="field op">${p.label} <output>${value(p.path)}</output>
                  <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${value(p.path)}" data-op="${p.path}">
                  <small>${p.help}${d.values[p.path] !== undefined ? ' · <span class="tag">ajusté</span>' : ''}</small></label>`,
                )
                .join('')}`,
            )
            .join('')}
          <div class="row">
            <button type="button" class="btn primary" data-do="op-apply">Appliquer et reconstruire</button>
            <button type="button" class="btn" data-do="op-reset">Profil publié</button>
            <button type="button" class="btn" data-do="op-export">Exporter</button>
            <label class="btn file">Importer…<input type="file" accept="application/json,.json" data-do="op-import" hidden></label>
          </div>`;
        break;
      }
      case 'progress': {
        const p = c.profile;
        const records = Object.entries(p.records).sort((a, b) => b[1].score - a[1].score).slice(0, 8);
        this.body.innerHTML = `
          <h3>Album des gemmes</h3>
          <div class="album">${c.gemIds
            .map((g) => `<span class="gem ${p.album.includes(g) ? 'owned' : ''}" style="--gem:${GEM_COLORS[g] ?? '#fff'}" title="${g}"></span><span class="gem-name">${p.album.includes(g) ? g : '?'}</span>`)
            .join('')}</div>
          <h3>Trophées</h3>
          <ul class="trophies">${TROPHIES.map((t) => `<li class="${p.trophies[t.id] ? 'owned' : ''}"><strong>${t.label}</strong> — ${t.description}</li>`).join('')}</ul>
          <h3>Records de défi</h3>
          ${records.length ? `<ol class="records">${records.map(([k, r]) => `<li>${r.score.toLocaleString('fr-FR')} pts · ${r.shots} tirs · <code>${escapeHtml(k.split('|')[1] ?? '')}</code>${r.timedOut ? ' (limite)' : ''}</li>`).join('')}</ol>` : '<p class="hint-text">Aucun défi standard terminé.</p>'}
          <p class="hint-text">Records locaux par version de règles et seed ; règles <code>${escapeHtml(c.rulesId)}</code>.</p>`;
        break;
      }
    }
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-new],[data-do],[data-sandbox],[data-preset]');
    if (!t) return;
    if (t.dataset.preset) {
      this.draft = { version: 1, preset: t.dataset.preset, values: {} };
      this.render();
    } else if (t.dataset.do === 'op-apply') {
      if (confirm('Appliquer ces réglages ? La page se recharge avec une machine reconstruite.')) this.actions.operatorApply(this.draft.preset === 'classic' && !Object.keys(this.draft.values).length ? null : this.draft);
    } else if (t.dataset.do === 'op-reset') {
      if (confirm('Revenir à la configuration publiée ? La machine sera reconstruite.')) this.actions.operatorApply(null);
    } else if (t.dataset.do === 'op-export') this.actions.operatorExport();
    else if (t.dataset.new) {
      const mode = t.dataset.new as GameMode;
      if (confirm(`Commencer une nouvelle partie en mode ${MODE_LABEL[mode]} ? La machine actuelle sera remplacée.`)) this.actions.newGame(mode);
    } else if (t.dataset.do === 'export') this.actions.exportSave();
    else if (t.dataset.do === 'reset') {
      if (confirm('Réinitialiser la machine ? La partie en cours sera remplacée par une machine neuve (la progression est conservée).')) this.actions.resetMachine();
    } else if (t.dataset.sandbox) this.actions.sandbox(t.dataset.sandbox as SandboxAction);
  }

  private onInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    if (el.dataset.op) {
      this.draft.values[el.dataset.op] = Number(el.value);
      const out = el.parentElement?.querySelector('output');
      if (out) out.textContent = el.value;
      return;
    }
    const key = el.dataset.set as keyof Settings | undefined;
    if (key && el.type === 'range') this.actions.settings({ [key]: Number(el.value) });
  }

  private onChange(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (el instanceof HTMLInputElement && el.dataset.do === 'op-import' && el.files?.[0]) {
      this.actions.operatorImport(el.files[0]);
      el.value = '';
      return;
    }
    if (el instanceof HTMLInputElement && el.dataset.do === 'import' && el.files?.[0]) {
      this.actions.importSave(el.files[0]);
      el.value = '';
      return;
    }
    const key = el.dataset.set as keyof Settings | undefined;
    if (!key) return;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') this.actions.settings({ [key]: el.checked });
    else if (el instanceof HTMLSelectElement) this.actions.settings({ [key]: el.value } as Partial<Settings>);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
