# A4 — Grain jour vs semaine — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **2** |
| Taps (gestes) | **2** |
| Décisions demandées (saisie/choix exigés) | **2** |
| États capturés | 4 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-semaine-complete.png | Cuisine/semaine | grille 7 jours, moyenne/jour, générer |
| 02 | 02-un-jour-composé.png | Cuisine/semaine | une carte-jour = lundi |
| 03 | 03-partage-portee-semaine.png | Cuisine/partage | défaut = La semaine (les 4 portées visibles) |
| 04 | 04-partage-portee-unjour.png | Cuisine/partage | sélecteur de jour révélé — chemin EXISTE (portée du partage) |

## Constat
Le chemin « ne partager qu'un jour » **existe** — mais UNIQUEMENT dans la feuille de partage
(portée « Un jour… », rang 2, après avoir choisi de partager). Il n'y a **pas** de vue « jour »
autonome ni de « partager ce jour » depuis une carte-jour du calendrier. Coût actuel pour
partager juste aujourd'hui : ouvrir le partage → changer la portée (défaut = La semaine) →
choisir le jour. Candidat doctrine : un raccourci « partager ce jour » sur la carte-jour, et/ou
« Aujourd'hui » comme portée par défaut selon le contexte.
