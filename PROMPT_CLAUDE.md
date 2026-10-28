# Prompt de lancement — à donner à Claude

Tu travailles dans `/home/sebastien/projets/coin-cascade` sur mon ordinateur. Développe **Coin Cascade**, un beau coin pusher 3D, fun, réglable et entièrement jouable dans un navigateur. Tous les documents nécessaires sont présents ici.

## Lis d'abord

1. `AGENTS.md`, `CLAUDE.md` et `docs/STATUS.md`.
2. `docs/01-PRODUIT.md` et `docs/02-REGLES.md`.
3. `docs/03-ARCHITECTURE.md`, `config/game.yaml`.
4. `docs/04-DIRECTION-ARTISTIQUE.md`, `assets/manifest.json`.
5. `docs/05-REALISATION.md`, `docs/06-VALIDATION.md`, `docs/07-HEBERGEMENT.md` et `docs/08-COLLABORATION.md`.

## Ce que je veux

- Une vraie sensation de pièces qui glissent, s'empilent et tombent sous les poussées.
- Une rampe orientable, des collectes physiques, des pertes latérales et des objets spéciaux visibles.
- Des combos, une Fever, des pluies de pièces, une roue, des coffres et des pouvoirs.
- Un mode libre, un défi à réserve initiale définie et un bac à sable.
- Un menu opérateur avec paramètres, préréglages et import/export.
- Une sauvegarde locale et une interface française adaptée ordinateur et téléphone.
- Un projet statique générant `dist/`, publiable sur Render Static Site ou GitHub Pages.

## Répartition avec Codex

Tu écris le gros du code, y compris Three.js, Rapier, les géométries 3D, matériaux, lumières, caméra, animations, UI, sons procéduraux, tests et build.

**Codex s'occupera de la direction graphique et des images raster lorsque nécessaire.** Il a accès au même dossier mais ne reçoit pas automatiquement tes demandes. Pour une image, écris une demande précise dans `docs/art/requests/` et signale son chemin à l'utilisateur en fin de session. Tu continues les tâches indépendantes avec les fallbacks.

Ne cherche pas à remplacer la scène 3D par une grande illustration. Les pièces et les éléments mécaniques doivent être construits et animés en 3D. Les images servent à leur habillage, aux décors et aux illustrations.

## Ta première session

1. Inspecte l'environnement et choisis des versions compatibles actuellement disponibles. Crée le projet TypeScript/Vite dans **ce dossier**, sans écraser les documents ni ajouter un sous-dossier de projet inutile.
2. Installe Three.js, Rapier et les outils strictement utiles. Prévois la validation de la configuration et un lockfile.
3. Réalise une scène de prototype : caméra fixe, deux niveaux, pousseur cinématique, rampe déplaçable, pièces physiques, collecte avant, pertes latérales.
4. Ajoute un diagnostic simple : nombre de corps, temps de simulation, FPS, pièces tirées/collectées/perdues. Permets de recharger un scénario initial avec une seed.
5. Vérifie que la scène fonctionne, que le build statique passe et que les ressources se chargent sous un sous-chemin. Consigne les vérifications réellement effectuées.
6. Mets à jour `docs/STATUS.md` avec commandes, résultat, limites, décisions et prochain jalon. Ensuite, avance dans les jalons suivants autant que la session le permet.

## Méthode

La physique est le premier jalon, pas un détail reporté après les effets. Si l'empilement pose problème, simplifie les colliders et mesure avant d'ajouter de la décoration.

Les nombres fournis sont des hypothèses modifiables. Tu peux ajuster les paramètres et la structure selon les résultats ; documente les adaptations importantes. Ne passe pas une session à recréer un autre plan : les décisions principales sont prises.

Ne demande pas une validation pour chaque choix réversible. Si un détail n'est pas spécifié, adopte une option simple compatible avec les règles. Demande une clarification seulement si elle est réellement nécessaire pour poursuivre.

Pas de déploiement ou de création de dépôt distant pour cette première phase. Ne change pas le projet Huff Clone. Ne génère pas de fausses images finales et ne marque aucun asset comme livré tant que le fichier réel n'existe pas.

En fin de session, donne les commandes pour lancer le résultat, les limites connues, les contrôles effectués et les demandes graphiques à transmettre à Codex.
