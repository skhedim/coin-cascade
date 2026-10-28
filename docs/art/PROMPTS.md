# Briefs de génération — réservés aux futurs lots Codex

Ces prompts sont des briefs préparatoires. ART-001 (A1, A3, A4) et ART-002 (A2, B1) ont été livrés le 2026-10-28 ; les prompts exacts exécutés sont conservés dans leurs dossiers `assets/source/ART-00X-.../` à la racine du projet. Les autres briefs restent non exécutés. Adapter chaque brief à la demande et aux captures du prototype.

## Avant chaque génération

1. Lire la demande, le manifeste et `../04-DIRECTION-ARTISTIQUE.md`.
2. Vérifier la géométrie, le cadrage et le gabarit UV si la ressource est une texture.
3. Pour une variante ou édition, inspecter l'image de référence et préserver l'identité visuelle.
4. Générer avec le vrai mode de transparence lorsque demandé. Exporter à la taille cible et contrôler le résultat ; une mention dans le prompt ne garantit ni alpha ni dimensions exactes.
5. Livrer selon `../08-COLLABORATION.md`, avec source originale et export réel.

## Direction commune à inclure dans les briefs

> Original premium arcade art for a browser coin-pusher game named Coin Cascade. Deep midnight navy, warm gold, restrained electric cyan and magenta accents. Bold readable shapes, coherent materials, playful mechanical elegance. Avoid visual clutter and excessive neon bloom. No existing brands, no casino machine imitation, no watermark. Do not include letters, numbers, labels, UI panels or essential text; those are rendered separately in code.

## A1 — Face de pièce classique

ID : `coin.face.classic`. Export cible : PNG RGBA, 512 × 512.

> Create a single original circular coin-face color design, viewed perfectly straight-on, orthographic, centered in a square transparent canvas. A simple cascading-wave emblem inside a thick ornamental ring, warm gold with a restrained cyan enamel accent. The full circle fits within 88 percent of the canvas width and height. Flat texture artwork suitable for mapping onto the flat cap of a 3D cylinder. Clear large features that remain legible on a small in-game coin. No perspective, no visible coin thickness, no cast shadow, no environment, no directional lighting baked into the image, no lettering, no numbers. Outside the circular design is genuinely transparent. The game engine supplies metallic lighting and geometry.

Faire confirmer l'orientation de la face et le mapping circulaire. Ne pas générer un rendu photographique de pièce posée sur une table.

## A2 — Ornement de façade

ID : `cabinet.front-decal`. Export cible : PNG RGBA, 2048 × 768, rapport 8:3 (contrat révisé par ART-002).

> Create a flat decorative decal for a wide 8:3 arcade back-wall panel using the supplied UV template as the layout reference. Original symmetrical flowing coin-cascade ornaments in warm gold and subtle cyan enamel. Keep the main motifs in the upper safe band and the lower region transparent according to the template. Isolated ornament shapes on a genuinely transparent background. Straight-on, no perspective, no cabinet geometry, no screws, no text, no fake controls, no cast shadows, no photoreal directional reflections. Designed to overlay a navy material in a real-time 3D scene.

Gabarit livré par Claude : `docs/art/templates/back-wall-decal-uv.svg`. Le prompt ne remplace pas le gabarit. Si le panneau change de proportions, mettre à jour la demande avant de produire. Prompts exacts et export livré : dossier source ART-002.

## A3 — Fond paysage

ID : `background.landscape`. Export cible : WebP opaque, 1920 × 1080.

> A refined dark arcade-lounge atmosphere for the background behind a playable 3D coin-pusher machine. Wide 16:9 composition. Midnight navy architecture, soft cyan and magenta accents concentrated at the far left and right edges, occasional warm golden light. The central sixty percent is dark, calm, low contrast and largely free of objects so the actual game machine can be rendered over it. Soft depth, subtle texture, no sharply detailed distractions. No foreground machine, no coins blocking the center, no characters, no screens with text, no logos, no lettering. Original stylized real-time game aesthetic, restrained glow.

