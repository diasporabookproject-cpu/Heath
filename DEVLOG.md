# DEVLOG — Menu de la semaine

> **Fil conducteur du projet.** Décisions d'architecture, état d'avancement, et
> journal des sessions/commits. À lire en début de session, à mettre à jour à
> chaque session et à chaque commit (voir « Comment tenir ce journal »).

---

## Comment tenir ce journal (convention)

- **Début de session** : lire ce fichier en entier (surtout « État actuel » et « Décisions »).
- **À chaque commit** : ajouter une ligne dans **Journal des sessions** (date · sujet · pourquoi).
- **Décision d'archi** (choix de techno, modèle de données, sécurité, etc.) : ajouter/мettre à jour une **ADR** dans la section « Décisions d'architecture ».
- **Changement d'état** (fonctionnalité finie, dette, point bloquant) : mettre à jour « État actuel » et « À faire / en cours ».
- Garder le ton **factuel et bref**. Ne jamais committer de secret (clé `service_role`/`secret`).

---

## Vue d'ensemble

App web **mobile-first, PWA offline**, pour composer les menus de la semaine d'un
programme nutritionnel (sans gluten, calcium élevé, glucides maîtrisés) et produire
des instructions claires pour la cuisinière. Voir `BRIEF_PRODUIT.md`.

- **Lien de production** : https://diasporabookproject-cpu.github.io/Heath/
- **Dépôt / branche de dev** : `diasporabookproject-cpu/Heath` · `claude/jolly-wozniak-s83str` (= branche par défaut)
- **Stack** : React + Vite + TypeScript · vite-plugin-pwa · zustand · `idb` (IndexedDB) · lz-string · @supabase/supabase-js
- **Hébergement** : GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`), base `/Heath/`
- **Backend** : Supabase (auth lien magique + stockage des notes vocales). Projet : `pqeilsuqglmrvijndrwa.supabase.co`

---

## Architecture (résumé)

- **Local-first** : IndexedDB est la source de vérité (`src/lib/db.ts`). Migrations via `SEED_VERSION`.
- **État** : zustand (`src/store/useStore.ts`).
- **Moteur métier** : `src/lib/nutrition.ts` (feux tricolores, éléments fixes, moyennes) — couvert par tests.
- **Vues** : Composer, Cuisinière (FR/darija), Courses (liste de courses), Bibliothèque. Page lecture seule `SharedMenuView` pour la cuisinière.
- **Partage** : deux mécanismes
  - **Hors-ligne** `#m=` : menu encodé+compressé (lz-string) dans l'URL, rendu par l'app hébergée. Sans backend, sans audio.
  - **Publié** `#p=<id>` : menu + audios téléversés sur Supabase (bucket public `shared`), lien court, audio jouable.
- **Tests** : Vitest (logique pure) + `scripts/smoke.mjs` (Playwright, parcours bout-en-bout, micro simulé).
- **Déploiement** : push sur la branche par défaut → Actions build (`BASE_PATH=/Heath/`, clés Supabase via `define` Vite) → Pages.

---

## Décisions d'architecture (ADR)

> Format : décision · pourquoi · statut.

