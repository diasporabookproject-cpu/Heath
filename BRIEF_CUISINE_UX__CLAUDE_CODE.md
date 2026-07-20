# BRIEF — Chantier UX Cuisine · DA v2

> ## 🔴 CORRECTIONS (PO + Q&A, 19/07) — À LIRE AVANT LE BRIEF D'ORIGINE
> Ce brief a été relu à froid par la Q&A et arbitré par le PO. **Cinq corrections priment sur le texte
> d'origine ci-dessous** (le corps du brief a été amendé en conséquence, ce bandeau les récapitule) :
>
> 1. **Vocabulaire — « mon équipe », PAS « Membres ».** Le personnel s'affiche **« mon équipe »** ; le mot
>    **« membre » reste réservé aux comptes** (table `membres`, policies — inchangé). **NE PAS renommer
>    « membre → personnel ».** *(La DA d'origine proposait « Membres » = personnel — écarté : retournerait un
>    mot de la base.)* Concerne aussi B1 : la maquette `proto-b1-reference.html` affichait « Membres » — **elle
>    a été corrigée en « Mon équipe »**, la reproduire telle que corrigée.
> 2. **§2.1 PÉRIMÉ — la purge nutrition est CLOSE** (lot « simplification transverse », mergé le 19/07, edge v2
>    en prod). Il n'y a **plus de "double purge" à craindre** : la nutrition est déjà retirée partout. **Vérifier
>    seulement** au read-back que `MealComposerSheet` n'importe plus `../lib/nutrition` (résidu éventuel) — si un
>    reste subsiste, le retirer ; sinon rien à purger. *(Voir `ETAT.md`.)*
> 3. **§2.3 PÉRIMÉ — l'audit sécurité §7.8 est CLOS** (18/07). La réponse à « UX maintenant ou après l'audit ? »
>    est **maintenant** — tous les prérequis sont levés. *(Voir `ETAT.md`.)*
> 4. **Q1 TRANCHÉE — goûter = repas PLEIN**, transmis/partagé comme les autres (pas une note allégée).
> 5. **Q2 TRANCHÉE — recette LÉGÈRE**, pas de texte éphémère. Un repas simple (« yaourt ») se saisit via
>    « L'écrire » avec **juste un nom** — mais il est **enregistré comme recette** (réutilisable, transmissible,
>    conforme à la thèse). **PAS de texte libre non sauvegardé.** *Claude Code vérifie au read-back qu'une
>    `Recipe` minimale (nom seul, ingrédients/étapes vides) est un état valide de bout en bout : bibliothèque +
>    partage + page reçue.*
>
> **Autres rappels :** ordre d'implémentation **câbler `tokens.css` (absent de `src/` — importer, pas dupliquer)
> → B1 (écran-socle) → puis Cuisine** ; **`apk.yml` à repointer** (pointe encore `lot-simplification-v1`) ;
> **maquette compilée périmée** sur les libellés (affiche encore Matin/Midi/Soir) → **le prototype cliquable fait
> foi** ; **emoji Fluent EMBARQUÉ, jamais CDN** (le CDN des maquettes est une béquille d'aperçu).

---

### Pack de passation → Claude Code (implémentation) + instance Q&A (relecture à froid)

> **Rituel d'ouverture.** Contexte = `PROJET_MAISON_OS.md` + `ETAT.md` + **ce brief** + les deux maquettes de
> référence (ci-dessous). Chantier : §7.1 (UX passe 2 — esthétique) appliqué au module **Cuisine**.
> **Sortie du dispositif :** ce document est un **brief**, pas un ordre d'exécution. Claude Code répond d'abord
> par un **read-back + chiffrage 🟢/🟡/🔴 + questions/contestations**, puis attend le **GO**. Aucun code avant.

---

## 0. En un paragraphe

On a mené la passe esthétique sur la Cuisine et convergé vers une **direction artistique v2** (DA v2). Ce
brief la transmet pour implémentation : la **fondation visuelle** (tokens), le **Menu** (jour + semaine), les
**Recettes** (états vide/plein), le geste **« Ajouter un repas »** (radial + sélecteur), et le **footer**.
Deux références font foi : un **prototype cliquable** (navigation réelle, 4 moments) et une **compilation
statique** (tous les états détaillés). Plusieurs points restent **à trancher par le PO** — ils sont isolés en
§6 et ne doivent **pas** être devinés.

---

## 1. Périmètre

**Dans le périmètre :**
- Fondation visuelle DA v2 (couleurs, typo, repères emoji) sur le module Cuisine.
- `SemaineView` (Menu jour + semaine) : en-tête, sélecteur temporel, cartes de moment, dispositions bas.
- Passage à **4 moments** : Petit déjeuner · Déjeuner · Goûter · Dîner (le goûter promu — cf. §5, SPEC 3).
- `RecettesView` : refonte états vide/plein (sections par moment, collections repositionnées).
- Geste **« Ajouter un repas »** : menu **radial** + sélecteur bibliothèque (réutilise l'existant).
- Footer de navigation (emoji Fluent).

**Hors périmètre (ne pas traiter ici) :**
- **Fiche recette** (`RecipeDetailSheet`) — pas encore conçue.
- **Courses** (`CoursesCuisine`) — pas encore conçue.
- **Projection cuisinier** (`EspaceCuisine`) — **sauf** l'adaptation minimale imposée par le 4ᵉ moment (SPEC 3).
- La **purge nutrition complète** — lot dédié (« simplification transverse »). Voir §2, prérequis.
- Nounou, Sécurité, FTUE, partage — non touchés.

---

## 2. Prérequis & séquencement — ⚠️ MIS À JOUR AU 19/07 (les 3 points sont RÉSOLUS)

*Le brief d'origine posait trois points de coordination. Depuis, deux lots ont été clos — voici leur état réel.*

1. **Recouvrement avec la purge nutrition → RÉSOLU (purge CLOSE).** Le lot « simplification transverse » est
   **mergé (19/07)** : macros/calcium/calories/objectif retirés **partout**, edge `generate-recipe` v2 en prod,
   porte CI `assertNoKcal` en place. Il n'y a **plus de double purge à craindre.** **Seule action au read-back :**
   confirmer que `MealComposerSheet` n'importe plus `../lib/nutrition` (si un résidu subsiste, le retirer — mais
   la purge devrait déjà l'avoir traité). Le nouveau Menu n'a pas de jauges : cohérent, rien à re-purger.
2. **`tokens.css` → À CÂBLER (vérifié : ABSENT de `src/`).** Le fichier n'existe pas encore dans l'app. Première
   action technique : **l'importer** (sans dupliquer un `:root` — il n'y en a pas à dupliquer puisqu'il est
   absent). C'est le socle partagé maquettes ↔ app.
3. **Place dans l'ordre de livraison → RÉSOLU : MAINTENANT.** L'audit sécurité §7.8 est **clos (18/07)**. Tous
   les prérequis sont levés. Le chantier UX démarre maintenant. *(État complet : `ETAT.md`.)*

---

## 3. La DA v2 — fondation visuelle (le socle du lot)

Valeurs verrouillées. Toutes les maquettes s'y tiennent ; elles sont la source de vérité chiffrée.

| Rôle | Valeur |
|---|---|
| Fond app | `#f8f6f4` |
| Carte | `#ffffff` · ligne `#eeeae6` |
| Encre / muted | `#1c1815` / `#8f8a85` |
| **Accent UNIQUE** | terracotta `#d9622f` (lien `#c25528`) |
| Teinte cuisine (en-tête chips) | `color-mix(ink 7%)` |
| **Moment · Petit déjeuner** | fond `#fbe9d2` · encre `#b9781f` |
| **Moment · Déjeuner** | fond `#e8efdf` · encre `#5f7a3f` |
| **Moment · Goûter** | fond `#fbe4e0` · encre `#b56a5a` |
| **Moment · Dîner** | fond `#dfeeeb` · encre `#3f7d72` |
| Typo | **100 % Plus Jakarta Sans** (titres 800, labels 700/800) |
| Interdits | **zéro dégradé, zéro filigrane, un seul accent** |

**Repères emoji.** Les plats et pictos de navigation utilisent **Fluent Emoji Flat**. ⚠️ Dans les maquettes,
ils sont chargés via CDN `<img>` avec fallback système (`onerror`). **En prod, l'invariant offline-first
interdit une dépendance réseau pour un repère affiché** → décision requise (Q6, §6) : **bundler les SVG Fluent
utilisés** ou retomber sur l'**emoji système**. Le CDN n'est acceptable qu'en maquette.

---

## 4. Références fournies (à committer dans `docs/maquettes/`)

**Référence principale — comportement + moments :**
- **`CUISINE-prototype-cliquable.html`** — prototype interactif, **4 moments**, navigation réelle (footer,
  bouton Semaine, radial, sélecteur, curseur vide/plein). **Fait foi pour les moments et les enchaînements.**

**Référence secondaire — tous les états détaillés + DA :**
- **`CUISINE-maquettes-compilees.html`** — galerie statique (Menu jour/semaine, Recettes vide/plein, radial +
  sélecteur). ⚠️ **Précède la décision 4 moments** (affiche encore Matin/Midi/Soir) → pour les libellés de
  moment, **suivre le prototype**, pas la compilée.

**Traces (historique de convergence, non normatives) :** `maquette-cuisine-menu-FINAL.html`,
`…-recettes-etats.html`, `…-radial-3petales.html`, `…-ajouter-repas-plein.html`.

---

## 5. Les specs (format §8)

### SPEC 1 — Fondation DA v2
- **Type** : refactor CSS / design tokens · **Module** : Cuisine (puis transverse)
- **Objectif** : poser la DA v2 comme socle unique de rendu.
- **Comportement** : appliquer les tokens du §3 ; en-tête, cartes, footer conformes aux maquettes.
- **Où** : `tokens.css` (à confirmer, cf. §2.2) et/ou `cuisine.css` (prefix `cz-`).
- **Réf** : prototype + compilée.
- **Règles** : ne rien casser hors Cuisine ; un seul accent ; pas de dégradé/filigrane.
- **Cas limites** : emoji hors-ligne (cf. Q6).
- **Critère de fini** : rendu identique aux maquettes ; typecheck + build verts ; capture avant/après.
- **Priorité** : 🟢 (socle — d'abord).

### SPEC 2 — Menu · en-tête + sélecteur temporel
- **Type** : refonte UI · **Module** : Cuisine
- **Objectif** : en-tête clair + sélecteur jour/semaine conforme.
- **Comportement** :
  - En-tête : retour `‹` (gauche) · titre « Cuisine » · **pastille « Règles alimentaires »** en haut à droite
    (feuille 🌿 + résumé, ex. « halal · sans arachide ») → ouvre `ReglagesSheet` (restrictions du foyer).
  - Sélecteur : bouton **« Semaine › »** teinte neutre tan (`#efe7d8`/bordure `#e2d6bf`/texte `#7a5f30`),
    **2 lignes compactes, ~62 px, fixe à gauche**, chevron ; en mode semaine → **actif rempli**.
  - Bande de jours à droite (scrollable) : **noms de jours** (Mer/Jeu/Ven…), **aujourd'hui** = point terracotta,
    **jour sélectionné** (défaut = **Demain**) = rempli terracotta.
- **Où** : `SemaineView.tsx`, `CuisineView.tsx`.
- **Règles** : la pastille **remplace l'engrenage ⚙** et **montre** les restrictions (invariant « un seul
  endroit ») ; défaut horizon = **Demain** (logique dimanche→lundi déjà gérée dans `CuisineView`, ne pas
  toucher).
- **Cas limites** : **aucune restriction posée** → comportement de la pastille (cf. Q7) ; restrictions longues →
  tronquer.
- **Critère de fini** : sélecteur et en-tête conformes ; la pastille ouvre bien les Réglages.
- **Priorité** : 🟢.

### SPEC 3 — Menu · les 4 moments  ⚠️ (le point sensible)
- **Type** : évolution modèle (additive) + libellés · **Module** : Cuisine + page reçue
- **Objectif** : passer de 3 à **4 créneaux** : Petit déjeuner · Déjeuner · Goûter · Dîner.
- **État réel (important)** :
  - Les **clés du modèle sont déjà** `petitdej / dej / diner` — « Matin/Midi/Soir » ne sont que des **libellés**
    (`MEAL_LABEL` dans `SemaineView`, `MealComposerSheet`, `PourQuelRepasSheet`).
  - `EspaceCuisine` (page reçue) **affiche déjà** « Petit-déjeuner / Déjeuner / Dîner » (FR) et « الفطور / الغدا
    / العشا » (AR). → Le renommage **aligne le Menu sur la page reçue** (corrige une incohérence). **Zéro risque.**
- **Comportement** :
  - **(a) Renommer** les libellés Menu → Petit déjeuner / Déjeuner / Dîner (les clés ne bougent pas).
  - **(b) Ajouter le créneau `gouter`** : étendre le type `MealKey`, `MEAL_KEYS`, `MEAL_LABEL` (les 3 fichiers),
    et `MK_LIST` + libellés FR/AR dans `EspaceCuisine`. Le rôle `gouter` **existe déjà** côté recettes.
  - Carte de moment = chip tinté (teintes §3) + label moment (petit, coloré) + nom du plat **ou** « Ajouter un
    repas ». Repas **multi-composant** conservé (plat + entrée/accompagnement — cf. `MealComposerSheet`).
- **Où** : `SemaineView.tsx`, `MealComposerSheet.tsx`, `PourQuelRepasSheet.tsx`, `EspaceCuisine.tsx`, `types`.
- **Règles CRITIQUES** :
  - **Lien perpétuel (invariant)** : les pages déjà publiées **n'ont pas** de données `gouter`. L'ajout est
    additif, mais le rendu de `EspaceCuisine` **doit tolérer l'absence** de la clé (ne pas planter, ne pas
    afficher un créneau vide fantôme). **Vérifier** que la boucle `MK_LIST` saute déjà un repas sans données.
  - **Libellé AR du goûter** : à fournir (item traduction — ex. « الغوطي » / « وجبة خفيفة ») ; **darija ≠ arabe
    standard** selon le domaine — rester cohérent avec l'existant.
  - **Goûter = repas PLEIN — TRANCHÉ (PO, Q1).** Il est transmis/partagé/navigable **comme les autres moments**
    (pas une note allégée). Le modèle et la page reçue le traitent à l'identique.
