# RAPPORT Q&A — Lot Cuisine (A3+A4 · A6 · Volet C)
**Instance Q&A · 14 juillet 2026 · Code audité : défaut `claude/jolly-wozniak-s83str` @ `338abfb`**
**Documents audités : `RECAP_CUISINE_POUR_QA.md` · `INDEX_MAQUETTES_CUISINE.md` · `proto-cuisine-cliquable.html`**
**Verdict global : GO pour la spec §8, avec 1 prémisse fausse à corriger (❌ Q1), 1 périmètre sous-estimé (⚠️ Q2), et les exigences §5 à porter dans la spec.**

---

## 0. Décision PO actée en ouverture (tension §7.1 du recap)
**« Partager » sur une fiche recette = AJOUT AU MENU puis partage** (jamais un second canal de
transmission). Geste : depuis la fiche, « Partager » propose « Pour quel repas ? » avec **défaut = le
prochain repas à venir** (un tap), puis ouvre la fiche de partage habituelle (A2). Un seul canal : la
cuisinière reçoit LE menu ; « fais-moi ça ce soir » = ajout au menu de ce soir + page à jour.
**→ À graver dans la spec §8.**

---

## 1. Vérification du prototype (langage & libellés)
| Affirmation | Verdict | Preuve |
|---|---|---|
| « IA » jamais nommée dans l'UI | ✅ | 0 occurrence réelle (6 faux positifs de sous-chaînes : `initial-scale`, `georgia,serif`) |
| « Générer / génération / indisponible » absents | ✅ | 0 occurrence |
| Fin de « PD » → Matin / Midi / Soir | ✅ | présents, « PD » absent |
| Aucun chiffre nutritionnel | ✅ | 0 « kcal / calorie / macro / protéine / glucide » dans le proto |
| « Semaines favorites » | ⚠️ | **Absent du proto** — vocabulaire verrouillé §4 non représenté ; **la spec §8 fera foi pour ce libellé** |

## 2. Vérification des affirmations « déjà conforme au code »
| Affirmation du recap | Verdict | Preuve (fichier:ligne) |
|---|---|---|
| `CuisineScope` existe (`semaine\|aujourdhui\|demain\|jour`) et peut être remonté vers la vue | ✅ | `PartageSheet.tsx:24,35-38,69` (type importé de `maison/digest`) ; défaut actuel du partage = `'semaine'` — le nouveau défaut `'demain'` est un changement de valeur, pas de modèle |
| Le formulaire manuel ne demande pas les macros | ✅ | `AddRecipeSheet.tsx:78` — littéralement « Les macros sont calculées, pas saisies » |
| Désambiguïsation par l'entrée (court = intention, long/collé = conversion) | ✅ | `AddRecipeSheet.tsx:270-271` — seuil explicite `v.length > 100 \|\| v.includes('\n')` |
| Les voies de création suivent l'ordre de la doctrine | ✅ | `AddRecipeSheet.tsx:36-38` (commentaire d'architecture : bibliothèque → manuel → ✦ IA avec quota + brouillon `Test` en file de relecture) |
| Machinerie collections : 3 packs, dédup par nom | ✅ | `data/packs.ts:15` (`PACKS = [fonds, marocain, leger]`) ; dédup à l'installation dans `CollectionsSheet.tsx:117,126` (« déjà dans ta bibliothèque » / « Tout est déjà là ✓ ») |
| (Recap A3A4 §9) Thèse A7 : renommer un destinataire préserve le lien | ✅ | `types.ts:126-133` (`nom` et `token` = deux champs indépendants du même objet) ; `espace.ts:14,46` (lien permanent = `#e=<token>`) — structurellement vrai |

## 3. ❌ Q1 — PRÉMISSE FAUSSE : les « règles du foyer » N'EXISTENT PAS côté Cuisine
Le recap affirme : §3.5 *« Restrictions = système du foyer (**précédent, conservé**) »* et §6 *« Règles du
foyer (écran de réglage) → Réglage foyer (**existant**) »*.
**Vérifié : aucun système de restrictions n'existe côté Cuisine.** `grep allerg|halal|régime|restriction`
sur `src/` ne touche QUE des fichiers Nounou (allergies **par enfant**, fiche urgence) et la FTUE. Le seul
réglage cuisine existant est `ObjectiveSheet.tsx` : objectif kcal + nombre de personnes — rien d'autre.
**Conséquences pour la spec §8 :**
- Le système « règles du foyer » (allergies / halal / régime, posées une fois, appliquées aux imports,
  alertant la page du cuisinier) est une **FEATURE À CONSTRUIRE** : modèle de données + écran de réglage +
  application à l'import + alerte page reçue. À chiffrer comme tel — pas comme la réutilisation d'un existant.
