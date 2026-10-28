/** Conseils contextuels : chacun s'affiche une seule fois, au moment où il devient utile. */
export const TIPS = {
  intro: 'Visez avec la souris (ou glissez en bas sur mobile), tirez avec clic ou Espace. La pièce glisse dans la rampe et se dépose contre le mur du fond : le plateau mobile la pousse vers l’avant.',
  collect: 'Une pièce qui tombe à l’avant est gagnée : elle rapporte des points et de la réserve. Celles qui tombent dans les gouttières latérales sont perdues.',
  star: `Les étoiles remplissent la jauge Fever : une fois pleine, tous les points sont doublés pendant un moment.`,
  wheel: 'Les jetons roue lancent la roue Cascade. Son résultat est tiré dès le troisième jeton, la roue ne fait que l’afficher.',
  power: 'Vous avez gagné un pouvoir : activez-le avec son bouton, à gauche du bouton de tir.',
  gem: 'Collectionnez les cinq gemmes différentes pour remporter le jackpot Grand.',
  busy: 'Goulotte occupée : déplacez la rampe pour répartir vos pièces, le tir n’a rien coûté.',
  auto: 'Tir automatique : il tire à la cadence maximale et s’arrête seul après 50 tirs, sur un bonus majeur ou quand la réserve est vide.',
} as const;

export type TipId = keyof typeof TIPS;

export class Coach {
  private readonly element: HTMLElement;
  private readonly text: HTMLElement;
  private readonly queue: TipId[] = [];
  private current: TipId | null = null;
  private timer = 0;
  enabled: boolean;
  private readonly seen: Set<string>;
  private readonly onSeen: (seen: string[]) => void;

  constructor(root: HTMLElement, enabled: boolean, seen: string[], onSeen: (seen: string[]) => void) {
    this.enabled = enabled;
    this.seen = new Set(seen);
    this.onSeen = onSeen;
    this.element = document.createElement('div');
    this.element.className = 'coach';
    this.element.hidden = true;
    this.element.setAttribute('role', 'status');
    this.element.innerHTML = `<p></p><button type="button" class="btn small">Compris</button>`;
    this.text = this.element.querySelector('p')!;
    this.element.querySelector('button')!.addEventListener('click', () => this.dismiss());
    root.prepend(this.element);
  }

  /** Demande l'affichage d'un conseil (ignoré s'il a déjà été vu ou si les conseils sont désactivés). */
  tip(id: TipId): void {
    if (!this.enabled || this.seen.has(id) || this.current === id || this.queue.includes(id)) return;
    this.queue.push(id);
    if (!this.current) this.next();
  }

  private next(): void {
    const id = this.queue.shift();
    if (!id) {
      this.current = null;
      this.element.hidden = true;
      return;
    }
    this.current = id;
    this.seen.add(id);
    this.onSeen([...this.seen]);
    this.text.textContent = TIPS[id];
    this.element.hidden = false;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.dismiss(), 9000);
  }

  private dismiss(): void {
    clearTimeout(this.timer);
    this.next();
  }

  reset(): void {
    this.seen.clear();
    this.onSeen([]);
  }
}
