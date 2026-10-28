# Règles et économie — contrat v1

Ces règles font autorité pour l'implémentation. Les valeurs numériques viennent de `config/game.yaml` et restent à calibrer. En cas d'évolution, modifier les documents et noter la décision.

## Trois ressources distinctes

- **Réserve** : entier de pièces disponibles pour tirer.
- **Score** : entier de points, utilisé pour les records.
- **Charges** : tirs gratuits, tirs dorés et pouvoirs disponibles, séparés de la réserve.

Un tir normal débite exactement une unité lorsque sa création physique est acceptée. Un tir refusé (pause, cadence, capacité) ne débite rien. Consommer d'abord une charge de tir gratuit si disponible ; consommer une charge dorée indépendamment si elle est active. Un tir doré coûte donc une pièce sauf s'il est également gratuit.

À la collecte :

`points = points_de_base × multiplicateur_combo × multiplicateur_fever`

Le multiplicateur total est plafonné. Les crédits de réserve ne sont pas multipliés. La collecte latérale n'accorde aucun gain et ne déclenche aucun pouvoir.

Les objets déjà présents sur le plateau et ceux offerts par les bonus représentent de la valeur initiale/subventionnée. Les statistiques les séparent des tirs payés ; ne pas appeler « RTP exact » un ratio qui ignore cet inventaire.

## Cycle de vie d'un objet

`pendingSpawn → active → collected | lost → removed`

Chaque objet possède un identifiant stable de session, un type, une origine et un état terminal unique. Une transition terminale et sa récompense forment une même transaction logique.

Les capteurs indiquent une sortie possible ; vérifier que l'objet franchit le plan de sortie sous le rebord avant de le retirer. Les sorties avant et latérales doivent avoir des volumes sans ambiguïté. Les événements doublons sont ignorés grâce à l'identifiant et à l'état terminal.

Origines minimales : `initial`, `paid-shot`, `free-shot`, `bonus`. Ne pas effacer un objet actif pour libérer de la capacité. Les créations en attente restent comptabilisées et sont distribuées progressivement.

## Collectes

| Type | Réserve | Points | Autre effet |
| --- | --- | --- | --- |
| Normal | 1 | 10 | Compte pour le combo |
| Doré | 5 | 50 | Compte pour le combo |
| Étoile | 0 | 25 | Ajoute 1 à Fever |
| Roue | 0 | 25 | Ajoute 1 au compteur roue |
| Gemme | 0 | 100 | Ajoute sa couleur à la collection |
| Coffre | 0 | 50 | Une récompense selon table pondérée |
| Pouvoir | 0 | 25 | Ajoute une charge du pouvoir indiqué |

Un objet de valeur différente ne doit pas changer implicitement de masse ou de taille. Un objet spécial perdu latéralement n'accorde pas d'effet de consolation par défaut.

## Distribution

Les tirs payés sont normaux, sauf charge dorée. Tous les 12 tirs payés acceptés, une offre d'objet spécial est tirée selon les poids de configuration et ajoutée à la file de distribution gratuite. Le jeton pouvoir choisit son sous-type selon une table pondérée.

Ce mécanisme donne accès aux bonus sans acheter un objet invisible. Chaque distribution arrive physiquement par une entrée au fond du plateau, avec un espacement sûr. Pas de génération directement dans un amas ou au-dessus du bac de collecte.

La composition initiale, les distributions gratuites, les coffres et la roue ont des tirages séparés et traçables. Les poids doivent être positifs ou nuls avec somme strictement positive ; normaliser des poids, pas des pourcentages supposés totaliser 100.

## Combo

- Seules les collectes normales et dorées augmentent le compteur de chaîne.
- Fenêtre initiale : 2,5 secondes de temps simulé, prolongée par chaque collecte éligible.
- Seuils proposés : 1 pièce → ×1 ; 5 → ×2 ; 12 → ×3 ; 25 → ×5.
- À chaque pas physique : dédupliquer puis ordonner les sorties par tick et identifiant stable ; mettre à jour le combo avant de payer l'objet correspondant.
- Les objets spéciaux bénéficient du multiplicateur courant sans prolonger la fenêtre.
- À expiration : retour à zéro/×1. La pause ne consomme pas le délai.

## Bonus et cumul

Tous les délais utilisent le temps simulé. File bornée de récompenses, budget de génération et maximum de redéclenchements. Conserver les récompenses déjà promises ; espacer leur exécution plutôt que les supprimer silencieusement. Au plafond de file, reporter les nouvelles opportunités de distribution jusqu'à libération.

