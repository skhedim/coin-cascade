# Catalogue des ressources graphiques

`manifest.json` décrit les ressources et leur contrat. **ART-001 et ART-002 livrent cinq images** : faces classique/dorée, décal du mur de fond et fonds paysage/portrait. Ces cinq entrées sont `ready`. Les huit autres restent `planned` et utilisent leurs fallbacks.

## Convention

- `id` : identifiant stable dans le code et les demandes.
- `path` : chemin relatif au dossier `public/`, sans slash initial. Le chargeur ajoute la base Vite.
- `status` : `planned` (absent), `ready` (fichier réel contrôlé), `deprecated` (ne plus utiliser).
- `batch` : `A` première passe après prototype ; `B` enrichissement facultatif une fois le style validé.
- `usage`, `width`, `height`, `transparent`, `colorSpace`, `maxBytes` : contrat de l'export destiné au jeu. Ces dimensions sont des cibles, pas une garantie du générateur.
- `fallback` : rendu que Claude implémente en attendant. Les valeurs de fallback sont descriptives, à relier à un registre de code.
- `notes` : contraintes de cadrage/UV.

Un asset `ready` peut être chargé ; un `planned` utilise immédiatement son fallback. Ne pas créer de fichiers vides ou de fausses images pour faire croire que la liste est complète.

## Couleur et transparence

Les exports listés sont des images de couleur en sRGB. Pour les textures Three.js, sélectionner l'espace colorimétrique approprié. La transparence est un vrai canal alpha ; ne pas simuler un fond transparent par un damier.

Les faces de pièces sont destinées aux faces planes du cylindre ; la tranche et l'effet de métal sont construits par le matériau et l'éclairage. Leur image ne doit pas contenir une perspective photographique ou une ombre portée sur un décor.

## Chemins

- `source/` : sources, variantes et gabarits, non publiés automatiquement.
- `../public/assets/` : exports compacts utilisés dans le jeu.
- `../docs/art/requests/` : briefs précis, comptes rendus et acceptation.
- `CREDITS.md` : provenance et droits connus des ressources réellement ajoutées.

Les caps de poids dans le manifeste sont des budgets d'export, ajustables si le rendu l'exige. Inspecter l'image et sa lisibilité après compression.

## Ressources qui n'ont pas besoin d'images

Pièces et tranche, gemmes, coffre simple, coque, pousseur, plateau, roue, boutons, jauges, libellés et logo typographique peuvent être faits en 3D/CSS/SVG. Les sept images de bonus sont facultatives : garder des pictogrammes natifs si leur lisibilité est meilleure.