- **Question de conception à trancher à la spec :** lien entre les *allergies par enfant* (Nounou, existant)
  et les *règles du foyer* (Cuisine, à créer) — remontée automatique, duplication, ou indépendance ? Reco
  Q&A : les allergies enfants **alimentent** les règles du foyer (une source, pas deux saisies), mais
  décision PO requise.
- La tension §7.2 du recap (garanties a/b/c sur les allergies) porte donc sur un système **à naître** : ce
  sont des **exigences de spec**, pas des vérifications d'existant. Les trois garanties (interdits montrés +
  confirmables · relecture d'import jamais sautable · jamais d'application silencieuse) sont saines et
  **doivent figurer telles quelles dans la spec** — le mécanisme de relecture existe déjà pour les brouillons
  IA (statut `Test` + file de relecture, `AddRecipeSheet.tsx:38`, `RelectureSheet.tsx`), il s'étend à l'import.

## 4. ⚠️ Q2 — PÉRIMÈTRE SOUS-ESTIMÉ : l'opt-in nutrition couvre ~11 fichiers, pas 4 surfaces
Le recap §1.1 liste 4 surfaces (pastille en-tête, bandeau moyenne/jour, total repas, macros au picker).
**Inventaire réel (`grep -l kcal src/cuisine/`) : 11 fichiers** — s'ajoutent notamment :
- `AddRecipeSheet.tsx:127-157,239` — **MacroPreview + bouton « Calculer les macros »** (formulaire manuel)
- `CollectionsSheet.tsx:117` — **kcal · g P sur chaque recette du rail collections**
- `RecipeDetailSheet.tsx` (tuiles macros — listé au recap A6), `RelectureSheet.tsx`, `CopyWeekSheet.tsx`,
  `RecettesView.tsx`, `SemaineView.tsx`, `CuisineView.tsx`, `MealComposerSheet.tsx`, `RecipePickerSheet.tsx`
- `ObjectiveSheet.tsx` — **l'objectif kcal lui-même est un réglage nutritionnel** : sous opt-in OFF, il
  passe sous « Suivi de l'équilibre » (le nombre de personnes, lui, reste — c'est une valeur foyer, cf.
  recap §6 : surfacée sur Courses + projection)
**Bonne nouvelle vérifiée :** la **page reçue** (`EspaceCuisine.tsx`), le **digest WhatsApp** et le **hub**
ne contiennent AUCUN kcal — l'invariant « zéro nutrition côté employé » est déjà tenu ; l'opt-in ne
concerne que l'admin.
**Garde-fou :** `SEED_CONFIG` (cibles kcal structurelles) reste **intouchable** — l'opt-in conditionne
l'AFFICHAGE, pas le calcul (les macros restent calculées en arrière-plan : réactivables sans perte).

## 5. Exigences à porter dans la spec §8 (relevées à l'audit, hors recap)
1. **Polices embarquées, pas Google Fonts.** Le proto charge Fraunces via Google Fonts — interdit en app
   (offline-first) : même mécanisme d'embarquement woff2 que la FTUE (précédent : 224 Ko, lot Flow FTUE).
2. **Libellé « semaines favorites »** porté par la spec (absent du proto, cf. §1).
3. **Retrait de « Générer la semaine »** (décision PO : reporté backlog) = **suppression de capacité avec
   accord explicite** — à tracer dans la spec comme telle (invariant « aucune capacité supprimée sans
   accord » : l'accord existe, il doit être cité). Le garde-fou F5b (biblio vide → propose la collection)
   suit le même sort que le bouton qu'il gardait : à traiter explicitement dans la spec.
4. **Le défaut de la vue = Demain** ; le défaut du *partage* suit la vue (portée auto-évidente) — préciser
   le comportement de `PartageSheet` quand il est ouvert depuis la vue jour vs semaine.
5. **Doc projet v2.2 à la clôture du lot** : le §3 (« objectif calorique individuel comme plafond »)
   deviendra faux au merge — description à actualiser, invariants §4 déjà alignés (doctrine).
6. **Test device du proto avant spec finale** (recommandé, non bloquant) : desktop ≠ tactile, et les deux
   derniers tests device ont chacun attrapé ce que le raisonnement avait manqué.

## 6. Rappel de périmètre (conforme, rien à signaler)
Les routages du §6 du recap (Proposer un repas → backlog · Courses par rayon → fiche dédiée · nombre de
personnes → valeur foyer · contenu éditorial → §7.2 · fiche de partage → A2 · direction visuelle → lot
visuel) sont cohérents avec le doc projet v2.1 et n'appellent pas d'objection.

*Fin du rapport. Circuit : intégrer Q1/Q2 + §5 dans la spec §8 (thread UX) → Claude Code (read-back +
chiffrage 🟢🟡🔴 → GO → portes → STOP → test device foyer NEUF).*
