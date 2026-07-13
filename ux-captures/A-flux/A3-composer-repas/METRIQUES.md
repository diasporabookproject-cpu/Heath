# A3 — Composer un repas — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **3** |
| Taps (gestes) | **5** |
| Décisions demandées (saisie/choix exigés) | **4** |
| États capturés | 4 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-objectif.png | Cuisine/objectif | kcal/personne + nb personnes |
| 02 | 02-composeur-vide.png | Cuisine/composeur | 3 briques : plat / entrée / accompagnement + total kcal |
| 03 | 03-picker-plat.png | Cuisine/picker | liste filtrée par rôle, macros par recette |
| 04 | 04-composeur-plat-choisi.png | Cuisine/composeur | plat posé, total recalculé — entrée/acc encore vides |

## Critères matérialisés (doctrine « ce qui peut devenir défaut »)
Un repas = jusqu'à **3 briques** (plat · entrée · accompagnement) + un **objectif kcal/personne**
réglable + **nb de personnes**. Pour composer UN repas minimal il faut : ouvrir → choisir un plat
(picker filtré par rôle). Entrée + accompagnement sont des décisions **supplémentaires** — déjà
optionnelles dans les faits (le plat seul suffit). Candidat : masquer entrée/acc derrière un
« + ajouter » discret, et pré-remplir l'objectif au lieu de le demander.
