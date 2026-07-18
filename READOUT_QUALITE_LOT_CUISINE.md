# READOUT QUALITÉ — Lot Cuisine (T1 → T4b)

**Pour l'instance Q&A · 14 juillet 2026 · branche `lot-cuisine-v1` (base = `338abfb`, le commit que tu as audité)**
**Tête : `4cdfe5c` · 10 commits · réf : `BRIEF_LOT_CUISINE.md` (spec §8) · `RAPPORT_QA_CUISINE.md` (ton rapport) · `READBACK_LOT_CUISINE.md`**

> But de ce document : te donner de quoi **confronter le livré à ton rapport** sans relire tout le diff.
> Chaque tranche indique ce qui a été construit, comment il **réconcilie avec ton audit `338abfb`**, la
> porte qui le verrouille, et **ce qui appelle ton œil**. Les points chauds sont regroupés au §7.

---

## 1. État global

| Tranche | Objet | Statut | Portes |
|---|---|---|---|
| **T1** | polices embarquées · retrait Générer+F5b · vocabulaire | ✅ mergé lot-branch | typecheck · 121 tests¹ · build web+natif · 3 smokes · CI+APK verts |
| **T2** | nutrition opt-in « Suivi de l'équilibre » (11 surfaces) | ✅ | idem |
| **T3** | règles du foyer (modèle + écran) — **zéro SQL** | ✅ | idem + 6 tests d'adoption dédiés |
| **T4a** | feuille des 3 voies · « L'écrire » · collections · langage | ✅ | idem |
| **T4b** | import photo (vision) · adaptation G1·G2·G3 · **prod edge** | ✅ **validé device** | idem + rituel token clos + preuve G2 |
| T5 · T6 · T7 · Clôture | fiche/tags/photo plat · partager · biblio/menu · doc v2.2 | ⏳ à venir | — |

