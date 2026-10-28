# Coin Cascade

Jeu de coin pusher 3D pour navigateur, entièrement statique et réglable.

Prototype jouable depuis le 28 octobre 2026 : borne 3D procédurale (Three.js), physique Rapier, modes libre, défi et bac à sable, bonus, sauvegarde locale. Les images définitives ne sont pas encore livrées : le jeu utilise ses fallbacks procéduraux. État détaillé et prochaines étapes : [docs/STATUS.md](docs/STATUS.md).

## Lancer le jeu

Prérequis : Node 22.18 ou plus récent (`.node-version`).

```sh
npm ci            # installation exacte depuis le lockfile
npm run dev       # http://localhost:5180/ (aussi depuis le navigateur Windows ou un téléphone du réseau local)
npm test          # tests automatiques
npm run build     # types + validation de config/game.yaml + dist/
npm run preview   # sert dist/ sur http://localhost:4180/
```

Commandes : souris pour viser, clic ou Espace pour tirer (maintenir pour répéter), flèches pour viser, Échap pour le menu, D pour le diagnostic. Sur mobile : glisser dans la zone de visée, bouton « Tirer ». Paramètres d'URL : `?quality=low|medium|high`, `?diag=1`, `?seed=…`.

Publication : **GitHub Pages uniquement**, sur <https://skhedim.github.io/coin-cascade/>. Chaque push sur `main` lance les tests, construit `dist/` et le publie (`.github/workflows/deploy.yml`). Le même `dist/` fonctionne aussi à la racine d'un domaine personnalisé. Voir [docs/07-HEBERGEMENT.md](docs/07-HEBERGEMENT.md).

## Reprendre avec Claude ou Codex

1. Ouvrir le dossier du projet dans le terminal ou l'éditeur utilisé avec Claude.
2. Lui donner le contenu de [PROMPT_CLAUDE.md](PROMPT_CLAUDE.md), ou simplement :

   > Lis CLAUDE.md et PROMPT_CLAUDE.md dans ce dossier, puis commence le développement de Coin Cascade selon ces instructions. Mets à jour docs/STATUS.md pour permettre une reprise par Codex.

3. Claude construit le jeu, y compris la scène 3D et les visuels procéduraux provisoires. **Codex prend en charge la direction artistique et les images lorsqu'elles deviennent nécessaires.**

Claude et Codex accèdent aux mêmes fichiers, mais ils ne se parlent pas automatiquement : les demandes et livraisons graphiques passent par `docs/art/requests/`. L'utilisateur lance ensuite la session souhaitée.

## Lire le dossier

| Fichier | Usage |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Consignes courtes pour Claude |
| [AGENTS.md](AGENTS.md) | Consignes communes aux agents intervenant ici |
| [PROMPT_CLAUDE.md](PROMPT_CLAUDE.md) | Prompt complet prêt à transmettre |
| [docs/01-PRODUIT.md](docs/01-PRODUIT.md) | Expérience, fonctionnalités et périmètre |
| [docs/02-REGLES.md](docs/02-REGLES.md) | Contrat de gameplay et économie |
| [docs/03-ARCHITECTURE.md](docs/03-ARCHITECTURE.md) | Structure, physique et sauvegardes |
| [docs/04-DIRECTION-ARTISTIQUE.md](docs/04-DIRECTION-ARTISTIQUE.md) | Style, cadrage, matières et interface |
| [docs/05-REALISATION.md](docs/05-REALISATION.md) | Jalons et critères de passage |
| [docs/06-VALIDATION.md](docs/06-VALIDATION.md) | Vérifications et scénarios significatifs |
| [docs/07-HEBERGEMENT.md](docs/07-HEBERGEMENT.md) | Build statique et publication GitHub Pages |
| [docs/08-COLLABORATION.md](docs/08-COLLABORATION.md) | Travail partagé Claude / Codex |
| [docs/STATUS.md](docs/STATUS.md) | État actuel et prochaine tâche |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Décisions et adaptations du plan |
| [config/game.yaml](config/game.yaml) | Proposition initiale des paramètres |
| [assets/manifest.json](assets/manifest.json) | Contrat des images, chemins et solutions provisoires |
| [docs/art/PROMPTS.md](docs/art/PROMPTS.md) | Briefs de génération pour Codex |

## Principe technique

TypeScript + Vite, rendu Three.js, physique Rapier 3D, menus HTML/CSS. À la fin : un dossier `dist/` autonome, hébergeable sur un service de fichiers statiques. Aucun backend requis.

`assets/source/` conserve les sources artistiques ; `public/assets/` reçoit uniquement les exports destinés au jeu. Le catalogue peut annoncer un fichier qui n'existe pas encore : `status: planned` le signale et le jeu doit avoir un fallback.

Aucun déploiement ni dépôt distant n'a été créé.
