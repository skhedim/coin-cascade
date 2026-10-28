export interface LoopHooks {
  /** Un pas fixe de simulation. */
  step(): void;
  /** Rendu avec facteur d'interpolation entre le pas précédent et le courant. */
  render(alpha: number, frameDt: number): void;
  /** Faux pendant une pause (menu, onglet masqué, présentation de roue). */
  canStep(): boolean;
}

/**
 * Boucle à pas fixe : accumulateur borné, au plus `maxCatchUp` pas par image.
 * Le temps en excès est abandonné (aucun rattrapage massif après une pause).
 */
export class FixedLoop {
  private readonly hooks: LoopHooks;
  private readonly dt: number;
  private readonly maxCatchUp: number;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private alpha = 0;
  /** Temps simulé abandonné faute de capacité de calcul (diagnostic). */
  droppedSeconds = 0;
  fps = 0;
  private frames = 0;
  private fpsWindow = 0;

  constructor(hooks: LoopHooks, dt: number, maxCatchUp: number) {
    this.hooks = hooks;
    this.dt = dt;
    this.maxCatchUp = maxCatchUp;
  }

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** Oublie le temps écoulé (reprise après pause ou onglet masqué). */
  resetClock(): void {
    this.last = performance.now();
    this.acc = 0;
  }

  private frame(now: number): void {
    const frameDt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.advance(frameDt);
  }

  /** Une image : pas fixes bornés puis rendu. Retourne le nombre de pas exécutés. */
  advance(frameDt: number): number {
    let n = 0;
    this.frames++;
    this.fpsWindow += frameDt;
    if (this.fpsWindow >= 0.5) {
      this.fps = this.frames / this.fpsWindow;
      this.frames = 0;
      this.fpsWindow = 0;
    }
    if (this.hooks.canStep()) {
      this.acc += frameDt;
      // `canStep` est relu à chaque pas : une présentation (roue) peut figer la suite de l'image.
      while (this.acc >= this.dt && n < this.maxCatchUp && this.hooks.canStep()) {
        this.hooks.step();
        this.acc -= this.dt;
        n++;
      }
      if (this.acc >= this.dt) {
        if (this.hooks.canStep()) this.droppedSeconds += this.acc;
        this.acc = 0;
      }
      this.alpha = this.acc / this.dt;
    } else {
      this.acc = 0;
    }
    this.hooks.render(this.alpha, frameDt);
    return n;
  }
}
