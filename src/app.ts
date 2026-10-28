import { reportAssetFailure, resolveAsset } from './assets/manifest.ts';
import { SoundEngine } from './audio/sound.ts';
import { OPERATOR_PARAMS, readPath, saveOverrides, buildConfig, type Overrides } from './config/overrides.ts';
import { computeRulesId } from './config/parse.ts';
import type { GameConfig, GameMode, PowerType } from './config/schema.ts';
import type { RulesEvent } from './engine/rules.ts';
import { FixedLoop } from './game/loop.ts';
import { Simulation, type ExitRecord } from './game/simulation.ts';
import { applyProgress, defaultSettings, emptyProfile, TROPHIES, type Profile, type Settings } from './persistence/profile.ts';
import { checkSave, downloadJson, LocalStore, readJsonFile, SAVE_FORMAT, SAVE_FORMAT_VERSION, SessionLock, type SaveEnvelope } from './persistence/store.ts';
import type { Rapier } from './physics/machine.ts';
import { GameRenderer, resolveQuality } from './render/renderer.ts';
import { themeById, themeUnlocked, THEMES } from './render/themes.ts';
import { Coach } from './ui/coach.ts';
import { DiagnosticsPanel } from './ui/diagnostics.ts';
import { Hud } from './ui/hud.ts';
import { bindInput } from './ui/input.ts';
import { escapeHtml, Menu, type SandboxAction } from './ui/menu.ts';
import { rewardLabel, WheelPresenter } from './ui/wheel.ts';

const MODE_LABEL: Record<GameMode, string> = { free: 'Libre', challenge: 'Défi', sandbox: 'Bac à sable' };
const JACKPOT_LABEL = { mini: 'Mini', minor: 'Minor', major: 'Major', grand: 'Grand' } as const;
const TYPE_LABEL: Record<string, string> = { gold: 'pièce dorée', star: 'étoile', wheel: 'jeton roue', gem: 'gemme', chest: 'coffre', power: 'jeton pouvoir', normal: 'pièce' };
const POWER_LABEL: Record<PowerType, string> = { barriers: 'Barrières', superPush: 'Super poussée', shockwave: 'Onde de choc' };
/** Tirs maximum par activation du tir automatique. */
const AUTO_LIMIT = 50;

/** Orchestration navigateur : session, rendu, boucle, entrées, interface, son et sauvegarde. */
export class App {
  private readonly R: Rapier;
  private readonly config: GameConfig;
  readonly rulesId: string;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  sim!: Simulation;
  renderer!: GameRenderer;
  private loop!: FixedLoop;
  private hud!: Hud;
  private menu!: Menu;
  private wheel!: WheelPresenter;
  private diag!: DiagnosticsPanel;
  private summary!: HTMLElement;
  private readonly sound: SoundEngine;
  private readonly store = new LocalStore();
  private readonly lock = new SessionLock();
  private profile: Profile = emptyProfile();
  private settings: Settings;
  private readOnly = false;
  private hiddenPause = false;
  private aimDirection = 0;
  private awakeCache = 0;
  private lastSaveTick = 0;
  private saving = false;
  private recordSaved = false;
  private coach!: Coach;
  private manualFire = false;
  /** Tirs automatiques restants (0 = arrêté). */
  private autoShots = 0;
  private autoButton!: HTMLButtonElement;
  private lastBusy = 0;
  private readonly operator: { overrides: Overrides | null; error: string | null; published: GameConfig };

  constructor(R: Rapier, config: GameConfig, root: HTMLElement, operator: { overrides: Overrides | null; error: string | null; published: GameConfig }) {
    this.R = R;
    this.config = config;
    this.operator = operator;
    this.rulesId = computeRulesId(config);
    this.root = root;
    this.canvas = root.querySelector<HTMLCanvasElement>('#scene')!;
    this.canvas.tabIndex = 0;
    const p = config.presentation;
    this.settings = defaultSettings(p.audio, p.quality, p.reducedEffects, p.theme);
    this.sound = new SoundEngine(this.settings);
  }