## A4 — Fond portrait

ID : `background.portrait`. Export cible : WebP opaque, 1080 × 1920.

> Create a vertical 9:16 companion background to the supplied Coin Cascade landscape reference, preserving its original architecture, navy palette and restrained cyan, magenta and warm gold lighting. Recompose for portrait rather than stretching or cropping the landscape. Keep the tall central region dark and quiet for a 3D game machine and controls. Accent lights near the outer edges. No foreground machine, no text, no logo, no characters, no sharp distracting focal point.

Créer après sélection du paysage, en réutilisant sa référence.

## B1 — Face dorée

ID : `coin.face.gold`. Même contrat UV que A1.

Reprendre la face classique comme référence et remplacer l'emblème central par une étoile géométrique lisible, avec distinction de silhouette et d'accent. Palette plus dorée, même cercle, marge et style. Ne pas se contenter de changer légèrement la teinte d'une pièce autrement identique.

## B2 — Illustrations de bonus, si utiles

IDs : `bonus.fever`, `bonus.coin-rain`, `bonus.barriers`, `bonus.super-push`, `bonus.shockwave`, `bonus.free-shots`, `bonus.golden-shots`.

Exporter **un fichier par icône**, PNG RGBA 512 × 512. Ne pas livrer une planche à découper comme seul résultat. Valider d'abord une icône à la taille d'usage, puis garder la même référence de style pour les autres.

> A single premium arcade bonus icon for Coin Cascade: [SUBJECT]. Bold compact silhouette, warm gold metal with restrained cyan or magenta enamel matching the supplied approved style reference. Subtle dimensional illustration, clean separations and very readable at small size. Centered with at least twelve percent transparent padding on every edge. Genuine transparent background. No badge frame unless requested, no surrounding scene, no text, no letters, no numbers, no multiple unrelated icons.

Sujets :

- Fever : étoile énergique et petite flamme magenta/or.
- Pluie : trois ou quatre pièces descendantes, directions lisibles.
- Barrières : deux protections cyan autour d'une pièce dorée.
- Super poussée : plaque mécanique avec deux flèches vers l'avant.
- Onde de choc : pièce centrale et deux anneaux d'impulsion.
- Rafale gratuite : trois pièces et une courte traînée de lancement cyan.
- Tirs dorés : pièce étoilée avec un éclat chaud et un accent magenta.

Ne pas remplacer un pictogramme SVG plus lisible par une illustration plus chargée simplement pour utiliser une image générée.

## B3 — Emblème de marque

ID : `brand.emblem`. PNG RGBA 1024 × 1024.

> Original compact emblem of three coins cascading in a clear flowing diagonal, conveying a chain reaction. Warm gold with one restrained cyan accent, matching the Coin Cascade visual identity. Simple memorable silhouette, centered on a genuinely transparent square canvas, generous padding, readable as a small app emblem. No letters, no wordmark, no numbers, no surrounding machine, no existing brand symbols.

Le nom du jeu est composé en texte dans l'interface. Favicon et petites variantes peuvent être construits par Claude à partir d'un SVG simple avant la livraison éventuelle de cet emblème.

## Concept de machine — seulement si le cadrage nécessite une référence

Un concept peut aider à choisir la coque, mais ne devient ni un fond qui remplace le jeu ni un fichier GLB. Le demander explicitement avant génération ; ne pas détourner le premier lot en une série d'illustrations sans usage.

> Design reference for an original compact arcade coin-pusher cabinet, front elevated three-quarter view with shallow perspective. Deep navy metal shell, warm gold mechanical trim, cyan edge lighting, restrained magenta accents. Two clearly visible coin shelves, a moving upper pusher, adjustable drop chute, open readable front collection edge and side-loss channels, compact bonus wheel above. The actual coin field is the visual priority. No branded machine, no lettering, no unreadable fake UI. Clean practical shapes that can be reconstructed using simple real-time 3D geometry. This is concept art, not a game-ready 3D asset.
