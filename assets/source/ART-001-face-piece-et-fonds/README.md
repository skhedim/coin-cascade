# ART-001 — Sources et exports

Lot produit par Codex le 2026-10-28 avec l'outil `image_gen` intégré. Demande : `docs/art/requests/ART-001-face-piece-et-fonds.md` à la racine du projet. Aucun changement du code principal.

## Originaux conservés

| Fichier | Dimensions | Usage |
| --- | --- | --- |
| `coin-v1-original.png` | 1254 × 1254 RGBA | Première proposition, non retenue : bord et relief trop présents |
| `coin-v2-original.png` | 1254 × 1254 RGBA | Face classique retenue, motif de trois vagues et émail cyan |
| `landscape-original.png` | 1672 × 941 RGB | Décor paysage retenu |
| `portrait-original.png` | 941 × 1672 RGB | Recomposition portrait du même décor |

Les fichiers `prompt-*.txt` sont les prompts exacts des quatre appels. La révision de pièce référence `coin-v1-original.png` ; le portrait référence `landscape-original.png`. Les sorties originales du générateur ont été copiées dans ce dossier, pas déplacées.

## Exports finaux à la racine du projet

| Chemin | Dimensions / format | Poids |
| --- | --- | --- |
| `public/assets/coins/classic-face.png` | 512 × 512 PNG RGBA | 102 914 octets |
| `public/assets/backgrounds/arcade-landscape.webp` | 1920 × 1080 WebP RGB | 125 984 octets |
| `public/assets/backgrounds/arcade-portrait.webp` | 1080 × 1920 WebP RGB | 104 522 octets |

Total : 333 420 octets. Les trois exports respectent leurs budgets du manifeste. `export-report.json` contient les mesures réelles.

La face est réduite avec Lanczos et une palette de 128 couleurs réexportée en RGBA, en conservant l'alpha original à la résolution finale. Les fonds sont exportés en WebP qualité 88. `export-assets.py` décrit exactement ces opérations de conditionnement et refuse d'écraser des exports existants. `coin-export-candidate.png` est la copie de contrôle identique au PNG final.

## Intégration

- Trois IDs du manifeste passent à `ready` ; le code de Claude les charge déjà automatiquement.
- Carte couleur sRGB seulement pour la pièce. Aucune normal map, rugosité ou géométrie livrée.
- L'alpha est réel (0 à 255, coins transparents). Le disque généré déborde légèrement le disque UV de 88 % : c'est une marge de couleur, pas un changement d'UV. Aucun ajustement du code requis.
- Les deux fonds sont des compositions distinctes du même décor, avec centre sombre, cyan à gauche et magenta à droite.
- Les textes, boutons et compteurs restent rendus par le jeu.
- Aucun asset de façade ni modèle 3D n'a été produit : ils ne sont pas demandés dans ce lot.

## Contrôles

Dimensions, formats, budgets et alpha vérifiés ; originaux et exports inspectés visuellement. Build de production réussi. Les fichiers image de `dist/` sont identiques aux exports de `public/`.

`node assets/source/ART-001-face-piece-et-fonds/verify-browser.mjs` a réussi les quatre combinaisons racine/sous-chemin et bureau/mobile, en vérifiant le PNG et le fond attendu (HTTP 200), sans erreur console ni requête en échec/hors origine. Rapport : `qa/browser-report.json` ; captures : `qa/assets-{root,subpath}-{desktop,mobile}.png`. La boucle est figée avant capture et le profil visuel est bas, pour limiter le coût du rendu logiciel WSL2. La planche `qa/coin-rotations.png` vérifie la lisibilité de la texture à 45/60 px sous six rotations.

La tentative du contrôle général animé (`npm run check:browser`, qualité moyenne) a été interrompue après sa première capture bureau à cause de la lenteur de capture sous SwiftShader. `qa/racine-desktop-depart.png` en est un aperçu, pas la preuve d'un contrôle général réussi. Voir la demande pour le bilan détaillé.

La livraison reste au statut `delivered` : Claude renseigne l'acceptation finale dans la rubrique Intégration de la demande. Les essais headless ne remplacent pas une vérification du rendu sur GPU ou téléphone réel.
