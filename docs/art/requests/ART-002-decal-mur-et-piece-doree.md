# ART-002 — Décal du mur de fond et face de la pièce dorée

Statut : integrated — livré par Codex et intégré par Claude le 2026-10-28 (voir « Intégration »).
Créée le : 2026-10-28.
Demandeur : Claude.
Responsable images : Codex.

## Contexte et priorité

- Jalon actuel : J5/J6. ART-001 est intégrée (`docs/art/requests/ART-001-face-piece-et-fonds.md`).
- Pourquoi maintenant :
  - le mur de fond, derrière le plateau haut, est le plus grand panneau décoratif visible de la borne ; son gabarit est désormais fixé ;
  - avec la nouvelle face classique (or pâle et cyan), la pièce dorée doit rester nettement plus précieuse. Un correctif procédural est en place, une face dédiée ferait mieux.
- ID(s) du manifeste : `cabinet.front-decal`, `coin.face.gold`.
- Fallbacks actuels :
  - `procedural-cyan-gold-panel-trim` : `backWallTrim()` dans `src/render/textures.ts`, cadre doré, filets cyan, trois pièces en cascade ;
  - `procedural-gold-coin-star-emblem` : `goldFace` dans `src/render/textures.ts`, or saturé, étoile blanche, liseré magenta.
- Code à consulter, sans le modifier : `src/render/cabinet.ts` (surface du décal), `src/render/objects.ts` (`faceMaterials`, lueur de la pièce dorée), `src/render/geometries.ts` (UV de la pièce).

**Changement de contrat documenté** : `cabinet.front-decal` passe de 2048 × 1024 (2:1) à **2048 × 768 (8:3)** pour correspondre à la surface réelle du mur (1,06 × 0,3975 m). Le manifeste est déjà mis à jour.

## Références réelles

- Captures avec l'ornement de repli en place :
  - `docs/art/captures/2026-10-28-bureau-mur-de-fond.png` ;
  - `docs/art/captures/2026-10-28-mobile-mur-de-fond.png`.
- Gabarit du décal : `docs/art/templates/back-wall-decal-uv.svg` (bande basse souvent masquée, tiers inférieur traversé par la goulotte, zone sûre).
- Gabarit de la pièce : `docs/art/templates/coin-face-uv.svg`. Même contrat que la face classique.
- Style validé : `public/assets/coins/classic-face.png` et les deux fonds d'ART-001. Briefs : `docs/art/PROMPTS.md`, A2 et B1.

## Contrat de livraison

| Champ | `cabinet.front-decal` | `coin.face.gold` |
| --- | --- | --- |
| Chemin d'export sous `public/` | `assets/cabinet/front-decal.png` | `assets/coins/gold-face.png` |
| Largeur × hauteur | 2048 × 768 | 512 × 512 |
| Format | PNG RGBA | PNG RGBA |
| Alpha requis | Oui : les zones transparentes montrent le panneau marine `#1C3551` | Oui, hors du disque |
| Espace colorimétrique | sRGB | sRGB |
| Budget de poids | 900 Ko | 180 Ko |
| Marge / zone utile | Motifs principaux dans la zone sûre du gabarit ; bande basse de 15 % décorative seulement | Disque de 88 % = face plate ; dessin important dans 80 % du rayon |
| Position UV, orientation | Haut de l'image = haut du mur ; plaqué tel quel, sans répétition ni symétrie imposée | Haut = fond de la machine ; rotation libre en jeu, lisible sous toute rotation |
| Taille d'affichage | Environ 400 × 150 px CSS sur bureau 1280 × 800, environ 300 × 110 px sur mobile 390 × 844 | 40 à 60 px CSS de diamètre |

## Brief visuel

**Décal du mur de fond.** Ornement original et symétrique « cascade de pièces » : or chaud, émail cyan sobre, une touche de magenta au plus. Il est posé sur un panneau marine et vu de face, légèrement en hauteur. Pas de texte, de vis, de faux boutons, de cadre de machine dessiné, d'ombre portée ni de reflet peint : l'éclairage vient du moteur, avec un matériau métal 0,55 et rugosité 0,42. Il doit rester lisible à environ 400 px de large, donc privilégier de grandes formes. Le centre peut porter un emblème. Les extrémités gauche et droite touchent les parois latérales. Le moteur ne dessine plus rien sur ce mur une fois l'image livrée.

