# État de la codebase — Maison OS (dossier pour brief UI/UX)

> Document **autonome** : tout ce qu'il faut pour cadrer un brief UI/UX sans accès au repo.
> Inclut produit, architecture, modèle de données, fonctionnalités, **design system actuel**,
> contraintes/invariants, parcours clés et **rapport d'audit**.
> Prod : https://diasporabookproject-cpu.github.io/Heath/ · Stack : React + Vite + TypeScript,
> PWA mobile-first, **local-first (IndexedDB)** + Supabase (partage). Langue UI : français.

---

## 1. Le produit en bref

**Mission :** centraliser le savoir du foyer et le **transmettre** à ceux qui font tourner la
maison (cuisinière, nounou), qui lisent **dans leur langue** (dont la darija en lettres arabes).

**Primitive produit :** *une page par rôle*, pré-remplie côté parent, **transmissible** par un
**lien permanent** que le destinataire ouvre en **lecture seule, hors-ligne, dans sa langue**.

**Trois onglets (barre du bas) :** 🍽️ **Cuisine** · 🧸 **Nounou** · 🛡️ **Sécurité**.

**Public :** foyer au Maroc ; côté parent = smartphone ; côté personnel = lien reçu (WhatsApp),
souvent en darija/arabe, souvent hors-ligne.

---

## 2. Architecture & modules

- **Front** : PWA (vite-plugin-pwa), 100 % client, déployée sur GitHub Pages (base `/Heath/`).
- **State** : deux stores zustand — `useStore` (Cuisine) et `useNounou` (Nounou).
- **Persistance locale** : IndexedDB (`src/lib/db.ts`) = **source de vérité**. Stores :
  `recipes`, `weeks`, `meta`, `audio`, `destinataires`, `securite`, `nounou` (document unique).
- **Backend** : Supabase — auth (lien magique e-mail), table `espaces` (payloads de partage,
  lecture publique par **token = capability**), table `espace_opens` (accusés de lecture),
  bucket public `shared` (audios), 2 **edge functions** (relais Claude/Anthropic, tool use) :
  `generate-recipe` (génération/estimation/traduction darija/import de recettes) et
  `generate-translation` (traduction de textes darija/arabe/anglais pour Nounou).
- **Partage** : un lien `.../#e=<token>` ouvre la page reçue ; le routeur choisit le rendu
  selon `payload.kind` (Cuisine vs Nounou).

**Arborescence (indicative) :** `src/cuisine/*` (onglet Cuisine), `src/nounou/*` (onglet Nounou),
`src/views/SecuriteView.tsx` + `EspaceView.tsx`, `src/lib/*` (db, espace, share, ai, publish,
supabase, nutrition, shopping…), `src/store/useStore.ts`, `src/types.ts`.

---

## 3. Modèle de données (entités clés)

**Cuisine (v2)**
- `Recipe` : rôle (petitdej/entrée/plat/accompagnement), macros par portion (calcium mis en
  valeur), darija (`*_ar`), statut (Validé/Test « à valider »), favori, note vocale.
- `WeekMenu` : semaine = 7 jours ; chaque jour = **3 repas** (petit-déj/déj/dîner, optionnels) ;
  chaque repas = **{plat, entrée?, accompagnement?(id+grammes)}**. Objectif calorique
  **individuel** (plafond) + nombre de personnes. Multi-semaines (clé = date du lundi).

**Nounou (document unique `NounouDoc`)** — modèle **en couches**, précédence stricte
**ponctuel > période > rythme habituel** :
- `Moment` : {label, heure, type, jours[0..6, 0=lundi], enfants[], qui?, lieu?} — récurrent.
- `Periode` : {nom, emoji, début, fin, rythme:[Moment]} — rythme alternatif sur une plage.
- `Ponctuel` : {date, label, heure, type, enfants[]} — un seul jour, par-dessus.
- `Enfant` : {prénom, initiale, couleur, fiche{allergies, traitement, médecin, groupe, habitudes}}.
- `Conduite` : protocole « que faire si… » {titre, catégorie (santé/sécurité/quotidien),
  urgent?, étapes, quiAppeler?, voix} + gabarits « à compléter ».
