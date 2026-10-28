# Validation et scénarios utiles

Tester les règles et les risques réels. Pas de tests qui recopient simplement la structure du code. Documenter les commandes réelles dans le README une fois créées.

## Tests automatisés prioritaires

| Scénario | Attendu |
| --- | --- |
| Deux événements de collecte du même objet | Un seul paiement et un seul effet |
| Tir pendant pause, cadence bloquée ou capacité pleine | Aucun débit et aucune charge consommée |
| Tir gratuit + charge dorée | Une charge de chaque consommée, aucune pièce de réserve débitée |
| Objet perdu latéralement | Aucun gain, aucune étoile/roue/collection accordée |
| Franchissement de seuil combo | Ordre stable, formule correcte, plafond respecté |
| Plusieurs sorties au même tick | Résultat indépendant de l'ordre brut des événements du moteur |
| Pause et masquage d'onglet | Délais de jeu figés, pas de rattrapage massif |
| Roue sauvegardée avant résultat visuel | Même récompense après reprise, payée au plus une fois |
| Collection de gemmes complète | Un Grand, remise à zéro de la collection de session, album conservé |
| Bonus qui se redéclenchent | Plafonds et budgets respectés, aucune boucle non bornée |
| Import de config invalide ou trop volumineux | Erreur explicite, état courant conservé |
| Configuration opérateur en défi | Score marqué personnalisé |
| Réserve nulle puis collecte tardive | Reprise des tirs, pas de résultat prématuré |
| Fin au timeout de résolution | Transaction terminée proprement, limite indiquée au bilan |

## Scénarios physiques

- Plateau dense au centre et amas contre chaque paroi.
- Pièces empilées sur plusieurs épaisseurs, poussée prolongée, chute du plateau haut vers le bas.
- Frontière collecte/perte : pas de double classification.
- Activation des barrières près d'une pièce : pas d'éjection explosive.
- Course de super poussée : pas de traversée des limites.
- Onde de choc au milieu d'un amas : impulsion maîtrisée.
- Pluie proche du plafond d'objets : distribution temporisée, pas de disparition d'objets actifs.
- Reprise d'un plateau au repos et en mouvement.

Ne pas valider la physique uniquement avec des mocks. Observer une vraie simulation et consigner les paramètres utilisés.

## Navigateurs et appareils

Vérifier au minimum Chromium et Firefox si disponibles, puis Safari/iOS et Android réels si accessibles. Ne pas prétendre couvrir un appareil qu'on n'a pas testé. Les outils disponibles sur l'ordinateur déterminent la méthode ; ne pas exiger une infrastructure propriétaire.

Contrôles : visée tactile, zones de clic, focus clavier, resize, orientation, audio après premier geste, pause/reprise, stockage local et mode effets réduits.

## Performance

Scènes : plateau de 100 / 160 / 250 pièces ; capacité maximale configurée ; pluie + Fever ; session d'au moins 15 minutes.

Relever navigateur, appareil, qualité, FPS, temps physique p50/p95 si disponible, nombre de corps, draw calls et évolution de mémoire. Les cibles 60 FPS bureau / 30 FPS mobile sont à mesurer, pas à annoncer sans preuve. Si 320 objets ne sont pas réalistes, réduire le profil de règles au démarrage, pas silencieusement au milieu d'un défi.

## Build et chemins

- Installation propre via lockfile, types et build réussis.
- Prévisualisation du build, pas uniquement du serveur de développement.
- Essai à la racine et sous `/coin-cascade/`.
- Zéro ressource requise chargée depuis un CDN ou une URL de développement.
- Asset `planned` sans fichier : fallback propre, pas de 404 répétée.
- Asset `ready` volontairement indisponible : fallback et diagnostic utiles.
- Aucun secret, source artistique lourde ou sauvegarde personnelle dans `dist/`.

## Bilan à consigner

Dans `STATUS.md` : commandes passées, tests réussis/échoués, date, limites et risques restants. Séparer ce qui est testé automatiquement de ce qui a été observé manuellement.