- **Cas limites** : **ouvrir un lien publié AVANT le changement** (doit rendre à l'identique) ; jour sans goûter
  (créneau vide normal) ; RTL inchangé.
- **Critère de fini** : un lien pré-changement s'ouvre correctement (**test explicite**) ; nouveau menu à 4
  créneaux composable, transmis, navigable jour par jour.
- **Priorité** : 🟡 (Q1 tranchée — goûter plein ; reste la **tolérance payload à prouver** : `EspaceCuisine` doit sauter la clé `gouter` absente sur les pages anciennes, test explicite).

### SPEC 4 — Menu · vue semaine
- **Type** : refonte UI · **Module** : Cuisine
- **Objectif** : vue semaine cohérente avec les 4 moments.
- **Comportement** : toggle via bouton Semaine ; liste des jours, chaque jour montrant les 4 moments
  (remplis/vides) ; « Copier une semaine précédente » (`CopyWeekSheet`) ; « Partager la semaine ».
- **Où** : `SemaineView.tsx` (mode semaine).
- **Règles** : dépend de SPEC 3 pour les moments ; réutiliser `CopyWeekSheet` existant.
- **Critère de fini** : bascule jour↔semaine fluide ; 4 moments présents par jour.
- **Priorité** : 🟢 (après SPEC 3).

### SPEC 5 — Ajouter un repas · radial + sélecteur
- **Type** : nouveau composant (radial) + réutilisation · **Module** : Cuisine
- **Objectif** : remplacer l'entrée « ajouter un repas » par un **geste radial** signature.
- **Comportement** :
  - Tap sur le ＋ d'un créneau → **menu radial** : fond assombri, **créneau source visible et surligné**,
    **3 pétales en arc**, bouton fermer. **Toujours 3 pétales, jamais 4.**
  - **Bibliothèque vide** : L'écrire · Photo ou lien · Depuis une collection.
  - **Bibliothèque remplie** : **Ma bibliothèque** · L'écrire · Photo ou lien (la « collection » quitte le
    radial — elle vit dans la bibliothèque et l'écran Recettes).
  - **« Ma bibliothèque »** → **sélecteur** : recherche + favoris en tête + « ＋ Nouvelle recette » qui **déplie
    les 3 voies en place** (pas de 2ᵉ feuille).
- **Où** : nouveau composant radial ; **réutiliser** `RecipePickerSheet` (a déjà recherche + « Nouvelle recette »
  + filtre par rôle) comme sélecteur, et `AddRecipeSheet` pour les 3 voies.
- **Règles** :
  - **Articulation avec `MealComposerSheet`** (repas multi-composant : plat + entrée/acc) : le radial est
    l'**entrée** ; il doit mener au composeur/sélecteur existant sans le contourner. **Mapping à proposer par
    Claude Code** (monter sur l'existant, pas une table neuve) : le radial remplace-t-il l'ouverture actuelle,
    ou la précède-t-il ?
  - **« IA » / « générer » restent bannis de l'UI** — on nomme la source (un lien, une photo, un texte).
  - Un repas = une **recette enregistrée** (`id`). **Q2 TRANCHÉE (PO) : recette LÉGÈRE, pas de texte éphémère.**
    Un repas simple (« yaourt ») se saisit via « L'écrire » avec **juste un nom** — sans ingrédients ni étapes
    obligatoires — mais il est **enregistré comme recette** (réutilisable, transmissible, conforme à la thèse).
    **Aucun texte libre non sauvegardé.** *Claude Code : vérifier au read-back qu'une `Recipe` minimale (nom
    seul, champs vides) est un état valide de bout en bout — bibliothèque + partage + page reçue — et l'ajuster
    si le modèle l'exige (rendre ingrédients/étapes optionnels).*
- **Cas limites** : en vide, le sélecteur n'est pas atteignable (pas de pétale bibliothèque) — cohérent ;
  position du pétale « Ma bibliothèque » (Q5).
- **Critère de fini** : radial fonctionnel dans les deux états ; « Ma bibliothèque » ouvre le sélecteur ;
  sélection **remplit réellement** le créneau.
- **Priorité** : 🟡 (nouveau composant + mapping composeur).

### SPEC 6 — Recettes (Bibliothèque) · états vide + plein
- **Type** : refonte UI · **Module** : Cuisine
- **Objectif** : sortir du « bordélique » (3 mécanismes empilés) → une liste rangée + collections vendeuses.
- **Comportement** :
  - **Plein** : recherche + **toggle favoris** (étoile) ; bandeau **relecture brouillons** (si brouillons) ;
    **sections PAR MOMENT repliables** (les chips de filtre **disparaissent**) ; lignes **épurées** (emoji +
    nom ; **tag de rôle retiré** des cartes) ; en bas, **« Besoin d'inspiration ? »** = carrousel de
    **collections vendeuses** (une teinte par pack, gros emoji, pitch, compte) ; **FAB ＋** → radial/3 voies.
  - **Vide** : héros « bibliothèque vide » → **collections en grandes tuiles** (oriente) + « ou créez votre
    recette ».
- **Où** : `RecettesView.tsx` (+ `CollectionsSheet`, `RelectureSheet` réutilisés).
- **Règles** : collections **déplacées en bas** (plus de rail en tête ni d'onglet) ; sections par moment
  **remplacent** les chips. Ordre des sections (Q3) et **replié/déplié par défaut** (Q4) = PO.
- **Cas limites** : bibliothèque pauvre mais non vide ; présence/absence de brouillons.
- **Critère de fini** : les deux états conformes ; recherche + favoris opérants ; FAB ouvre le geste de création.
- **Priorité** : 🟡.

### SPEC 7 — Footer de navigation (emoji Fluent)
- **Type** : refonte UI · **Module** : Cuisine
- **Objectif** : footer chaleureux et lisible.
- **Comportement** : 🍽️ Menu · 📖 Recettes · 🛒 Courses ; **actif** = fond clair `#f4efe6` + pleine couleur +
  libellé gras ; **inactifs restent colorés** (pas de gris désaturé).
- **Où** : `CuisineView.tsx`.
- **Règles** : emoji disponible **hors-ligne** (cf. Q6).
- **Critère de fini** : footer conforme ; état actif correct sur les trois onglets.
- **Priorité** : 🟢.

---

## 6. Questions ouvertes — rulings PO requis (ne pas deviner)

**Bloquantes — ✅ TRANCHÉES (PO, 19/07) :**
- **Q1 — Goûter : repas PLEIN.** Transmis/partagé/navigable comme les autres moments. *(gravé en SPEC 3)*
- **Q2 — Recette LÉGÈRE (pas de texte éphémère).** « Yaourt » = « L'écrire » avec juste un nom, **enregistré**
  comme recette. Pas de texte libre non sauvegardé. Claude Code vérifie qu'une `Recipe` minimale est valide
  bout-en-bout. *(gravé en SPEC 5)*

**Non bloquantes (valeur par défaut acceptable, à affiner) :**
- **Q3 — Ordre des sections Recettes** : Plats d'abord, ou ordre des repas ?
- **Q4 — Sections Recettes** : dépliées ou repliées par défaut ?
- **Q5 — Position du pétale « Ma bibliothèque »** : à gauche (côté pouce) ou centre-haut de l'arc ?
- **Q6 — Emoji des repères** : bundler les SVG Fluent utilisés, ou emoji système ? (contrainte offline-first)
- **Q7 — Pastille règles sans restriction** : masquée, ou état neutre « Aucune restriction » ?

---

## 7. Protocole (le rituel du dispositif — non négociable)

- **Gate avant tout code.** Claude Code : **read-back** (reformuler chaque spec) + **chiffrage 🟢/🟡/🔴** +
  **questions/contestations sur le code réel** (`fichier:ligne`), **puis attendre le GO**.
- **Contestation > exécution fidèle.** Monter sur l'existant plutôt qu'une table/un composant neuf est
  encouragé (précédent : une brique montée sur `docs` a économisé une migration).
- **Livraison lot par lot + portes vertes** : typecheck · tests · build · **smoke** · captures → entrée
  `DEVLOG.md` → **`ETAT.md` réécrit** → **STOP** entre lots.
- **Verrouiller, jamais constater.** Toute suppression/garantie (ex. « plus de nutrition dans le Menu », « IA
  banni de l'UI ») devient une **assertion CI/smoke** qui échoue si la chose revient.
- **Lien perpétuel.** Toute évolution du payload d'une page publiée reste **lisible par les liens déjà donnés**
  — assertion/test explicite (SPEC 3).
- **Device test = foyer NEUF.** Jamais le foyer prod (données seed historiques faussent le test).
- **Fenêtre prod** (si migration) : staging → `parity:check` 0 écart → validation PO → prod → parité de clôture
  0 écart.

---

## 8. Pour l'instance Q&A (relecture à froid)

Points à **stress-tester en priorité** (chercher l'erreur de logique, dans les deux sens) :
1. **SPEC 3 — payload & lien perpétuel** : l'ajout de `gouter` casse-t-il réellement zéro page déjà publiée ?
   `EspaceCuisine` tolère-t-il l'absence de la clé, ou faut-il un garde explicite ?
2. **Q1/Q2 — cohérence modèle** : un goûter « plein » et un repas « texte libre » sont-ils compatibles avec la
   thèse (transmission d'un savoir réutilisable) et avec le multi-composant du composeur ?
3. **SPEC 5 — articulation radial ↔ `MealComposerSheet`** : le geste radial n'enterre-t-il pas la composition
   multi-composant (plat + entrée/acc) ? Le mapping proposé respecte-t-il l'existant ?
4. **§2.1 — double purge nutrition** : le découpage évite-t-il de purger deux fois, et laisse-t-il l'état
   cohérent entre ce lot et le lot simplification ?
5. **Vocabulaire** : « IA/générer » absent partout ; libellés de moment alignés Menu ↔ page reçue.

---

*Fin du brief. Claude Code : read-back + chiffrage + questions, puis attendre le GO.*
