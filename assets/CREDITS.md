# Provenance des ressources

Au 28 octobre 2026, ART-001 et ART-002 livrent cinq images finales générées avec l'outil OpenAI `image_gen` intégré, à partir des briefs du projet. Aucune police additionnelle, musique, son enregistré ou modèle externe n'est livré. Les entrées `planned` du manifeste ne sont pas des ressources existantes.

Pour chaque ajout réel, consigner : ID, chemin source, export, auteur/provenance, outil et date si génération, référence à la demande, conditions/licence connues et attribution nécessaire.

Ne pas inventer de licence ou déclarer une ressource « libre de droits » sans base. Ne pas utiliser de visuels provenant d'une autre machine de casino. Les licences des bibliothèques et polices installées seront ajoutées par Claude au moment de leur introduction.

| ID réel | Source / outil | Date | Conditions connues / attribution | Demande |
| --- | --- | --- | --- | --- |
| `coin.face.classic` | `source/ART-001-face-piece-et-fonds/coin-v2-original.png`, image_gen intégré ; révision de la v1 générée | 2026-10-28 | Création générée pour ce projet ; aucune licence tierce déclarée. PNG réduit et optimisé, alpha du générateur conservé. | ART-001 |
| `background.landscape` | `source/ART-001-face-piece-et-fonds/landscape-original.png`, image_gen intégré | 2026-10-28 | Création générée pour ce projet ; aucune image externe importée ni licence tierce déclarée. Export WebP. | ART-001 |
| `background.portrait` | `source/ART-001-face-piece-et-fonds/portrait-original.png`, image_gen intégré avec le paysage comme référence | 2026-10-28 | Recomposition du paysage de ce projet ; aucune licence tierce déclarée. Export WebP. | ART-001 |
| `cabinet.front-decal` | `source/ART-002-decal-mur-et-piece-doree/decal-v3-original.png`, image_gen intégré | 2026-10-28 | Création générée pour ce projet ; aucune source externe importée ni licence tierce déclarée. Placement dans la zone sûre et compression PNG, alpha du générateur préservé. | ART-002 |
| `coin.face.gold` | `source/ART-002-decal-mur-et-piece-doree/gold-original.png`, image_gen intégré avec la face classique du projet comme référence | 2026-10-28 | Variante originale générée pour ce projet ; aucune licence tierce déclarée. Réduction en PNG RGBA. | ART-002 |

Les géométries et sons originaux créés dans le code peuvent être décrits comme procéduraux ; cela n'autorise pas à qualifier une image planifiée de livrée.

Prompts exacts et source de la première variante non retenue : `source/ART-001-face-piece-et-fonds/`. Les exports livrés sont sous `public/assets/` à la racine du projet, selon le manifeste. Aucun appel API/CLI de génération n'a été utilisé : uniquement l'outil intégré. Pillow est utilisé pour le redimensionnement, l'export et la compression, pas pour dessiner les ressources.

Les quatre prompts et quatre sorties originales d'ART-002 sont conservés dans `source/ART-002-decal-mur-et-piece-doree/` (trois propositions de décal, une face dorée). Les variantes non retenues ne sont pas publiées.

## Bibliothèques embarquées dans `dist/`

Ajoutées le 2026-10-28. Versions exactes fixées par `package-lock.json`.

| Bibliothèque | Version | Licence | Usage |
| --- | --- | --- | --- |
| three | 0.186.1 | MIT | Rendu 3D WebGL, géométries, matériaux |
| @dimforge/rapier3d-compat | 0.21.0 | Apache-2.0 | Moteur physique (WebAssembly embarqué) |
| zod | 4.6.7 | MIT | Validation de la configuration et des sauvegardes |
| yaml | 2.9.1 | ISC | Lecture de `config/game.yaml` |

Les licences complètes sont dans `node_modules/<paquet>/LICENSE`. Les outils de développement (TypeScript, Vite, Vitest, Playwright) ne sont pas publiés dans `dist/`.

## Créations procédurales du code

Géométrie de la borne, pièces, gemmes, coffres, textures de faces et de plateaux (canvas), pictogrammes SVG, favicon, sons Web Audio : créés dans le code de ce projet. Ils servent de fallbacks aux entrées `planned` du manifeste, sans les rendre « livrées ».