  /** Ouvre le stockage, reprend la session compatible ou crée une machine neuve. */
  async init(): Promise<void> {
    await this.store.open();
    this.settings = { ...this.settings, ...((await this.store.get<Settings>('settings').catch(() => undefined)) ?? {}) };
    this.sound.setVolumes(this.settings);
    this.profile = (await this.store.get<Profile>('profile').catch(() => undefined)) ?? emptyProfile();

    const params = new URLSearchParams(location.search);
    const lockOk = await this.lock.acquire();
    this.lock.onLost = () => this.becomeReadOnly();
    const saved = await this.store.get<unknown>('session').catch(() => undefined);
    let notice: string | null = null;
    let sim: Simulation | null = null;
    if (saved && !params.has('seed')) {
      const check = checkSave(saved);
      if (!check.ok) notice = 'Sauvegarde illisible : nouvelle machine (progression conservée).';
      else if (check.save.rulesId !== this.rulesId) notice = 'Règles ou physique modifiées depuis la sauvegarde : nouvelle machine, progression conservée.';
      else sim = this.createSimulation(check.save.sim.seed, check.save.sim.rules.mode as GameMode, check.save);
    }
    this.sim = sim ?? this.createSimulation(params.get('seed') || this.config.seed, this.config.defaultMode);

    const forced = params.get('quality');
    const quality = forced === 'low' || forced === 'medium' || forced === 'high' ? forced : this.settings.quality;
    this.renderer = new GameRenderer(this.canvas, this.config, this.sim.geometry, resolveQuality(quality));
    this.renderer.objects.reducedEffects = this.settings.reducedEffects;
    // Un thème dont le trophée n'est plus présent (profil importé, réinitialisé) revient au thème de base.
    const theme = themeById(this.settings.theme);
    this.renderer.applyTheme(themeUnlocked(theme, this.profile.trophies) ? theme : THEMES[0]!);
    this.buildUi();
    this.loop = new FixedLoop(
      {
        canStep: () => this.canStep(),
        step: () => this.step(),
        render: (alpha, frameDt) => this.render(alpha, frameDt),
      },
      this.sim.dt,
      this.config.simulation.maxCatchUpSteps,
    );
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => void this.save());
    this.resize();
    if (params.get('diag') === '1') this.toggleDiag(true);