La limite concerne les travaux actifs, pas l'annulation de droits acquis. Conserver les jetons roue et étoiles dans leurs compteurs tant qu'un effet ne peut pas être programmé. Les distributions déjà accordées peuvent être agrégées par type avec un nombre restant ; ne pas créer un travail par pièce. Une collecte existante n'est jamais refusée parce que la file de présentation est pleine.

| Effet | Déclenchement et durée initiale | Cumul |
| --- | --- | --- |
| Pluie | 30 pièces normales, distribuées progressivement | Lots mis en file ; pas tous au même instant |
| Barrières | Ferme les côtés pour 8 cycles complets | Ajouter des cycles, plafond 24 |
| Super poussée | Course étendue sur 3 cycles | Ajouter des cycles, plafond 9 |
| Onde de choc | Impulsion bornée, une charge consommée | Charges stockées, plafond 3 |
| Rafale gratuite | 10 charges de tirs gratuits | Ajouter, plafond 50 |
| Tirs dorés | 8 prochaines créations de tir | Ajouter, plafond 30 |
| Fever | 6 étoiles collectées, ×2 points pendant 20 s | Étoiles mises en attente ; max 2 prolongations par séquence |

La super poussée doit garder une géométrie sûre. Élever les barrières seulement à une frontière de cycle et prévoir une zone de collision sans objet traversé à l'activation. L'onde de choc applique une impulsion limitée, pas une téléportation.

Fever : consommer 6 étoiles au déclenchement. Six nouvelles étoiles pendant Fever ajoutent 10 s si une prolongation est encore permise. Après deux prolongations, conserver le reliquat pour la prochaine séquence, sans nouveau déclenchement avant la fin de la séquence active. Le plafond de multiplicateur global reste appliqué.

Ordre d'un tick : entrées acceptées → physique → sorties dédupliquées/triées → comptabilité/combos/compteurs → programmation des effets → notifications de rendu. Une Fever atteinte pendant ce tick prend effet au tick suivant.

## Roue et coffres

Trois jetons roue collectés donnent un tirage. Le résultat est choisi une seule fois, sauvegardé avant l'animation, puis payé une seule fois. La roue présente ce résultat ; sa décélération ne décide pas du gain.

Pendant la présentation de roue : arrêter les nouveaux tirs et mettre la simulation en pause de présentation. Ne pas faire expirer Fever, combo ou pouvoirs ; reprendre après application de la récompense. Les étoiles ou roues supplémentaires collectées au même tick sont conservées.

Les coffres tirent une seule récompense parmi pièces de réserve, pluie, pouvoirs et tirs dorés. Sauvegarder le résultat dans la transaction de collecte pour éviter un nouveau tirage au rechargement.

## Jackpots

- Mini : 20 pièces de réserve, 500 points de base.
- Minor : 50 pièces, 1 500 points de base.
- Major : 150 pièces, 5 000 points de base.
- Grand : 500 pièces, 20 000 points de base ; collection des cinq gemmes distinctes.

Les trois premiers peuvent être obtenus à la roue. Le Grand de collection est payé une fois par ensemble complet ; réinitialiser l'ensemble de session dans la même transaction. Les points fixes de jackpot ne sont pas multipliés. Pas de progressif au premier équilibrage ; les compteurs sont locaux.

## Fin d'un défi

- Réserve vide et aucune charge de tir gratuit : entrer en résolution, pas en résultat immédiat.
- Terminer les cycles/bonus/distributions engagés. Toute réserve regagnée réactive les tirs.
- Résultat lorsque la réserve et les charges gratuites sont nulles, les files et présentations vides, et aucune collecte n'a eu lieu depuis 3 cycles complets.
- Timeout de résolution : 45 s simulées par phase sans nouveau tir ; terminer au prochain point de transaction sûr, abandonner les effets futurs non résolus, et afficher cette limite dans le bilan. Ne pas supprimer la valeur résiduelle du bilan.
- Ne jamais terminer au milieu d'un paiement. Afficher score, tirs, réserve gagnée et valeur encore sur le plateau.

## Intégrité locale

Les records sont locaux et modifiables par le propriétaire du navigateur ; aucune promesse anti-triche. Import/opérateur/forçage change le statut de la session. Les jackpots ne sont pas partagés entre visiteurs.