1. **React + Vite + TS, local-first, PWA** — simple à maintenir/faire évoluer, offline natif. ✅ Acté.
2. **IndexedDB (idb) comme source de vérité**, pas localStorage — données binaires (audio) + volume. ✅
3. **Hébergement GitHub Pages via Actions** (au lieu de Vercel initialement envisagé) — auto-suffisant avec l'accès dépôt, lien persistant. ✅ Base `/Heath/` (nom exact du dépôt, casse importante).
4. **Cibles & feux tricolores pilotés par la config** (`recettes.json`) et **verrouillés par tests** — règles médicales sensibles. ✅
5. **Liste de courses : parseur « best-effort »** du texte libre d'ingrédients (séparateurs `·` / ` + `, quantités, rayons). Imparfait mais utile. ✅
6. **Darija stockée par recette (lettres arabes)**, pas de traduction automatique en ligne — fiabilité + offline. Bascule FR/الدارجة dans Cuisinière. ✅
7. **Import de recettes par collage JSON** (+ `TEMPLATE_RECETTE.md`) — « zéro friction » pour ajouter des recettes générées ailleurs. ✅
8. **Notes vocales : MediaRecorder + IndexedDB (local)** puis partage. Web Share API. ✅
9. **Partage par lien sans backend (`#m=`, lz-string)** d'abord, pour valider l'usage avant d'investir dans le backend. ✅
10. **Backend = Supabase** ; **auth lien magique e-mail** (sans mot de passe). Nouvelles clés : on utilise la **publishable key** (publique, injectée au build via `define` Vite car le shell n'alimente pas `import.meta.env`). ✅
11. **Audios publiés dans un bucket public `shared`** (lecture publique pour la cuisinière sans compte) ; **écriture via REST** côté app. ✅
12. **Bug clé : l'en-tête `x-upsert` provoquait un refus RLS** (403 « new row violates row-level security policy »). Retiré — chemins de publication uniques, insert simple. ✅ (cause racine de la longue série de blocages).
13. **PWA : `skipWaiting`/`clientsClaim`** — éviter qu'une app installée reste sur un ancien cache après déploiement. ✅
14. **Écriture du bucket réservée aux utilisateurs connectés** (jeton de session dans l'upload + policy `authenticated`-only). ✅ Vérifié : upload anonyme refusé (403), lecture publique intacte.
17. **Génération IA de recette (F5)** : edge function Supabase `generate-recipe` (relais Claude/Anthropic, clé serveur, `verify_jwt`), front « ✨ Générer un brouillon » → recette en **Test** (relecture humaine obligatoire). IA **exclue de la Sécurité** (D9). 1re brique de logique serveur, réutilisable. ✅ Déployée et validée en réel.
16. **Module Sécurité (F3) + seed (F4)** : référentiel de fiches (numéros / procédures / gestes), contenu en **lignes** (darija en parallèle), statut Validé/Test/Écarté, note vocale du parent. **Aucune génération IA** (D7). **Assignation par personne** (`Destinataire.securiteIds`) → les fiches Validé assignées apparaissent dans l'espace, dans la langue du destinataire. Onglet « Sécurité ». Réutilise espace + audio + import. ✅ (aucune nouvelle table Supabase : contenu dans le `payload` des `espaces`).
15. **Socle « Destinataire + Espace » (keystone F1/F2, slice 1)** : entité **Destinataire** locale (IndexedDB, v3) avec **langue** + jeton capability ; **Espace** par personne stocké dans une **table Supabase `espaces`** (upsert en place, lecture publique par jeton = capability), audios dans le bucket `shared`. Lien permanent `#e=<token>`, page lecture seule offline-cache. 1re brique générique réutilisable (Sécurité/Entretien). ✅ (table à créer côté Supabase).

---

18. **Refonte UX module Cuisine (brief FC1–FC10) — design system dédié** : nouveau dossier `src/cuisine/` avec un design system **repris exactement de `maquette-cuisine.html`** (tokens `--petrol`/`--saffron`/`--draft`, polices Fraunces/Hanken Grotesk/JetBrains Mono/Noto Naskh Arabic). CSS **scopé sous `.cz` et classes préfixées `cz-`** pour cohabiter sans collision avec le style v1 (`styles.css`). Le module Cuisine devient **une section à 3 destinations** (segmented control Semaine/Recettes/Courses) qui **absorbe** les anciens onglets Composer/Courses/Bibliothèque ; la barre du bas passe à **Cuisine · Cuisinière · Sécurité**. Construit par **lots** (FC1→FC3, puis FC5/6/7, FC4, FC9/10, FC8). ✅ Acté (lot 1 livré).
19. **Statut « À valider » côté Cuisine = `statut: 'Test'`** : on réutilise le statut existant `Test` (déjà produit par la génération IA F5) comme état « ✦ À valider » (violet). Le sélecteur (FC3) et le ⤧ (remplacer) ne piochent que des recettes `Validé`. Champs `DayMenu` ajoutés (rétro-compatibles, optionnels) : `type?` (override ⚙ jour), `lockDej?/lockDin?` (verrouillage). ✅
20. **Auto-macros (2.3) = base locale + estimation LLM, jamais bloquant** : `src/lib/macros.ts` = base nutritionnelle « best-effort » côté client (offline, calcium soigné) ; `estimateMacros()` (lib/ai.ts) **préfère l'edge function** (`generate-recipe` mode `estimate`) quand connecté+en ligne, **repli automatique sur la base locale** sinon. L'utilisateur **ne saisit plus jamais** les macros (champs supprimés du formulaire) ; elles sont **calculées** et marquées « estimées · à valider ». Nouveaux champs Recipe (optionnels, rétro-compatibles) : `etapes?`, `etapes_ar?`, `macros_estimees?`. ✅
21. **Edge function `generate-recipe` étendue** : (a) mode **`estimate`** (macros depuis ingrédients, prompt dédié) ; (b) le mode génération renvoie désormais **`etapes`/`etapes_ar`**. Rétro-compatible (défaut = génération via `{intention}`). **⚠️ à redéployer une fois** côté Supabase pour activer macros-IA + étapes IA ; d'ici là le **repli local** couvre les macros et la génération renvoie les étapes dès le redéploiement. ✅ (code) / ⏳ (redéploiement dashboard)
22. **Le module Cuisine remplace les vues v1** : suppression de `ComposerView`/`BibliothequeView`/`RecipePicker`/`Totals` (absorbés par `SemaineView`/`RecettesView`/`RecipeDetailSheet`). L'**import JSON** (D7) est préservé comme 3ᵉ option du sheet d'ajout (FC6). ✅
23. **Générateur de semaine hybride (FC4)** : `GenerateWeekSheet`. Remplit les créneaux non verrouillés **d'abord depuis la bibliothèque Validé** (proche de la cible kcal + jitter pour varier, évite les répétitions), **puis complétion IA** (`generateRecipeDraft`) pour ~25 % des créneaux + le cold-start (type sans recette dispo). **Plafond `AI_CAP = 6` appels/génération** (coût/latence), parallèles ; surplus → bibliothèque (répétition tolérée). Recettes IA en **`Test` (à valider)**, macros estimées. Respecte 🔒 ; critères alimentaires injectés **côté prompt IA**. Si IA indisponible (hors-ligne/non connecté) → 100 % bibliothèque + toast. ✅
24. **Changer un repas déjà placé** : action **⇄ « changer ce repas »** sur chaque créneau rempli → rouvre le sélecteur (FC3) pour choisir une recette **précise** (le ⤧ restant = remplacement aléatoire). Comble le manque signalé (« je ne peux pas changer une recette déjà entrée »). Nouvelle action store `setExtras` (utilisée aussi par le générateur pour le Coupe-faim). ✅
25. **Espace cuisinière refondu (FC10)** : nouveau `EspaceCuisine` (classes `ck-`, tokens maquette-partage). **Projection cuisine** : aucune macro/calcium/feu ; en-tête pétrole « Cuisine / الكوزينة » + bascule FR/الدارجة (RTL) + indicateur hors-ligne ; accueil « Aujourd'hui » + cartes repas (déj/dîn) + reste de la semaine ; recette = **voix héros** (lecture de la note vocale, voix de l'employeur) + **ingrédients ×personnes** + étapes + mention « traduit automatiquement ». `EspaceView` rend `EspaceCuisine` (et **journalise l'ouverture**). `SharedMenuView` conservé pour les liens legacy `#m=`/`#p=`. ✅
26. **Envoi en un geste (FC9)** : `PartageSheet` accessible depuis l'en-tête Cuisine (icône Partager). Sélection du destinataire, **résumé** (jours, ingrédients ×pers., étapes, notes vocales, langue), **« Voir l'aperçu »** (rendu local via `previewEspace`, sans upload), **accusé de lecture** (« Dernier accès »), et **UN bouton « Envoyer à … »** = `publishEspace` (maj en place de l'espace) **+ rappel WhatsApp** (`wa.me` pré-rempli). Lien secondaire « Copier le menu du jour en texte ». Champs `Destinataire.tel?`/`persons?`. ✅
27. **Traduction darija à l'envoi** : edge function `generate-recipe` mode **`translate`** ; à la publication d'un espace en darija, les champs `*_ar` manquants des recettes utilisées sont complétés (best-effort, plafonné à 12, **figés dans le payload** → lisibles hors-ligne) ; repli FR + mention si indisponible. **⚠️ nécessite un redéploiement** de l'edge function. ✅ (code) / ⏳ (redéploiement)
31. **Gestion des personnes unifiée** : `DestinatairesSheet` (v1) supprimé ; la vue Cuisinière ouvre désormais le `PartageSheet` (FC9). Une seule UI pour créer/modifier/partager. ✅
30. **Sortie IA structurée (tool use)** : l'edge function `generate-recipe` force la réponse via **appel d'outil** Anthropic (schéma JSON) pour les 3 modes (recette / estimate / translate) → plus jamais de « réponse illisible ». Diagnostic : remontée du vrai message d'erreur (statut + corps) côté `ai.ts`. **⚠️ redéploiement** de l'edge function requis. ✅
29. **Courses refondues (FC8)** : `CoursesCuisine` (style maquette, classes `cz-`). Réutilise le parseur `shopping.ts` (groupage par rayon, agrégation) + **mise à l'échelle ×personnes** (nouveau param `buildShoppingList(..., persons)`), cases à cocher (barré), **Partager** (Web Share / copie WhatsApp). Remplace `CoursesView` v1 (supprimée). ✅
28. **Accusé de lecture via table `espace_opens`** : l'ouverture de l'espace insère `(token, opened_at)` (anon) ; l'admin lit le dernier accès. Best-effort : si la table n'existe pas, ignoré → « Dernier accès : — ». **⚠️ SQL à exécuter une fois** (voir journal session 5). `SharedMeal` étendu (`e`/`ea` étapes) ; util `src/lib/ingredients.ts` (découpe + mise à l'échelle ×personnes). ✅

## État actuel (au 2026-06-26)

**Fait :**
- P0 complet : composer, feux tricolores + moyenne semaine, vue Cuisinière (copie WhatsApp), bibliothèque, persistance, mobile-first, PWA.
- P1 : liste de courses (onglet Courses), PWA installable, **fiches non encore détaillées**.
- Darija (vue Cuisinière, 24 recettes traduites) + bascule FR/AR + RTL.
- Import JSON de recettes + édition des recettes existantes (dont le type).
- Notes vocales par recette (enregistrement, lecture, partage).
- Partage par lien : hors-ligne (`#m=`) **et** publié avec audio (`#p=`).
- Backend Supabase : connexion (lien magique) + publication des notes vocales (lien court avec ▶️). Upload désormais authentifié.

**Données Supabase utiles :**
- Bucket `shared` (public) — lecture publique, écriture par utilisateurs connectés.
- Auth → URL Configuration : Site URL + Redirect = `https://diasporabookproject-cpu.github.io/Heath/`.
- Clés (URL + publishable, publiques) dans `.github/workflows/deploy.yml`. **Ne jamais committer la clé secrète.**

---

## À faire / en cours

**✅ Lot v1 de la passation produit livré (F1→F5).**

**✅ Refonte Cuisine (brief FC1–FC10) — COMPLÈTE (5 lots livrés & déployés).**
**✅ Cuisine v2 (brief FC11–FC19) — COMPLÈTE (5 lots + repas optionnels, déployés).**
- ✅ **Lot 1** : FC1 (nav) · FC2 (Semaine) · FC3 (sélecteur).
- ✅ **Lot 2** : FC5 (Recettes/statuts/filtres) · FC6 (ajout manuel + IA + auto-macros + import JSON) · FC7 (fiche + édition + validation + étapes + vocal).
- ✅ **Lot 3** : FC4 (générateur hybride biblio + complétion IA) + correctif « changer un repas placé ».
- ✅ **Lot 4** : FC9 (envoi un geste + traduction) · FC10 (espace cuisinière, projection cuisine, voix héros, RTL).
- ✅ **Lot 5** : FC8 (Courses par rayon + mise à l'échelle ×personnes + partage).

- ⏳ **Affiner « quel contenu pour quelle personne »** : aujourd'hui l'espace inclut toujours le menu courant + la sécurité assignée. Permettre de choisir les briques par personne (ex. nounou sans menu).
- ⏳ **Compléter F1** (différé) : QR imprimable + aide d'installation iOS, accusé « lu/ouvert ».
- ⏳ **Synchro multi-appareils** (menus/recettes/destinataires/sécurité). Stratégie de fusion + RLS par `user_id`. *(Note dette : destinataires + référentiel sécurité sont encore locaux à l'appareil ; à synchroniser.)*
- ⏳ **Module Entretien maison** (réutilise le socle référentiel→espace).
- ⏳ **P1/P2 Cuisine** : fiches recette détaillées, repas verrouillés, export PDF, récap calcium hebdo.
- 🧹 **Nettoyage mineur** : fichiers de test du bucket `shared` (`diagnostic-*`, `t*`, `flow*`, `testflow*`) via Storage UI.

---

## Journal des sessions

### Session 6 — 2026-06-27 (Cuisine v2)
- **Brief v2 reçu** (FC11–FC19) : refonte du modèle Cuisine. Read-back + chiffrage + risques validés ; décisions : (1) garder 3 segments Semaine/Recettes/Courses ; (2) supprimer Coupe-faim (ex-CF → rôle **Entrée**) ; (3) **un seul nombre de personnes global** (réglages Objectif).
- **Lot 1 livré — FC11 + FC12 + FC13** (réécriture du cœur) :
  - **Modèle** : `Recipe.type`→**`role`** (petit-déj/entrée/plat/accompagnement) + `fav` ; `DayMenu` = **3 repas** (`petitdej/dej/diner`), chacun conteneur **{plat, entrée, acc{id,g}}** ; **suppression socle + type de jour**. Migration DB (`SEED_VERSION=4`) : backfill role, ajout petit-déj/accompagnements au seed, **reset des semaines** (modèle incompatible). Réglages persistés (`meta.settings` : objectif + personnes).
  - **FC11/FC12** vue Semaine v2 : 3 repas par jour, **composeur** (plat + entrée + accompagnement avec quantité g, macros = somme), sélecteur filtré par rôle + **favoris** en tête.
  - **FC13** objectif individuel (plafond) + personnes : pastille d'en-tête + sheet ; jauges/statuts « sous / dans / léger dépassement / dépassé » ; moyenne hebდo sur jours complets.
  - **Nettoyage v2** : retrait des liens legacy `#m=`/`#p=` (déjà non générables) → `SharedMenuView`, `GenerateWeekSheet` supprimés ; `share.ts` refondu en **payload espace v2** (3 repas + composants) ; `espace.ts`/`publish.ts`/`shopping.ts`/`EspaceCuisine`/`PartageSheet`/`CoursesCuisine` adaptés au nouveau modèle (FC19 partiel, finition au lot 5). Favoris (FC15) déjà câblés au passage.
  - **Provisoire (lots suivants)** : « Générer la semaine » → toast (FC16, lot 3) ; navigation/copie de semaine → toast (FC14, lot 4) ; import **texte** IA (FC17, lot 2) — l'ajout actuel reste Saisir/IA/Import JSON.
  - Qualité : typecheck + **37 tests** + build + **smoke v2 réécrit & exécuté (vert)**.
- **Lot 2 livré — FC15 + FC17 + FC18** :
  - **FC15 (favoris)** & **FC18 (création → fiche directe + Valider 1‑tap)** : déjà câblés au Lot 1 (étoile biblio/sélecteur/fiche, tri favoris en tête, filtre ★ ; ajout → fiche ; bouton « Valider » sur les lignes à valider). Vérifiés.
  - **FC17 (import par texte collé)** : edge function `generate-recipe` mode **`import`** (structuration d'un texte → recette via tool use : rôle + ingrédients + étapes + macros + darija). UI : option **« Importer (coller un texte) »** dans le FAB → zone de texte → « Convertir avec l'IA » → recette **« à valider »** qui **ouvre directement sa fiche** (FC18). L'import **JSON** reste accessible (lien « Coller du JSON à la place »).
  - **⚠️ redéploiement** de l'edge function requis (nouveau mode `import`). typecheck + 37 tests + build OK.
- **Lot 3 livré — FC16 (génération = complétion IA des repas vides)** :
  - « Générer la semaine » remplit **uniquement les repas sans plat**, en générant de **nouvelles recettes IA « à valider »**, **sans toucher** au déjà composé (plus de verrou). Chaque recette est **dimensionnée sous l'objectif** : budget restant (objectif − déjà rempli) réparti entre repas vides (poids petit‑déj 0,28 / déj 0,40 / dîner 0,40, plancher 250) → `mealBudgets` (pur, testé).
  - Orchestration dans `SemaineView` : concurrence limitée (4) sur les appels `generate-recipe`, recettes Test + macros estimées + rôle imposé (petit‑déj/plat), bandeau « N à valider » déjà présent. Réutilise l'edge function existante (**pas de redéploiement**). Hors‑ligne/non connecté → message.
  - typecheck + 39 tests + build + smoke (vert).
- **Lot 4 livré — FC14 (navigation entre semaines + copier)** :
  - **Persistance multi‑semaines** : chaque semaine = un plan stocké sous une **clé = date du lundi** (`weekId(offset)`, YYYY‑MM‑DD). Store : `weekOffset` + `navWeek(±1)` (charge/crée la semaine, vide si jamais composée) ; flèches ← → branchées ; libellé + sous‑titre relatif (cette semaine / prochaine / passée).
  - **Copier une semaine** : `CopyWeekSheet` liste les semaines déjà composées (date + nb de jours + moyenne kcal/j) → **copie profonde** (composants compris) dans la semaine courante (`copyWeekInto`). `db.loadAllWeeks`.
  - typecheck + 39 tests + build + smoke OK.
- **Ajustement (2026-06-27) — repas optionnels** : un repas peut rester **volontairement vide** (ex. pas de petit-déjeuner). Le **total du jour** et la **moyenne hebdo** se calculent désormais sur les jours ayant **au moins un repas** (`dayHasAny`) au lieu d'exiger les 3 (`dayComplete`). Jauge affichée dès qu'un repas est présent. 40 tests.
- **Lot 5 livré — FC19 (Courses + espace cuisinière, modèle complet)** :
  - L'essentiel avait été fait à la migration du Lot 1 : **Courses** (`shopping.ts`/`CoursesCuisine`) agrègent les 3 repas + tous les composants, accompagnement = quantité g, **×nombre de personnes (global)** ; **espace cuisinière** (`EspaceCuisine`) rend les repas **structurés** (entrée/plat/accompagnement) avec quantités ×personnes, **voix par composant**, étapes, FR/الدارجة RTL, sans nutrition.
  - Finition : **sous-ligne « entrée / accompagnement »** sur les cartes repas de l'espace (rappel rapide du repas structuré). typecheck + 40 tests + build + smoke OK.
  - **→ Brief Cuisine v2 (FC11–FC19) COMPLET.** _Rappel : re-envoyer le menu (Partager → Envoyer) pour passer les espaces déjà publiés au format v2._


### Session 5 — 2026-06-26
- **Brief refonte Cuisine reçu** (`BRIEF_CUISINE_CLAUDE_CODE.md` + `maquette-cuisine.html` + `maquette-partage.html`) : fiches FC1–FC10 (UX complète Cuisine + partage dual). Read-back + chiffrage (2🟢 / 5🟡 / 2🔴) + risques produits et validés (« go »).
- **Lot 1 livré — FC1 + FC2 + FC3** :
  - **FC1 (nav)** : module `CuisineView` plein écran, en-tête marque + **segmented control Semaine/Recettes/Courses**, FAB sur Recettes, état d'onglet conservé, scroll remonté au changement. Barre du bas réduite à **Cuisine · Cuisinière · Sécurité** (Composer/Courses/Biblio absorbés).
  - **FC2 (Semaine)** : 7 cartes-jour (nom + date réelle), résumé hebdo (moyenne kcal/prot + jauge), **socle fixe** affiché, **jauge calorie** + statut en clair (« dans la cible / un peu haut / au-dessus »…), **⚙ jour** (cycle Repos/Cardio/Muscu, persistant), **🔒 verrouiller** + **⤧ remplacer** (Validé only), bandeau « ✦ N à valider », marqueurs ✦/🎙 sur les créneaux.
  - **FC3 (sélecteur)** : bottom-sheet, **recettes Validé du type uniquement**, recherche, filtre **Calcium champion**, drapeau calcium + macros + 🎙, tap → place le repas.
  - Helper testé `kcalStatusWord` (nutrition) ; champs `DayMenu` `type?/lockDej?/lockDin?` + actions store `setDayType/toggleLock/shuffleSlot`. Design system `src/cuisine/cuisine.css` (tokens maquette, classes `cz-`).
  - _Provisoire (comblé aux lots suivants)_ : segments **Recettes**/**Courses** affichent les vues v1 (à re-styler aux lots 2 et 5) ; **Générateur (FC4)**, **fiche détaillée (FC7)** et **ajout FAB (FC6)** renvoient un toast « prochain lot » ; navigation multi-semaines hors périmètre. typecheck + 34 tests + build OK.
- **Lot 2 livré — FC5 + FC6 + FC7** :
  - **FC5 (Recettes)** : nouvelle bibliothèque `RecettesView` (recherche + chips ✦À valider/Déjeuner/Dîner/Coupe-faim/Calcium champion), lignes avec badge statut, drapeau calcium, type, kcal/P, « macros estimées », 🎙, lignes « à valider » teintées violet ; tap → fiche.
  - **FC6 (Ajout)** : sheet d'options **Saisir / Générer IA / Importer (JSON)**. Saisie : nom/type/ingrédients/étapes + **« Calculer les macros à partir des ingrédients »** (jamais saisies). IA : champ libre + type + personnes + critères → brouillon (nom, étapes, macros) → fiche. Tout naît **à valider**.
  - **FC7 (Fiche)** : détail (bandeau IA si à valider, macros dont **calcium safran**, **note vocale juste sous les macros** + badge « partagée », ingrédients, étapes numérotées) + **édition** (recalcul macros, étapes, darija nom/ingrédients/étapes) + **validation** (→ Validé, lève « estimées »). Note vocale = `ConsigneVocale` (réutilise la mécanique audio éprouvée v1 : MediaRecorder + IndexedDB + fix-webm-duration).
  - **Auto-macros** : base locale `src/lib/macros.ts` (offline) + edge function `estimate` (préférée si en ligne), repli auto, jamais bloquant. Champs Recipe `etapes?/etapes_ar?/macros_estimees?`. Edge function `generate-recipe` étendue (mode `estimate` + `etapes`).
  - Suppression des vues v1 mortes (Composer/Bibliothèque/RecipePicker/Totals) ; import JSON préservé. typecheck + 38 tests + build OK.
  - **⚠️ À refaire côté Supabase (1×)** : redéployer l'edge function `generate-recipe` (dashboard) pour activer l'estimation macros par IA + les étapes IA. D'ici là : repli local (macros) et étapes dès le redéploiement.

- **Lot 3 livré — FC4 (générateur) + correctif UX** :
  - **FC4 `GenerateWeekSheet`** : bottom-sheet (personnes, repas à planifier, cible Léger/Équilibré/Copieux, critères alimentaires, préférences libres, interrupteurs éviter-répétitions / compléter-IA / respecter-verrouillés). Génération **hybride** : bibliothèque Validé d'abord (proche cible + variété, anti-répétition), **IA en complétion** (~25 % des créneaux + cold-start), plafonnée à 6 appels parallèles, recettes IA « à valider ». Repli 100 % bibliothèque si IA indispo.
  - **Correctif** : bouton **⇄ « changer ce repas »** sur les créneaux remplis (rouvre le sélecteur pour une recette précise) — répond à « je ne peux pas changer une recette déjà entrée ». _NB : l'édition d'une recette de bibliothèque fonctionnait déjà (Recettes → fiche → Modifier) ; le manque était côté Semaine._
  - Store `setExtras`. typecheck + 38 tests + build OK.

- **Lot 4 livré — FC9 (envoi) + FC10 (espace cuisinière)** :
  - **FC10 `EspaceCuisine`** : projection cuisine (zéro nutrition), en-tête pétrole + bascule FR/الدارجة RTL + indicateur hors-ligne ; accueil « Aujourd'hui » + cartes repas + reste de la semaine ; recette = voix héros + ingrédients ×personnes + étapes + note « traduit automatiquement ». `EspaceView` l'utilise et journalise l'ouverture.
  - **FC9 `PartageSheet`** (icône Partager dans l'en-tête) : destinataire + résumé + aperçu local + accusé de lecture + **un bouton Envoyer = espace + WhatsApp** + copier le menu du jour. Champs `tel`/`persons` sur Destinataire.
  - Edge function : mode **`translate`** (darija figée à l'envoi). Util `ingredients.ts` (×personnes). `SharedMeal` porte les étapes. typecheck + 44 tests + build OK.
  - **⚠️ 2 actions Supabase (1×)** :
    1. **Redéployer** l'edge function `generate-recipe` (active la traduction darija à l'envoi ; sans ça → repli FR / darija existante).
    2. **Créer la table d'accusé de lecture** (sinon « Dernier accès : — ») :
       ```sql
       create table if not exists public.espace_opens (
         id bigint generated always as identity primary key,
         token text not null,
         opened_at timestamptz not null default now()
       );
       alter table public.espace_opens enable row level security;
       create policy "espace_opens insert anon" on public.espace_opens
         for insert to anon, authenticated with check (true);
       create policy "espace_opens read auth" on public.espace_opens
         for select to authenticated using (true);
       create index if not exists espace_opens_token_idx on public.espace_opens (token, opened_at desc);
       ```
  - _Note dette_ : l'ancien `DestinatairesSheet` (onglet Cuisinière) coexiste avec `PartageSheet` (mêmes données locales) ; à fusionner plus tard. Filtrage fin « quelle brique pour qui » (nounou sans menu) toujours à faire.

- **Lot 5 livré — FC8 (Courses)** : `CoursesCuisine` (style maquette) — liste générée depuis la semaine, **×personnes** (stepper), groupée par rayon, cases à cocher (barré), **Partager** (Web Share / copie WhatsApp). `buildShoppingList` accepte `persons`. `CoursesView` v1 supprimée. typecheck + 45 tests + build OK. **→ Refonte Cuisine FC1–FC10 COMPLÈTE.**
  - _Restes / dette connue_ : fusionner `DestinatairesSheet` (onglet Cuisinière) dans `PartageSheet` ; filtrage fin « quelle brique pour qui » ; re-styler l'onglet Cuisinière (preview locale) et Sécurité aux tokens `cz` ; les 2 actions Supabase (redéploiement edge `translate` + table `espace_opens`) restent à faire côté dashboard.

- **Audit post-refonte (2026-06-26 soir)** : revue complète après suppression de l'onglet Cuisinière.
  - **Code mort retiré** : `publishMenu` + `PublishResult` + `newId` (`publish.ts`), `buildShareUrl` (`share.ts`) — plus aucun consommateur (le partage passe par les espaces `#e=`). Routes de lecture legacy `#m=`/`#p=` conservées (`fetchPublishedMenu`, `decodeMenu`, `readSharedFromLocation`).
  - **Aucune référence cassée** ni import inutilisé (typecheck `--noUnusedLocals` vert) ; 2 commentaires périmés corrigés.
  - **Smoke réécrit** (`scripts/smoke.mjs`) pour la nouvelle nav (segmented Semaine/Recettes/Courses, sélecteur bottom-sheet, fiche, courses) + filtre du bruit réseau externe (polices/Supabase). **Exécuté en réel : vert** (compose → fiche → courses → cochage). 45 tests unitaires + build OK.
- **Nav simplifiée (2026-06-26 soir)** : onglet **Cuisinière** supprimé (devenu redondant : note vocale = fiche FC7, aperçu = FC10, partage = FC9 dans l'en-tête). Barre du bas = **Cuisine · Sécurité**. `CuisinierView` supprimé ; routes `#m=`/`#p=`/`#e=` conservées. (`publishMenu`/`buildShareUrl` désormais inutilisés mais conservés dans les libs.)
- **Suivi Lot 4/5 + durcissement IA (2026-06-26 soir)** :
  - Bug réel en prod : génération IA « non-2xx » puis « réponse illisible » → causes successives : message d'erreur opaque (corrigé : `ai.ts` remonte statut+corps), puis **JSON tronqué** (max_tokens 1024→2048) ; **solution définitive : tool use** (sortie structurée garantie) sur les 3 modes de l'edge function. Génération validée en réel.
  - **Fusion** `DestinatairesSheet` → `PartageSheet` (plus de double gestion des personnes). typecheck + 45 tests + build OK.
  - _Action Supabase (1×)_ : redéployer `generate-recipe` (version tool use).

### Session 4 — 2026-06-23
- Passation produit v1 reçue (vision « Maison OS », fiches F1-F5).
- **F5 — Génération IA de recette** : edge function `supabase/functions/generate-recipe` (relais Claude, clé serveur) + bouton « ✨ Générer un brouillon » dans la Bibliothèque (sortie en statut Test, relecture humaine). ✅ Déployée (dashboard) + secret `ANTHROPIC_API_KEY` posé + **validée en réel**. **→ Lot v1 de la passation produit COMPLET (F1→F5).**
- **Module Sécurité (F3+F4)** : onglet « Sécurité », référentiel de fiches (numéros/procédures/gestes) + pack de démarrage importable (statut Test), note vocale du parent, darija. Assignation **par personne** ; les fiches Validé assignées s'affichent dans l'espace du destinataire (numéros en tête), dans sa langue. Flux admin vérifié (import → valider → assigner). _Reste : test live de l'espace avec sécurité ; F5 (IA recette via edge function)._
- **Slice 1 keystone (F1+F2)** : entité **Destinataire** (locale, langue, jeton) + écran de gestion ; **Espace permanent** par personne (lien `#e=<token>`) servant le menu courant dans la langue du destinataire, page lecture seule + cache offline ; contenu dans table Supabase `espaces` (upsert en place, lecture publique par jeton), audios dans `shared`. UI vérifiée (création destinataire, boutons partage). _Reste : créer la table `espaces` côté Supabase ; test live ; puis F3/F4 (Sécurité) dans le même espace._

### Session 3 — 2026-06-22
- `b292492` Corrige l'upload des notes vocales (**retrait de `x-upsert`**) — cause racine du blocage RLS, identifiée par test REST direct contre Supabase.
- `06a0206` Sécurité : publication en tant qu'utilisateur **connecté** (jeton de session). Étape 1/2 du resserrement.
- `55bfedc` Ajout de `DEVLOG.md` + `CLAUDE.md` (convention de tenue du journal).
- **Sécurité (changement DB, hors git)** : bucket `shared` verrouillé en écriture → policy `shared write authenticated` (insert, rôle `authenticated`) ; policies `anon`/`upsert` supprimées. Vérifié : upload anonyme refusé (403).
- `e345977` Corrige les notes vocales coupées à la lecture (durée WebM : `fix-webm-duration` + repli côté lecture).
- *(doc)* Ajout de `PRODUCT_CONTEXT.md` : pack de passation pour un chat produit dédié (vision, état réel, archi, faisabilité, backlog, protocole de boucle). Source de vérité produit.
- *(produit)* **Élargissement de la vision** : de « app perso de menus » → **« app de gestion de maison + briefing du personnel »**. La cuisine devient le **module 1** ; 2 modules visés en plus (Entretien maison, Enfants/Sécurité). Motif commun identifié : *référentiel → composer → transmettre (texte/voix/lien/darija/offline)* → viser un **socle générique réutilisable**. Détail dans `PRODUCT_CONTEXT.md`.
- *(produit)* **Passation v1 reçue du chat produit** (`PASSATION_CLAUDE_CODE.md`) : décisions verrouillées D1-D13, ordre de construction, fiches **F1** (espace permanent + accès tokenisé), **F2** (langue par destinataire), **F3** (module Sécurité-référentiel), **F4** (seed sécurité), **F5** (génération IA de recette via edge function). Keystone = F1+F2 ; wedge = Sécurité (F3+F4). _(MANIFESTE_PRODUIT.md référencé mais pas encore fourni.)_

### Session 2 — 2026-06-21
- `01f420f` Onglet **Courses** : liste de courses auto-générée (P1 #10), parseur d'ingrédients + tests.
- `776998f` Vue Cuisinière en **darija** (lettres arabes), bascule FR/AR, RTL, migration des données existantes.
- `88dabf6` **Import** de recettes en lot (JSON) + `TEMPLATE_RECETTE.md`.
- `1d9279d` **Édition** des recettes existantes (dont le type : ex. Dîner → Déjeuner).
- `636711b` Ajout de 2 recettes (DEJ-09 mezze poulet chermoula, DIN-10 chakchouka kefta).
- `5280022` **Notes vocales** par recette (MediaRecorder + IndexedDB), partage Web Share.
- `6e9b53c` **Partage par lien** unique sans backend (`#m=`, lz-string) + placeholder audio.
- `41bc0e5` PWA : `skipWaiting`/`clientsClaim` (mise à jour immédiate).
- `197fe34` **Backend étape 1** : connexion Supabase (lien magique).
- `8415f13` **Backend étape 2** : notes vocales dans le lien partagé (publication, bucket `shared`).

### Session 1 — 2026-06-20
- `b1915fd` **P0** : composer ses menus (PWA mobile-first, offline-first), moteur nutritionnel + tests.
- `2e336cf` Test de fumée Playwright (rendu + interactions clés).
- `9cfa39c` → `4f86f7f` Déploiement **GitHub Pages** (base `/Heath/`, activation Pages, redéploiement).
