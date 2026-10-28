# Architecture proposée

## Stack

TypeScript strict, Vite, Three.js et Rapier 3D. UI HTML/CSS. YAML pour la configuration avec validation de schéma (Zod ou équivalent). Web Audio pour les premiers sons. GSAP seulement si cela simplifie réellement une animation de présentation.

Choisir des versions compatibles au moment de l'installation, les verrouiller via lockfile. Ne pas recopier les numéros de version de Huff sans vérification. Rapier doit être initialisé avant la création du monde ; ses fichiers nécessaires doivent être inclus au build, pas chargés d'un CDN distant.

## Structure à créer

```text
src/
  main.ts
  engine/         règles pures, RNG, tables, score, économie
  physics/        monde, corps, colliders, pousseur, sorties
  game/           orchestration, tick, modes, bonus, progression
  render/         Three.js, caméra, géométries, matériaux, effets
  ui/             HUD, contrôles, opérateur, tutoriel, accessibilité
  audio/          mixage, sons procéduraux, remplacement optionnel
  persistence/    état versionné, transactions, migration, import
  config/         lecture et validation de config/game.yaml
  assets/         résolution des IDs du manifeste et fallbacks
tools/            mesures/scénarios utiles, sans framework interne inutile
```

Scripts attendus après initialisation : `dev`, `build`, `preview`, `typecheck`, `test`. `build` contrôle les types puis génère `dist/`. Ajouter un outil de simulation seulement une fois les règles physiques exploitables.

## Frontières

- Le moteur de règles ne dépend ni du DOM ni de Three.js.
- La physique émet des candidats à la collecte, jamais un paiement direct.
- Le contrôleur applique les transactions et émet les événements de présentation.
- Le rendu consomme l'état et les événements ; il ne décide jamais des gains.
- Les animations et sons peuvent être abrégés sans modifier le résultat.

Enveloppe d'événement recommandée : `id`, `sessionId`, `tick`, `type`, `payload`. Événements utiles : `ShotAccepted`, `ObjectCollected`, `ObjectLost`, `ComboChanged`, `BonusQueued`, `BonusStarted`, `BonusEnded`, `WheelResultCommitted`, `JackpotAwarded`.

## Physique

- Repère : X gauche/droite, Y vertical, Z vers l'avant du joueur ; gravité sur -Y. Une unité correspond à un mètre de référence, non à une taille imposée d'objet réel.
- Pas fixe initial 1/60 s, interpolation visuelle et rattrapage borné. Aucun gros delta après pause.
- Pousseur cinématique piloté à chaque tick, avec déplacement continu. Les bonus modifient sa trajectoire aux frontières de cycle.
- Pièces : cylindre visuel, collider convexe simplifié à tester. Éviter les trimeshes dynamiques et les colliders trop fins.
- Sols/rebords : volumes de collision simples. Tester l'absence de fentes et de tunneling.
- Commencer par 160 objets, plafond de distribution 320 à confirmer sur les appareils ciblés.
- Les corps au repos peuvent dormir puis se réveiller par contact. Ne pas désactiver définitivement leurs collisions.
- Les objets passent derrière une limite de sortie réelle avant retrait. Une boîte de sécurité rattrape les chutes anormales et les journalise séparément des pertes prévues.

Benchmark initial : 100 / 160 / 250 pièces, avalanche, gros amas, barrières et pluie. Mesurer CPU physique et GPU séparément. Un worker physique reste une optimisation ultérieure conditionnée aux mesures.

## Aléatoire et reproduction

RNG avec seed sauvegardée et état sérialisable pour les distributions/récompenses. Séparer si possible les flux gameplay et effets cosmétiques. Le rendu ne consomme pas le flux de récompenses.

Une seed seule reproduit la disposition/tirages selon les mêmes versions, pas nécessairement une partie complète : les actions doivent être journalisées avec leurs ticks et les versions de moteur/paramètres fixées. Ne pas promettre une égalité de score cross-browser sans vérification.

## Configurations

`config/game.yaml` = valeurs de départ, contrôlées au build/démarrage. Overrides locaux validés dans le menu. Un import invalide ne remplace pas la configuration active.

Trois catégories explicites :

- En direct : volumes, effets, certaines valeurs de présentation.
- À la prochaine action/frontière de cycle : nouvelles distributions et durées futures.
- Reconstruction de machine/session : dimensions, masses, friction, géométrie, seed.

Calculer un identifiant de règles à partir de la configuration normalisée et de la version de règles ; exclure les options purement visuelles des clés de record.

## Sauvegarde

IndexedDB pour un snapshot cohérent : état logique + snapshot physique compatible + mapping IDs/corps + ticks, files, résultats en attente et RNG. Petites préférences éventuellement dans localStorage.

Sauvegarder à une frontière de tick après résolution des transactions, jamais pendant un paiement. Une écriture IndexedDB atomique remplace le checkpoint précédent. Temporiser les écritures, sauvegarder après événement majeur et au changement de visibilité si possible ; signaler qu'une fermeture brutale peut perdre les dernières secondes.

Persistés : version de format, version des règles/physique, configuration normalisée, sessionId, tick, phase du pousseur, objets actifs, réserves, score, jauges, bonus, charges, roue engagée/récompensée, statistiques, collections, état RNG.

Au chargement : validation, limites de taille/nombre, compatibilité, puis restauration. Si le format physique est incompatible, proposer une nouvelle machine en conservant la progression récupérable. Ne pas présenter un reset physique comme une reprise exacte.

Export JSON versionné, import confirmé par récapitulatif, sauvegarde de secours avant remplacement. Si stockage indisponible : jeu en mémoire avec information lisible. Une seconde fenêtre ne doit pas écraser silencieusement la session active : détecter le conflit, proposer une session séparée ou un mode lecture.

## Ressources graphiques

Résolution par IDs stables de `assets/manifest.json`. Aucun accès réseau n'est nécessaire pour un asset `planned` : utiliser directement son fallback pour éviter des 404 répétées. Un fichier `ready` qui échoue au chargement retombe également sur un fallback et produit un diagnostic.

URLs construites avec la base de Vite, jamais `'/assets/...'` supposé à la racine du domaine. Le manifeste source dans `assets/` doit être importé/copié explicitement par le build, car Vite ne le publiera pas automatiquement.
