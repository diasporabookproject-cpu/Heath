# A1 — De l'installation à la première page envoyée — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **13** |
| Taps (gestes) | **17** |
| Décisions demandées (saisie/choix exigés) | **7** |
| États capturés | 17 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-ftue-entry.png | FTUE/entry | première ouverture |
| 02 | 02-ftue-domaines-vide.png | FTUE/domain | 5 domaines, 2 « Bientôt » |
| 03 | 03-ftue-domaines-coches.png | FTUE/domain | cuisine + enfants cochés |
| 04 | 04-ftue-memoire.png | FTUE/memory | planche narrative |
| 05 | 05-ftue-personnes.png | FTUE/people | rôles à poser |
| 06 | 06-ftue-namesheet.png | FTUE/name-sheet | prénom + langue |
| 07 | 07-ftue-namesheet-rempli.png | FTUE/name-sheet | Fatima · darija |
| 08 | 08-ftue-personnes-nomme.png | FTUE/people | carte « ✓ Fatima · darija » |
| 09 | 09-ftue-transmission.png | FTUE/send | planche 5 étapes |
| 10 | 10-ftue-bienvenue.png | FTUE/welcome |  |
| 11 | 11-hub.png | Hub Maison | Fatima · Cuisine + carte Nounou |
| 12 | 12-cuisine-semaine-vide.png | Cuisine/semaine | semaine vide |
| 13 | 13-composeur.png | Cuisine/composeur | composer un repas |
| 14 | 14-composeur-picker.png | Cuisine/picker | choisir le plat |
| 15 | 15-repas-ajoute.png | Cuisine/semaine | lundi composé |
| 16 | 16-partage-ouvert.png | Cuisine/partage | feuille de partage (Fatima pré-sélectionnée ?) |
| 17 | 17-securiser-volet.png | Partage/Sécuriser | compte transparent — STOP avant OTP réel (backend) |

## Limite de capture (règle « jamais la prod »)
Le film s'arrête à l'apparition du volet **« Sécuriser ta page »** : la suite (saisie e-mail →
« Recevoir mon code » → code 6 chiffres → « Envoyé ✓ ») déclenche l'**OTP réel** (envoi d'un
e-mail via le backend). Non joué pour ne pas toucher la prod ni le compte staging (creds absentes
de l'env de capture). **À compléter à la main** sur staging avec le compte smoke. Le rendu du
volet lui-même (étape e-mail) est capturé ; les étapes code + confirmation manquent.

## Lecture doctrine (par défaut simple / paramétrage au rang 2)
Décisions demandées AVANT d'avoir une page à soi : domaines (×N) + nommage cuisinière (prénom +
langue) + composer 1 repas (choisir plat) + sécuriser (e-mail + code). Candidat n°1 à alléger :
le nommage prénom+langue **pourrait** être différé au premier envoi (déjà l'option « Plus tard »).
