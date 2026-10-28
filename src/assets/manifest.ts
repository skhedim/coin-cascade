import { z } from 'zod';
import rawManifest from '../../assets/manifest.json';

// Contrat d'images partagé avec Codex : assets/manifest.json.
// Un asset `planned` n'est jamais demandé au réseau : son fallback procédural est utilisé directement.

const entrySchema = z.object({
  id: z.string().min(1),
  path: z
    .string()
    .min(1)
    .refine((p) => !p.startsWith('/') && !p.includes('..') && !p.includes('\\'), 'chemin relatif à public/ attendu'),
  status: z.enum(['planned', 'ready', 'deprecated']),
  batch: z.string(),
  usage: z.string(),
  width: z.int().positive(),
  height: z.int().positive(),
  transparent: z.boolean(),
  colorSpace: z.string(),
  maxBytes: z.int().positive(),
  fallback: z.string().min(1),
  notes: z.string().optional(),
});

const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseDirectory: z.literal('public'),
    assets: z.array(entrySchema),
  })
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    const paths = new Set<string>();
    m.assets.forEach((a, i) => {
      if (seen.has(a.id)) ctx.addIssue({ code: 'custom', path: ['assets', i, 'id'], message: `ID en double : ${a.id}` });
      if (paths.has(a.path)) ctx.addIssue({ code: 'custom', path: ['assets', i, 'path'], message: `chemin en double : ${a.path}` });
      seen.add(a.id);
      paths.add(a.path);
    });
  });

export type AssetEntry = z.output<typeof entrySchema>;

export const assetManifest = manifestSchema.parse(rawManifest);

export type AssetResolution =
  | { kind: 'file'; id: string; url: string; fallback: string; entry: AssetEntry }
  | { kind: 'fallback'; id: string; fallback: string; reason: 'planned' | 'deprecated' | 'unknown' };

/** URL publique d'un fichier de public/, construite avec la base Vite (jamais '/assets/...'). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith('/') ? base : `${base}/`}${path}`;
}

export function resolveAsset(id: string): AssetResolution {
  const entry = assetManifest.assets.find((a) => a.id === id);
  if (!entry) return { kind: 'fallback', id, fallback: 'none', reason: 'unknown' };
  if (entry.status !== 'ready') return { kind: 'fallback', id, fallback: entry.fallback, reason: entry.status };
  return { kind: 'file', id, url: publicUrl(entry.path), fallback: entry.fallback, entry };
}

/** Journal des ressources ayant échoué : visible dans le diagnostic. */
export const assetDiagnostics: string[] = [];

export function reportAssetFailure(id: string, detail: string): void {
  const line = `${id} : ${detail} → fallback`;
  if (!assetDiagnostics.includes(line)) assetDiagnostics.push(line);
  console.warn(`[assets] ${line}`);
}
