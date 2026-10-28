# ART-001 — Face de pièce classique et fonds d'ambiance

Statut : integrated — livré par Codex et intégré par Claude le 2026-10-28 (voir « Intégration »).
Créée le : 2026-10-28.
Demandeur : Claude.
Responsable images : Codex.

## Contexte et priorité

- Jalon actuel : prototype jouable (J0 à J4 réalisés, J5 partiel). Cadrage et UV de la pièce stabilisés.
- Pourquoi maintenant : la face de pièce est la texture la plus visible (le plateau en montre 150 à 220) ; les fonds encadrent la borne en paysage (côtés et haut) et en portrait (haut et bas). Les deux définissent la direction artistique.
- ID(s) du manifeste : `coin.face.classic`, `background.landscape`, `background.portrait`.
- Fallbacks actuels : `procedural-coin-face-ring-emblem` (`classicFace` dans `src/render/textures.ts`) et `css-dark-arcade-gradient` (fond de `#app` dans `src/styles.css`).
- Code à consulter, sans le modifier : `src/render/geometries.ts` (`createCoinGeometry`, convention UV), `src/render/objects.ts` (`faceMaterials`, chargement d'un asset `ready`), `src/app.ts` (`updateBackground`).

## Références réelles

- Captures locales (Chromium headless, rendu logiciel, qualité moyenne) : `docs/art/captures/2026-10-28-bureau-1280x800.png` et `docs/art/captures/2026-10-28-mobile-390x844.png`.
- Gabarit UV de la face : `docs/art/templates/coin-face-uv.svg`.
- Briefs de départ : `docs/art/PROMPTS.md` (A1, A3, A4). Création originale uniquement, aucune marque ni machine de casino existante.

## Contrat de livraison

| Champ | `coin.face.classic` | `background.landscape` | `background.portrait` |
| --- | --- | --- | --- |
| Chemin d'export sous `public/` | `assets/coins/classic-face.png` | `assets/backgrounds/arcade-landscape.webp` | `assets/backgrounds/arcade-portrait.webp` |
| Largeur × hauteur | 512 × 512 | 1920 × 1080 | 1080 × 1920 |
| Format | PNG RGBA | WebP opaque | WebP opaque |
| Alpha requis | Oui, hors du disque | Non | Non |
| Espace colorimétrique | sRGB | sRGB | sRGB |
| Budget de poids | 180 Ko | 500 Ko | 500 Ko |
| Marge / zone utile / recadrage | Disque de 88 % du carré = face plate ; dessin important dans 80 % du rayon | Recadré en `cover` ; borne au centre sur ~55 % de la largeur | Recadré en `cover` ; borne sur presque toute la largeur |
| Position UV, orientation, répétition | Voir gabarit : haut = fond de la machine ; pièces orientées au hasard, emblème lisible sous toute rotation ; pas de répétition | Aucune | Aucune |
| Taille d'affichage dans le jeu | 40 à 60 px CSS de diamètre (bureau 1280 × 800 comme mobile 390 × 844) | Plein écran derrière la scène | Plein écran derrière la scène |

## Brief visuel

**Face classique.** Emblème original d'or chaud avec un émail cyan sobre, gros éléments lisibles à 45 px. Vue strictement de face, sans perspective, épaisseur, ombre portée ni éclairage peint : le moteur éclaire le métal. L'image livrée est utilisée comme carte couleur seule, avec un métal uniforme (métal 0,6, rugosité 0,38). Préférer des tons moyens à clairs, car un dessin très sombre paraîtra noir. Aucun texte ni chiffre. Le listel doré et la tranche sont déjà en géométrie : ne pas redessiner de bord de pièce épais au bord du disque.

**Fond paysage.** Salle d'arcade nocturne : marine profond, accents cyan à gauche et magenta à droite, touches d'or. Centre calme et sombre derrière la borne. Les côtés restent visibles autour de la machine (voir la capture bureau). La bande du haut passe sous les compteurs : elle doit rester peu contrastée.

**Fond portrait.** Même lieu recomposé, pas un étirement. Les zones visibles sont le haut, sous les compteurs (~15 % de la hauteur), le bas sous les commandes (~12 %) et de fines marges latérales. Garder ces zones calmes pour la lisibilité du texte HTML.

## Critères d'acceptation

- [x] Composition compatible avec le gabarit et les captures.
- [x] Face lisible à 45 px sur la capture mobile ; contrôle complémentaire à 45/60 px sous six rotations.
- [x] Transparence réelle hors du disque, sans halo parasite visible sur les captures inspectées.
- [x] Aucun texte essentiel peint dans les images.
- [x] Format, dimensions et poids d'export contrôlés.

## Chemins modifiables et simultanéité

- Sources : `assets/source/ART-001-face-piece-et-fonds/`.
- Exports : les trois chemins ci-dessus sous `public/`.
- Manifeste : Codex peut passer ces trois entrées à `ready` une fois les fichiers réels contrôlés. Claude n'édite pas le manifeste en parallèle.
- Code : aucun changement requis. Le jeu charge automatiquement un asset `ready` ; s'il échoue, il revient au fallback et l'affiche dans le diagnostic (touche D).
- Crédits : compléter `assets/CREDITS.md`.

Pas de demande pour `cabinet.front-decal` dans ce lot : le panneau de façade n'a pas encore de gabarit UV livré par Claude.

## Livraison — Codex

Date : 2026-10-28, Europe/Paris. Statut : `delivered`.

| ID | Export réel sous `public/` | Dimensions / mode | Poids |
| --- | --- | --- | --- |
| `coin.face.classic` | `assets/coins/classic-face.png` | 512 × 512, PNG RGBA | 102 914 octets / budget 180 000 |
| `background.landscape` | `assets/backgrounds/arcade-landscape.webp` | 1920 × 1080, WebP RGB opaque | 125 984 octets / budget 500 000 |
| `background.portrait` | `assets/backgrounds/arcade-portrait.webp` | 1080 × 1920, WebP RGB opaque | 104 522 octets / budget 500 000 |

Total des trois exports : 333 420 octets. Les trois entrées du manifeste sont passées à `ready`. Les dix autres restent `planned`. Aucun fichier de `src/`, `tools/`, `tests/` ou `config/` n'a été modifié.

**Sources et prompts.** `assets/source/ART-001-face-piece-et-fonds/` contient les quatre sorties originales du générateur, les quatre prompts exacts, `export-assets.py` et `export-report.json` (mesures et SHA-256). La pièce v1 n'est pas retenue : trop de relief et un bord trop présent. La v2 conserve le motif mais l'aplatit en carte couleur. Le portrait a été généré en prenant le paysage comme référence, avec recomposition verticale. Génération avec le skill imagegen et l'outil `image_gen` intégré, sans CLI/API de génération. Pillow sert au conditionnement des exports. Crédits ajoutés dans `assets/CREDITS.md`.

**Alpha et UV.** PNG RGBA réel, alpha 0–255, quatre coins entièrement transparents. Le disque conserve un petit débord de couleur autour du rayon UV de 88 %, pour éviter un liseré sombre ; le gabarit et le code ne changent pas. Sur 360 points du bord UV à la résolution exportée : alpha minimal 248, moyen 252,08. Le matériau existant est opaque et la découpe circulaire est géométrique : conserver ce fonctionnement, sans activer de transparence de matériau.

**Inspections.** Originaux et exports visualisés, pièce contrôlée à 45 et 60 px CSS avec rotations 0/60/120/180/240/300°. Planche : `assets/source/ART-001-face-piece-et-fonds/qa/coin-rotations.png`. Captures de la borne inspectées en bureau 1280 × 800 et mobile 390 × 844 ; couleurs, cadrage et texte HTML restent lisibles. Les détails fins de l'emblème sont décoratifs et ne portent pas d'information de jeu.

**Contrôles techniques effectués.**

- `npm run build` : réussi, avec l'avertissement de taille du chunk Rapier déjà connu.
- Exports de `public/` identiques octet par octet aux fichiers copiés dans `dist/` ; tailles et budgets vérifiés.
- `node assets/source/ART-001-face-piece-et-fonds/verify-browser.mjs` : réussi pour les quatre combinaisons racine/sous-chemin et bureau/mobile. PNG et fond attendu reçus en HTTP 200, aucune erreur console, aucun fallback signalé, aucune requête en échec ni hors origine. Résultats : `qa/browser-report.json`, captures `qa/assets-{root,subpath}-{desktop,mobile}.png`.
- Le contrôle général `npm run check:browser -- --out=assets/source/ART-001-face-piece-et-fonds/qa --seconds=1 --quality=medium` a été interrompu après une première capture bureau, car les captures animées sont très lentes sous SwiftShader. Il n'est pas annoncé comme passé. Le contrôle ciblé ci-dessus fige la boucle pour vérifier les visuels sans modifier le jeu.

**Reprise Claude.** Les trois fichiers sont déjà branchés par le chargeur existant et visibles après reconstruction/rafraîchissement. Relire cette livraison, vérifier sur un navigateur avec GPU et sur téléphone réel, puis renseigner l'acceptation ci-dessous. Aucun changement d'UV ou de shader demandé. La façade n'est pas incluse : attendre le gabarit UV avant une demande distincte.

**Limites.** Les quatre contrôles utilisent Chromium headless sous WSL2, profil bas et scène figée pour les captures. Ils ne valident ni FPS réels, ni animation prolongée, ni Safari/Firefox, ni appareil mobile réel. Ne pas remplacer les vérifications J6 restantes par ces seuls contrôles d'assets.

## Intégration — à remplir par Claude

- Date : 2026-10-28.
- Résultat dans la scène et contrôles effectués :
  - livraison relue ; les trois fichiers sont chargés par le code existant (aucune modification d'UV ni de shader) ;
  - face classique contrôlée sur la borne : orientation correcte, aucun liseré, débord de couleur invisible car hors disque UV, matériau opaque conservé ;
  - fonds paysage et portrait visibles autour de la borne sans gêner les compteurs ;
  - `npm run build` puis `npm run check:browser` (boucle figée pendant les captures, méthode reprise de `verify-browser.mjs`) : aucune erreur, aucune requête en échec ni hors origine ;
  - captures dans `test-results/browser/`.
- Correction nécessaire : aucune sur les fichiers livrés. Conséquence côté code : la nouvelle face, claire et dorée, rendait la pièce dorée procédurale plus sombre que la pièce normale. J'ai renforcé la pièce dorée : or saturé, étoile blanche, métal moins réfléchissant, lueur chaude qui scintille (coupée en effets réduits). Une face dédiée est demandée dans ART-002 (`coin.face.gold`).
- Non vérifié : rendu sur GPU réel et sur téléphone (WSL2 n'offre que SwiftShader).
