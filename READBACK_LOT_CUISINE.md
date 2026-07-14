# READ-BACK — Lot Cuisine (spec §8, protocole §0)

**14 juillet 2026 · branche `lot-cuisine-v1` (base = défaut `338abfb`, celui qu'a audité la Q&A)**
**Sources :** `BRIEF_LOT_CUISINE.md` (spec §8) · `RAPPORT_QA_CUISINE.md` (autorité F2.2 + F5b) ·
`docs/maquettes/cuisine/proto-cuisine-cliquable.html` (référence unique, cf. INDEX) · 2 amendements PO du 14 juil.
**Statut : EN ATTENTE DE GO — aucune ligne de code produit n'est écrite.**

---

## 0. Réconciliations exigées par la spec (faites sur le code réel)

### F2.2 ↔ rapport : inventaire nutrition — **écart : AUCUN**
`grep -l kcal src/cuisine/*.tsx` sur `338abfb` → **exactement les 11 fichiers du rapport** :
`CuisineView` (pastille Objectif, :103-105) · `SemaineView` (résumé moyenne/jour + jauges jour + kcal
par repas `mk2` + bandeau « équilibre ») · `RecettesView` (kcal/gP des cartes, 2 modes) ·
`RecipeDetailSheet` (tuiles macros + Calculer) · `RecipePickerSheet` (macros :36-45) ·
`AddRecipeSheet` (MacroPreview + « Calculer les macros ») · `CollectionsSheet` (kcal·gP du rail) ·
`CopyWeekSheet` (~kcal/j :98-102) · `MealComposerSheet` (total repas + budgets) · `ObjectiveSheet`
(l'écran lui-même) · `RelectureSheet`.
- `cuisine.css:261` contient une classe `.cz-kcal` : **style, pas une surface** — hors périmètre.
- Vérifié propre, conforme au rapport : **`EspaceCuisine.tsx` = 0 occurrence** (341 lignes), digest
  WhatsApp et hub Maison sans nutrition. **On n'y touche pas.**
- Garde-fou du rapport tenu : le masquage est **au rendu seulement** — `lib/nutrition.ts`,
  `lib/macros.ts` et `SEED_CONFIG` (structurel, 8 fichiers dépendants) restent intouchés.

### F1.2 ↔ rapport : garde-fou F5b — **confirmé : il meurt avec le bouton**
Le F5b vit **uniquement** dans `SemaineView.generate()` (:107-113 : biblio vide → toast + ouvre la
collection « Fonds de départ ») via la prop `onOpenCollections` (:67), câblée depuis
`CuisineView:148`. **Aucun autre rôle nulle part.** Le retrait de « Générer la semaine » emporte :
le bouton (:224-227), `generate()` entière, `recipeFromDraft`/`runPool` (:24-59), les imports
`ai.ts` de SemaineView, et la copie « ou lance une génération » de l'état vide (:194).
⚠️ Ce qui **reste** : « Copier une semaine précédente » (:228-231) et la prop `onOpenCollections`
**réutilisée différemment** en F7.1/F4.5 (le rail collections continue d'ouvrir les packs).
Le « Coup de main IA » d'`AddRecipeSheet` n'est **pas** concerné par F1.2 — il est refondu en T4 (F4.3).

---

## 1. Amendements PO intégrés (14 juil.)

**① « Semaines favorites » → REPORTÉ au backlog.**
- **F1.3** ne porte plus ce libellé : vocabulaire = onglet **Menu**, « menu du jour », « menu de la
  semaine » (pastille courte « Semaine »), et c'est tout. Aucune entité « favorites » créée.
- **F7.2** se lit : **« Copier » = journée / semaine précédente uniquement.**
- Report tracé au `DEVLOG` (backlog qualité) à la T1.

**② F4.1 gagne une exigence.** Le **`RecipePickerSheet`** (choisir un composant depuis le menu)
gagne une entrée **« ＋ Nouvelle recette »** routant vers la **même feuille des voies** que le FAB —
particulièrement utile sur son état vide « Aucune recette validée pour ce rôle » (:67). Câblage :
nouvelle prop remontée à `CuisineView`, la feuille des voies s'ouvre par-dessus. 🟢

---

## 2. Read-back fiche par fiche + chiffrage

### TRANCHE 1 — Fondations, retraits, vocabulaire — **🟢 (S)**

**F1.1 Polices embarquées — 🟢.** Les 4 woff2 **variables** existent déjà (`src/ftue/fonts/`,
224 Ko, lot Flow FTUE) : Fraunces **400-600** ✓, Jakarta **400-700** ✓, JetBrains Mono, Naskh.
Je fais : `@font-face` remontés au niveau app (CSS global, plus seulement `ftue.css`), suppression
du `<link>` Google Fonts d'`index.html` (:11-14) et des preconnects. Deux notes : (a) `index.html`
charge aussi **Hanken Grotesk — jamais utilisée dans `src/`** : supprimée avec le lien, tracé DEVLOG ;
(b) le lien chargeait Jakarta **800** — la variable s'arrête à 700, 800 se clampe à 700 (aucun usage
800 trouvé) ; Naskh déclarée `500 600` côté FTUE → j'élargis à `400 700` (le fichier est variable).
Critère : zéro requête `fonts.googleapis.com`, rendu identique hors-ligne, RTL Naskh inchangé.

**F1.2 Retrait « Générer la semaine » + F5b — 🟢.** Périmètre exact au §0 ci-dessus. Suppression
**tracée au DEVLOG avec mention « accord PO »** (doctrine). Nettoyage des références résiduelles :
copies d'état vide, tests éventuels. La projection cuisine et le partage ne touchent pas à
`generate()` — vérifié, pas de casse. Critère : zéro occurrence « Générer la semaine » au build.

**F1.3 Vocabulaire — 🟢.** Onglet `Semaine` → **Menu** (`SEG_LABEL`, `CuisineView:24`), titres de
vue « menu du jour » / « menu de la semaine » (la structure d'horizon, elle, arrive en T7 — ici
c'est du libellé). Amendement ① : **pas** de « semaines favorites ». Aucun « menus » comme entité.

### TRANCHE 2 — Nutrition opt-in — **🟡 (M, transverse 11 fichiers)**

**F2.1 Réglage « Suivi de l'équilibre » — 🟢.** Un seul flag, **OFF par défaut**. Stockage :
la spec dit « préférence d'affichage, **hors sync de contenu** » → convention existante = **clé
IDB `meta`** (comme `ftueDone`), **par appareil**, jamais dans `CuisineSettings` (qui, lui, EST
synchronisé — store `settings`, `map.ts:55`). Chargé au boot dans le store Zustand, bascule
instantanée. Foyers existants : clé absente = OFF (pas de présomption ON). Où : dans une feuille
**Réglages ⚙** (voir F3.2 — les deux fiches partagent la même maison).

**F2.2 Masquage 11 surfaces — 🟡.** Rendu conditionnel dans les 11 fichiers du §0, **un seul point
de vérité** (le flag du store). OFF cache aussi la **pastille Objectif** et l'**entrée** vers
`ObjectiveSheet` (le nombre de personnes, valeur foyer, reste accessible via Réglages). Recette sans
macros : rien, pas de « 0 kcal ». ON restitue tout à l'identique (aucun calcul supprimé). Porte
ajoutée : assertion smoke « OFF par défaut → aucun "kcal" dans le DOM Cuisine ; ON → réapparaît ».

### TRANCHE 3 — Règles du foyer — **🟡 (M) avec ma contestation · 🔴 (M/L) si table dédiée**

**F3.1 Modèle — CONTESTATION (point d'attention « rituel token » inclus).**
La spec suppose « migration versionnée + RLS ». **Vérifié sur `0001_foyers-membres-docs-rls.sql` :
la table `docs` porte `store text not null` SANS contrainte CHECK, PK `(foyer_id, store, doc_id)`,
et la policy `docs_rw` couvre tout store pour les membres du foyer.** Un nouveau store de sync est
donc **purement client** :
- `plan.ts` : union `SyncStore` + **`'foyer'`** (document unique `regles`, façon `nounou`) ;
- `map.ts` : collecte + application ; `db.ts` : object store IDB (`DB_VERSION` 8→9) ;
- modèle : `ReglesFoyer { allergies: string[]; halal: boolean; regime?: string }` (champ libre +
  bascules, décision Volet C) — attaché de fait au `foyer_id` par la table `docs`, LWW par document,
  lisible hors-ligne, et le **foyer rejoint adopte les règles du foyer** via `planAdopt`
  (`adoptRemote` couvre tout store) — cas limites de la fiche couverts par l'existant.
- RLS : **déjà testée** (isolation `docs_rw` éprouvée par les stores existants).

**Conséquence : AUCUNE migration SQL en T3 → pas de fenêtre prod, pas de token.** Le rituel token
complet reste dans le lot mais se déplace là où il est réellement requis : **T5/F5.3 (bucket
images, la vraie première migration SQL depuis AS-2)** et **T4/F4.3 (déploiement edge function)**.
Contre-analyse table dédiée : elle n'apporterait un plus **que** si le serveur devait requêter les
restrictions (jointures, edge functions) — or l'alerte F5.5 voyage dans le **payload publié**
(client → `espaces`), le serveur n'a jamais à lire les règles. Coût de la table : migration + RLS +
cas particulier dans l'engine, pour zéro gain. **Reco : monter sur `docs`. Ton arbitrage.**

**F3.2 Écran « Restrictions du foyer » — 🟡.** Le **seul** point d'édition (D2). Je propose une
feuille **Réglages ⚙** (nouvelle, dans l'en-tête Cuisine) regroupant : Suivi de l'équilibre (F2.1),
objectif kcal (visible si suivi ON), personnes, et **Restrictions du foyer** (allergies champ libre
« une par ligne » + bascules halal/végé). Registre chaleureux, neutre en genre, copie montrée **sur
rendu** à la porte de tranche. Retrait d'une allergie : n'altère pas les recettes passées, vaut pour
les prochains imports. « Modifier » de F4.4 y mène. G1 : ce qui s'applique est toujours affiché.

### TRANCHE 4 — Créer une recette — **🔴 (L, cœur du lot)**

**F4.1 FAB + feuille des voies — 🟢.** Le FAB existe (`cz-fab`, `position:fixed` + safe-area,
`cuisine.css:287` — l'exigence « hors flux de scroll » est **déjà tenue**) ; il n'apparaît
aujourd'hui que sur l'onglet Recettes — conforme maquette. La feuille `choose` d'`AddRecipeSheet`
est refondue en **3 voies** : **L'écrire · À partir d'instructions · Depuis une collection**
(remplace bibliothèque/manuel/« ✦ Coup de main IA »). + **Amendement ②** (RecipePickerSheet, §1).

**F4.2 « L'écrire » — 🟢/🟡.** Refonte du `ManualForm` existant : nom · ingrédients (zone texte,
une ligne = un ingrédient — déjà le format) · préparation (zone texte) · rôle (chips) · **portions
(stepper — champ neuf, posé en F5.2)**. **Zéro champ macro** (déjà la doctrine : « les macros sont
calculées, pas saisies », `AddRecipeSheet:78` — estimation locale en coulisse, réactivable par le
flag T2). Zéro widget allergène (D2). Minimale (nom + 1 ingrédient) = valide, rôle défaut « Plat ».

**F4.3 « À partir d'instructions » — 🟡/🔴 (seule vraie inconnue du lot).** Un seul champ + photo.
La désambiguïsation **existe** (`> 100 car. ou saut de ligne = conversion`, sinon intention —
`AddRecipeSheet:270`) : je l'expose proprement. **« IA / Générer / ✨ / indisponible » bannis de
l'UI** — sweep complet, y compris les toasts quota (reformulés doux). **La photo est le morceau
serveur** : `generate-recipe` est aujourd'hui **texte seul** (modes `estimate/import/translate/
generate`, `index.ts:239-260`) → nouveau mode **`import-image`** (image base64 → vision, même
session + même quota serveur, jamais dans la synchro). **Rituel : déployée sur STAGING d'abord,
`parity:check`, puis prod à la fenêtre — token révoqué aussitôt.** Repli doux : OCR/lien raté →
message chaleureux + bascule vers « L'écrire » pré-rempli, jamais d'échec dur. Entrée vide = pas
d'appel.

**F4.4 Adaptation + règles foyer + relecture (G1·G2·G3) — 🟡.** Champ « Adapte-la, si tu veux » ;
ligne **« J'adapte selon les règles de ton foyer : halal, sans arachide »** (lecture du doc T3,
« aucune règle » si vide — pas d'invention), marquée « À vérifier », « Modifier » → F3.2.
CTA **« Créer la recette »**. **Relecture obligatoire** : mécanisme existant étendu — tout import
naît `statut: 'Test'` et la fiche s'ouvre en relecture (quantités en premier) **avant** validation ;
aucun chemin ne l'évite (G2). Adaptation contradictoire (« plus de porc » sur foyer halal) :
l'interdit du foyer **prime**, montré à la relecture (G1/G3).

**F4.5 « Depuis une collection » — 🟢.** Pure plomberie : la 3ᵉ voie appelle `onCollections`
(machinerie 3 packs + dédup par nom vérifiée par la Q&A). Contenu éditorial hors lot (§7.2).

### TRANCHE 5 — Fiche recette — **🟡 (M/L — modèle tags + Storage + LA migration SQL du lot)**

**F5.1 Structure — 🟢.** Réordonnancement de `DetailBody` : titre (Fraunces) · tags (F5.2) ·
consigne vocale (existante — voix de l'employeur, jamais synthétisée) · ingrédients · étapes
numérotées. Macros après, et seulement si flag ON (déjà fait en T2). Sections vides omises.

**F5.2 Tags enrichis — 🟡.** Le **moment** passe de 4 à 8 : union `RecipeRole` étendue
(`dessert | soupe | gouter | boisson` s'ajoutent à `petitdej | entree | plat | acc`) — la clé
stockée reste `role`, **les recettes existantes ne bougent pas** (leur valeur reste valide : le
mapping de migration est l'identité). Nouveaux champs optionnels : `cuisine? difficulte? temps?
portions?` — pastilles omises si absents. Impacts balayés : `ROLE_LABEL`, tableaux `ROLES`
(`AddRecipeSheet:11`, `RecipeDetailSheet:19`), `roleFromDraft`, chips de filtre, picker.
→ **Q2 ci-dessous** : où composent les 4 nouveaux moments.

**F5.3 Photo du plat — 🟡 (point d'attention Storage, design demandé au read-back) :**
- **Une seule entrée « Ajouter une photo »** → `<input type="file" accept="image/*">` : sur
  Android WebView c'est **le sélecteur natif appareil-ou-galerie** demandé par la fiche — pas de
  bouton appareil dédié. Plan B si le test device le contredit : `@capacitor/camera` via
  `platform.ts` (passerelle unique, DCE web préservé). Redimensionnement client (canvas,
  ≤ 1280 px, JPEG q0.8) avant tout stockage. Avec photo : bandeau + « Changer la photo ».
- **Stockage — miroir exact du modèle audio (précédent 0003 + `publish.ts`) :**
  1. **Local-first** : object store IDB `images` (clé `recipeId`), comme `audio` — la photo vit
     d'abord sur l'appareil, hors-ligne comprise ;
  2. **Sauvegarde privée** : bucket **`foyer-images`** (privé), objets `foyer_id/recipes/<id>.jpg`,
     **policies copiées de `0003`** (select/insert/update/delete pour `is_foyer_member` sur le
     1ᵉʳ segment du chemin) → **migration `0010_images_bucket.sql`, idempotente** (`on conflict do
     nothing` + `drop policy if exists`) ;
  3. **Publication** : copie vers le bucket public **`shared`** au moment du partage (même canal
     que l'audio publié) — **seule une photo publiée devient publique**, la fiche privée ne fuit pas.
- **Rituel token complet** (c'est LA première migration SQL depuis AS-2) : annonce « je vais écrire
  en prod » · **staging d'abord** · `parity:check` · fenêtre prod · **révocation immédiate**.
- Distinction stricte tenue : « en photo » de F4.3 = **recette écrite à transcrire** ; F5.3 =
  **photo du plat fini**. Deux entrées, deux endroits, jamais le même bouton.

**F5.4 Barre du haut — 🟢.** ‹ retour · ♡ discret (fantôme) · ⋯ (modifier / dupliquer / supprimer)
· **« Partager » plein, dominant**. La fiche actuelle expose Modifier/Valider/Écarter — restructurée
selon la maquette corrigée (qui **prime**). Dupliquer s'appuie sur `ManualSeed` (existant),
supprimer sur `deleteById`. Aucun overlap à toutes largeurs (repli d'espacement) — capture à la porte.

**F5.5 Alerte allergène sur la page cuisinière — 🟡.** Au rendu de la projection (et dans le
payload publié — le serveur ne lit jamais les règles) : correspondance **normalisée, insensible
accents/casse** entre allergies du foyer (champ libre) et ingrédients des recettes servies →
bandeau d'alerte **visible** sur `EspaceCuisine` (G3, rien en silence). Foyer sans restriction :
aucune alerte. Restriction ajoutée après partage : la page vivante se met à jour à la prochaine
publication. Registre de traduction = celui du gate (sensible). Ne touche pas la fiche enfant
Nounou (D2).

### TRANCHE 6 — Partager — **🟡 (M)**

**F6.1 Partager une fiche = ajout au menu puis partage (D1) — 🟡.** Depuis la fiche, « Partager »
propose **« Pour quel repas ? »** avec **défaut = prochain repas à venir** (un tap) → pose la
recette dans le créneau → ouvre `PartageSheet` sur le menu correspondant. Jamais de second canal.
Créneau occupé : « Remplacer ? » (un tap, jamais d'écrasement silencieux). Aucun repas à venir :
prochain créneau logique (matin du lendemain). → **Q3** : la règle horaire proposée.

**F6.2 Portée selon la vue — 🟢/🟡.** `CuisineScope` existe (`semaine|aujourdhui|demain|jour`,
`digest.ts:14`) et `PartageSheet` le porte déjà (:69, défaut `'semaine'`). Changement : le défaut
**suit la vue courante** (horizon T7) — Aujourd'hui → `aujourdhui`, Demain → `demain`, Semaine →
`semaine`. **La portée ne change que le message** (le digest ne liste que le rempli) ; la page reste
complète et vivante. C'est un passage de prop, pas un nouveau modèle — conforme au rapport §2.

### TRANCHE 7 — Bibliothèque & Menu — **🟡 (M — F7.2 est une vraie restructure, pas un ajustement)**

**F7.1 Collections en rail + emoji — 🟢.** Le rail existe (`RecettesView:148-163`, aujourd'hui en
bas). Bascule : **≤ 12 recettes → rail en tête** ; > 12 → ligne repliée « ＋ Ajouter des recettes ·
Collections › » en bas. Exactement 12 = en tête. Zéro recette = rail en tête + FAB visible. Emoji
par carte : fonction déterministe **mot-clé → repli rôle** (jamais choisi à la main). Photos
réservées fiche + page reçue (pas la liste).

**F7.2 Menu : horizon, repas, footer, état vide — 🟡.** La plus grosse pièce de la tranche :
- **Horizon Aujourd'hui / Demain / Semaine, défaut Demain** (pas-à-pas **dans le contenu**, jamais
  une 2ᵉ barre), réutilise `CuisineScope`. Aujourd'hui passé/en cours : Demain reste le défaut.
- Repas **Matin / Midi / Soir** : libellés seuls — les clés `petitdej|dej|diner` du modèle
  (`WeekMenu`, digest, projection) **ne bougent pas** (compat totale, zéro migration de données).
- **Footer** Menu · Recettes · Courses : la barre segmentée quitte l'en-tête pour une barre du bas
  (fond blanc, bordure + ombre, actif = **pastille foncée** — override PO assumé). **Une seule
  barre de navigation.** Le FAB reste au-dessus.
- **État vide = composer + « Copier »** (sans Générer, F1.2). **Amendement ①** : « Copier » =
  **journée / semaine précédente uniquement** — vue jour → copier la journée précédente non vide ;
  vue semaine → `CopyWeekSheet` existant. → **Q4**.
- Cartes à hauteur naturelle, jamais étirées.

### CLÔTURE
**C1** : `PROJET_MAISON_OS.md` → **v2.2** (⚠️ ce fichier n'est pas dans le repo — je le signale :
soit tu me le fournis à la clôture, soit la mise à jour se fait de ton côté sur mon texte) ;
`DECISIONS_STORE_V1.md` (restrictions foyer, Partager=D1) ; `DEVLOG` par tranche.
**C2** : test device sur APK frais, **foyer NEUF** (jamais le foyer prod), checklist de la spec.
Opérationnel : `apk.yml` déclenche sur la branche du lot précédent → je le pointe sur
`lot-cuisine-v1` en T1 (le point « les références de branche se périment à chaque lot »).

---

## 3. Chiffrage récapitulatif par tranche

| Tranche | Contenu | Chiffrage | Serveur ? |
|---|---|---|---|
| **T1** | polices · retrait Générer+F5b · vocab | **🟢 S** | non |
| **T2** | flag + masquage 11 fichiers | **🟡 M** | non |
| **T3** | règles du foyer (modèle + écran) | **🟡 M** (contesté) · 🔴 M/L si table dédiée | **non si contestation acceptée** |
| **T4** | FAB/voies · écrire · instructions · adaptation G1-G3 | **🔴 L** | **oui — edge function (staging → parity → prod)** |
| **T5** | fiche · tags 8 moments · photo · barre · alerte | **🟡 M/L** | **oui — migration `0010_images_bucket.sql` (rituel token complet)** |
| **T6** | D1 partager=ajout menu · portée=vue | **🟡 M** | non |
| **T7** | rail/emoji · horizon/footer/état vide | **🟡 M** | non |

Ordre de merge = ordre des tranches (T3 précède T4, comme la spec). Portes par tranche :
typecheck · Vitest · build · 3 smokes · captures. STOP entre chaque.

---

## 4. Questions / contestations (réponses avant GO)

**Q1 — T3 sans SQL (contestation, détail au §2/F3.1).** La table `docs` accepte tout store sans
migration ; RLS déjà en place ; le serveur ne lit jamais les règles. **Reco : nouveau store de sync
`'foyer'` sur l'existant — pas de migration, pas de fenêtre prod en T3.** Le rituel token reste au
lot mais à sa vraie place : T4 (edge function) et T5 (bucket images). Valides-tu ?

**Q2 — F5.2 : où composent les 4 nouveaux moments ?** Les créneaux restent Matin/Midi/Soir avec
plat + entrée + accompagnement. **Reco :** la **soupe** devient choisissable comme entrée **ou**
plat ; **dessert / goûter / boisson** vivent en bibliothèque et sur la fiche mais **hors créneaux
en v1** (les y mettre = 4ᵉ brique de composeur, contraire au repli entrée/acc du chantier A3).

**Q3 — F6.1 : définition du « prochain repas à venir ».** **Reco :** avant 11 h → **Midi
aujourd'hui** ; 11 h-18 h → **Soir aujourd'hui** ; après 18 h → **Matin demain**. Seuils ajustables.

**Q4 — F7.2 : « copier la journée précédente ».** **Reco :** en vue jour, « Copier » propose **le
dernier jour non vide** (d'abord la veille, sinon on remonte) → copie ses 3 repas dans le jour
affiché, confirmation si le jour affiché n'est pas vide.

**Q5 — F5.3 : sélecteur natif.** **Reco :** `<input type="file" accept="image/*">` d'abord (ouvre
le sélecteur appareil-ou-galerie sur Android WebView, zéro dépendance) ; si le test device C2 le
contredit, bascule `@capacitor/camera` derrière `platform.ts`. D'accord pour cet ordre d'essai ?

**Q6 — C1 : `PROJET_MAISON_OS.md` absent du repo.** Tu me le fournis à la clôture, ou la v2.2 se
rédige de ton côté sur la base de mon récapitulatif de lot ?

---

*Fin du read-back. J'attends ton GO (et tes arbitrages Q1-Q6) — rien ne se code avant.*
