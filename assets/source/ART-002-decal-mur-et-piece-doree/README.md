# ART-002 — Décal de mur et face dorée

Livraison Codex du 2026-10-28. Demande : `docs/art/requests/ART-002-decal-mur-et-piece-doree.md` à la racine du projet. Outil de création : `image_gen` intégré, skill imagegen. Aucun appel CLI/API de génération.

## Exports

| ID | Chemin à la racine du projet | Dimensions / format | Poids |
| --- | --- | --- | --- |
| `cabinet.front-decal` | `public/assets/cabinet/front-decal.png` | 2048 × 768 PNG RGBA | 422 912 octets |
| `coin.face.gold` | `public/assets/coins/gold-face.png` | 512 × 512 PNG RGBA | 103 772 octets |

Total : 526 684 octets. Les budgets 900 000 et 180 000 octets sont respectés. Détails et SHA-256 : `export-report.json`.

## Sources originales et prompts exacts

| Source | Dimensions | Prompt | Usage |
| --- | --- | --- | --- |
| `decal-v1-original.png` | 2048 × 768 RGBA | `prompt-decal.txt` | Première proposition ; motif inférieur trop bas pour le gabarit |
| `decal-v2-original.png` | 2048 × 768 RGBA | `prompt-decal-revision.txt` | Révision de v1, conservée comme variante |
| `decal-v3-original.png` | 2048 × 768 RGBA | `prompt-decal-flat.txt` | Proposition retenue, formes simplifiées et plus lisibles |
| `gold-original.png` | 1254 × 1254 RGBA | `prompt-gold-coin.txt` | Face retenue ; référence : face classique d'ART-001 |

Les originaux ont été copiés dans ce dossier sans supprimer ceux du générateur. Les images originales et leurs canaux alpha sont conservés.

## Conditionnement

`export-assets.py` décrit les opérations reproductibles :

- Décal : réduction uniforme à 1984 × 744 puis placement à X=32, Y=0 sur le canvas transparent 2048 × 768. Les motifs visibles sont ainsi dans la zone sûre du gabarit, sans modifier les UV.
- Pièce : réduction à 512 × 512.
- Compression : 128 couleurs, réexport RGBA en préservant l'alpha à la taille finale.

Le script ne dessine aucun motif et refuse les fichiers de destination existants. Ne pas le relancer aveuglément sur les exports livrés.

## Alpha et matériaux

Le décal visible au seuil alpha du matériau occupe X=71..1977, Y=68..431 : entièrement dans la zone sûre X=62..1986, Y=40..440. La bande basse de 15 % a un alpha nul ; sous Y=460, l'alpha vaut 0 ou 1/255, sous le seuil `alphaTest=0.02` existant. Les quatre coins sont transparents. Aucun halo visible lors de la composition sur le panneau marine.

Certains aperçus montrent la couleur RGB des pixels pourtant transparents : juger le résultat composé dans le navigateur et consulter l'alpha, pas seulement l'aperçu RGB brut. Voir `qa/texture-check.png`.

La face dorée comporte une grande étoile champagne, un contour magenta et un fond or ambré. L'étoile distingue la variante même en niveaux de gris. Pas de grande surface blanche pure demandée ; l'émission chaude reste fournie par le code existant. Aucune carte PBR supplémentaire, géométrie ou modification de shader livrée.

## Vérifications

- Dimensions, poids, RGBA, zone sûre et transparence contrôlés.
- Comparaison classique/dorée à 45 px, six rotations, en couleur et en gris ; décal à 400 et 300 px : `qa/texture-check.html` et `qa/texture-check.png`.
- `npm run build` réussi avec Node 22.23.3 ; avertissement de taille Rapier déjà connu.
- `node assets/source/ART-002-decal-mur-et-piece-doree/verify-browser.mjs` : vérification dans Chromium du chargement des deux nouvelles textures et de l'émissive de la pièce, avec captures aux formats bureau/mobile, racine/sous-chemin. Rapport : `qa/browser-report.json`. La boucle est figée et le conseil d'introduction fermé pour inspecter le mur.
- `code-baseline.json` permet de vérifier que `src/`, `tools/`, `tests/` et `config/` n'ont pas été changés pendant la livraison.

Les captures headless en qualité basse ne mesurent pas les performances réelles. L'acceptation finale sur GPU et téléphone, ainsi que le statut `integrated`, restent à renseigner par Claude.
