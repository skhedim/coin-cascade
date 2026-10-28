// Sons synthétisés (Web Audio) : aucun fichier audio, aucun réseau.
// Le contexte n'est créé qu'au premier geste de l'utilisateur (politique des navigateurs).

type Note = { freq: number; at?: number; dur?: number; gain?: number; type?: OscillatorType };

export interface Volumes {
  master: number;
  effects: number;
  music: number;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private effects!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private volumes: Volumes;
  private recent: number[] = [];
  private feverTimer = 0;
  private feverStep = 0;

  constructor(volumes: Volumes) {
    this.volumes = { ...volumes };
  }

  /** À appeler dans un gestionnaire de geste (clic, touche) : crée ou relance le contexte. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.effects = ctx.createGain();
      this.music = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.effects.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(comp).connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      this.setVolumes(this.volumes);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(v: Volumes): void {
    this.volumes = { ...v };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(v.master, t, 0.02);
    this.effects.gain.setTargetAtTime(v.effects, t, 0.02);
    this.music.gain.setTargetAtTime(v.music, t, 0.02);
  }

  /** Suspend le son avec la simulation (pause, onglet masqué). */
  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private ready(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  /** Limite le nombre de sons simultanés pendant une avalanche. */
  private allow(maxPerSecond: number): boolean {
    const now = performance.now();
    this.recent = this.recent.filter((t) => now - t < 1000);
    if (this.recent.length >= maxPerSecond) return false;
    this.recent.push(now);
    return true;
  }

  private tone(notes: Note[], dest: 'effects' | 'music' = 'effects'): void {
    const ctx = this.ready();
    if (!ctx) return;
    const out = dest === 'music' ? this.music : this.effects;
    const t0 = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const start = t0 + (n.at ?? 0);
      const dur = n.dur ?? 0.18;
      osc.type = n.type ?? 'sine';
      osc.frequency.setValueAtTime(n.freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(n.gain ?? 0.2, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
  }

  private burst(dur: number, freq: number, gain: number, q = 0.8, at = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.effects);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shot(golden: boolean): void {
    this.tone([
      { freq: golden ? 1760 : 1320, dur: 0.12, gain: 0.08, type: 'triangle' },
      { freq: golden ? 2637 : 1980, dur: 0.08, gain: 0.04, at: 0.01 },
    ]);
    this.burst(0.22, 2400, 0.05, 2, 0.04);
  }

  refused(): void {
    if (!this.allow(4)) return;
    this.tone([{ freq: 220, dur: 0.12, gain: 0.08, type: 'square' }]);
  }

  /** Collecte : la hauteur monte avec le combo (demi-tons). */
  collect(kind: 'normal' | 'gold' | 'special', combo: number): void {
    if (!this.allow(18)) return;
    const base = kind === 'gold' ? 1046.5 : kind === 'special' ? 1318.5 : 880;
    const step = Math.min(combo, 24);
    const f = base * 2 ** (step / 12);
    const notes: Note[] = [
      { freq: f, dur: 0.16, gain: 0.09, type: 'triangle' },
      { freq: f * 1.5, dur: 0.12, gain: 0.04, at: 0.015 },
    ];
    if (kind !== 'normal') notes.push({ freq: f * 2, dur: 0.22, gain: 0.05, at: 0.05 });
    this.tone(notes);
  }

  lost(): void {
    if (!this.allow(10)) return;
    this.burst(0.18, 320, 0.12, 1.2);
    this.tone([{ freq: 110, dur: 0.15, gain: 0.07, type: 'sine' }]);
  }

  combo(multiplier: number): void {
    const f = 523.25 * 2 ** ((multiplier - 1) * 2 / 12);
    this.tone([0, 4, 7, 12].map((s, i) => ({ freq: f * 2 ** (s / 12), at: i * 0.05, dur: 0.16, gain: 0.07, type: 'triangle' as const })));
  }

  power(kind: 'barriers' | 'superPush' | 'shockwave' | 'rain'): void {
    if (kind === 'shockwave') {
      this.burst(0.5, 160, 0.3, 0.6);
      this.tone([{ freq: 70, dur: 0.45, gain: 0.25 }]);
    } else if (kind === 'barriers') {
      this.tone([300, 450, 600].map((freq, i) => ({ freq, at: i * 0.06, dur: 0.25, gain: 0.06, type: 'sawtooth' as const })));
    } else if (kind === 'superPush') {
      this.tone([{ freq: 98, dur: 0.6, gain: 0.18, type: 'sawtooth' }, { freq: 196, dur: 0.4, gain: 0.06, at: 0.1 }]);
    } else {
      this.tone([1568, 1760, 2093, 2349, 2637].map((freq, i) => ({ freq, at: i * 0.07, dur: 0.2, gain: 0.05 })));
    }
  }

  wheelTick(): void {
    this.burst(0.03, 3000, 0.08, 4);
  }

  fanfare(big: boolean): void {
    const root = big ? 392 : 523.25;
    const seq = big ? [0, 4, 7, 12, 7, 12, 16, 19] : [0, 4, 7, 12];
    this.tone(seq.map((s, i) => ({ freq: root * 2 ** (s / 12), at: i * 0.09, dur: 0.3, gain: 0.08, type: 'triangle' as const })));
  }

  /** Pulsation rythmique pendant la Fever (canal musique). */
  setFever(active: boolean): void {
    clearInterval(this.feverTimer);
    if (!active) return;
    this.feverStep = 0;
    this.feverTimer = window.setInterval(() => {
      const bass = [110, 110, 146.8, 130.8][this.feverStep % 4]!;
      this.tone([{ freq: bass, dur: 0.18, gain: 0.16, type: 'sawtooth' }], 'music');
      if (this.feverStep % 2 === 1) this.burst(0.05, 6000, 0.05, 2);
      this.feverStep++;
    }, 250);
  }
}
