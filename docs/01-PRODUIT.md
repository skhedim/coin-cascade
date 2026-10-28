# Produit et périmètre

## Promesse

Une machine d'arcade originale, spectaculaire mais lisible, où chaque pièce peut provoquer une cascade. Le joueur vise une zone, choisit son timing et poursuit des récompenses visibles sur le plateau.

Nom : **Coin Cascade**. Langue initiale : français. Pièces et récompenses virtuelles. Jeu local par navigateur, sans connexion à un compte.

## Machine

- Vue frontale surélevée, légère perspective, caméra fixe pendant les tirs.
- Plateau supérieur mobile et plateau inférieur de réception.
- Rampe de lancement déplaçable horizontalement.
- Collecte à l'avant, pertes sur les côtés, zones distinctes et visibles.
- Plateau préchargé ; quelques objets convoités apparaissent assez près du bord pour offrir un objectif immédiat.
- Roue, jauge Fever et compteurs intégrés visuellement à la borne.

Le joueur doit voir les pièces près du bord et anticiper une chute. Un coffre se gagne lorsqu'il tombe ; il ne se téléporte pas dans la réserve parce que sa jauge est pleine.

## Boucles

1. Seconde : viser, tirer, regarder le déplacement, entendre la collecte.
2. Minute : préparer une avalanche, récupérer un coffre, terminer une collection de jetons.
3. Session : déclencher Fever et roue, améliorer son record, compléter une collection.
4. Long terme : apparences et trophées, sans imposer de rendez-vous ou connexion quotidienne.

## Modes

| Mode | Fonctionnement | Records |
| --- | --- | --- |
| Libre | Machine persistante, réserve et recharge manuelle gratuite | Statistiques locales identifiées par configuration |
| Défi | Réserve initiale de 100 tirs, les gains créditent normalement la réserve ; pas de recharge manuelle | Record par version de règles, preset et seed/scénario |
| Bac à sable | Réserve illimitée, placement d'objets et forçage des bonus | Exclus des records de défi |

Le défi peut durer plus de 100 tirs : 100 est la **réserve initiale**, pas une limite absolue de tirs. Un futur défi « exactement 100 tirs » doit être un mode explicitement différent.

En défi, toute modification opérateur affectant les règles bascule la session en personnalisée et exclut son score des records standard. Les réglages audio/visuels restent libres.

## Commandes

- Ordinateur : souris pour la rampe ; clic/espace pour tirer ; flèches pour viser ; Échap pour pause/menu.
- Mobile : glisser sur une zone de visée et bouton de tir distinct. Pas de tir accidentel à l'ouverture d'un menu.
- Maintien = répétition à cadence bornée ; bouton d'auto avec limite et arrêt sur bonus majeur.
- Pause réelle et arrêt de simulation quand l'onglet est masqué. Pas de rattrapage physique massif à la reprise.
- Éviter que les raccourcis se déclenchent dans un champ de saisie.

## Fonctionnalités cibles

- Pièces normales, dorées, étoiles, jetons roue, gemmes, coffres, jetons pouvoir.
- Combos et Fever qui multiplient les points.
- Pluie de pièces, barrières, super poussée, onde de choc, rafale gratuite, tirs dorés.
- Roue pondérée et quatre jackpots locaux.
- Sauvegarde, export/import, collections et trophées.
- Menu opérateur, préréglages, diagnostic et statistiques.
- Rendu adaptatif, sons réactifs et mode effets réduits.

Voir `05-REALISATION.md` pour la répartition progressive. Pas de multijoueur, classement mondial sécurisé, compte, argent réel ou backend dans la version cible.

## Progression

Première collection : cinq gemmes distinctes. Album persistant de découverte et collection de session sont séparés. La collection de session déclenche le Grand et repart à zéro ; l'album conserve les découvertes.

Premiers trophées : chaîne de 30 pièces, premier coffre, premier Grand, coffre sauvé pendant les barrières. Les apparences se greffent ensuite sur des identifiants de thème ; ne pas construire une boutique pour le prototype.

## Sensation attendue

Un tir donne un retour visuel immédiat. Les gains restent compréhensibles. Les petits succès restent brefs ; une grosse animation est réservée aux événements importants et peut être abrégée. Aucun panneau ne doit cacher durablement le bord du plateau.
