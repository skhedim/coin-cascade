# Collaboration Claude / Codex sur le même ordinateur

## Responsabilités

| Travail | Responsable principal |
| --- | --- |
| Gameplay, économie, modes, sauvegardes et configuration | Claude |
| Physique, géométrie 3D, UV, caméra et lumières | Claude |
| UI HTML/CSS, SVG simples, animations et sons procéduraux | Claude |
| Direction artistique et images raster originales | Codex |
| Intégration des images et tests dans le jeu | Claude, avec retours visuels Codex |
| Choix de publication et arbitrages de préférence | Utilisateur |

Ce partage n'empêche pas un correctif ciblé par l'autre assistant quand l'utilisateur le demande. Il évite surtout de produire deux implémentations concurrentes.

## Fonctionnement réel

Même disque ne signifie pas communication automatique. Claude laisse une demande et un état ; l'utilisateur lance Codex sur ce dossier et lui demande de traiter les demandes ouvertes. Codex livre les fichiers et un compte rendu ; l'utilisateur fait reprendre Claude.

Si les deux sessions sont actives, privilégier des chemins disjoints : Claude édite `src/` et le code ; Codex édite `assets/source/`, `public/assets/` et sa demande graphique. Le manifeste est un fichier partagé : éviter l'édition simultanée, ou laisser Claude intégrer la modification décrite dans le compte rendu. Ne pas remplacer un fichier modifié par l'autre session sans le relire.

## Demande de Claude

1. Copier `art/requests/TEMPLATE.md` vers `art/requests/ART-001-nom.md` (puis incrémenter).
2. Indiquer l'ID du manifeste, la cible, la taille, la transparence et la marge utile.
3. Joindre si possible une capture locale de la scène et, pour une texture, un gabarit UV exporté. Donner des chemins réels, pas des fichiers imaginaires.
4. Décrire l'usage, le cadrage et les contraintes sans proposer une texture dont l'UV n'est pas fixé.
5. Lister les chemins qu'on peut modifier et les critères d'acceptation.
6. Mentionner la demande dans `STATUS.md`, puis continuer avec le fallback.

La première demande ne doit pas forcément concerner toute la liste d'assets : demander le petit lot qui permet de juger la direction.

## Traitement par Codex

- Lire `AGENTS.md`, `STATUS.md`, la demande, la direction artistique et le manifeste.
- Inspecter les références/captures disponibles avant modification.
- Générer/éditer les images avec les outils adaptés, vérifier l'export et conserver la source.
- Ne pas produire de nouveau gameplay pour contourner une demande d'image.
- Livrer les chemins exacts, dimensions réelles, format, transparence et contraintes d'intégration.
- Dans la demande, remplir « Livraison » et passer à `delivered`, pas directement `integrated`.
- Passer un asset à `ready` seulement si son export réel existe et a été contrôlé. Si Claude modifie simultanément le manifeste, décrire la modification à appliquer sans écraser son fichier.

## Intégration par Claude

- Lire le compte rendu et les nouveaux fichiers.
- Vérifier cadrage, orientation UV, alpha, espace colorimétrique et taille réelle à l'écran.
- Utiliser la texture couleur comme telle ; ne pas l'interpréter comme une normal map.
- Mettre la demande à `integrated` seulement après vérification dans le jeu.
- Pour une correction : indiquer le problème précis et garder la version antérieure dans les sources.

## Messages prêts à copier

**Pour revenir vers Codex :**

> Dans `/home/sebastien/projets/coin-cascade`, lis `AGENTS.md`, `docs/STATUS.md` et les demandes ouvertes de `docs/art/requests/`. Traite les demandes graphiques nécessaires selon le manifeste et le guide artistique, livre les exports et remplis les comptes rendus. Le code principal est développé par Claude.

**Pour reprendre avec Claude :**

> Codex a livré les ressources indiquées dans `docs/art/requests/`. Lis les comptes rendus, intègre les fichiers et vérifie leur rendu dans le jeu, puis continue le prochain jalon de `docs/STATUS.md`.

## Statuts d'une demande

`open → in-progress → delivered → integrated`. Utiliser `needs-revision` si la livraison existe mais doit être corrigée. L'état d'une demande et celui d'un asset sont distincts : un fichier peut être prêt sans être encore intégré.
