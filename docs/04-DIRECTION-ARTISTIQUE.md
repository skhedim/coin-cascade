# Direction artistique et contrat visuel

## Identité

Arcade nocturne, métal bleu profond, or chaud, éclairages cyan et accents magenta. Une machine originale, sans reprendre la marque ou les illustrations d'une borne existante.

| Usage | Couleur de référence |
| --- | --- |
| Fond | `#080D1B` |
| Coque | `#14243D` |
| Panneaux | `#1C3551` |
| Or | `#F6BD54` |
| Cyan | `#54E5EC` |
| Magenta | `#ED69C1` |
| Texte clair | `#EEF5FF` |
| Texte secondaire | `#B4C7D8` |

La couleur ne porte jamais seule une information. Ajouter formes, symboles et libellés. Vérifier le contraste réel des textes.

## Caméra et composition

- Caméra fixe surélevée, perspective modérée. Les pièces proches du bord restent visibles.
- Bureau paysage : plateau au centre, compteurs en haut, commandes sous le plateau ; panneau opérateur en tiroir.
- Mobile portrait : compteurs compacts en haut, scène centrale, contrôles en bas. Adapter le cadrage 3D plutôt que réduire toute l'interface desktop.
- La borne n'a pas besoin d'être visible intégralement si cela rend le plateau illisible.
- Les grosses récompenses s'affichent au-dessus de la scène, sans couvrir durablement les sorties.

## Géométrie et matériaux — Claude

Construire procéduralement la coque, les plateaux, rebords, rampe, pousseur, roue, pièces, gemmes et coffres de base. Géométries simples et réutilisables, arrêtes lisibles, matériaux différenciés.

La pièce classique utilise une géométrie commune instanciée, une face circulaire texturable et une tranche métallique. Le matériau doit rester agréable sans texture externe. Une pièce dorée doit être distinguable même avec un éclairage réduit.

Employer un éclairage qui révèle l'épaisseur et les empilements. Contrôler le coût des ombres et du bloom ; pas de lumière temps réel par pièce. Le compteur ne dépend pas d'une texture générée.

Un modèle GLB très détaillé n'est pas requis. Si un modèle devient nécessaire, créer une demande séparée avec dimensions, pivot, axes, budget et format. Les images générées par Codex ne constituent pas une livraison de maillage 3D.

## Images et textures — Codex

Les images finales sont livrées selon `assets/manifest.json`, après stabilisation du cadrage ou des UV.

- Décor d'ambiance : sans textes ni machine jouable, suffisamment discret derrière la scène.
- Ornement de coque : vue plane, sans perspective ni lumière directionnelle déjà peinte.
- Faces de pièces : emblème original centré et lisible ; pas de photo de pièce oblique.
- Icônes illustrées : silhouettes lisibles à petite taille, fond transparent si requis.
- Visuel promotionnel : dernière étape, une fois le jeu existant.

Une texture de couleur n'est pas une normal map ou une carte de rugosité. Ne pas déduire automatiquement des cartes PBR fiables d'une illustration. Des matériaux procéduraux suffisent tant qu'aucun besoin réel n'est établi.

## UI

Textes HTML ou texte de rendu, jamais gravés dans une image nécessaire à la compréhension. Police système lisible au départ ; toute police ajoutée est embarquée avec sa licence. Boutons natifs stylés, états hover/focus/pressed/disabled, zones tactiles d'au moins environ 44 px CSS.

Les cadres, jauges et boutons sont faits en CSS/SVG lorsque cela est plus net et plus adaptable qu'un bitmap. Claude peut les réaliser définitivement. Codex prend surtout les illustrations et textures qui gagnent à être générées.

## Mouvement

- Collecte : flash local bref, quelques particules, points vers le compteur.
- Combo : palier indiqué sans grande fenêtre.
- Fever : transition d'éclairage, rythme sonore renforcé, compteur de temps.
- Barrières : mouvement mécanique visible aux côtés.
- Jackpot : présentation forte, résultat déjà fixé ; possibilité d'abréger le décompte.
- Mode effets réduits : supprimer secousses et flashes forts, diminuer particules et mouvements décoratifs.

## Qualité des exports

- PNG RGBA pour les petites ressources transparentes ; WebP pour les grands fonds opaques.
- Pas de blanc simulant la transparence, pas de bord noir/blanc autour des objets.
- Réserver une marge de sécurité dans les icônes.
- Export à la taille convenue après inspection ; ne pas supposer que le générateur respecte au pixel près le brief.
- Vérifier le rendu à la taille réellement utilisée, pas uniquement en grand.
- Préserver sources et variantes dans `assets/source/`; publier seulement les exports utiles dans `public/assets/`.

## Première passe graphique

Ne rien générer avant qu'une scène permette de juger les proportions. Première demande recommandée après J2/J3 : face de pièce classique, ornement de façade et fond paysage/portrait. Les icônes viennent quand leurs usages et dimensions sont confirmés. Voir `art/PROMPTS.md`.
