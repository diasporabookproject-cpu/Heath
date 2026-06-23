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
16. **Module Sécurité (F3) + seed (F4)** : référentiel de fiches (numéros / procédures / gestes), contenu en **lignes** (darija en parallèle), statut Validé/Test/Écarté, note vocale du parent. **Aucune génération IA** (D7). **Assignation par personne** (`Destinataire.securiteIds`) → les fiches Validé assignées apparaissent dans l'espace, dans la langue du destinataire. Onglet « Sécurité ». Réutilise espace + audio + import. ✅ (aucune nouvelle table Supabase : contenu dans le `payload` des `espaces`).
15. **Socle « Destinataire + Espace » (keystone F1/F2, slice 1)** : entité **Destinataire** locale (IndexedDB, v3) avec **langue** + jeton capability ; **Espace** par personne stocké dans une **table Supabase `espaces`** (upsert en place, lecture publique par jeton = capability), audios dans le bucket `shared`. Lien permanent `#e=<token>`, page lecture seule offline-cache. 1re brique générique réutilisable (Sécurité/Entretien). ✅ (table à créer côté Supabase).

---

## État actuel (au 2026-06-22)

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

- 🧹 **Nettoyage mineur** : supprimer les fichiers de test du bucket (`diagnostic-*`, `t*`, `flow*`, `testflow*`) via Storage UI (sans impact).
- ⏳ **Étape 3 — Synchro multi-appareils** (menus/recettes/notes entre téléphone et ordinateur). Gros morceau : stratégie de fusion (last-write-wins ?), schéma de tables + RLS par `user_id`.
- ⏳ **P1 — Fiches recette détaillées** (techniques de cuisson, dressage), imprimables.
- ⏳ **P2** — repas verrouillés, export PDF, détection répétitions, récap calcium hebdo.

---

## Journal des sessions

### Session 4 — 2026-06-23
- Passation produit v1 reçue (vision « Maison OS », fiches F1-F5).
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
