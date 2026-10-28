import { hash53 } from './hash.ts';

/** État sérialisable d'un flux aléatoire (sfc32). */
export type RngState = [number, number, number, number];

/**
 * Générateur sfc32 à état explicite. Chaque flux (disposition, distribution,
 * coffres, roue, effets cosmétiques) a sa propre instance : consommer un flux
 * ne décale jamais les tirages d'un autre.
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state.map((v) => v >>> 0) as RngState;
  }

  static fromSeed(seed: string, stream: string): Rng {
    const text = `${seed}\u0000${stream}`;
    const h1 = hash53(text, 1);
    const h2 = hash53(text, 2);
    const rng = new Rng([h1 >>> 0, (h1 / 4294967296) >>> 0, h2 >>> 0, ((h2 / 4294967296) >>> 0) | 1]);
    for (let i = 0; i < 12; i++) rng.nextUint32();
    return rng;
  }

  nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Flottant dans [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Entier dans [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }
}

/** Tire une clé selon des poids relatifs (normalisés, pas des pourcentages). */
export function pickWeighted<K extends string>(rng: Rng, weights: Readonly<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  return pickWeightedEntry(rng, entries, (e) => e[1])[0];
}

export function pickWeightedEntry<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T {
  let total = 0;
  for (const item of items) total += Math.max(0, weightOf(item));
  if (!(total > 0)) throw new Error('Tirage pondéré impossible : somme des poids nulle');
  let roll = rng.next() * total;
  for (const item of items) {
    const w = Math.max(0, weightOf(item));
    if (w === 0) continue;
    if (roll < w) return item;
    roll -= w;
  }
  // Arrondi flottant : dernier élément de poids positif.
  for (let i = items.length - 1; i >= 0; i--) if (weightOf(items[i]!) > 0) return items[i]!;
  throw new Error('unreachable');
}