    if (this.operator.error) this.hud.toast(`Réglages opérateur écartés (${this.operator.error}) : configuration publiée active.`, 'warn', 6000);
    if (!this.store.persistent) this.hud.toast('Stockage local indisponible : partie conservée en mémoire seulement.', 'warn', 5000);
    if (notice) this.hud.toast(notice, 'warn', 5000);
    else if (sim) this.hud.toast(`Partie reprise (${MODE_LABEL[this.sim.rules.state.mode]}).`, 'info');
    if (!lockOk) this.askSecondWindow();
    this.coach.tip('intro');
    this.lastSaveTick = this.sim.tick;
  }

  start(): void {
    this.loop.start();
  }

  private createSimulation(seed: string, mode: GameMode, save?: SaveEnvelope): Simulation {
    this.recordSaved = false;
    const sim = new Simulation(this.R, this.config, save ? { seed, restore: save.sim } : { seed, mode });
    // Ajustements manuels de l'opérateur : session personnalisée, hors records standard.
    if (!save && Object.keys(this.operator.overrides?.values ?? {}).length > 0) sim.rules.markCustom();
    return sim;
  }

  // --- Boucle -------------------------------------------------------------------------------

  private canStep(): boolean {
    return !this.menu.open && !this.hiddenPause && !this.wheel.active && !this.sim.rules.hasUnpaidSpin() && this.summary.hidden === true;
  }

  private step(): void {
    if (this.aimDirection !== 0) {
      const c = this.sim.geometry.chute;
      const next = this.sim.physics.chuteTargetX + this.aimDirection * c.speed * 0.8 * this.sim.dt;
      this.sim.setRampTarget(Math.min(c.maxX, Math.max(c.minX, next)));
    }
    if (this.autoShots > 0 && !this.sim.rules.canShoot()) this.stopAuto(this.sim.rules.hasUnpaidSpin() ? null : 'réserve vide');
    this.sim.holdFire = !this.readOnly && (this.manualFire || this.autoShots > 0);
    this.sim.step();
    const busy = this.sim.stats.shotsRefused['chute-busy'];
    if (busy !== this.lastBusy) {
      this.lastBusy = busy;
      this.coach.tip('busy');
    }
    const exits = this.sim.exitLog;
    if (exits.length) this.renderer.objects.addExits(exits);
    const events = this.sim.rules.drainEvents();
    if (events.length) this.handleEvents(events, exits);
    // Point de transaction sûr : fin de pas, règles résolues.
    if (this.sim.tick - this.lastSaveTick >= this.config.persistence.checkpointIntervalSeconds / this.sim.dt) void this.save();
  }

  private elapsed = 0;

  private render(alpha: number, frameDt: number): void {
    this.elapsed += frameDt;
    const s = this.sim.rules.state;
    const superPush = this.sim.physics.pusherStroke > this.sim.geometry.pusher.stroke + 1e-6;
    this.renderer.setMood(s.fever.active, superPush, this.elapsed, this.settings.reducedEffects);
    this.renderer.render(this.sim, alpha, frameDt);
    this.hud.update(s, this.sim.rules.unlimitedReserve);
    this.updateKnob();
    if (!this.wheel.active && this.sim.rules.hasUnpaidSpin() && !this.menu.open) this.presentWheel();
  }

  // --- Événements de règles → présentation ----------------------------------------------------

  private handleEvents(events: RulesEvent[], exits: readonly ExitRecord[]): void {
    const rules = this.sim.rules;
    let major = false;
    for (const e of events) {
      switch (e.type) {
        case 'ShotAccepted':
          this.sound.shot(e.objectType === 'gold');
          if (this.autoShots > 0 && --this.autoShots === 0) this.stopAuto('limite de 50 tirs');
          this.updateAutoButton();
          break;
        case 'ObjectCollected': {
          const exit = exits.find((x) => x.id === e.id);
          if (exit) {
            const at = this.renderer.project({ x: exit.position.x, y: this.sim.geometry.lowerY, z: this.sim.geometry.frontZ }, this.root.clientWidth, this.root.clientHeight);
            const tone = e.objectType === 'normal' ? 'normal' : e.objectType === 'gold' ? 'gold' : 'special';
            this.hud.float(at.x, at.y - 18, `+${e.points}${e.multiplier > 1 ? ` ×${e.multiplier}` : ''}`, tone);
          }
          this.sound.collect(e.objectType === 'normal' ? 'normal' : e.objectType === 'gold' ? 'gold' : 'special', rules.state.combo.count);
          if (e.reserve > 0) this.hud.bump('reserve');
          this.coach.tip(e.objectType === 'star' ? 'star' : e.objectType === 'wheel' ? 'wheel' : e.objectType === 'gem' ? 'gem' : 'collect');
          if (e.objectType !== 'normal' && e.objectType !== 'gold') this.hud.toast(`${capitalize(TYPE_LABEL[e.objectType] ?? e.objectType)} collecté${e.objectType === 'star' ? 'e' : ''} !`, 'good', 1400);
          break;
        }
        case 'ObjectLost':
          this.sound.lost();
          break;
        case 'ComboChanged':
          if (e.multiplier > 1 && e.count > 1) {
            this.hud.toast(`Combo ×${e.multiplier} !`, 'good', 1200);
            this.sound.combo(e.multiplier);
          }
          break;
        case 'FeverStarted':
          this.stopAuto('Fever');
          this.hud.toast(`FEVER ! Points ×${this.config.bonus.fever.pointMultiplier} pendant ${e.seconds} s`, 'big', 2600);
          this.sound.setFever(true);
          major = true;
          break;
        case 'FeverExtended':
          this.hud.toast(`Fever prolongée : +${e.seconds} s`, 'good');
          break;
        case 'FeverEnded':
          this.sound.setFever(false);
          break;
        case 'BonusQueued':
          if (e.job.kind === 'rain') {
            this.hud.toast(`Pluie de pièces : ${e.job.remaining} à venir !`, 'big');
            this.sound.power('rain');
          } else this.hud.toast(`Objet offert : ${TYPE_LABEL[e.job.type] ?? e.job.type}`, 'info', 1600);
          break;
        case 'BonusStarted':
          if (e.bonus !== 'shockwave') {
            this.hud.toast(`${POWER_LABEL[e.bonus]} : +${e.cycles} cycles (au prochain cycle)`, 'good');
            this.sound.power(e.bonus);
          }
          break;
        case 'BonusEnded':
          this.hud.toast(`${POWER_LABEL[e.bonus]} terminée${e.bonus === 'barriers' ? 's' : ''}`, 'info', 1400);
          break;
        case 'ChargesAdded':
          if (e.charge === 'barriers' || e.charge === 'superPush' || e.charge === 'shockwave') this.coach.tip('power');
          if (e.charge === 'freeShots' || e.charge === 'goldenShots' || e.added + e.deferred > 0) {
            const what = { freeShots: 'tirs gratuits', goldenShots: 'tirs dorés', barriers: 'barrières', superPush: 'super poussée', shockwave: 'onde de choc' }[e.charge];
            this.hud.toast(`+${e.added + e.deferred} ${what}${e.deferred > 0 ? ` (${e.deferred} en attente, plafond atteint)` : ''}`, 'good');
          }
          break;
        case 'ChestOpened':
          this.stopAuto('coffre');
          this.hud.toast(`Coffre : ${rewardLabel(e.reward, this.config)} !`, 'big', 2600);
          this.sound.fanfare(false);
          major = true;
          break;
        case 'WheelResultCommitted':
          this.stopAuto(null);
          major = true;
          break;
        case 'WheelPaid':
          this.hud.toast(`Roue : ${rewardLabel(e.reward, this.config)}`, 'big');
          break;
        case 'GemAdded':
          this.hud.toast(`Gemme ${e.gem} (${e.session.length}/${this.config.collection.gemIds.length})${e.newInAlbum ? ' — nouvelle dans l’album !' : ''}`, 'good', 2000);
          break;
        case 'JackpotAwarded':
          this.stopAuto('jackpot');
          this.hud.toast(`JACKPOT ${JACKPOT_LABEL[e.tier]} ! +${e.reserve} pièces · +${e.points.toLocaleString('fr-FR')} pts`, 'big', 3600);
          this.sound.fanfare(true);
          major = true;
          break;
        case 'ChallengePhase':
          if (e.phase !== 'playing') this.stopAuto(null);
          if (e.phase === 'resolving') this.hud.toast('Réserve épuisée : les pièces en mouvement peuvent encore rapporter…', 'warn', 3000);
          else if (e.phase === 'playing') this.hud.toast('Réserve regagnée : les tirs reprennent !', 'good');
          else if (e.phase === 'ended') {
            this.showSummary();
            major = true;
          }
          break;
      }
    }
    const unlocked = applyProgress(this.profile, events, rules.state);
    for (const id of unlocked) {
      const theme = THEMES.find((t) => t.unlock === id);
      this.hud.toast(`Trophée : ${TROPHIES.find((t) => t.id === id)!.label}${theme ? ` — thème « ${theme.label} » débloqué (Réglages)` : ''}`, 'big', 3600);
    }
    if (unlocked.length || events.some((e) => e.type === 'GemAdded')) void this.store.put('profile', this.profile).catch(() => {});
    if (major) void this.save();
  }

  private presentWheel(): void {
    const pending = this.sim.rules.pendingSpin();
    if (!pending) return;
    this.stopFiring();
    this.wheel.present(pending.spin.index, rewardLabel(pending.reward, this.config), this.settings.reducedEffects, () => {
      // Paiement unique du résultat engagé, puis reprise.
      if (this.sim.rules.payWheel(pending.spin.id)) {
        this.sound.fanfare(pending.reward.kind === 'jackpot');
        const events = this.sim.rules.drainEvents();
        this.handleEvents(events, []);
      }
      void this.save();
      this.loop.resetClock();
    });
  }

  // --- Interface ------------------------------------------------------------------------------

  private buildUi(): void {
    this.hud = new Hud(this.root, this.config, {
      menu: () => this.openMenu(),
      diag: () => this.toggleDiag(),
      refill: () => {
        if (this.sim.rules.manualRefill()) {
          this.hud.toast(`Recharge gratuite : +${this.config.economy.freeManualRefill}`, 'good');
          this.hud.bump('reserve');
        }
      },
      power: (p) => this.activatePower(p),
    });

    const controls = document.createElement('div');
    controls.id = 'controls';
    controls.innerHTML = `
      <div class="aim-zone" role="slider" aria-label="Position de la rampe" aria-valuemin="0" aria-valuemax="100" tabindex="-1"><div class="aim-knob"></div></div>
      <button type="button" class="fire" aria-label="Tirer une pièce">Tirer</button>
      <button type="button" class="auto" aria-pressed="false" title="Tir automatique (A) : 50 tirs maximum, arrêt sur bonus majeur">Auto</button>`;
    controls.prepend(this.hud.powers);
    const hint = document.createElement('div');
    hint.className = 'hint desktop';
    hint.textContent = 'Souris : viser · Clic ou Espace : tirer (maintenir) · ← → : viser · Échap : menu';
    this.root.append(controls, hint);
    setTimeout(() => (hint.style.opacity = '0'), 9000);

    this.menu = new Menu(this.root, {
      resume: () => this.closeMenu(),
      newGame: (mode) => this.newGame(mode),
      settings: (s) => this.applySettings(s),
      exportSave: () => this.exportSave(),
      importSave: (f) => void this.importSave(f),
      resetMachine: () => this.newGame(this.sim.rules.state.mode),
      sandbox: (a) => this.sandbox(a),
      operatorApply: (o) => this.applyOperator(o),
      operatorExport: () => downloadJson('coin-cascade-reglages.json', this.operator.overrides ?? { version: 1, preset: 'classic', values: {} }),
      operatorImport: (f) => void this.importOperator(f),
    });
    this.wheel = new WheelPresenter(this.root, this.config);
    this.wheel.onTick = () => this.sound.wheelTick();
    this.summary = document.createElement('div');
    this.summary.className = 'overlay';
    this.summary.hidden = true;
    this.root.append(this.summary);
    this.diag = new DiagnosticsPanel(this.root, this.diagnosticsSource(), (seed) => this.newGame(this.sim.rules.state.mode, seed));

    window.addEventListener('keydown', (e) => {
      if ((e.key === 'd' || e.key === 'D') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) this.toggleDiag();
    });
    // Le premier geste débloque l'audio (politique des navigateurs).
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const aimZone = controls.querySelector<HTMLElement>('.aim-zone')!;
    const knob = controls.querySelector<HTMLElement>('.aim-knob')!;
    const fire = controls.querySelector<HTMLButtonElement>('.fire')!;
    bindInput(this.canvas, aimZone, fire, {
      aimScreen: (x, y) => this.sim.setRampTarget(this.renderer.screenToChuteX(x, y, this.canvas.getBoundingClientRect())),
      aimFraction: (f) => {
        const c = this.sim.geometry.chute;
        this.sim.setRampTarget(c.minX + (c.maxX - c.minX) * f);
      },
      aimNudge: (d) => (this.aimDirection = d),
      setFire: (held) => {
        this.manualFire = held && !this.readOnly;
        if (held && !this.sim.rules.canShoot() && this.sim.rules.state.challenge.phase !== 'ended') this.explainNoShot();
      },
      togglePause: () => (this.menu.open ? this.closeMenu() : this.openMenu()),
      blocked: () => this.menu.open || this.wheel.active || !this.summary.hidden || this.readOnly,
    });
    this.autoButton = controls.querySelector<HTMLButtonElement>('.auto')!;
    this.autoButton.addEventListener('click', () => this.toggleAuto());
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'a' || e.key === 'A') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement) && !e.repeat) this.toggleAuto();
    });
    // Conseils dans la colonne des messages, en haut : jamais sur le bord de collecte.
    this.coach = new Coach(this.root.querySelector<HTMLElement>('.toasts') ?? this.root, this.settings.tips, this.settings.tipsSeen, (seen) => this.applySettings({ tipsSeen: seen }));
    this.updateKnob = () => {
      const c = this.sim.geometry.chute;
      const f = (this.sim.physics.chuteX - c.minX) / (c.maxX - c.minX);
      knob.style.left = `calc(24px + ${f} * (100% - 48px))`;
      aimZone.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    };
  }

  private updateKnob: () => void = () => {};

  private toggleAuto(): void {
    if (this.autoShots > 0) {
      this.stopAuto(null);
      return;
    }
    if (this.readOnly || this.menu.open || !this.summary.hidden || !this.sim.rules.canShoot()) {
      this.explainNoShot();
      return;
    }
    this.autoShots = AUTO_LIMIT;
    this.coach.tip('auto');
    this.updateAutoButton();
  }

  /** Arrête le tir automatique ; `reason` non nul affiche pourquoi. */
  private stopAuto(reason: string | null): void {
    if (this.autoShots === 0) return;
    this.autoShots = 0;
    if (reason) this.hud.toast(`Tir automatique arrêté : ${reason}.`, 'info', 1800);
    this.updateAutoButton();
  }

  private updateAutoButton(): void {
    if (!this.autoButton) return;
    const on = this.autoShots > 0;
    this.autoButton.setAttribute('aria-pressed', String(on));
    this.autoButton.textContent = on ? `Auto ${this.autoShots}` : 'Auto';
  }

  /** Coupe tout tir en cours (menu, présentation, onglet masqué, bilan). */
  private stopFiring(): void {
    this.manualFire = false;
    this.stopAuto(null);
    this.sim.holdFire = false;
  }

  private explainNoShot(): void {
    const s = this.sim.rules.state;
    if (s.mode === 'free' && s.reserve < this.config.economy.shotCost) this.hud.toast('Réserve vide : utilisez la recharge gratuite (bouton en haut).', 'warn');
    else if (s.mode === 'challenge') this.hud.toast('Réserve épuisée : résolution en cours.', 'warn');
  }

  private activatePower(p: PowerType): void {
    if (this.readOnly || !this.sim.rules.activatePower(p)) return;
    if (p === 'shockwave') {
      const x = this.sim.physics.chuteX;
      this.sim.shockwave(x);
      const g = this.sim.geometry;
      this.renderer.pulseRing(x, (g.pusher.retractedZ + g.pusher.maxStroke + g.frontZ) / 2);
      this.sound.power('shockwave');
      this.hud.toast('Onde de choc !', 'good', 1200);
    }
    this.handleEvents(this.sim.rules.drainEvents(), []);
  }

  private openMenu(): void {
    this.stopFiring();
    this.sound.setPaused(true);
    this.menu.show({
      mode: this.sim.rules.state.mode,
      seed: this.sim.options.seed,
      rulesId: this.rulesId,
      custom: this.sim.rules.state.custom,
      persistent: this.store.persistent,
      readOnly: this.readOnly,
      settings: this.settings,
      profile: this.profile,
      gemIds: this.config.collection.gemIds,
      operator: {
        overrides: this.operator.overrides,
        defaults: Object.fromEntries(OPERATOR_PARAMS.map((p) => [p.path, readPath(this.operator.published, p.path)])),
      },
    });
    void this.save();
  }

  /** Applique des réglages validés : la machine est reconstruite au rechargement de la page. */
  private applyOperator(o: Overrides | null): void {
    try {
      buildConfig(this.configText, o);
    } catch (error) {
      this.hud.toast(`Réglages refusés : ${error instanceof Error && 'details' in error ? String(error.details).split('\n')[0] : String(error)}`, 'warn', 5000);
      return;
    }
    void this.save().then(() => {
      saveOverrides(o);
      location.reload();
    });
  }

  private async importOperator(file: File): Promise<void> {
    try {
      const raw = (await readJsonFile(file, 100_000)) as Overrides;
      buildConfig(this.configText, raw);
      if (confirm(`Appliquer ces réglages (profil « ${raw.preset} », ${Object.keys(raw.values ?? {}).length} ajustement(s)) ? La machine sera reconstruite.`)) this.applyOperator(raw);
    } catch (error) {
      this.hud.toast(`Réglages refusés : ${error instanceof Error ? error.message : String(error)}. Configuration actuelle conservée.`, 'warn', 5000);
    }
  }

  configText = '';

  private closeMenu(): void {
    this.menu.hide();
    this.sound.setPaused(false);
    this.loop.resetClock();
    this.canvas.focus({ preventScroll: true });
  }

  private toggleDiag(force?: boolean): void {
    this.diag.toggle(force);
    this.hud.setDiagPressed(this.diag.visible);
  }

  private newGame(mode: GameMode, seed?: string): void {
    const fresh = seed ?? (mode === 'challenge' ? this.config.seed : `${this.config.seed}-${Date.now().toString(36)}`);
    this.sim.dispose();
    this.sim = this.createSimulation(fresh, mode);
    this.sound.setFever(false);
    this.summary.hidden = true;
    this.menu.hide();
    this.sound.setPaused(false);
    this.loop.resetClock();
    this.lastSaveTick = this.sim.tick;
    void this.save();
    this.hud.toast(`Nouvelle partie : ${MODE_LABEL[mode]}`, 'info');
  }

  private applySettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.sound.setVolumes(this.settings);
    this.renderer.objects.reducedEffects = this.settings.reducedEffects;
    if (patch.theme) {
      const theme = themeById(patch.theme);
      if (themeUnlocked(theme, this.profile.trophies)) this.renderer.applyTheme(theme);
    }
    if (patch.tips !== undefined && this.coach) {
      this.coach.enabled = patch.tips;
      if (patch.tips) this.coach.reset();
    }
    if (patch.quality) {
      this.renderer.setQuality(resolveQuality(patch.quality));
      this.resize();
    }
    void this.store.put('settings', this.settings).catch(() => {});
  }

  private sandbox(action: SandboxAction): void {
    const rules = this.sim.rules;
    if (rules.state.mode !== 'sandbox') return;
    rules.markCustom();
    const reward = (kind: 'coinRain' | 'barriers' | 'superPush' | 'freeShots' | 'goldenShots') => rules.applyReward({ id: 'sandbox', weight: 1, kind } as never);
    switch (action) {
      case 'rain':
        reward('coinRain');
        break;
      case 'barriers':
      case 'superPush':
      case 'freeShots':
      case 'goldenShots':
        reward(action);
        break;
      case 'shockwave':
        rules.addCharge('shockwave', 1);
        break;
      case 'fever':
        rules.grantStars(this.config.bonus.fever.starsRequired);
        break;
      case 'wheel':
        rules.grantWheelTokens(this.config.wheel.tokensRequired);
        break;
      case 'chest':
        rules.forceChest();
        break;
      case 'mini':
      case 'minor':
      case 'major':
      case 'grand':
        rules.applyReward({ id: 'sandbox', weight: 1, kind: 'jackpot', tier: action });
        break;
      default:
        if (!rules.queueSpecial(action.slice(5) as 'gold' | 'star' | 'wheel' | 'gem' | 'chest' | 'power')) this.hud.toast('File de distribution pleine.', 'warn');
    }
    this.closeMenu();
    this.handleEvents(rules.drainEvents(), []);
  }

  // --- Fin de défi -------------------------------------------------------------------------------

  private showSummary(): void {
    const s = this.sim.rules.state;
    const st = s.stats;
    let boardValue = 0;
    for (const o of this.sim.objects.values()) if (o.state === 'active') boardValue += this.config.objects[o.type].reserve;
    const recordKey = `${this.rulesId}|${this.sim.options.seed}`;
    let best = this.profile.records[recordKey];
    const standard = !s.custom;
    if (standard && !this.recordSaved && (!best || s.score > best.score)) {
      best = { score: s.score, shots: st.paidShots + st.freeShots, date: new Date().toISOString(), timedOut: s.challenge.timedOut };
      this.profile.records[recordKey] = best;
      void this.store.put('profile', this.profile).catch(() => {});
    }
    this.recordSaved = true;
    this.summary.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <h2 id="summary-title">Défi terminé</h2>
        <dl class="summary">
          <dt>Score</dt><dd>${s.score.toLocaleString('fr-FR')}</dd>
          <dt>Tirs (payés + gratuits)</dt><dd>${st.paidShots} + ${st.freeShots}</dd>
          <dt>Réserve gagnée</dt><dd>${(st.reserveFromCollection + st.reserveFromBonus).toLocaleString('fr-FR')}</dd>
          <dt>Valeur encore sur le plateau</dt><dd>${boardValue.toLocaleString('fr-FR')} pièces</dd>
          <dt>Meilleur combo</dt><dd>${st.bestCombo}</dd>
          <dt>Record (règles et seed)</dt><dd>${standard ? (best?.score ?? s.score).toLocaleString('fr-FR') : 'session personnalisée, hors records'}</dd>
        </dl>
        ${s.challenge.timedOut ? `<p class="warn">Fin à la limite de résolution (${this.config.challenge.maxResolutionSeconds} s simulées) : les effets encore engagés ont été abandonnés.</p>` : ''}
        <div class="row">
          <button type="button" class="btn primary" data-again="challenge">Nouveau défi</button>
          <button type="button" class="btn" data-again="free">Mode libre</button>
        </div>
      </div>`;
    this.summary.hidden = false;
    this.stopFiring();
    for (const b of this.summary.querySelectorAll<HTMLButtonElement>('[data-again]')) b.addEventListener('click', () => this.newGame(b.dataset.again as GameMode));
    this.summary.querySelector<HTMLButtonElement>('[data-again]')!.focus();
  }

  // --- Sauvegarde --------------------------------------------------------------------------------

  private envelope(): SaveEnvelope {
    return { format: SAVE_FORMAT, formatVersion: SAVE_FORMAT_VERSION, savedAt: new Date().toISOString(), rulesId: this.rulesId, overrides: null, sim: this.sim.snapshot() };
  }

  /** Instantané à une frontière de pas ; une écriture remplace atomiquement la précédente. */
  private async save(): Promise<void> {
    if (this.readOnly || this.saving || !this.sim) return;
    this.lastSaveTick = this.sim.tick;
    this.saving = true;
    try {
      await this.store.put('session', this.envelope());
    } catch {
      /* lastError visible dans le diagnostic */
    } finally {
      this.saving = false;
    }
  }

  private exportSave(): void {
    downloadJson(`coin-cascade-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.json`, this.envelope());
  }

  private async importSave(file: File): Promise<void> {
    try {
      const raw = await readJsonFile(file, this.config.persistence.maxImportBytes);
      const check = checkSave(raw);
      if (!check.ok) throw new Error(check.reason);
      const save = check.save;
      const r = save.sim.rules as unknown as { mode: GameMode; score: number; reserve: number };
      const compatible = save.rulesId === this.rulesId;
      const recap = `Importer cette partie ?\n\nMode : ${MODE_LABEL[r.mode]}\nScore : ${r.score}\nRéserve : ${r.reserve}\nObjets sur le plateau : ${save.sim.objects.length}\nEnregistrée le : ${save.savedAt}\n${compatible ? '' : '\nAttention : règles différentes de ce site ; la partie sera marquée personnalisée.'}\n\nLa partie actuelle sera remplacée (une copie de secours est conservée).`;
      if (!confirm(recap)) return;
      await this.store.put('session-backup', this.envelope()).catch(() => {});
      const next = this.createSimulation(save.sim.seed, r.mode, save);
      if (!compatible) next.rules.markCustom();
      this.sim.dispose();
      this.sim = next;
      this.closeMenu();
      await this.save();
      this.hud.toast('Partie importée.', 'good');
    } catch (error) {
      this.hud.toast(`Import refusé : ${error instanceof Error ? error.message.split('\n')[0] : String(error)}. La partie actuelle est conservée.`, 'warn', 5000);
    }
  }

  // --- Fenêtres multiples, visibilité, taille -------------------------------------------------------

  private askSecondWindow(): void {
    this.readOnly = true;
    this.summary.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="dup-title">
        <h2 id="dup-title">Déjà ouvert ailleurs</h2>
        <p>Coin Cascade est ouvert dans une autre fenêtre ou un autre onglet. Pour ne pas écraser cette partie silencieusement, choisissez :</p>
        <div class="row">
          <button type="button" class="btn primary" data-dup="take">Jouer ici (l’autre fenêtre passe en lecture seule)</button>
          <button type="button" class="btn" data-dup="view">Regarder sans sauvegarder</button>
        </div>
      </div>`;
    this.summary.hidden = false;
    this.summary.querySelector('[data-dup="take"]')!.addEventListener('click', async () => {
      await this.lock.acquire(true);
      this.readOnly = false;
      this.summary.hidden = true;
      this.hud.toast('Cette fenêtre détient la partie.', 'info');
    });
    this.summary.querySelector('[data-dup="view"]')!.addEventListener('click', () => {
      this.summary.hidden = true;
      this.hud.toast('Lecture seule : aucun tir ni sauvegarde dans cette fenêtre.', 'warn', 4000);
    });
  }

  private becomeReadOnly(): void {
    this.readOnly = true;
    this.stopFiring();
    this.hud.toast('Une autre fenêtre a pris la main : celle-ci passe en lecture seule.', 'warn', 6000);
  }

  /** Onglet masqué : arrêt réel de la simulation et sauvegarde ; reprise sans rattrapage. */
  private onVisibility(): void {
    if (document.hidden) {
      this.hiddenPause = true;
      this.stopFiring();
      this.sound.setPaused(true);
      void this.save();
    } else if (this.hiddenPause) {
      this.hiddenPause = false;
      if (!this.menu.open) this.sound.setPaused(false);
      this.loop.resetClock();
    }
  }

  private backgroundId = '';

  /** Fond de page : image `background.*` si livrée, sinon dégradé CSS (fallback du manifeste). */
  private updateBackground(portrait: boolean): void {
    const id = portrait ? 'background.portrait' : 'background.landscape';
    if (id === this.backgroundId) return;
    this.backgroundId = id;
    const asset = resolveAsset(id);
    if (asset.kind !== 'file') {
      this.root.style.removeProperty('background-image');
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (this.backgroundId === id) this.root.style.backgroundImage = `url("${asset.url}")`;
    };
    img.onerror = () => reportAssetFailure(id, 'chargement impossible');
    img.src = asset.url;
  }

  private resize(): void {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.updateBackground(h > w);
    const status = this.root.querySelector<HTMLElement>('#status');
    const controls = this.root.querySelector<HTMLElement>('#controls');
    this.renderer.setMargins({
      top: status ? status.getBoundingClientRect().bottom + 4 : 0,
      bottom: controls ? h - controls.getBoundingClientRect().top + 4 : 0,
    });
    this.renderer.resize(w, h);
  }

  private diagnosticsSource() {
    return {
      fps: () => this.loop.fps,
      quality: () => this.renderer.quality,
      renderInfo: () => this.renderer.info(),
      droppedSeconds: () => this.loop.droppedSeconds,
      sim: () => {
        const s = this.sim.stats;
        if (this.sim.tick % 15 === 0) this.awakeCache = this.sim.countAwake();
        return {
          tick: this.sim.tick,
          cycle: this.sim.physics.cycle,
          seed: this.sim.options.seed,
          active: this.sim.activeCount,
          awake: this.awakeCache,
          pending: this.sim.pendingSpawns,
          stepP50: s.stepMs.percentile(0.5),
          stepP95: s.stepMs.percentile(0.95),
          tickMean: s.tickMs.mean(),
          shots: s.shotsAccepted,
          collected: s.collected,
          lost: s.lost,
          anomalies: s.anomalies,
          settleDiscarded: s.settleDiscarded,
          refused: s.shotsRefused,
        };
      },
      extra: (): [string, string][] => {
        const st = this.sim.rules.state.stats;
        return [
          ['Règles', this.rulesId],
          ['Stockage', this.store.persistent ? 'IndexedDB' : `mémoire (${escapeHtml(this.store.lastError ?? 'indisponible')})`],
          ['Fenêtre', this.readOnly ? 'lecture seule' : 'active'],
          ['Collectées initiales / payées / gratuites / bonus', `${st.collected.initial} / ${st.collected['paid-shot']} / ${st.collected['free-shot']} / ${st.collected.bonus}`],
          ['Objets offerts', `${st.specialsOffered}`],
        ];
      },
    };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
