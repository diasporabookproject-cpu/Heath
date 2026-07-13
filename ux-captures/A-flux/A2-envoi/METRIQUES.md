# A2 — Envoi / paramétrage de partage — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **2** |
| Taps (gestes) | **3** |
| Décisions demandées (saisie/choix exigés) | **1** |
| États capturés | 4 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-cuisine-nouvelle-personne.png | Cuisine/partage | FRICTION : sans destinataire, il faut d'abord CRÉER une personne (nom, rôle, langue, tél) |
| 02 | 02-cuisine-partage-complet.png | Cuisine/partage | vue envoi entière : destinataire, QUOI ENVOYER, message, rappel, aperçu |
| 03 | 03-cuisine-portee-unjour.png | Cuisine/partage | « Un jour… » → sélecteur de jour apparaît |
| 04 | 04-nounou-partage-complet.png | Nounou/partage | destinataire, langue, message, traduction, QR, rappel |

## Décisions matérialisées (à passer aux 5 questions)
**Cuisine** : destinataire (Changer) · QUOI ENVOYER = 4 portées (La semaine / Aujourd'hui /
Demain / Un jour…) · message éditable · rappel d'envoi (activer + jour + heure) · aperçu.
**Nounou** : destinataire · langue · message éditable + traduction (sensible à relire) · QR ·
rappel. Doctrine : « La semaine » est déjà le défaut ; les 3 autres portées + rappel + traduction
sont du **rang 2** candidat au repli sous un « Options ».
