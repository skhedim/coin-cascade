import { z } from 'zod';
import { GAME_MODES, OBJECT_TYPES } from '../config/schema.ts';
import type { SimulationSnapshot } from '../game/simulation.ts';
import type { Profile } from './profile.ts';

// Sauvegarde locale versionnée (docs/03-ARCHITECTURE.md § Sauvegarde).
// Un seul enregistrement IndexedDB par clé : chaque écriture remplace atomiquement la précédente.

export const SAVE_FORMAT = 'coin-cascade-save';
export const SAVE_FORMAT_VERSION = 1;
const MAX_OBJECTS = 2000;

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  formatVersion: number;
  savedAt: string;
  rulesId: string;
  /** Réglages opérateur appliqués (overrides validés), pour reconstruire la même machine. */
  overrides: unknown;
  sim: SimulationSnapshot;
}

const finite = z.number().refine(Number.isFinite, 'nombre fini attendu');

/** Validation structurelle d'une sauvegarde importée ou relue (tailles bornées). */
const envelopeSchema = z.object({
  format: z.literal(SAVE_FORMAT),
  formatVersion: z.int().positive(),
  savedAt: z.string().max(64),
  rulesId: z.string().max(200),
  overrides: z.unknown(),
  sim: z.object({
    format: z.literal('coin-cascade-sim'),
    version: z.literal(1),
    seed: z.string().max(120),
    tick: z.int().nonnegative(),
    nextId: z.int().positive(),
    lastShotTick: finite,
    machine: z.object({ phase: finite, stroke: finite, cycle: z.int().nonnegative(), chuteX: finite, barrierLevel: finite, barrierTarget: finite }),
    objects: z
      .array(
        z.object({
          id: z.int().positive(),
          type: z.enum(OBJECT_TYPES),
          origin: z.enum(['initial', 'paid-shot', 'free-shot', 'bonus']),
          variant: z.string().max(40).nullable(),
          pose: z.array(finite).length(13),
          sleeping: z.boolean(),
        }),
      )
      .max(MAX_OBJECTS),
    rules: z.object({ version: z.literal(1), mode: z.enum(GAME_MODES) }).loose(),
  }),
});

export type SaveCheck = { ok: true; save: SaveEnvelope } | { ok: false; reason: string };

export function checkSave(raw: unknown): SaveCheck {
  const r = envelopeSchema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    const path = issue?.path.length ? issue.path.join('.') : 'racine';
    return { ok: false, reason: `fichier de sauvegarde invalide (champ « ${path} » manquant ou incorrect)` };
  }
  if (r.data.formatVersion > SAVE_FORMAT_VERSION) return { ok: false, reason: `format ${r.data.formatVersion} plus récent que ce jeu (${SAVE_FORMAT_VERSION})` };
  return { ok: true, save: r.data as unknown as SaveEnvelope };
}

// --- IndexedDB ---------------------------------------------------------------------

const DB_NAME = 'coin-cascade';
const STORE = 'kv';

export type StoreKey = 'session' | 'session-backup' | 'profile' | 'settings';

/**
 * Stockage clé/valeur. Si IndexedDB est indisponible (navigation privée stricte,
 * stockage bloqué), le jeu continue en mémoire et `persistent` vaut faux.
 */
export class LocalStore {
  private db: IDBDatabase | null = null;
  private readonly memory = new Map<StoreKey, unknown>();
  persistent = false;
  lastError: string | null = null;

  async open(): Promise<void> {
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('base bloquée par un autre onglet'));
      });
      this.persistent = true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.persistent = false;
    }
  }

  async get<T>(key: StoreKey): Promise<T | undefined> {
    if (!this.db) return this.memory.get(key) as T | undefined;
    return new Promise((resolve, reject) => {
      const req = this.db!.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async put(key: StoreKey, value: unknown): Promise<void> {
    if (!this.db) {
      this.memory.set(key, structuredClone(value));
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('transaction annulée'));
    }).catch((error: unknown) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    });
  }

  async delete(key: StoreKey): Promise<void> {
    if (!this.db) {
      this.memory.delete(key);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/**
 * Verrou de session entre fenêtres (Web Locks). Une seconde fenêtre n'écrase pas
 * silencieusement la partie : elle le sait et peut demander la main.
 */
export class SessionLock {
  held = false;
  private release: (() => void) | null = null;

  async acquire(steal = false): Promise<boolean> {
    if (!('locks' in navigator)) {
      this.held = true;
      return true;
    }
    return new Promise<boolean>((resolve) => {
      const options: LockOptions = steal ? { steal: true } : { ifAvailable: true };
      navigator.locks
        .request('coin-cascade-session', options, (lock) => {
          if (!lock) {
            resolve(false);
            return undefined;
          }
          this.held = true;
          resolve(true);
          // Conserve le verrou jusqu'à `release()` ou la fermeture de la page.
          return new Promise<void>((done) => (this.release = done));
        })
        .catch(() => {
          // Verrou volé par une autre fenêtre : celle-ci passe en lecture seule.
          this.held = false;
          this.onLost?.();
        });
    });
  }

  onLost?: () => void;

  free(): void {
    this.release?.();
    this.release = null;
    this.held = false;
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readJsonFile(file: File, maxBytes: number): Promise<unknown> {
  if (file.size > maxBytes) throw new Error(`fichier trop volumineux (${Math.round(file.size / 1024)} Kio, maximum ${Math.round(maxBytes / 1024)} Kio)`);
  const text = await file.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('JSON illisible');
  }
}

export type { Profile };
