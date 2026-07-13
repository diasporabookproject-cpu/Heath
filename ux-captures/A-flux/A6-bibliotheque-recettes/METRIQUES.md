# A6 — Entretenir la bibliothèque — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **6** |
| Taps (gestes) | **5** |
| Décisions demandées (saisie/choix exigés) | **0** |
| États capturés | 7 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-add-choix.png | Recettes/ajout | 4 modes : manuel · IA · coller · JSON |
| 02 | 02-add-manuel.png | Recettes/manuel | CHAMPS exigés : nom, rôle, kcal, prot, gluc, lip, calcium, ingrédients… |
| 03 | 03-add-ia-etat.png | Recettes/IA | mode IA : dispo si connecté + quota (état grisé hors-ligne visible) |
| 04 | 04-add-ia-ouvert.png | Recettes/IA | ce que l'IA demande (si ouvrable) |
| 05 | 05-fiche-recette.png | Recettes/fiche | fiche : macros, ingrédients, étapes, vocal |
| 06 | 06-fiche-edition.png | Recettes/édition | champs éditables (mêmes que saisie manuelle) |
| 07 | 07-organiser-biblio.png | Recettes/bibliothèque | 30 recettes, chips de rôle/filtre, favoris, entrée Collections |

## Les 4 modes d'ajout et leur coût
**Manuel** : ~8 champs nutritionnels + nom + rôle + ingrédients (le plus lourd). **IA** : conditionné
connexion + quota (grisé sinon) — décrit ce qu'il demande. **Coller (texte)** / **JSON** : import.
**Modifier** : fiche → éditer → mêmes champs qu'en manuel. **Organiser** : favoris, filtres par rôle,
collections. Candidat doctrine : le mode manuel demande TOUS les champs nutritionnels d'emblée —
beaucoup pourraient être **calculés par défaut** (déjà le cas via l'IA/auto-macros) et repliés.