¹ 115 au départ → **121** (les 6 tests d'adoption du store `foyer`, T3).

**Test device (APK `4cdfe5c`, Amine, 14/07) : PASSÉ.** Les 2 chemins photo (appareil **et** galerie),
relecture non contournable, G1/G3 au rendu, repli doux — tous vérifiés sur appareil réel.

---

## 2. Réconciliations exigées par ton rapport — faites, écart nul

- **Q2 / F2.2 — inventaire nutrition = 11 fichiers, écart ZÉRO.** `grep -l kcal src/cuisine/*.tsx` =
  exactement ta liste (CuisineView · SemaineView · RecettesView · RecipeDetailSheet · RecipePickerSheet ·
  AddRecipeSheet · CollectionsSheet · CopyWeekSheet · MealComposerSheet · ObjectiveSheet→**ReglagesSheet** ·
  RelectureSheet). Masquage **au rendu seul** ; `nutrition.ts`/`macros.ts`/`SEED_CONFIG` intouchés ;
  ON restitue tout à l'identique. **`EspaceCuisine` = 0 kcal** (invariant « zéro nutrition côté employé »
  préservé, comme tu l'avais vérifié).
- **F5b (garde-fou) — confirmé mort avec son bouton.** Il ne vivait que dans `SemaineView.generate()` ;
  retiré avec « Générer la semaine » (accord PO tracé). **Verrouillé par une porte** : le smoke échoue si
  « Générer la semaine » réapparaît.
- **Q1 — les règles du foyer n'existaient pas → feature construite intégralement** (T3, cf. §4).

---

## 3. Ce qui a été construit, par tranche (résumé auditable)

**T1** — 4 woff2 variables embarqués (`@font-face` niveau app, `src/assets/fonts.css`), Google Fonts
retiré d'`index.html` (au passage : **Hanken Grotesk chargée mais jamais utilisée** → supprimée).
Onglet « Menu », titre « Menu de la semaine ». « Semaines favorites » **reporté backlog** (amendement PO ①).

**T2** — flag `suiviEquilibre` (méta IDB, **par appareil, hors sync**), OFF par défaut, **un seul point de
vérité** (store Zustand). `ObjectiveSheet` → **`ReglagesSheet`** (maison ⚙). Cas limite tenu : OFF cache
la pastille Objectif **et** la section objectif ; le **nombre de personnes reste** (valeur foyer §6).

**T3** — `ReglesFoyer { allergies[], halal, regime }` ; store IDB `foyer` (DB v9), doc unique `'regles'`,
**absent tant que rien n'est posé**. Écran « Restrictions du foyer » dans `ReglagesSheet` (**seul point
d'édition**, D2) : bascules halal/végétarien + allergies champ libre. **Sans migration SQL** (cf. §4).

**T4a** — feuille des 3 voies (« L'écrire · À partir d'instructions · Depuis une collection »).
« L'écrire » : texte naturel, portions, **zéro champ macro, zéro widget allergène**. **Amendement ②** :
« ＋ Nouvelle recette » dans le sélecteur de composant, rôle pré-rempli, recette créée **posée directement
dans le créneau**. **Langage « IA » banni** (verrouillé smoke).

**T4b** — mode serveur **`import-image`** (vision) + adaptation. `prepareImage` (≤1280px, q0.8) partagé
vision/Storage ; **EXIF/GPS retirés** au ré-encodage. Repli device **Q5** : `@capacitor/camera` (prompt
natif appareil **ou** galerie) derrière `platform.ts`, web garde son `<input>` (DCE vérifié : 0 octet
camera dans le bundle web). `generate-recipe` **v12 en prod**.

---

## 4. Décisions structurantes (à re-challenger si tu le juges)

**Q1 — montage « règles du foyer » sur `docs`, ZÉRO SQL (contestation acceptée par le PO).**
Ton rapport prévoyait « modèle + migration versionnée + RLS ». Vérifié sur `0001` : la table `docs` porte
`store text not null` **sans contrainte CHECK**, PK `(foyer_id, store, doc_id)`, policy `docs_rw` couvre
tout store pour les membres. → un nouveau `SyncStore = 'foyer'` (doc unique, façon `nounou`) monte
**purement côté client** : `plan.ts` + `map.ts` + `db.ts`. **Aucune migration, aucune fenêtre prod pour T3.**
Le serveur ne lit jamais les règles en base — elles voyagent dans la requête (cf. §5, F4.4).
**Contrepartie exigée par le PO et livrée** : 6 tests purs d'adoption (§6).

**Amendements PO au brief :** ① « Semaines favorites » → backlog (F7.2 = « Copier » journée/semaine
précédente uniquement) ; ② `RecipePickerSheet` gagne « ＋ Nouvelle recette » vers la feuille des voies.

**Découpage T4** (tranche la plus risquée) : **T4a client pur** (le mode `import` texte existait déjà en
prod → zéro déploiement) / **T4b serveur + garanties** (photo + rituel token + G1·G2·G3 + device).

---

## 5. Garanties allergies (G1·G2·G3) — comment c'est prouvé

- **G1 (interdits montrés + confirmables)** : ligne « J'adapte selon les règles de ton foyer : halal ·
  sans arachide » sous le champ d'import, chip **« à vérifier »**, bouton **« Modifier »** → `ReglagesSheet`.
  Foyer sans règle → « Aucune règle du foyer — rien ne sera adapté » (pas d'invention).
- **G2 (relecture jamais sautable) — par TOPOLOGIE, pas par vérification ajoutée.** `InstructionsForm`
  est l'**unique** point de persistance des imports ; il écrit `statut: 'Test'` **en dur**. Une recette
  `Test` est inerte partout : le sélecteur ne liste que `Validé` ; taper une carte `Test` ouvre la
  **relecture**, jamais la fiche. Les **seules** transitions `Test → Validé` (`validateRecipe`) partent des
  3 surfaces de relecture. **Preuve capture 3 faces** (brouillon injecté headless) + **validée device**.
- **G3 (jamais d'application silencieuse)** : trace `Recipe.adapteSelon` **dans le document**, affichée
  « Adaptée selon : … — vérifie surtout les quantités » sur **les deux** surfaces de relecture (fiche +
  relecture express — correctif né de la capture G2). Côté serveur, le conflit est tranché dans le prompt :
  **les règles du foyer priment** sur la demande d'adaptation.

**Échec vision** (photo illisible) : validation serveur (nom+ingrédients non vides) → **refund du quota** +
422 honnête → message client + **repli « L'écrire à la place »**. Jamais d'échec dur.

---

## 6. Sécurité — rituel token + tests d'adoption

**Rituel token (fenêtre prod `generate-recipe`, annoncée et clôturée)** : staging d'abord →
`parity:check` → signalement PO → validation → prod (v12) → **révocation → disparition vérifiée**
(`management API 401`). Sondes prod sans session : « Photo manquante » 400, 401 avant tout appel LLM.

**Découverte pendant la fenêtre (à ta connaissance) :** le `parity:check` a exhumé `ack_owner_notice()`
(0009, AS-2b) **présent en prod, absent de staging** — un écart dormant depuis AS-2b (application staging
omise, **pas** un défaut du rebuild). Corrigé (staging remis à parité 0). Deux garde-fous durables au
RUNBOOK : liste de rejeu **vivante** (au lieu du `0001→0005` figé, périmé de 4 migrations) + **parity de
clôture obligatoire** à chaque fenêtre.

**Les 6 tests d'adoption du store `foyer`** (`plan.test.ts`, contrepartie Q1) : ① foyer rejoint → règles
**adoptées** ; ② appareil fondateur → règles **téléversées** ; ③ collision → **le foyer rejoint fait foi**
(cloud gagne) ; ④ la dédup de pack F5a-② **ne touche jamais** le store `foyer` (garde sur le store, pas la
forme) ; ⑤ garde G2 : édition locale non poussée **jamais écrasée** ; ⑥ dirty par hash → push.

---

## 7. Points chauds — ce qui mérite ton audit

1. **Prompt vision (`SYSTEM_IMPORT`) + `reglesBlock`** : le conflit « règle foyer vs adaptation » est
   tranché *par le prompt* (« les règles du foyer priment »). C'est du **LLM, pas déterministe** — à
   challenger : suffit-il pour G3, ou faut-il un filet côté client sur la sortie ?
2. **G2 repose sur `statut:'Test'` en dur au seul point de persistance.** Solide aujourd'hui ; **T6**
   (« Partager » depuis une fiche) devra définir le partage d'un **brouillon** *sans* créer le chemin de
   traverse qui n'existe pas. **Trace gravée** — à re-vérifier en T6.
3. **`import-image` = même quota que le texte** (100/mois/foyer). Surcoût réel de l'image ~+50-100 %
   d'entrée (sortie identique, dominante). Plafond jugé suffisant — à confirmer si tu vois un risque coût.
4. **Repère calcium** : suit désormais le flag T2 (décision lot — l'invariant historique « calcium
   visible partout » vaut maintenant *suivi ON*). ON le restitue. Signalé car c'est un léger glissement
   de ta doctrine calcium.

---

## 8. Reste à faire (périmètre non entamé)

- **T5** fiche recette : structure, **tags 8 moments** (migration `RecipeRole` étendue, recettes
  existantes = identité), **photo du plat** (même `prepareImage` + bucket `foyer-images` privé miroir de
  0003 → **2ᵉ fenêtre token**), barre du haut corrigée, **alerte allergène F5.5** (application des règles T3).
- **T6** partager (recette→menu D1 ; portée=vue via `CuisineScope`) — **+ trace « partager un brouillon »**.
- **T7** biblio & menu : rail/seuil 12/emoji ; horizon Demain/footer/état vide.
- **Clôture** : doc projet **v2.2** (côté chat produit) ; DEVLOG ; **+ ligne registre RGPD** (allergies du
  foyer → relais vision, transit requête, jamais stockées serveur — **trace gravée**).

*Fin du readout. Le détail par tranche vit au `DEVLOG.md` (Journal des sessions). Circuit inchangé :
GO PO → portes → STOP par tranche → test device foyer NEUF.*
