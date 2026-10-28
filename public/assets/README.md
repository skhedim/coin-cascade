# Exports utilisés par le jeu

ART-001 livré le 2026-10-28 : `coins/classic-face.png`, `backgrounds/arcade-landscape.webp` et `backgrounds/arcade-portrait.webp`. Les trois fichiers sont réels, contrôlés et marqués `ready` dans le manifeste.

ART-002 livré le 2026-10-28 : `cabinet/front-decal.png` (2048 × 768) et `coins/gold-face.png` (512 × 512), PNG RGBA réels, contrôlés et marqués `ready`.

Les dossiers `bonus/` et `brand/` seront créés lors de futurs lots. Une entrée du manifeste passe à `ready` uniquement après existence et inspection du fichier réel. Ne pas créer de fichiers image vides pour les entrées `planned`.

Vite copie le contenu de `public/` dans le build. Ne pas y placer les sources lourdes, variantes abandonnées ou informations privées.
