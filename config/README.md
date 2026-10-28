# Configuration de départ

`game.yaml` est une proposition complète des paramètres principaux pour guider l'implémentation, pas un fichier déjà consommé par un moteur existant. Claude doit créer le chargeur et le schéma de validation.

Les valeurs initiales, notamment dimensions, frottements, masses, fréquences et récompenses, doivent être ajustées à partir du prototype. Toute modification des règles se répercute dans `docs/02-REGLES.md`.

Unités : secondes simulées, cycles complets de pousseur, mètres de référence, kilogrammes de référence, points et unités de réserve entières. Les poids sont relatifs et normalisés par le moteur.

Séparer réglages visuels et règles pour les records. Refuser NaN, valeurs infinies, dimensions négatives, listes sans poids positif et plafonds incohérents. Les probabilités ne doivent pas être modifiées par le réglage de qualité graphique.

Préréglages à ajouter après J3 :

- Classique : profil de base équilibré par observation.
- Généreux : plus de réserve/récompenses et moins de pertes, règles identifiées séparément.
- Chaos : distributions et événements plus fréquents, avec les mêmes garde-fous de capacité.
- Détente : réserve libre et effets moins agressifs ; ne pas confondre avec un profil de défi standard.

La configuration publiée fournit les défauts de tous les visiteurs ; le menu applique des overrides locaux. Pas de menu administrateur distant caché.
