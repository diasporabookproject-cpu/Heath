# Passation — Refonte UI/UX « Bento lumineux » → **Manzil**

> Document d'audit + de reprise pour une nouvelle session. Objectif : permettre
> d'**auditer ce qui existe** et de mener une **Q&A / QA approfondie** sans casser les invariants.
> **Refonte fonctionnellement COMPLÈTE (Lots 0→3).** Voir aussi **`QA_REFONTE_BENTO.md`** (guide de session Q&A : scénarios, check-list, limites, questions ouvertes).
> Dernière mise à jour : **2026-07-05**. Écrit à la main (pas d'auto-génération).

---

## 0. TL;DR

- **Nature** : CONVERGENCE de l'app existante vers un prototype validé (« Bento lumineux » v6.1),
  pas une réécriture. Règles : l'UX du prototype gagne sur l'UI existante ; les **invariants
  produit + le modèle de données** gagnent sur le prototype ; **aucune capacité supprimée sans accord**
  (« rhabiller, pas retirer »).
- **Branche** : tout le travail est sur **`refonte/bento-v1`** (tag local `pre-bento` sur la base).
  La **branche de prod = `claude/jolly-wozniak-s83str`** (c'est elle que déploie GitHub Pages). **Non fusionnée.**
- **Livré — Lots 0→3 COMPLETS** : Lot 0 (socle `mz-`), Lot 1 (hub Maison + navigation + état de
  transmission), Lot 2 (Cuisine + Nounou rhabillées Manzil, feuilles incluses), **Lot 3 « Flux »**
  (EnvoiSheet v2 · pastilles Envoyer/Briefer/Planifier · 3 portes + quota IA · file de relecture ·
  collections/packs · rappel d'envoi). Prototype `prototype-interactif-v6-1-bento.html` committé (spec).
- **Déployé en PRÉVUE** sur l'URL de prod : **https://diasporabookproject-cpu.github.io/Heath/**
  (voir §6 pour le mécanisme ; la branche de prod reste intacte).
- **Reste** : **test QNA global + check-list** d'Amine (voir `QA_REFONTE_BENTO.md`), puis **décision de merge**.
- **Qualité à chaque commit** : `typecheck` + `test` (**90**) + `build` + `smoke` **verts**. Aucune action Supabase pendant la refonte.

---

## 1. Comment auditer (mise en route)

```bash
git fetch origin refonte/bento-v1 && git checkout refonte/bento-v1
npm ci
npm run typecheck      # tsc -b --noEmit
npm run test           # Vitest — 90 tests
npm run build          # tsc + vite build
npm run preview &      # sert le build sur http://localhost:4173
npm run smoke          # Playwright bout-en-bout (parcours Cuisine via le hub Maison)
```

- **Prévue en ligne** (déjà déployée) : https://diasporabookproject-cpu.github.io/Heath/
  (PWA — rafraîchir 1–2× pour vider le cache du service worker).
- **Vitrine du design system** : ouvrir `#mz-demo` (ex. `http://localhost:4173/#mz-demo`) — toutes les
  primitives `mz-` en LTR **et** RTL. Porte dev, hors navigation de prod.
- **Écrans clés à regarder** : Maison (accueil) → carte **Cuisine** (héros vert) / **Nounou** (héros violet)
  → feuilles (composeur, fiche recette, partage). Pastille **« Envoyer »** sur une carte-personne =
  ouvre la page + feuille de partage pré-remplie.

---

## 2. Ce qui est livré, lot par lot (commits sur `refonte/bento-v1`)

| Commit | Contenu |
|---|---|
| `0b96140` | **Lot 0** — design system `mz-` (`src/ui/mz.css` + `primitives.tsx`), sanitizer (`src/lib/sanitize.ts` + 8 tests), lecteur audio `MzAudio`, branding « Manzil », vitrine `#mz-demo`. |
| `04febb0` | **Lot 1** — hub **Maison** (`src/maison/`), routeur (App), retour `‹ Maison`, suppression bottom-tabs, absorption Sécurité, **état de transmission** (signatures locales, store IndexedDB `published`, DB v6). |
| `5a21b3b` | **Lot 2 — Cuisine** rhabillée Manzil (retheme par tokens `.cz`, en-tête → héros vert, FAB ambre ; feuilles incluses). |
| `a822e03` | **Lot 2 — Nounou** rhabillée Manzil (scope `.cz-nounou` → héros violet + accents violets). |
| `4f81beb` | **Clôture Lot 2** — décisions : espaces reçus gardés en Manzil ; renommage `cz-/nz-` reporté. |
| `6d71f27` | **L3-1** — câblage « personne = contexte → envoi ciblé » (pastille Envoyer → feuille pré-sélectionnée). |
| `2a403d8`, `cac7fbe` | **CI** — déclencheur temporaire de prévue sur l'URL de prod (à retirer au merge). |
| `897d2f3` | **Lot 3 kickoff** — prototype v6.1 committé (spec) + cadrage (décisions Amine). |
| `9be3099` | **C1 + C2** — correctifs Maison (fin de journée « Journée terminée » ; teinte timeline par rôle) + libellés « nouvelle page ». |
| `b30a6a2` | **#2** — pastilles Maison **Envoyer / Briefer / Planifier** (fonction pure `pillKind`, signaux réels). |
| `876b2d5` | **L3-1b** — **EnvoiSheet v2** : composeur de digest partagé (`digest.ts`) + `DigestBlock`, portées, corps par rôle. |
| `a58af7e` | **L3-2** — création **3 portes** + **quota IA** (store `app` **DB v7**, `quota.ts`) ; ADR store `app`. |
| `7d8d9b2` | **L3-3** — **file de relecture** des brouillons IA (`RelectureSheet`) ; suppression des « Valider » par ligne. |
| `0d75f12` | **L3-4** — **collections/packs** (`packs/*.json`, `lib/packs.ts`, `CollectionsSheet` + rail). |
| `ecd913e` | **L3-5** — **rappel d'envoi** (v1 pastille only, `rappel.ts`, `RappelSheet`) → **Lot 3 complet**. |

---

## 3. Décisions d'architecture (ADR) — à respecter

1. **Retheme par TOKENS, pas renommage de classes.** Les pages `cz-/nz-` sont une identité distincte,
   mais `cuisine.css` est ~90 % piloté par tokens. On a repointé les tokens `.cz` sur le langage `mz-`
   et restylé l'en-tête → **toute la page + ses feuilles** deviennent Manzil **sans toucher au JSX/logique**.
   Nounou : scope `.cz-nounou` qui surcharge le token d'accent `--petrol` → violet + dégradé d'en-tête.
   ➜ **Conséquence** : les **noms** `cz-/nz-/ck-` subsistent (morts en identité, pas en nom). Le renommage
   littéral est **abandonné** (churn ~35 fichiers, casse les sélecteurs du smoke, zéro gain visuel).
2. **Page = contenu ; personne = contexte.** Maison liste les **personnes** ; ouvrir une personne ouvre
   la page de son **rôle** dans son contexte (langue, scope, cible d'envoi). Pas de sélecteur permanent
   dans l'en-tête, pas de duplication de contenu. Adaptateur lecture : `src/maison/personnes.ts`
   (unifie destinataires Cuisine + Nounou **sans** fusionner les stores).
3. **Navigation = hub à 3 niveaux max.** Maison = écran racine ; pages de rôle en plein écran avec
   `‹ Maison` ; **plus de bottom-tabs**. Liens reçus `#e=` et vitrine `#mz-demo` court-circuitent avant
   tout rendu applicatif (intouchés).
4. **État de transmission (local, sans réseau).** Signature `hashStr` (djb2→base36, `src/lib/hash.ts`)
   du payload scopé par jeton (`cuisineSig` dans `src/maison/transmission.ts`, `nounouSig` dans
   `src/nounou/partage.ts`), comparée à la dernière publication (store IndexedDB `published`, **DB v6**,
   `recordPublished`/`loadPublished` dans `src/lib/db.ts`). Surfacé sur les cartes-personnes de Maison
   (✓ transmis / ● nouveau à envoyer / ● jamais envoyé).
5. **Sanitizer au rendu seulement** (`src/lib/sanitize.ts` : `cleanText`/`cleanQty`/`phoneNbsp`) — **ne
   mute jamais les données**. Quantités & téléphones insécables. Ne normalise pas càc/càs.
6. **Espaces reçus (`#e=`) gardés en habillage Manzil** (héritage des tokens `.cz`), structure `ck-`/`nz-`
   et RTL/darija intactes. Décision Amine : cohérence produit.
7. **Heures conventionnelles** (non réglables) : petit-déj **08:00**, déj **12:30**, dîner **20:00**
   (`src/maison/prochain.ts`).
8. **L3-1 backbone** : `App` porte `shareFor` (jeton) → `openPage(kind, person, share)` ; les vues
   consomment le jeton une fois (`shareToken` + `onConsumeShare`) ; `PartageSheet`/`PartageNounouSheet`
   acceptent `initialToken` → amorcent `selId`. **Survit** à un futur EnvoiSheet v2.
9. **EnvoiSheet v2 — « la portée ne change QUE le message ».** L'envoi publie **toujours** la page
   complète et à jour (`publishEspace`/`publishNounouEspace` inchangés) ; les portées (semaine/jour/…)
   ne modifient que le **digest WhatsApp** (`src/maison/digest.ts`, pur). Modèle « page vivante », jamais
   d'instantané partiel. Coquille + composeur partagés (`src/ui/DigestBlock.tsx`), corps par rôle.
10. **Store transverse `app` (DB v7).** Réglages ni recette/menu/destinataire (quota IA, rappels) → store
    dédié `app` (clé `'app'`, `loadApp`/`saveApp`), **pas** d'extension de `CuisineSettings`. `DB_VERSION 6→7`.
11. **IA = accélérateur, jamais péage.** Saisie manuelle **toujours gratuite/illimitée** et **née `Validé`**.
    Quota IA **front-only** (`src/lib/quota.ts`, 5/mois, reset mensuel) sur la seule porte ③ (« coup de main IA »).
12. **Anti-doublon des packs par NOM** (`src/lib/packs.ts`) — raffinement de la question Q4 : `packId+nom`
    seul laisserait dupliquer le pack « seed » déjà en bibliothèque ; la dédup par nom couvre aussi la réinstallation.
13. **Rappel d'envoi v1 = pastille only.** **Aucune notification système** ; mention in-app à l'ouverture
    (échéance pure `src/lib/rappel.ts`, testée). Microcopy honnête. « Rappel sans ouvrir l'app » = backlog.

---

## 4. Carte des fichiers (refonte)

**Nouveau (design system & hub)**
- `src/ui/mz.css` — tokens Manzil (`--mz-*`) + primitives CSS (héros, cartes, chips, feuilles, toast, RTL).
- `src/ui/primitives.tsx` — `MzScreen/MzScroll/PageHero/ActionBar/Card/Pill/Chips/Chip/Sheet/useToast`.
- `src/ui/MzDemo.tsx` — vitrine `#mz-demo`. `src/ui/MzAudio.tsx` — lecteur audio custom.
- `src/maison/MaisonView.tsx` — écran racine (Aujourd'hui + Ton équipe + Sécurité + nouvelle page).
- `src/maison/personnes.ts` — adaptateur Personne (Cuisine+Nounou). `KIND_LABEL`/`KIND_PICTO`.
- `src/maison/prochain.ts` — agenda cross-rôles du jour (moments Nounou projetés + repas Cuisine).
- `src/maison/transmission.ts` — `cuisineSig` + `envoiState` + **`pillKind`** (pastille Maison, testée).
- `src/lib/hash.ts` — `hashStr`. `src/lib/sanitize.ts` (+ `.test.ts`) — nettoyage au rendu.

**Nouveau (Lot 3 « Flux »)**
- `prototype-interactif-v6-1-bento.html` — **le prototype v6.1** (spec de comportement : objets `WA`, `state`/`render`, sheets `sh-*`).
- `src/maison/digest.ts` (+ `.test.ts`) — composeur de digest WhatsApp partagé (cuisine/nounou).
- `src/ui/DigestBlock.tsx` — coquille partagée portées + bulle éditable (EnvoiSheet v2).
- `src/lib/quota.ts` (+ `.test.ts`) — quota IA mensuel (pur). `src/lib/packs.ts` (+ `.test.ts`) — install des packs (pur).
- `src/lib/rappel.ts` (+ `.test.ts`) — échéance des rappels (pur).
- `src/data/packs.ts` + `src/data/packs/*.json` — collections (format versionné).
- `src/cuisine/RelectureSheet.tsx` — file de relecture IA. `src/cuisine/CollectionsSheet.tsx` — collections.
- `src/cuisine/RappelSheet.tsx` — réglage rappel (partagé cuisine+nounou).

**Modifié (convergence)**
- `src/App.tsx` — routeur hub (screen: maison|cuisine|nounou|securite), sheet « nouvelle page »,
  plomberie `shareFor`. `index.html`, `vite.config.ts` — branding + polices.
- `src/lib/db.ts` — store `published` (DB v6) + **store `app` (DB v7)** (`AppState`/`Rappel`, `loadApp`/`saveApp`).
- `src/store/useStore.ts` — `app` state + `consumeAi`/`setRappel`/`bumpReminderCheck`.
- `src/lib/espace.ts` — `publishEspace` appelle `recordPublished(cuisineSig)`.
- `src/nounou/partage.ts` — `nounouSig`, `publishNounouEspace` appelle `recordPublished`.
- `src/cuisine/cuisine.css` — **retheme tokens `.cz` → Manzil** + héros vert + FAB ambre + styles L3.
- `src/nounou/nounou.css` — scope `.cz-nounou` (héros violet + accents).
- `src/cuisine/CuisineView.tsx`, `src/nounou/NounouView.tsx` — retour `‹ Maison`, `initialShareToken`, host collections.
- `src/cuisine/PartageSheet.tsx`, `src/nounou/PartageNounouSheet.tsx` — **EnvoiSheet v2** (portées + digest + ligne rappel) sur le backbone `initialToken`.
- `src/cuisine/AddRecipeSheet.tsx` — **3 portes** + quota. `src/cuisine/RecettesView.tsx` — bannière relecture + rail collections (plus de « Valider » par ligne).
- `src/maison/MaisonView.tsx` — pastilles Envoyer/Briefer/Planifier + mention rappel. `src/types.ts` — `origineIA`/`packId`/`RecipeSeed`/`Pack`.
- `src/styles.css` — `.topbar__back`. `scripts/smoke.mjs` — entrée Cuisine via le hub.

**Hors périmètre (ne pas restyler sans accord)** : espaces reçus `src/cuisine/EspaceCuisine.tsx`,
`src/nounou/NounouEspaceView.tsx`, `src/views/EspaceView.tsx` (leur structure `ck-`/`nz-`/RTL est intacte).

---

## 5. Invariants produit (NE PAS casser)

- **UI en français** ; darija en lettres arabes pour les pages destinées à la cuisinière/nounou.
- **Local-first** : IndexedDB = source de vérité (`src/lib/db.ts`), migrations via `DB_VERSION`/`SEED_VERSION`.
- **Calcium toujours visible** partout ; **ne pas normaliser** les mesures à la cuillère (càc/càs).
- **Aucune capacité supprimée** sans accord explicite (rhabiller, pas retirer).
- **Secrets** : ne jamais committer la clé Supabase `secret`/`service_role`. La `publishable` (publique) +
  l'URL vivent dans `.github/workflows/deploy.yml`.
- **Tenir le DEVLOG** : entrée « Journal des sessions » à chaque commit ; ADR à chaque décision d'archi.

---

## 6. Déploiement & prévue (important)

- Le workflow `.github/workflows/deploy.yml` déploie **un seul site Pages** (l'URL de prod) sur push vers
  **`claude/jolly-wozniak-s83str`** (branche de prod) **ou** `refonte/bento-v1` (déclencheur **temporaire**
  ajouté pour la prévue — **à retirer au merge final**).
- L'environnement `github-pages` autorise les branches `refonte/*` (règle ajoutée par Amine dans
  Settings → Environments → github-pages → Deployment branches). Sans ça, le job `deploy` échoue.
- **Chaque push sur `refonte/bento-v1` redéploie la prévue** sur l'URL de prod. La branche de prod n'est
  **pas** touchée ; pour restaurer l'app actuelle, redéployer `claude/jolly-wozniak-s83str`.
- **Merge en prod = décision explicite d'Amine** (non prise). Au merge : retirer `refonte/bento-v1` du
  déclencheur `on.push.branches`.
- ⚠️ L'intégration GitHub (MCP) **n'a pas** le droit `actions: write` : impossible de déclencher
  `workflow_dispatch`/re-run par API — on redéploie **en poussant un commit**.

---

## 7. Lot 3 « Flux » — LIVRÉ (récap)

| Fiche | Livré |
|---|---|
| **C1 / C2** | Fin de journée « Journée terminée 🌙 » (plus de faux « prochain ») ; teinte de timeline par rôle. |
| **#2** | Pastilles Maison **Envoyer > Briefer > Planifier > ✓** sur signaux réels (fonction pure `pillKind`, testée ; Briefer = ponctuel ≤ 7 j, Planifier = semaine suivante vide). |
| **L3-1b** | **EnvoiSheet v2** : composeur de digest partagé depuis les données réelles, portées (semaine/jour/📌…), bulle éditable ; portée = message uniquement ; corps par rôle ; digest vide → confirmation ; sans tél → « Publier + copier ». |
| **L3-2** | Création **3 portes** (bibliothèque/collections · saisie manuelle **née `Validé`** · ✦ IA un seul champ) + **quota IA** front-only (5/mois, reset mensuel) ; store `app` DB v7. |
| **L3-3** | **File de relecture** des brouillons `Test` (1/N, avertissement sanitizer, Supprimer/Modifier/Valider) ; bannière biblio ; **plus de « Valider » par ligne**. |
| **L3-4** | **Collections/packs** (`packs/*.json`, rail + sheet, install = copie `Validé`+`packId`, **anti-doublon par nom**). |
| **L3-5** | **Rappel d'envoi** v1 **pastille only** (aucune notif système) ; réglage par rôle ; mention Maison à échéance. |

**Points d'attention / dette connue**
- Noms `cz-/nz-/ck-` conservés (ADR 1) — assumé, pas une régression. Renommage littéral abandonné.
- Déclencheur de déploiement `refonte/bento-v1` **temporaire** (à retirer au merge).
- **Non vérifiable en headless (→ à cocher au QNA manuel, session Supabase requise)** : envois réels
  (publication + `wa.me` + retour ✓ transmission + accusé) ; rendu **visuel** de la page reçue (`#e=`) ;
  pastilles **Briefer/Planifier** (exigent un état `uptodate` = publication réelle). Voir `QA_REFONTE_BENTO.md`.
- Dette pré-refonte (voir « À faire / en cours » du DEVLOG) : synchro multi-appareils, QR imprimable +
  accusé lu/ouvert, module Entretien, P1/P2 Cuisine, nettoyage bucket `shared`.

**Backlog issu du Lot 3** : rappel « sans ouvrir l'app » (notification/push) ; contenu éditorial riche
des collections ; sélecteur de jour avancé pour la portée « Un jour… ».

---

## 8. Contexte produit (rappel mission)

App PWA mobile-first (React + Vite + TS) pour **centraliser le savoir du foyer et le transmettre au
personnel** (cuisinière Khadija, nounou Fatima) qui lit **dans sa langue** (dont darija/arabe).
Voir `BRIEF_PRODUIT.md` (produit) et `DEVLOG.md` (architecture + journal + ADR).
