# Passation — Refonte UI/UX « Bento lumineux » → **Manzil**

> Document d'audit + de reprise pour une nouvelle session. Objectif : permettre
> d'**auditer ce qui existe** puis de **spécifier/écrire les prochaines
> fonctionnalités** (fin du Lot 3) sans casser les invariants.
> Dernière mise à jour : **2026-07-04**. Écrit à la main (pas d'auto-génération).

---

## 0. TL;DR

- **Nature** : CONVERGENCE de l'app existante vers un prototype validé (« Bento lumineux » v6.1),
  pas une réécriture. Règles : l'UX du prototype gagne sur l'UI existante ; les **invariants
  produit + le modèle de données** gagnent sur le prototype ; **aucune capacité supprimée sans accord**
  (« rhabiller, pas retirer »).
- **Branche** : tout le travail est sur **`refonte/bento-v1`** (tag local `pre-bento` sur la base).
  La **branche de prod = `claude/jolly-wozniak-s83str`** (c'est elle que déploie GitHub Pages). **Non fusionnée.**
- **Livré** : Lot 0 (socle `mz-`), Lot 1 (hub Maison + navigation + état de transmission),
  Lot 2 (Cuisine + Nounou rhabillées Manzil, feuilles incluses), **L3-1** (câblage « personne → envoi ciblé »).
- **Déployé en PRÉVUE** sur l'URL de prod : **https://diasporabookproject-cpu.github.io/Heath/**
  (voir §6 pour le mécanisme ; la branche de prod reste intacte).
- **Reste (Lot 3)** : fonctionnalités **nouvelles** → §7. Elles ont besoin du **prototype/spec**.
- **Qualité à chaque commit** : `typecheck` + `test` (55) + `build` + `smoke` **verts**. Aucune action Supabase pendant la refonte.

---

## 1. Comment auditer (mise en route)

```bash
git fetch origin refonte/bento-v1 && git checkout refonte/bento-v1
npm ci
npm run typecheck      # tsc -b --noEmit
npm run test           # Vitest — 55 tests
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

---

## 4. Carte des fichiers (refonte)

**Nouveau (design system & hub)**
- `src/ui/mz.css` — tokens Manzil (`--mz-*`) + primitives CSS (héros, cartes, chips, feuilles, toast, RTL).
- `src/ui/primitives.tsx` — `MzScreen/MzScroll/PageHero/ActionBar/Card/Pill/Chips/Chip/Sheet/useToast`.
- `src/ui/MzDemo.tsx` — vitrine `#mz-demo`. `src/ui/MzAudio.tsx` — lecteur audio custom.
- `src/maison/MaisonView.tsx` — écran racine (Aujourd'hui + Ton équipe + Sécurité + nouvelle page).
- `src/maison/personnes.ts` — adaptateur Personne (Cuisine+Nounou). `KIND_LABEL`/`KIND_PICTO`.
- `src/maison/prochain.ts` — agenda cross-rôles du jour (moments Nounou projetés + repas Cuisine).
- `src/maison/transmission.ts` — `cuisineSig` + `envoiState`. `src/lib/hash.ts` — `hashStr`.
- `src/lib/sanitize.ts` (+ `.test.ts`) — nettoyage au rendu.

**Modifié (convergence)**
- `src/App.tsx` — routeur hub (screen: maison|cuisine|nounou|securite), sheet « nouvelle page »,
  plomberie `shareFor`. `index.html`, `vite.config.ts` — branding + polices.
- `src/lib/db.ts` — store `published` (DB v6), `recordPublished`/`loadPublished`.
- `src/lib/espace.ts` — `publishEspace` appelle `recordPublished(cuisineSig)`.
- `src/nounou/partage.ts` — `nounouSig`, `publishNounouEspace` appelle `recordPublished`.
- `src/cuisine/cuisine.css` — **retheme tokens `.cz` → Manzil** + héros vert + FAB ambre.
- `src/nounou/nounou.css` — scope `.cz-nounou` (héros violet + accents).
- `src/cuisine/CuisineView.tsx`, `src/nounou/NounouView.tsx` — retour `‹ Maison`, `initialShareToken`/`onConsumeShare`.
- `src/cuisine/PartageSheet.tsx`, `src/nounou/PartageNounouSheet.tsx` — prop `initialToken` (pré-sélection).
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

## 7. Reste à faire — Lot 3 (fonctionnalités NOUVELLES → besoin de spec/prototype)

Ce ne sont plus des rhabillages : à cadrer avec le **prototype v6.1** ou des maquettes avant de coder.

1. **EnvoiSheet v2** — refonte visuelle de la feuille d'envoi (le **backbone L3-1** est déjà là : la feuille
   s'ouvre pré-sélectionnée par personne ; il « suffit » de refaire l'intérieur en `mz-`).
   *Manque : la maquette de la feuille.*
2. **Création « 3 portes » + quota IA** — les 3 façons de créer une page/du contenu + compteur d'usage IA.
   *Manque : les 3 portes exactes, le comportement du quota, l'emplacement.*
3. **File de relecture IA** — écran pour relire/valider les traductions (le sensible est un **rappel non
   bloquant**, décidé au Lot 4.2 Nounou). *Manque : la maquette + le workflow de validation.*
4. **Collections / packs** — regrouper des recettes/consignes réutilisables. *Manque : modèle de données + UX.*
5. **Rappels** — relances d'envoi. **Décision Lot 1** : rappel **éteint par défaut**, invitation à l'activer
   dans le sheet Envoyer, **repli pastille in-app** (pas de notification système). *Manque : déclencheurs + UI.*

**Points d'attention / dette connue**
- Noms `cz-/nz-/ck-` conservés (voir ADR 1) — assumé, pas une régression.
- Déclencheur de déploiement `refonte/bento-v1` **temporaire** (à retirer au merge).
- Vérif **visuelle** de la page reçue (`#e=`) à faire sur un **lien publié réel** (non reproductible headless).
- Dette pré-refonte encore valable (voir « À faire / en cours » du DEVLOG) : synchro multi-appareils,
  QR imprimable + accusé lu/ouvert, module Entretien, P1/P2 Cuisine, nettoyage bucket `shared`.

---

## 8. Contexte produit (rappel mission)

App PWA mobile-first (React + Vite + TS) pour **centraliser le savoir du foyer et le transmettre au
personnel** (cuisinière Khadija, nounou Fatima) qui lit **dans sa langue** (dont darija/arabe).
Voir `BRIEF_PRODUIT.md` (produit) et `DEVLOG.md` (architecture + journal + ADR).
