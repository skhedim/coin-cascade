# Décisions du projet

| ID | Date | Décision et raison |
| --- | --- | --- |
| D001 | 2026-10-28 | Projet séparé dans `projets/coin-cascade`, Huff reste une référence en lecture seule. |
| D002 | 2026-10-28 | Site statique sans backend : portabilité Render/GitHub Pages et fonctionnement local. |
| D003 | 2026-10-28 | Three.js + Rapier proposés pour une scène réellement 3D ; validation par prototype avant enrichissement. |
| D004 | 2026-10-28 | Claude développe le code, y compris la 3D procédurale ; Codex fournit direction artistique et images selon demandes. |
| D005 | 2026-10-28 | Les points sont multipliables, pas les retours de réserve par défaut : éviter une économie incontrôlée. |
| D006 | 2026-10-28 | Valeurs et dimensions initiales non validées, ajustables après mesures. |
| D007 | 2026-10-28 | Défi à réserve initiale de 100, gains réutilisables ; pas un défi à exactement 100 tirs. |
| D008 | 2026-10-28 | Aucun asset final avant stabilisation des usages/UV. Fallbacks obligatoires pour avancer. |
| D009 | 2026-10-28 | Pas de publication à cette étape ; préparer les configurations puis choisir avec l'utilisateur. |
| D010 | 2026-10-28 | Physique : `@dimforge/rapier3d-compat` 0.21 (WASM embarqué, aucun CDN), collider de pièce `roundCylinder`, `lengthUnit` 0,1 pour des tolérances à l'échelle de pièces de 11 cm. Mesuré au banc : l'enveloppe convexe 14 côtés enfonce des pièces et crée des anomalies ; le cylindre simple est correct ; le cylindre arrondi est le plus stable. |
| D011 | 2026-10-28 | Mécanique « penny falls » : une pièce ne fait avancer le tapis du plateau haut que si elle tombe dans la bande balayée par le mur de fond (course du pousseur). La goulotte descend donc de l'avant vers le mur ; sa première version, qui jetait les pièces au milieu du plateau, ne faisait rien tomber. |
| D012 | 2026-10-28 | Calibrage : profondeur 1,2, plateau haut 0,36, joues latérales pleines sur 0,45 m (pertes ramenées d'environ 50 % à 21 %), frottement pièce 0,12 et plateau 0,15. Au-delà de 0,2 entre pièces, les tas atteignent la sortie de la goulotte ; à 0,1, la nappe flue au repos. La cadence de 0,18 s n'est pas tenable physiquement : 0,35 s, avec refus sans débit quand la goulotte est occupée. |
| D013 | 2026-10-28 | Sorties : test géométrique à chaque pas plutôt que des capteurs Rapier. Le franchissement du plan sous le rebord classe l'objet (avant = collecte, côté = perte, ailleurs = anomalie). Le corps est retiré au même pas ; la chute qui suit n'est qu'une animation. Aucun double classement possible, ordre stable par identifiant. |
| D014 | 2026-10-28 | Le coffre a explicitement son collider boîte et une masse de 0,06 (configurés dans `machine.chest`) ; tous les autres objets partagent le collider et la masse de la pièce. |
| D015 | 2026-10-28 | Un jeton pouvoir donne une charge stockée, activée par un bouton (barrières, super poussée, onde de choc). Les barrières et la super poussée gagnées au coffre ou à la roue s'activent directement. Barrières et course changent uniquement à une frontière de cycle. |
| D016 | 2026-10-28 | Plafonds de charges et de cycles : l'excédent est conservé dans une réserve de droits et versé quand la charge redescend, jamais supprimé silencieusement. La file de distribution est bornée ; au plafond, l'offre d'objet spécial est reportée. |
| D017 | 2026-10-28 | Sauvegarde : JSON versionné dans IndexedDB (poses et vitesses des objets, pousseur, règles, états RNG), et non l'instantané binaire Rapier, pour rester portable entre versions. La reprise est exacte en positions mais pas bit à bit pour la suite (cache de contacts non sauvegardé). Si l'identifiant de règles diffère, nouvelle machine et progression conservée. |
| D018 | 2026-10-28 | Build à base relative (`./`) : le même `dist/` fonctionne à la racine et sous `/coin-cascade/` (contrôlé dans Chromium). Fichiers hachés dans `dist/bundle/`, images Codex dans `dist/assets/` avec un cache plus court. |
| D019 | 2026-10-28 | Réglages opérateur : surcharges locales validées par le schéma, appliquées par rechargement (machine reconstruite). Chaque préréglage a son identifiant de règles et ses records ; un ajustement manuel rend les nouvelles parties personnalisées. |
| D020 | 2026-10-28 | Outils TypeScript exécutés directement par Node ≥ 22.18 (suppression native des types), sans `tsx` ; les imports portent l'extension `.ts`, et `erasableSyntaxOnly` interdit les syntaxes non effaçables. |
| D021 | 2026-10-28 | Canvas WebGL transparent : le fond de page (dégradé de repli ou futures images `background.*`) reste visible autour de la borne. |
| D022 | 2026-10-28 | `cabinet.front-decal` habille le mur de fond derrière le plateau haut, le panneau décoratif le plus visible. Son contrat passe de 2048 × 1024 (2:1) à 2048 × 768 (8:3), la proportion réelle de la surface (1,06 × 0,3975 m). Changement documenté dans le manifeste et ART-002, avant toute génération. |
| D023 | 2026-10-28 | Tir automatique : 50 tirs au plus par activation, arrêt sur bonus majeur (Fever, roue, coffre, jackpot), sur réserve vide, à l'ouverture du menu et quand l'onglet est masqué ; un tir refusé ne coûte rien. Les conseils contextuels s'affichent en haut, dans la colonne des messages, pour ne jamais masquer le bord de collecte. |
| D024 | 2026-10-28 | Thèmes de borne purement visuels (couleurs des éclairages et de la coque), débloqués par trophée, sans boutique. Ils n'entrent pas dans l'identifiant de règles et ne changent ni physique ni records. |
| D025 | 2026-10-28 | Publication sur **GitHub Pages uniquement** (choix de l'utilisateur) ; `render.yaml` supprimé. Dépôt `skhedim/coin-cascade` créé privé : la création publique demande l'accord explicite de l'utilisateur. Pages gratuit exige un dépôt public : bascule en attente. Le workflow teste et construit avant chaque déploiement. |

Ajouter une entrée datée pour les changements structurants : problème observé, choix final et conséquence. Les réglages mineurs ne nécessitent pas une entrée par nombre.
