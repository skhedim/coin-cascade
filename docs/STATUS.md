# État de passation

Mis à jour : 2026-10-28, 23 h (Europe/Paris), après la troisième session de Claude : ART-002 intégrée, thèmes, partie longue mesurée.

## Situation

- Prototype **jouable** : machine 3D procédurale (Three.js) et physique Rapier, modes libre, défi et bac à sable, bonus J3/J4, sauvegarde locale, sons synthétisés, menu avec réglages et préréglages opérateur.
- Cinq images finales livrées par Codex : faces classique/dorée, décal du mur de fond et fonds paysage/portrait, marquées `ready` et chargées par le code existant. Les huit autres assets restent `planned` avec fallbacks.
- ART-001 et ART-002 sont `integrated` : face classique, fonds paysage et portrait, décal du mur de fond, face dorée. Les 8 autres assets (7 illustrations de bonus et l'emblème, lot B facultatif) restent `planned` avec leurs fallbacks SVG ou CSS.
- Dépôt **public** <https://github.com/skhedim/coin-cascade>, `main` poussée. GitHub Pages est la seule cible (Render abandonné, D025) mais **pas encore activé** : c'est à l'utilisateur de le faire. Étapes dans `docs/07-HEBERGEMENT.md`. Le workflow a déjà réussi sur GitHub `npm ci`, `npm test` et `npm run build`.
- Pas de dépôt git local (non demandé).

## Commandes

| Commande | Effet |
| --- | --- |
| `npm ci` | Installation exacte depuis `package-lock.json` (Node ≥ 22.18, voir `.node-version`). |
| `npm run dev` | Serveur de développement sur <http://localhost:5180/>, exposé sur le réseau (navigateur Windows via WSL2, téléphone sur le réseau local). |
| `npm run build` | Contrôle des types (`tsc`), validation de `config/game.yaml` (plugin Vite), puis `dist/`. |
| `npm run preview` | Sert `dist/` sur <http://localhost:4180/>. |
| `npm test` | Tests Vitest : règles, simulation Rapier réelle, configuration, sauvegarde. |
| `npm run typecheck` | Types seuls. |
| `npm run check:config` | Valide le YAML (outil Node). |
| `npm run bench:physics -- --scenario=play\|idle\|perf [--rate=2] [--seconds=180] [--set=machine.coin.friction:0.15] [--trace=30]` | Banc physique sans navigateur. |
| `npm run check:browser -- [--bases=/,/coin-cascade/] [--quality=low] [--devices=desktop,mobile]` | Après `npm run build` : Chromium headless sert `dist/` à la racine et sous un sous-chemin. Vérifie console, requêtes en échec ou hors origine, et produit des captures dans `test-results/browser/`. |

Paramètres d'URL utiles : `?quality=low|medium|high`, `?diag=1` (diagnostic ouvert), `?seed=texte` (nouvelle machine avec cette seed). En jeu : touche **D** pour le diagnostic, **Échap** pour le menu.

## Jalons

- [x] **J0** Initialisation : TypeScript strict, Vite 8, Three.js 0.186, Rapier 0.21, Zod 4, lockfile, écran de chargement, message WebGL 2 indisponible, YAML validé au build et au démarrage, chemins d'assets construits avec la base Vite.
- [x] **J1** Physique : deux niveaux, pousseur cinématique, mur racleur, goulotte orientable, gouttières, bac, barrières, disposition reproductible par seed, diagnostic. Calibrage mesuré, voir plus bas et D010-D013.
- [x] **J2** Partie de base : réserve, score, collecte unique, modes libre et défi avec résolution de fin et bilan, commandes clavier/souris/tactile, tir maintenu, pause et onglet masqué, sauvegarde/reprise IndexedDB, export/import, sons. *Non fait :* test sur téléphone réel.
- [x] **J3** Première version fun : pièces dorées, objets offerts tous les 12 tirs payés, étoiles, combos, Fever, pluie, HUD et gains flottants, demande ART-001.
- [x] **J4** Bonus complets : roue (résultat engagé et sauvegardé avant l'animation, payé une fois), coffres, barrières, super poussée, onde de choc, tirs gratuits et dorés, gemmes, collection de session, album et quatre jackpots. Tout se force dans le bac à sable.
- [x] **J5** Opérateur et progression : préréglages Classique/Généreux/Chaos/Détente, 14 paramètres bornés et expliqués, import/export des réglages, bac à sable, records de défi par règles et seed, 4 trophées, album, tir automatique (bouton « Auto » ou touche A, 50 tirs au plus, arrêt sur bonus majeur), 8 conseils contextuels et **4 thèmes** (Néon or ; Saphir, Émeraude et Rubis débloqués par trophée ; purement visuels, hors règles). *Écart assumé :* les paramètres opérateur s'appliquent tous par reconstruction de la machine (D019), pas « à la prochaine action ».
- [~] **J6** Presque complet. Fait : ART-001 et ART-002 intégrées, pièce dorée renforcée, qualité basse/moyenne/haute, effets réduits, robustesse vérifiée en navigateur (reprise, seconde fenêtre, stockage indisponible, import invalide), partie longue de 15 min simulées sans anomalie ni fuite (banc `--scenario=long`). *Restent :* mesures sur GPU et téléphone réels.
- [~] **J7** Livraison statique : workflow GitHub Pages (tests puis build puis déploiement), `.node-version`, licences dans `assets/CREDITS.md`, dépôt public poussé, CI vérifiée sur GitHub. *Reste :* activer Pages (utilisateur), relancer le workflow, vérifier l'URL réelle.

## Vérifications réellement effectuées (2026-10-28, machine de développement WSL2, 22 cœurs)

**Automatiques**

- `npm test` : 43 tests passés (règles, simulation Rapier réelle sous Node, configuration, préréglages, sauvegarde, boucle). Sont couverts : collecte unique, tir refusé sans débit (cadence, capacité), tir gratuit + doré, perte sans gain, combo et plafond, ordre des sorties d'un même pas, Fever (démarrage au pas suivant, deux prolongations, reliquat), roue reprise depuis la sauvegarde et payée une fois, Grand (album conservé), plafonds et droits reportés, fin de défi (reprise des tirs, trois cycles calmes, limite de résolution), barrières à la frontière de cycle sans éjection, super poussée, onde de choc bornée, YAML invalide refusé, import de sauvegarde invalide refusé, reprise d'instantané.
- `npm run typecheck` et `npm run build` : OK. Chunks : démarrage 209 Ko (64 Ko gzip), application 665 Ko (176 Ko gzip), Rapier 4,3 Mo (1,67 Mo gzip, WASM en base64).
- `npm run check:browser` (Chromium 1248 headless, SwiftShader, sans GPU) : chargement complet **à la racine et sous `/coin-cascade/`**, bureau 1280×800 et mobile 390×844. Aucune erreur console, aucune requête en échec, aucune requête hors origine (donc aucun CDN). Aucun asset `planned` demandé au réseau.
- Scénario Playwright ponctuel (bureau) : menu, passage en bac à sable, roue forcée, présentée, abrégée puis payée une seule fois ; Fever active ; session marquée personnalisée ; aucune erreur console.

**Mesures physiques** (banc Node 22, un processus, configuration publiée)

| Scénario | Résultat |
| --- | --- |
| Pas physique, 100 / 160 / 250 / 320 objets | p50 1,47 / 1,67 / 2,95 / 3,01 ms ; p95 2,09 / 2,07 / 3,89 / 3,76 ms ; 0 anomalie |
| Repos 60 s, 160 objets | 0 perte, 0 anomalie, vitesse résiduelle moyenne < 0,0001 m/s (pas de tremblement permanent) |
| Jeu 5 min, 2,85 tirs/s, rampe en balayage | 80 % des tirs acceptés (les autres refusés sans débit : goulotte occupée), 633 collectées, 165 perdues (21 %), régime stable vers 200 objets, 0 anomalie |
| Pire cas, rampe immobile, 2,85 tirs/s | 70 % des tirs acceptés, le flux continue |
| Jeu 2 tirs/s, 150 s | 284 tirs sur 300 acceptés, 281 collectées, 55 perdues |

**Observé sur captures** : borne lisible en paysage et en portrait. Pièces champagne avec emblème, pièce dorée, étoiles, jetons roue, gemmes colorées, coffres, chevrons du pousseur, gouttières et bac distincts. Les captures de référence sont dans `docs/art/captures/`.

**Non vérifié** : FPS réels sur GPU (le headless de WSL2 n'a que SwiftShader : 4 à 12 FPS non représentatifs), Firefox, Safari et iOS, Android réel, session de 15 min dans un navigateur, son réellement entendu (le code Web Audio n'est exercé que par le typage et le build).

### Seconde session (2026-10-28 au soir)

- `npm test` : 44 tests passés. Le test d'assets couvre désormais un asset `ready` (URL construite depuis la base Vite, fichier présent) et un asset `planned`.
- `npm run typecheck` et `npm run build` : OK.
- `npm run check:browser` : racine et `/coin-cascade/`, bureau et mobile, sans erreur ni requête en échec ou hors origine. L'outil fige désormais la boucle pendant chaque capture (méthode de Codex) : sous SwiftShader, les captures sont rapides et fiables.
- Scénarios Playwright ponctuels (Chromium headless) :
  - **reprise** après rechargement : même nombre de tirs, tick repris là où il s'était arrêté ;
  - **seconde fenêtre** : dialogue « Déjà ouvert ailleurs », puis lecture seule ;
  - **stockage bloqué** : jeu en mémoire, avec message ;
  - **import invalide** : refusé avec un message en français, partie inchangée ;
  - **tir automatique** : décompte, arrêt à l'ouverture du menu ;
  - **conseil d'introduction** : visible en haut, sur ordinateur comme sur mobile.
- Aucune mesure de FPS réelle (toujours SwiftShader).

### Troisième session (2026-10-28, 23 h)

- `npm test` : 46 tests passés, dont deux nouveaux sur les thèmes.
- `npm run typecheck` et `npm run build` : OK. `npm run check:browser` : racine et `/coin-cascade/`, bureau et mobile, sans erreur ni requête en échec ou hors origine.
- ART-002 contrôlée dans la scène : décal du mur de fond et face dorée ; thème Rubis vérifié sur capture.
- Partie longue, `node --expose-gc tools/bench-physics.ts --scenario=long --minutes=15`, un processus seul :
  - 1 575 collectées, 302 perdues, 6 Fever, 8 roues, 0 anomalie, aucun NaN ;
  - actifs 246 au maximum sur 320, travaux de distribution 2 au maximum sur 32 ;
  - pas physique p50/p95 de 1,8/2,3 ms en fin de partie, sans dégradation ;
  - tas JS retenu stable (+1,5 Mo) ;
  - deux exécutions donnent exactement les mêmes résultats (même seed, mêmes actions).

## Limites connues et risques

- **Débit d'alimentation physique** : au-delà d'environ 2 tirs/s au même endroit, les tas du plateau haut bouchent la sortie de la goulotte ; le tir est alors refusé sans débit. Le frottement entre pièces est le réglage le plus sensible (D012).
- **Reprise** exacte en positions et vitesses, pas bit à bit pour la suite (D017). Un changement de configuration publiée crée une nouvelle machine.
- Le **chunk Rapier** pèse 1,67 Mo gzip. Piste : paquet non-compat avec `.wasm` séparé (~30 % de moins), à mesurer.
- Les flous `backdrop-filter` du HUD peuvent coûter sur GPU faible : à vérifier sur téléphone.
- L'onde de choc s'applique autour de la position de la rampe, sur le plateau bas.
- Pas de service worker ni de PWA (choix volontaire, voir `07-HEBERGEMENT.md`).
- `cabinet.front-decal` : gabarit 8:3 fourni par Claude, image ART-002 livrée et chargement vérifié ; confirmer le rendu sur appareils réels.

## Décisions de cette session

D010 à D021 dans `docs/DECISIONS.md` : collider et échelle Rapier, mécanique de la goulotte vers le mur, calibrage (frottements, joues, cadence), détection des sorties, coffre à collider propre, pouvoirs stockés, droits au-delà des plafonds, format de sauvegarde, base relative, réglages opérateur, exécution TypeScript native, canvas transparent.

## Prochaine tâche concrète

1. **Utilisateur** : activer Pages (Settings > Pages > Source : « GitHub Actions ») et relancer le workflow (commandes dans `docs/07-HEBERGEMENT.md`). Jouer ensuite sur <https://skhedim.github.io/coin-cascade/> depuis Windows et un téléphone, et noter le FPS et le pas physique p95 (touche D).
2. **Claude (session suivante)** : corriger d'après les mesures sur appareils réels. Publier quand l'hébergement sera choisi (J7), puis vérifier l'URL réelle. En option : demander l'emblème et les illustrations de bonus (lot B) pour l'écran de chargement et les annonces de jackpot.

## Livraison graphique Codex — ART-001

- `public/assets/coins/classic-face.png` : PNG RGBA 512 × 512, 102 914 octets.
- `public/assets/backgrounds/arcade-landscape.webp` : RGB 1920 × 1080, 125 984 octets.
- `public/assets/backgrounds/arcade-portrait.webp` : RGB 1080 × 1920, 104 522 octets.
- Sources, prompts exacts, mesures, script de conditionnement et captures : `assets/source/ART-001-face-piece-et-fonds/`.
- Trois entrées du manifeste passées à `ready`, crédits complétés, aucun changement du code principal.
- Contrôles : dimensions, alpha et budgets OK ; `public/` et `dist/` identiques ; `npm run build` réussi ; contrôles Chromium ciblés passés sur racine/sous-chemin et formats bureau/mobile, aucune erreur ni requête d'asset en échec. Pièce inspectée à 45/60 px sous six rotations.
- Le contrôle général animé en qualité moyenne a été interrompu à cause de la lenteur de capture sous SwiftShader. Le contrôle ciblé fige la boucle, utilise le profil bas et ne mesure pas les FPS. Voir le compte rendu ART-001 pour les commandes et limites exactes.

## Livraison graphique Codex — ART-002

- `public/assets/cabinet/front-decal.png` : 2048 × 768 PNG RGBA, 422 912 octets (budget 900 000).
- `public/assets/coins/gold-face.png` : 512 × 512 PNG RGBA, 103 772 octets (budget 180 000).
- Sources, quatre prompts exacts, variantes, conditionnement, mesures et captures : `assets/source/ART-002-decal-mur-et-piece-doree/`.
- Décal placé dans la zone sûre du gabarit ; bande basse transparente. Pièce étoilée distinguable à 45 px sous six rotations, même en gris.
- `npm run build` réussi ; quatre contrôles Chromium passés (bureau/mobile, racine/sous-chemin), deux nouveaux assets et émissive correctement chargés, sans erreur ni fallback. Scène figée pour les captures, aucune mesure de FPS réelle.
- Les deux entrées du manifeste sont `ready`, crédits complétés. Aucun changement de `src/`, `tools/`, `tests/` ou `config/`.

## Demandes graphiques ouvertes

Aucune demande ouverte : ART-001 et ART-002 sont `integrated`.

## Travail simultané / chemins réservés

Aucune session concurrente. Le code (`src/`, `tools/`, `tests/`, `config/`) relève de Claude ; les ressources graphiques (`assets/source/`, `public/assets/`) relèvent de Codex.

## Carte rapide du code

- `src/engine/` : règles pures (`rules.ts`), RNG à flux séparés, hachage. Aucune dépendance au DOM, à Three.js ou à Rapier.
- `src/physics/` : géométrie de la borne, monde Rapier, disposition initiale.
- `src/game/` : simulation (ordre d'un pas, sorties, instantanés), boucle à pas fixe.
- `src/render/` : scène Three.js, borne, pièces instanciées, textures procédurales.
- `src/ui/` : HUD, menu, roue, entrées, diagnostic. `src/audio/` : sons Web Audio.
- `src/persistence/` : IndexedDB, verrou de fenêtre, profil. `src/config/` : schéma Zod, surcharges opérateur.
- `tools/` : banc physique, vérification navigateur, validation du YAML. `tests/` : Vitest.