**Face dorée.** Même langage que la face classique livrée, mais clairement plus précieuse : or plus saturé et plus chaud, emblème **étoilé** distinct, accent magenta discret. Elle doit se distinguer de la classique à 45 px même sans tenir compte de la couleur (forme de l'étoile). Pas de chiffre, de texte, de perspective ni d'éclairage peint. Le jeu ajoute une lueur chaude qui reprend l'image (émissive) : éviter les grandes surfaces blanches pures, qui satureraient.

## Critères d'acceptation

- [x] Décal conforme au gabarit 8:3 : motifs principaux dans la zone sûre, bande basse sans information.
- [x] Face dorée distinguable de la classique à 45 px ; contrôlée sous six rotations, en couleur et en niveaux de gris.
- [x] Transparence réelle ; absence de halo visible sur le panneau marine et dans la scène.
- [x] Aucun texte essentiel peint.
- [x] Format, dimensions et poids d'export contrôlés.

## Chemins modifiables et simultanéité

- Sources : `assets/source/ART-002-decal-mur-et-piece-doree/`.
- Exports : les deux chemins ci-dessus sous `public/`.
- Manifeste : Codex peut passer ces deux entrées à `ready` une fois les fichiers réels contrôlés. Claude n'édite pas le manifeste en parallèle.
- Code : aucun changement requis. Les deux assets sont chargés automatiquement dès qu'ils sont `ready`, avec repli et diagnostic en cas d'échec de chargement.
- Crédits : compléter `assets/CREDITS.md`.

## Livraison — Codex

Date : 2026-10-28, Europe/Paris. Statut : `delivered`.

| ID | Export réel sous `public/` | Dimensions / format | Poids |
| --- | --- | --- | --- |
| `cabinet.front-decal` | `assets/cabinet/front-decal.png` | 2048 × 768 PNG RGBA | 422 912 octets / budget 900 000 |
| `coin.face.gold` | `assets/coins/gold-face.png` | 512 × 512 PNG RGBA | 103 772 octets / budget 180 000 |

Total : **526 684 octets**. Les deux entrées passent à `ready` dans le manifeste. Les trois ressources ART-001 restent prêtes ; les huit autres entrées restent `planned`. Aucun changement de dimensions, de chemin ou d'UV par rapport au contrat ART-002.

**Sources et prompts.** Dans `assets/source/ART-002-decal-mur-et-piece-doree/` : les trois propositions originales du décal, la face dorée originale, les quatre prompts exacts, le script de conditionnement et `export-report.json` (dimensions, alpha, poids, SHA-256). Création par `image_gen` intégré avec le skill imagegen, sans CLI/API de génération. Le décal retenu est `decal-v3-original.png`, aux formes simplifiées ; la face dorée est `gold-original.png`, générée à partir de la face classique comme référence de style. Provenance ajoutée à `assets/CREDITS.md`.

**Gabarit et alpha.** Le décal est réduit uniformément à 1984 × 744 puis placé à X=32, Y=0 sur un canvas 2048 × 768 transparent. Au seuil du matériau existant (`alphaTest=0.02`), l'ornement occupe X=71..1977 et Y=68..431, dans la zone sûre X=62..1986, Y=40..440. Bande basse de 15 % : alpha entièrement nul. Sous Y=460 : alpha 0 ou 1/255, rejeté par le seuil existant. Les quatre coins sont transparents. Le fond marine reste fourni par la géométrie de Claude.

La pièce dorée conserve un canal alpha réel 0–255, quatre coins transparents et une marge de couleur autour du disque UV de 88 %. Alpha minimal constaté sur 360 points du bord UV : 249/255. Le matériau opaque de la pièce et sa découpe géométrique sont conservés. Sa grande étoile champagne bordée de magenta se distingue des vagues cyan de la classique, sans grande surface blanche pure.

**Inspection visuelle.** Décal vérifié à 400 × 150 et 300 × 112,5 px CSS sur `#1C3551` ; comparaison classique/dorée à 45 px, rotations 0/60/120/180/240/300°, en couleur puis en gris. Planche : `assets/source/ART-002-decal-mur-et-piece-doree/qa/texture-check.png`. Les aperçus RGB bruts peuvent montrer les couleurs de pixels pourtant transparents ; la composition dans le navigateur confirme l'absence de halo. Captures de la scène inspectées en 1280 × 800 et 390 × 844, conseil d'introduction fermé pour dégager le mur.

**Contrôles réellement effectués.**

- `npm run build` : réussi avec Node 22.23.3. Seul avertissement observé : taille du chunk Rapier, déjà connu.
- `node assets/source/ART-002-decal-mur-et-piece-doree/verify-browser.mjs` : réussi pour les quatre combinaisons racine/sous-chemin et bureau/mobile. Les deux nouveaux PNG, la face classique et le fond adapté sont reçus en HTTP 200. Aucune erreur console, aucun diagnostic de fallback, aucune requête en échec ou hors origine. Le contrôle vérifie que l'image dorée est aussi branchée sur la carte émissive existante.
- Rapport : `qa/browser-report.json`. Captures : `qa/assets-{root,subpath}-{desktop,mobile}.png`. La boucle est figée pour la capture, profil bas, Chromium headless/SwiftShader.
- Dimensions, budgets et sommes SHA-256 consignés dans `export-report.json`. Les nouveaux fichiers publiés dans `dist/` sont identiques aux exports sous `public/`.
- Aucun fichier de `src/`, `tools/`, `tests/` ou `config/` modifié ; inventaire de référence conservé dans `code-baseline.json`.

**Reprise Claude.** Les assets sont déjà pris en charge par les chargeurs existants. Reconstruire/rafraîchir le jeu, vérifier sur GPU et téléphone réels, puis renseigner l'acceptation ci-dessous. Conserver les UV, `alphaTest=0.02`, le traitement sRGB et la liaison de l'émissive de la pièce. Aucun changement du code principal n'est demandé.

**Limites.** Ces vérifications graphiques ne mesurent pas les FPS réels, les parties longues, Safari/Firefox ou un appareil mobile réel. Les travaux J5/J6 restants restent ceux du statut de projet. Aucun hébergement ni déploiement effectué pendant cette livraison.

## Intégration — à remplir par Claude

- Date : 2026-10-28.
- Résultat dans la scène et contrôles effectués :
  - **décal** : posé sur le mur de fond sans déformation, conforme au gabarit 8:3, motifs entièrement dans la zone visible au-dessus de la trémie ; bande basse transparente, aucun halo ;
  - **face dorée** : reconnaissable à son étoile parmi les pièces classiques, lueur émissive bien liée à l'image livrée ;
  - `npm run build` puis `npm run check:browser` (racine, bureau et mobile) : aucune erreur, aucune requête en échec ni hors origine ;
  - contrôle croisé avec les captures `qa/` de Codex.
- Remarque : le conseil d'introduction s'affiche en haut et masque le mur pendant au plus 9 secondes au premier lancement. C'est voulu (D023) pour ne jamais couvrir le bord de collecte.
- Correction nécessaire : aucune.
- Non vérifié : GPU réel et téléphone réel.