- `UrgenceFiche` : {numéros (19/15/150 « à vérifier »), contacts, règles (autorisé/interdit)}.
- `NounouDest` : destinataire = {prénom, rôle, **langue**, **enfants scopés**, tél, token}.
- `translations` : cache par langue {texteSource → {traduction, sensible, statut}}.

**Sécurité (transverse)** : `SecuriteFiche` {type (numéros/procédure/gestes), titre, contenu,
darija, statut, note vocale} assignée à des `Destinataire`.

---

## 4. Fonctionnalités actuelles (par onglet)

**Cuisine** — 3 segments : *Semaine* (3 repas/jour, composeur multi-composants, jauge objectif),
*Recettes* (bibliothèque, statuts, favoris, ajout par saisie/IA/import texte/JSON, auto-macros,
fiche + édition + validation + voix), *Courses* (par rayon, ×personnes, partage). Génération IA
des repas vides. Navigation multi-semaines + copie. Espace cuisinière (voix, FR/darija RTL).

**Nounou** — 3 onglets : *Journée* (bande de jours, moments/périodes/ponctuels), *Conduites*
(protocoles rédigés par le parent + consignes vocales), *Fiche urgence* (numéros, contacts,
règles, fiches enfants). Partage : langue par destinataire, **lien scopé** + QR + WhatsApp +
accusé de lecture, mise à jour en place. **Page reçue** : aujourd'hui + bande de jours + 3 accès
(*Que faire si…* / *Qui appeler* appel-au-tap / *Les enfants*), RTL+arabe, hors-ligne.
**Traduction** darija/arabe/anglais (interface + contenu), relecture du sensible **non bloquante**.

**Sécurité** — référentiel numéros d'urgence / procédures / gestes permis-interdits, assigné au
personnel, poussé dans son espace dans sa langue.

---

## 5. Design system actuel (à connaître pour un redesign)

**Layout :** mobile-first, colonne centrée **`--maxw: 480px`**. Bottom-sheets pour toute
saisie. FAB pour l'ajout. Barre d'onglets en bas. En-tête par page (marque + segments).

**Couleurs (tokens CSS) :**
```
--paper #f3efe7   (fond)        --surface #ffffff   --surface-2 #fbf8f2
--ink #26221e     (texte)       --muted #90867a     --line #e7e0d3 (bordures)
--petrol #1e4d45  (action/marque cuisine)  --petrol-tint #e7efec  --petrol-ink #143733
--saffron #b6791c (calcium / accent chaud) --saffron-tint #f6ecd7
--draft #7a5aa6   (« à valider » / marque Nounou)  --draft-tint #eee8f6  --draft-line #d9ccec
--ok #3f9a63   --warn #e0922e   --bad #c8503f   --rec #c0392b
--shadow: 0 1px 2px rgba(38,34,30,.04), 0 8px 24px rgba(38,34,30,.06)
```
**Typo :** titres **Fraunces** (serif), corps **Hanken Grotesk**, chiffres/heures **JetBrains
Mono**, arabe **Noto Naskh Arabic**. **RTL complet** en arabe/darija.

**Conventions de code CSS :** classes préfixées `cz-` (Cuisine, `.cz` scope), `nz-` (Nounou),
`ck-` (espace cuisinière). Deux « design languages » très proches mais **dupliqués**.

