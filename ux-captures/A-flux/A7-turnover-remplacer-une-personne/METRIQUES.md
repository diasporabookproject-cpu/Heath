# A7 — Turnover : remplacer une personne — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **3** |
| Taps (gestes) | **3** |
| Décisions demandées (saisie/choix exigés) | **2** |
| États capturés | 4 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-depart-page-fatima.png | Cuisine/partage | Fatima a une page (destinataire + contenu) — point de départ |
| 02 | 02-liste-destinataires.png | Cuisine/destinataires | liste : ajouter / éditer / supprimer |
| 03 | 03-editer-fatima.png | Cuisine/édition-dest | RENOMMER Fatima → Khadija : la page + le lien (token) survivent-ils ? |
| 04 | 04-renomme-khadija.png | Cuisine/édition-dest | renommé Khadija (même ligne = même token = lien conservé) |

## Ce que le chemin RÉEL permet (constats bruts joués)
- Départ : un destinataire « Fatima » avec une page composée (token = lien permanent).
- « Changer » ouvre la liste des destinataires (ajouter / éditer / supprimer).
- Renommer un destinataire EXISTE (édition) → le token/lien ne change pas → la remplaçante HÉRITE de la page. C'est la promesse — mais implicite (aucun geste « remplacer » nommé).

## Le moment de vérité de la promesse produit
La thèse « la page survit au départ, le nouveau hérite d'une page prête » se joue AUJOURD'HUI par
**renommage d'un destinataire** (via « Changer » → éditer) : le token — donc le lien permanent —
ne change pas, la page et son contenu restent, il suffit d'ajuster le prénom (et la langue).
**C'est la promesse tenue techniquement, mais JAMAIS énoncée** : il n'existe pas de geste
« [Personne] est partie → confier sa page à quelqu'un d'autre ». L'alternative supprimer/recréer
casserait le lien (nouveau token → l'ancien lien devient mort ; cf. finding `revokeEspace`
silencieux au backlog). **À trancher au chantier** : matérialiser explicitement le geste turnover
et dire à l'utilisateur que le lien/la page survivent — c'est LE différenciateur produit.
