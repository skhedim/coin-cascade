# Consignes partagées — Coin Cascade

## Mandat

- L'utilisateur a validé un coin pusher web statique et réglable, avec bonus et scène 3D.
- Claude réalise le gros du code : règles, physique, rendu 3D, UI, audio, tests, build et préparation de l'hébergement.
- Codex réalise la direction artistique et les images raster lorsque nécessaire. Les géométries 3D, CSS, SVG simples et animations de code restent du ressort de Claude.
- Le dossier actuel est un kit de passation ; ne pas prétendre que le jeu est déjà réalisé.

## Avant de travailler

Lire `docs/STATUS.md`, puis les documents concernés. Pour démarrer l'implémentation, lire `PROMPT_CLAUDE.md` et suivre son ordre de lecture.

Les instructions directes de l'utilisateur priment sur ce dossier. Les règles du jeu sont décrites dans `docs/02-REGLES.md`. Les nombres de `config/game.yaml` sont des valeurs initiales non validées ; conserver leur cohérence avec les règles en cas de changement.

## Contraintes

- Travailler dans ce projet. Ne pas modifier `../perso/huff-clone` ; c'est une référence consultable.
- Aucun backend, compte, secret, paiement ou dépendance runtime à un CDN.
- Aucun travail graphique externe ne doit bloquer le prototype : créer des fallbacks procéduraux lisibles.
- Un réglage de qualité visuelle ne doit pas modifier les règles physiques d'un défi.
- Ne pas inventer un modèle 3D à partir d'une image : toute image de concept est une référence, pas une géométrie.
- Ne pas supprimer ou renommer les documents de passation au démarrage.
- Ne pas annoncer de tests, images ou déploiements qui n'ont pas été réalisés.

## Collaboration

- Mettre à jour `docs/STATUS.md` après chaque jalon ou fin de session.
- Consigner les modifications structurantes dans `docs/DECISIONS.md`.
- Pour les images : créer une demande dans `docs/art/requests/` selon `docs/08-COLLABORATION.md`.
- Préserver les identifiants de `assets/manifest.json`. Un changement de dimensions ou d'UV se documente avant une nouvelle livraison.
- Aucun agent n'a besoin de supposer que l'autre session est en cours. Les fichiers constituent la passation.
- Si les deux sessions travaillent en même temps, annoncer les chemins pris en charge dans `docs/STATUS.md` et éviter d'éditer le même fichier.

## Livrable technique

Un build statique `dist/`, une documentation de lancement, des configurations de publication, et des contrôles adaptés aux risques : comptabilité, collecte unique, reprise, bornes de bonus, import et construction statique.
