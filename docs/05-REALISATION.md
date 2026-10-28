# Réalisation par jalons

Chaque jalon laisse un projet jouable ou vérifiable. Mettre à jour `STATUS.md` avec le dernier jalon réellement validé et les limites. Une case terminée implique un résultat observé, pas seulement du code écrit.

## J0 — Initialisation

- Créer package, TypeScript strict, Vite, lockfile, point d'entrée et scripts.
- Installer Three.js/Rapier, initialiser la physique avec un écran de chargement utile.
- Lire/valider le YAML et établir la base des chemins de ressources.
- Préparer la page française, le canvas, un HUD temporaire et un message en cas de WebGL indisponible.
- Contrôler types, build et chargement sous sous-chemin.

**Sortie :** commandes de lancement documentées, scène vide fonctionnelle, `dist/` généré. Ne pas attendre les images.

## J1 — Sensation physique

- Construire les deux niveaux, pousseur, rebords, rampe et capteurs.
- Lancer des pièces depuis une position réglable, avec cadence et débit atomiques.
- Précharger environ 160 objets et afficher le diagnostic physique.
- Rendre les formes provisoires agréables : métal, or, lumière et caméra cohérentes.
- Tester empilements, poussées, avalanche et pertes pendant plusieurs minutes.
- Ajuster proportions, épaisseur, colliders, frottements et trajectoire du pousseur.

**Sortie :** les pièces se poussent et tombent de manière lisible, pas de fuite massive ni tremblement permanent, mesures consignées sur la machine de développement.

## J2 — Partie de base

- Comptabilité, score, réserve, collecte unique et historique court.
- Modes libre et défi avec résolution de fin ; reset explicite.
- Commandes clavier/tactile, maintien, pause, gestion du masquage d'onglet.
- Sauvegarde et reprise des objets et de l'état logique.
- Premiers sons synthétiques, volume et retour visuel de collecte.

**Sortie :** une vraie session peut se jouer, se fermer et se reprendre sans double gain connu. Test manuel téléphone réel si disponible ; sinon limite signalée.

## J3 — Première version fun

- Pièces dorées, distribution des spéciaux, étoiles et combos.
- Fever et pluie de pièces, files bornées et limites de redéclenchement.
- HUD lisible, effets et audio gradués.
- Créer les premières demandes d'images selon les cadrages et UV désormais connus.

**Sortie :** première boucle avec réactions en chaîne, sans dépendre des images finales. Analyser les gains et la fréquence des événements avant d'ajouter davantage.

## J4 — Bonus complets

- Jetons roue, roue pondérée, résultat persistant avant animation.
- Coffres, barrières, super poussée, onde de choc, rafale et tirs dorés.
- Gemmes, collection de session, album persistant et jackpots.
- Résolution des interactions entre pouvoirs, pause de présentation et fin de défi.

**Sortie :** tous les bonus peuvent être forcés dans le bac à sable et joués sans gain dupliqué ou boucle de génération illimitée.

## J5 — Opérateur et progression

- Menu opérateur avec catégories, bornes, explications et indication des paramètres nécessitant une reconstruction.
- Export/import de réglages et de sauvegardes ; préserver les données existantes en cas d'échec.
- Préréglages Classic/Généreux/Chaos/Détente construits comme variantes validées du même schéma.
- Bac à sable, diagnostics, placement et déclenchements de test.
- Records par règles, statistiques, trophées et premiers thèmes simples.
- Auto limité, arrêt sur bonus et tutoriel contextuel.

**Sortie :** changer de profil fonctionne, les réglages persistent et les scores personnalisés restent distingués des défis standard.

## J6 — Intégration artistique et robustesse

- Intégrer les livraisons Codex prêtes, conserver les fallbacks.
- Ajuster éclairage, cadrage, matériaux, contraste et sons.
- Profils de qualité visuelle, effets réduits, responsive et confort tactile.
- Mesurer plateau chargé/pluie/partie longue ; corriger les problèmes constatés.
- Tester imports, stockage indisponible, changement de version et seconde fenêtre.

**Sortie :** résultat cohérent et utilisable sur les configurations effectivement testées ; limites non testées écrites.

## J7 — Livraison statique

- Passer les validations nécessaires de `06-VALIDATION.md`.
- Préparer le workflow GitHub Pages selon `07-HEBERGEMENT.md` (Render abandonné, D025).
- Vérifier chemins de ressources, chargement Rapier, build propre et documentation.
- Compléter crédits, sources des ressources et instructions de publication.

**Sortie :** build `dist/` et sources prêts à publier. Publication seulement après choix explicite de l'utilisateur.

## Après la version complète

Installation/offline via PWA, défis datés, nouveaux thèmes, son enregistré et modèle de coque détaillé si cela apporte un gain réel. Aucun de ces ajouts ne bloque J0–J7.
