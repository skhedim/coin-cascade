# Outils

Outils Node exécutés directement en TypeScript (Node ≥ 22.18, voir `docs/DECISIONS.md` D020).

| Outil | Commande | Usage |
| --- | --- | --- |
| `bench-physics.ts` | `npm run bench:physics -- --scenario=play\|idle\|perf\|long …` | Mesures physiques sans navigateur : débit, pertes, anomalies, temps de pas p50/p95, surcharges de configuration (`--set=chemin:valeur`). `long` (`--minutes=15`) force un bonus par minute et contrôle plafonds, files et mémoire (lancer avec `node --expose-gc` pour un tas sans déchets). |
| `check-browser.ts` | `npm run build && npm run check:browser` | Sert `dist/` à la racine et sous `/coin-cascade/`, ouvre Chromium headless, vérifie console et requêtes, produit des captures. |
| `check-config.ts` | `npm run check:config [-- fichier.yaml]` | Valide un fichier de configuration et affiche son identifiant de règles. |

Le moteur de règles et la simulation sont partagés avec le jeu : les outils ne recopient aucune formule.
