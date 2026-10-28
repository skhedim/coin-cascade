# Préparation de l'hébergement

Ce document décrit la cible. Aucun service, dépôt ou déploiement n'est créé à ce stade. Claude préparera les fichiers quand le projet exécutable existera.

## Contrat statique

- `npm ci`, puis `npm run build` ; sortie `dist/`.
- HTML, CSS, JS, WebAssembly éventuel et assets embarqués.
- Une page principale, pas de route serveur nécessaire. Utiliser des panneaux/états UI ou des fragments pour éviter un besoin de réécriture SPA.
- Tester toutes les URL d'assets avec la base de Vite. Pas de chemin absolu supposant la racine du domaine.
- Pas de backend, de variable secrète, de login ou de stockage distant.
- Le double-clic `file://` n'est pas une cible. Utiliser un serveur HTTP local ou une URL hébergée.

## Render Static Site — abandonné

Le 2026-10-28, l'utilisateur a choisi **GitHub Pages uniquement** (D025). `render.yaml` a été supprimé ; ne pas le recréer sans nouvelle demande.

## GitHub Pages

Préparer `.github/workflows/deploy.yml` avec : installation Node compatible, `npm ci`, validations retenues, build, upload de `dist/` et déploiement Pages. Utiliser les actions et versions recommandées dans la documentation au moment de l'implémentation ; permissions minimales nécessaires pour Pages.

Configuration du chemin :

- Projet `https://utilisateur.github.io/coin-cascade/` : base `/coin-cascade/`.
- Domaine racine/custom : base `/`.
- Prévoir une option de build, ou une configuration relative testée, pour ne pas devoir maintenir deux sources différentes.

Pages est disponible pour les dépôts publics sur l'offre GitHub Free ; la prise en charge des dépôts privés dépend de l'offre. Sources : <https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages> et <https://vite.dev/guide/static-deploy>.

## Sauvegardes et mise à jour

Chaque origine de site a son propre stockage. Changer d'adresse de publication (autre compte, domaine personnalisé) ne transfère pas automatiquement la partie ; utiliser export/import.

Versionner le format de sauvegarde et afficher une mise à jour incompatible proprement. Ne pas introduire de service worker avant une gestion explicite de la mise à jour : un vieux cache peut conserver une ancienne version du code ou des assets.

## Publication finale

Quand l'utilisateur choisit le service, fournir les étapes correspondant au dépôt réel. Vérifier l'URL publiée et les ressources si la publication est effectuée. Ne pas affirmer qu'un simple build local prouve le fonctionnement du site distant.

## État de la publication (2026-10-28)

- Dépôt créé **privé** : <https://github.com/skhedim/coin-cascade>, branche `main` poussée. Passer en public est une décision de l'utilisateur : l'outil de Claude a bloqué la création publique sans son accord explicite.
- GitHub Pages **n'est pas encore activé**. Sur l'offre gratuite, Pages exige un dépôt public. Étapes, à lancer par l'utilisateur ou à confier explicitement à Claude :
  1. `gh repo edit skhedim/coin-cascade --visibility public --accept-visibility-change-consequences`
  2. `gh api -X POST repos/skhedim/coin-cascade/pages -f build_type=workflow`
  3. `gh workflow run deploy.yml -R skhedim/coin-cascade`
- Ensuite, chaque push sur `main` lance `npm ci`, `npm test` et `npm run build`, puis publie `dist/` sur <https://skhedim.github.io/coin-cascade/>. La base relative (`./`) évite toute configuration de chemin.