**Motifs récurrents :** feux tricolores (objectif calorique), pastilles de statut violet
(« à valider »), cartes-jour, accordéons, « voix héros » (lecture d'un mémo du parent),
états vides invitants (anti-page-blanche).

---

## 6. Contraintes & invariants (NE PAS casser sans décision explicite)

- **Vocabulaire Nounou verrouillé** : *moment* (récurrent) · *ponctuel* (un jour) · *période*
  (plage) · *rythme habituel* (socle). Onglets **Journée · Conduites · Fiche urgence**
  (« Repères » banni).
- **Local-first** : IndexedDB = vérité ; la page reçue **doit fonctionner hors-ligne**.
- **Une langue d'auteur = source** (français) ; traductions **dérivées**, figées hors-ligne.
- **La voix est celle du parent, JAMAIS synthétisée.**
- **Personnel = lecture seule** ; aucune création côté employé.
- **Invariant sécurité enfant** : l'app est un **véhicule des consignes du parent, jamais un
  conseiller** médical/sécurité (les modèles sont des gabarits que le parent remplit).
- **Calcium toujours visible** ; mesures càc/càs non converties (règle nutrition Cuisine).
- **Assoupli récemment (décision produit)** : la relecture du sensible avant diffusion dans une
  autre langue **n'est plus bloquante** (devenue un rappel « à relire » + Valider/Éditer/Rejeter).
- **Responsive** : aucun élément à largeur fixe ; cibles tactiles ≥ 44px ; darija illustrative
  dans les maquettes → en prod via edge function.

---

## 7. Parcours utilisateurs clés

1. **Parent compose** (Cuisine : la semaine ; Nounou : Journée/Conduites/Fiche urgence).
2. **Parent partage** : crée/choisit un destinataire, règle sa **langue**, envoie **un lien
   permanent scopé** (WhatsApp pré-rempli ou QR). Mise à jour en place (même lien).
3. **Destinataire ouvre le lien** : page **lecture seule**, dans sa langue, **hors-ligne**,
   navigation jour-à-jour / recette, voix, appel au tap. Accusé de lecture remonté au parent.

---

## 8. Rapport d'audit (synthèse — voir `PLAN_ACTION.md` pour le plan détaillé)

### Qualité du code / architecture
- ✅ TS strict (`noUnusedLocals/Parameters`) → peu de code mort ; logique métier pure et testée
  (47 tests) ; sorties IA structurées.
- 🔴 **Local-first pur = risque de perte de données** : les données *sources* ne vivent qu'en
  IndexedDB (pas de sauvegarde/synchro). Changer de téléphone = tout perdre.
- 🔴 **Fuite de confidentialité dans le payload de partage** : la map de traductions est
  calculée sur le document **complet**, pas scopé → le JSON public d'un destinataire limité à un
  enfant contient des traductions de données d'autres enfants.
- 🔴 **Voix non disponible hors-ligne** : le service worker n'a pas de `runtimeCaching` → les
  audios (bucket externe) ne sont pas mis en cache, contredit l'exigence offline.
- 🟡 **Duplications structurelles** : deux notions de « destinataire », deux `dates.ts`, bande de
  jours et rendu d'entrées dupliqués (admin vs reçu), deux systèmes de partage/UI.
- 🟡 Manifest PWA encore nommé « Menu de la semaine » (branding legacy) ; pas de versioning du
  schéma Nounou ; cache de traductions jamais purgé ; quelques gros fichiers (>400 lignes).

### UX & navigation
- ✅ Anti-page-blanche, transmission en un geste, RTL/langue par destinataire : très soignés.
- 🔴 **Redondance Sécurité ⟷ Fiche urgence Nounou** (numéros, gestes, procédures) → double
  saisie et confusion sur « laquelle gagne ».
- 🔴 **Flux de traduction peu lisible** : il faut générer PUIS re-envoyer ; l'état n'est signalé
  que par un toast.
- 🟡 Pas d'**aperçu** « ce que voit la nounou » côté admin ; **onboarding** = données fictives à
  effacer ; **a11y** perfectible (boutons-icônes sans label) ; deux UI de partage différentes.

### Produit
- Déblocages : **compte-coffre** (sauvegarde/restauration), **annuaire « Maison » unifié**
  (foyer/enfants/personnel/contacts source unique).
- Extensions mission : **« Mot de Maman » du jour** (voix, non branché), **module Entretien**
  (3ᵉ page par rôle), **tableau de bord « Aujourd'hui »**, **rappels manuels**.

---

## 9. Hors-scope / connu

Hors-MVP volontaire : flux ICS exposé · automatisation WhatsApp (API Business) · bascule de
langue côté employé · création de contenu côté employé · vidéo. Non branché : « Mot de Maman »
du jour.

---

## 10. Documents de référence dans le repo
- `DEVLOG.md` — journal + ADR (décisions d'architecture), lot par lot (source canonique).
- `PLAN_ACTION.md` — plan d'action priorisé issu de l'audit (4 phases, lots chiffrés).
- `BRIEF_PRODUIT.md`, briefs Cuisine/Nounou — cadrages produit d'origine.
- Ce fichier (`ETAT_CODEBASE.md`) — dossier autonome pour cadrer un brief UI/UX.
