# B2 — Sécurité — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **5** |
| Taps (gestes) | **3** |
| Décisions demandées (saisie/choix exigés) | **0** |
| États capturés | 5 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-securite-vide.png | Sécurité/vide | ÉTAT VIDE : « Aucune fiche » + « Importer le pack » — style LEGACY (pas mz-/bento) |
| 02 | 02-securite-apres-import.png | Sécurité/rempli | 4 fiches en statut Test, groupées par type |
| 03 | 03-securite-fiche.png | Sécurité/fiche | édition fiche : FR + darija, statut, vocal |
| 04 | 04-bento-maison.png | Maison (bento) | langage mz-/bento — référence visuelle |
| 05 | 05-bento-cuisine.png | Cuisine (bento) | langage cz-/bento — référence visuelle |

## Constat
Sécurité utilise un langage visuel LEGACY (`lib-item`, `card`, `btn--ghost`, `empty-note`) —
distinct du système `mz-`/`cz-` (bento) de Maison/Cuisine/Nounou. États : vide (« Aucune fiche »
+ import) · rempli (fiches en statut Test à relire/valider) · fiche (FR + darija). Les captures
`bento-maison`/`bento-cuisine` sont mises côte à côte pour matérialiser le décalage. Parking PO
confirmé : « legacy à repenser » — chantier passe 2 (esthétique) autant que passe 1 (flux
d'import + assignation).
