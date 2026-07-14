# BRIEF LOT CUISINE — Spec §8 pour Claude Code
**14 juillet 2026 · chantier UX passe 1 · lot Cuisine (A3+A4 · A6 · Volet C)**
**Sources :** `RECAP_CUISINE_POUR_QA.md` · rapport Q&A (code audité à **`338abfb`**) · maquette validée
**`proto-cuisine-cliquable.html`** · décisions PO du 14 juil.
**Contexte canonique :** `PROJET_MAISON_OS.md` v2.1 (→ v2.2 à la clôture) · `PRIMER_THREAD_UX.md`

> **Note de fidélité.** Le rapport Q&A détaillé n'est pas reproduit ici. Là où il fait **autorité** —
> notamment l'**inventaire exact des 11 fichiers nutrition (F2.2)** et le repérage du **garde-fou F5b (F1.2)** —
> la spec le désigne explicitement : **Claude Code réconcilie sa liste avec le rapport `338abfb` au read-back**
> et signale tout écart. Ce brief reformule les décisions ; le rapport reste la vérité d'audit du code.

---

## 0. Protocole (impératif — avant toute ligne de code)
1. **Read-back** de ce brief, fiche par fiche.
2. **Chiffrage 🟢/🟡/🔴** par fiche + par tranche.
3. **Questions / contestations** + réponses aux cas limites ouverts.
4. **Attendre le GO** explicite.
5. Livraison **tranche par tranche** — chacune laisse l'app **fonctionnelle**, mergée séparément.
6. **Portes vertes** par tranche : typecheck · tests · build · smoke · captures.
7. **STOP** entre tranches. Entrée **`DEVLOG.md`** à chaque tranche.
8. **Test device** en fin de lot, avec un **foyer NEUF** (jamais le foyer prod — données cloud historiques).

---

## 1. Corrections d'audit à intégrer (issues de la Q&A)

**Q1 — « Règles du foyer » : prémisse du recap FAUSSE.** Contrairement à ce que le recap affirmait, il n'y a
**rien à conserver** côté Cuisine : les restrictions du foyer **n'existent pas**. C'est une **feature à
construire intégralement** : modèle de données + écran de réglage + application aux imports + alerte sur la
page du cuisinier. → **Tranche 3, chiffrée comme construction** (pas un tweak).

**Q2 — Opt-in nutrition : ~11 fichiers, pas 4 surfaces.** L'inventaire complet est au rapport. Il inclut
notamment (nommés par la Q&A) : le **`MacroPreview` + bouton « Calculer »** du formulaire manuel, les
**kcal·gP du rail collections**, et l'**`ObjectiveSheet` lui-même**. → **Tranche 2, sur toutes les surfaces
du rapport.**

**Vérifié propre (ne rien toucher) :** **page reçue**, **digest** WhatsApp, **hub** Maison — déjà sans
nutrition. Ne pas les inclure dans le masquage.

---

## 2. Décisions PO gravées dans la spec (non rediscutables au read-back)

**D1 — Tension « Partager » tranchée.** Partager une **fiche recette** = **ajout au menu, puis partage** ;
**jamais un second canal**. Défaut = le **prochain repas à venir** (un seul tap). → **F6.1**.

**D2 — Allergies tranchées, simplicité maximale.** Allergies/restrictions = **paramètres du foyer**, **un seul
endroit**, **verrouillées là**. La **fiche enfant Nounou existante ne bouge pas** (hors périmètre).
**Aucune synchronisation construite** — la passerelle Cuisine↔Nounou part au **parking**. → **Tranche 3 + F5.5**.

---

## 3. Garanties transverses ALLERGIES (à tenir dans toute fiche concernée)
Ces trois garanties sont des **critères de fini bloquants** partout où une restriction du foyer intervient :
- **G1 — Interdits montrés + confirmables.** Ce qui est appliqué est **toujours affiché** et **confirmable**
  par l'utilisateur (jamais une boîte noire).
- **G2 — Relecture d'import jamais sautable.** Après toute mise en forme (import/photo/description), l'écran
  de **relecture** est **obligatoire** — pas de chemin qui l'évite.
- **G3 — Jamais d'application silencieuse.** Une restriction n'est **jamais** appliquée sans **trace visible**.

---

# TRANCHE 1 — Fondations, retraits, vocabulaire
*Bas risque, à merger en premier. Aucune dépendance.*

### F1.1 — Polices embarquées
- **Type :** Fondation / dette. **Module :** build / assets typographiques.
- **Objectif :** Servir **Fraunces** et **Plus Jakarta Sans** en **auto-hébergé/embarqué**, **comme la FTUE
  le fait déjà** — pas via Google Fonts (offline-first, pas de dépendance réseau, pas de FOUT).
- **Comportement :** Fichiers de polices dans les assets ; `@font-face` local ; repli serif/sans conservé.
- **Réf maquette :** `proto-cuisine-cliquable.html` (titres Fraunces, corps Jakarta).
- **Règles :** Réutiliser le mécanisme d'embarquement **déjà en place pour la FTUE** (mêmes poids nécessaires :
  Fraunces 400/500/600, Jakarta 400/500/600/700). Aucune requête `fonts.googleapis.com` en runtime.
- **Cas limites :** Poids manquant → repli, pas de crash. Vérifier le RTL arabe (Naskh) inchangé.
- **Critère de fini :** Aucune requête Google Fonts au chargement ; rendu identique hors-ligne.
- **Priorité :** 🟢 Haute (préalable visuel du lot).

### F1.2 — Retrait de « Générer la semaine » (suppression tracée + garde-fou F5b)
- **Type :** **Suppression** (avec accord PO explicite). **Module :** `SemaineView.tsx` + garde-fou associé.
- **Objectif :** Retirer entièrement « Générer la semaine » du menu (proposer-un-repas **reporté en backlog**),
  et **statuer sur le garde-fou F5b** repéré par la Q&A.
- **Comportement :** Le bouton/CTA « Générer la semaine » disparaît de l'état vide et d'ailleurs. L'état vide
  ne garde que **composer** + **Copier** (cf. F7.2). Le **garde-fou F5b** (le code qui reroute la génération
  quand la bibliothèque est vide) devient **mort** → **le retirer**, sauf si le rapport lui prête un autre
  rôle (à confirmer au read-back).
- **Réf maquette :** `proto-cuisine-cliquable.html` (Menu : pas de « Générer »).
- **Règles :** C'est une **capacité supprimée** → tracer explicitement dans le `DEVLOG` avec la mention
  « accord PO » (doctrine : aucune capacité supprimée sans accord). Ne rien retirer d'autre du composeur.
- **Cas limites :** Références résiduelles au flux Générer (imports, i18n, tests) → nettoyer. Vérifier que le
  retrait ne casse pas la projection cuisine ni le partage.
- **Critère de fini :** Zéro occurrence de « Générer la semaine » ; F5b retiré ou re-justifié ; build vert.
- **Priorité :** 🟢 Haute.

### F1.3 — Vocabulaire porté par la spec
- **Type :** Renommage / libellés. **Module :** Cuisine (onglets, vues, modèles sauvegardés).
- **Objectif :** Graver le vocabulaire verrouillé, en particulier **« semaines favorites »**.
- **Comportement :** Onglet = **Menu**. Titre de vue jour = **« menu du jour »**, vue semaine = **« menu de
  la semaine »** (la pastille reste courte « Semaine »). Modèles réutilisables sauvegardés = **« semaines
  favorites »** — **jamais** « menus » (collision type Paprika).
- **Réf maquette :** `proto-cuisine-cliquable.html` + questionnaire PO (14 juil.).
- **Règles :** Nettoyer i18n/labels ; ne pas introduire « menus » comme entité de sauvegarde.
- **Cas limites :** Si une entité « menus sauvegardés » existe déjà en base → la surface se nomme « semaines
  favorites », le nom technique interne peut rester, mais **jamais** exposé « menus » à l'UI.
- **Critère de fini :** Libellés conformes partout ; « semaines favorites » présent ; aucun « menus » visible.
- **Priorité :** 🟢 Moyenne.

---

# TRANCHE 2 — Nutrition opt-in (« Suivi de l'équilibre »)
*Cross-cutting. Dépend de rien ; à merger tôt.*

### F2.1 — Le réglage « Suivi de l'équilibre »
- **Type :** Nouveau réglage. **Module :** Réglages Cuisine (⚙) + store de préférences (local, hors sync
  de contenu — c'est une préférence d'affichage).
- **Objectif :** Un interrupteur unique **« Suivi de l'équilibre »**, **OFF par défaut**, qui régit
  l'affichage de **toute** la nutrition dans Cuisine.
- **Comportement :** OFF → aucune donnée nutritionnelle nulle part (cf. F2.2). ON → tout réapparaît.
- **Réf maquette :** `proto-cuisine-cliquable.html` (⚙, décision A3 opt-in Option B).
- **Règles :** Un **seul** flag, lu partout. Valeur par défaut **OFF**. Persistant par appareil/foyer selon la
  convention de préférences existante.
- **Cas limites :** Foyers existants → défaut OFF aussi (migration : ne pas présumer ON). Bascule ON/OFF =
  instantanée, sans rechargement.
- **Critère de fini :** Le flag existe, OFF par défaut, et pilote F2.2 de bout en bout.
- **Priorité :** 🟢 Haute (préalable de F2.2).

### F2.2 — Masquage de la nutrition sur toutes les surfaces (inventaire Q&A)
- **Type :** Affichage conditionnel transverse. **Module :** **les 11 fichiers du rapport `338abfb`**.
- **Objectif :** Quand le flag (F2.1) est OFF, **aucune** nutrition visible.
- **Comportement / surfaces à couvrir** (reconstruction depuis le code — **à réconcilier avec la liste
  autoritaire du rapport au read-back**) :
  1. `RecettesView.tsx` — kcal/gP des **cartes recette** (les deux modes : `{kcal} kcal/100g` et
     `{kcal} kcal · {prot}g P`).
  2. `AddRecipeSheet.tsx` — composant **`MacroPreview`**.
  3. `AddRecipeSheet.tsx` — bouton **« Calculer les macros… »** + sous-titre « Les macros sont calculées ».
  4. **Fiche recette** — les **tuiles macros** (kcal / prot / gluc / calcium).
  5. En-tête Cuisine — pastille **« Objectif … kcal/pers. »**.
  6. **`ObjectiveSheet`** — l'écran d'objectif lui-même (masqué/inaccessible quand OFF).
  7. **Rail collections / `CollectionsSheet`** — **kcal·gP** des aperçus de recettes de pack.
  8. `SemaineView.tsx` — bandeau **« Ajoute au moins un repas pour voir l'équilibre »**.
  9. Composeur de repas — usage de l'objectif kcal (plafond ×personnes).
  10. Bandeau/résumé nutritionnel de semaine (moyenne/jour), s'il existe.
  11. *(11ᵉ surface selon le rapport — à confirmer au read-back.)*
- **Réf maquette :** `proto-cuisine-cliquable.html` (cartes/fiche sans macros).
- **Règles :** Masquage **au niveau du rendu** (pas de suppression du calcul sous-jacent) ; **ON restitue
  tout à l'identique**. Un seul point de vérité (F2.1) ; pas de flags dupliqués par écran.
- **Cas limites :** Recette dont la nutrition est absente en base → rien à afficher même ON, pas de « 0 kcal ».
  L'objectif (F2.2 #5/#6) : OFF cache la pastille **et** l'entrée vers `ObjectiveSheet`.
- **Critère de fini :** Flag OFF (défaut) → **zéro** chiffre nutritionnel sur les 11 surfaces ; ON → tout
  revient ; page reçue/digest/hub inchangés.
- **Priorité :** 🟡 Haute (cross-cutting, ampleur réelle = 11 fichiers).

---

# TRANCHE 3 — Règles du foyer (NOUVELLE feature — Q1)
*Construction complète. **Dépendance : précède la Tranche 4** (les imports les appliquent).*

### F3.1 — Modèle de données « restrictions du foyer »
- **Type :** **Construction** (nouveau modèle). **Module :** schéma foyer + migration versionnée + store.
- **Objectif :** Représenter les restrictions au **niveau du foyer** : **allergies** (liste), **halal**
  (booléen), **régime** (ex. végé — extensible).
- **Comportement :** Attaché au **`foyer_id`** (jamais `user_id`) ; synchronisé comme le reste du contenu du
  foyer (local-first, LWW par document) ; lisible hors-ligne.
- **Réf maquette :** `proto-cuisine-cliquable.html` (ligne « règles de ton foyer : halal, sans arachide »).
- **Règles :** **Migration idempotente** (leçon Environments — obligatoire), relue avant application. RLS :
  isolation inter-foyers. **Un seul endroit** de stockage (D2). **Aucune** structure de synchro vers la fiche
  enfant Nounou (D2 — passerelle parquée).
- **Cas limites :** Foyer sans restrictions = état vide légal (pas d'erreur). Foyer rejoint : les restrictions
  suivent le foyer adopté.
- **Critère de fini :** Modèle + migration idempotente + RLS testée ; lecture/écriture hors-ligne OK.
- **Priorité :** 🔴 **Construction (M/L)** — nouvelle feature, chiffrer comme telle, pas comme un tweak.

### F3.2 — Écran de réglage « Restrictions du foyer »
- **Type :** Nouvel écran. **Module :** Réglages foyer.
- **Objectif :** Le **seul endroit** où l'on pose/édite allergies, halal, régime (D2 — verrouillé là).
- **Comportement :** Saisie des allergies (champ libre + éventuels raccourcis), bascules halal/régime.
  Accessible depuis les réglages ; **atteignable depuis « Modifier »** de l'écran d'import (F4.4).
- **Réf maquette :** `proto-cuisine-cliquable.html` (cible du lien « Modifier »).
- **Règles :** **Un seul point d'édition** (pas de duplication). Registre chaleureux, vouvoiement conforme.
  Neutralité de genre. **Restrictions = champ libre** (on ne peut pas énumérer toutes les restrictions —
  décision Volet C) + quelques bascules courantes.
- **Cas limites :** Retrait d'une allergie déjà appliquée à des imports passés → n'altère pas les recettes
  déjà créées (pas de rétro-réécriture) ; s'applique aux **prochains** imports.
- **Critère de fini :** CRUD des restrictions du foyer ; « Modifier » de F4.4 y mène ; **G1** respectée.
- **Priorité :** 🟡 Moyenne-haute (dépend de F3.1).

---

# TRANCHE 4 — Créer une recette (écrire + importer & adapter)
*Dépend de Tranche 3 (application des règles). Cœur du Volet C.*

### F4.1 — FAB « ＋ Nouvelle recette » + feuille des voies
- **Type :** Nouvelle entrée. **Module :** `RecettesView` + feuille de création.
- **Objectif :** Un **bouton flottant** « ＋ Nouvelle recette », **TOUJOURS visible sans scroll** (hors flux
  de scroll), ouvrant une feuille à **trois voies** : **L'écrire · À partir d'instructions · Depuis une
  collection**.
- **Comportement :** FAB fixe en bas à droite (au-dessus de la barre du bas). Tap → feuille des 3 voies.
- **Réf maquette :** `proto-cuisine-cliquable.html` (FAB + écran « Comment on l'ajoute ? »).
- **Règles :** **Exigence dure : le FAB ne fait pas partie du contenu qui défile** — jamais un bouton posé en
  fin de liste. Il masque éventuellement la dernière carte (comportement standard, contenu défile dessous).
- **Cas limites :** Collision barre système Android → gérée par les safe-area insets (lot Coquille).
- **Critère de fini :** FAB visible sans scroll dans tous les états de la bibliothèque ; ouvre les 3 voies.
- **Priorité :** 🟢 Haute.

### F4.2 — « L'écrire » (texte naturel)
- **Type :** Écran de création. **Module :** création manuelle (aligner sur le formulaire existant).
- **Objectif :** Écrire une recette **au bon format** via des **zones de texte naturelles** — idéal recettes
  de famille (« une bonne pincée », « un filet d'huile »).
- **Comportement :** Champs = **nom** · **ingrédients** (zone de texte, une ligne = un ingrédient) ·
  **préparation** (zone de texte) · **rôle** (chips) · **portions** (stepper). La structure (quantités pour
  courses / ×personnes) est **dérivée en coulisse**, pas imposée à la saisie.
- **Réf maquette :** `proto-cuisine-cliquable.html` (écran « Écris ta recette »).
- **Règles :** **Aucune macro saisie** (calculées). **Aucune détection d'allergène ici** (D2 — les
  restrictions vivent au foyer). Réutiliser au maximum le formulaire manuel **déjà existant** (texte
  ingrédients/étapes) plutôt que de le remplacer par des champs rigides.
- **Cas limites :** Recette minimale (nom + un ingrédient) = valide. Rôle par défaut = « Plat ».
- **Critère de fini :** Écriture texte fonctionnelle ; enregistrement produit une recette structurée ; zéro
  champ macro ; zéro widget allergène.
- **Priorité :** 🟢 Haute.

### F4.3 — « À partir d'instructions » (un champ + photo)
- **Type :** Écran de création assistée. **Module :** import/mise en forme (fonction serveur edge + session).
- **Objectif :** Produire une recette **au bon format** à partir d'**instructions** : **un seul champ +
  appareil photo** acceptant **lien / texte collé / photo-capture / description**.
- **Comportement :** Le champ **désambiguïse par l'entrée** — **texte court = intention à produire**,
  **texte long/collé = conversion** (comportement **déjà présent dans le code**, à exposer proprement). Photo
  = entrée d'import (capture, page de livre). **Le mot « IA » n'apparaît nulle part** ; « Générer/génération/
  indisponible/✨ » bannis.
- **Réf maquette :** `proto-cuisine-cliquable.html` (écran « Importer »).
- **Règles :** Relais LLM **sous session** (quota = vérité serveur, jamais dans la synchro). Langage
  chaleureux (F1.3 registre). **La photo « en photo » d'import ≠ la photo du plat** (F5.3).
- **Cas limites :** Entrée vide → pas d'appel. Lien non supporté / OCR raté → message doux + repli vers
  l'écriture manuelle (F4.2), pas d'échec dur.
- **Critère de fini :** Les 4 entrées produisent une recette à relire (F4.4) ; aucune occurrence « IA/Générer ».
- **Priorité :** 🟡 Haute.

### F4.4 — Adaptation aux contraintes + règles du foyer + relecture (G1·G2·G3)
- **Type :** Comportement de production. **Module :** F4.3 + Tranche 3.
- **Objectif :** L'import **transcrit ET adapte** : un champ d'**adaptation** libre (« pour 6 · sans porc ·
  plus léger ») ; les **règles du foyer** (Tranche 3) s'appliquent **d'office** ; **relecture obligatoire**.
- **Comportement :** Sous le champ source, un champ **« Adapte-la, si tu veux »**. Une ligne
  **« J'adapte selon les règles de ton foyer : … »** qui **montre** les règles appliquées, est **marquée
  « À vérifier »**, et **cliquable « Modifier »** (→ F3.2). Après « Créer la recette », **écran de relecture
  obligatoire** (surtout les **quantités**).
- **Réf maquette :** `proto-cuisine-cliquable.html` (champ adaptation + ligne foyer + « Créer la recette »).
- **Règles (garanties bloquantes) :** **G1** interdits montrés + confirmables · **G2** relecture jamais
  sautable · **G3** jamais d'application silencieuse. CTA = **« Créer la recette »** (jamais « Mettre en forme »).
- **Cas limites :** Foyer sans restrictions → la ligne foyer indique « aucune règle », pas d'invention.
  Adaptation contradictoire (« plus de porc » sur foyer halal) → l'interdit foyer **prime**, montré à la relecture.
- **Critère de fini :** Adaptation + règles foyer appliquées, montrées, éditables ; relecture non contournable.
- **Priorité :** 🟡 Haute (porte les garanties allergies).

### F4.5 — « Depuis une collection »
- **Type :** Voie de création (existant à relier). **Module :** `CollectionsSheet` + `packs.ts`.
- **Objectif :** Piocher dans les packs et copier chez soi.
- **Comportement :** La **machinerie existe** (3 packs `fonds`/`marocain`/`leger`, **dédup par nom**) — la
  relier à la feuille des voies (F4.1) et à l'entrée de bibliothèque.
- **Réf maquette :** `proto-cuisine-cliquable.html` (3ᵉ voie).
- **Règles :** Le **contenu éditorial** des packs = **§7.2**, hors de ce lot. Ici = **plomberie de liaison**.
- **Cas limites :** Pack déjà installé → dédup par nom (comportement existant).
- **Critère de fini :** La 3ᵉ voie ouvre les collections ; installation fonctionne.
- **Priorité :** 🟢 Basse (surtout du câblage).

---

# TRANCHE 5 — Fiche recette
*Dépend de Tranche 3 (alerte cuisinier). L'alerte peut être livrée après si besoin.*

### F5.1 — Structure de la fiche
- **Type :** Écran. **Module :** fiche recette.
- **Objectif :** Fiche = **titre** (Fraunces) · **tags** (F5.2) · **consigne vocale** · **ingrédients** ·
  **étapes** (numérotées).
- **Comportement :** Ordre : voix + ingrédients **avant** tout chiffre ; macros seulement si flag ON (F2.2).
- **Réf maquette :** `proto-cuisine-cliquable.html` (écran Fiche).
- **Règles :** Consigne **vocale = voix de l'employeur, jamais synthétisée**. Étapes lisibles, numérotées.
- **Cas limites :** Recette sans étapes / sans voix → sections omises proprement.
- **Critère de fini :** Fiche complète, conforme à la maquette, macros gouvernées par F2.1.
- **Priorité :** 🟢 Haute.

### F5.2 — Tags enrichis
- **Type :** Métadonnée. **Module :** modèle recette + fiche + chips de rôle (biblio & création).
- **Objectif :** Enrichir le **moment** au-delà de plat/entrée : **Petit-déj · Entrée · Plat · Accompagnement
  · Dessert · Soupe · Goûter · Boisson** ; plus **cuisine · difficulté · temps · portions**.
- **Comportement :** Affichés en pastilles sur la fiche ; le **moment** sert de rôle dans la composition.
- **Réf maquette :** `proto-cuisine-cliquable.html` (« Plat · Marocain · ◆ Moyen · 1 h · 4 pers. »).
- **Règles :** Le jeu de **moments** est fermé (les 8 ci-dessus) ; cuisine/difficulté/temps optionnels.
- **Cas limites :** Recette sans cuisine/temps → pastilles omises. Migration : recettes existantes gardent
  leur rôle actuel, mappé sur le nouveau jeu.
- **Critère de fini :** Les 8 moments disponibles à la création ; pastilles affichées ; rôle = moment.
- **Priorité :** 🟡 Moyenne.

### F5.3 — Photo du plat (une seule entrée)
- **Type :** Média. **Module :** fiche + stockage image (Storage).
- **Objectif :** Donner une **photo du plat** (illustration) via **une seule entrée « Ajouter une photo »**
  ouvrant le **sélecteur natif** (appareil **ou** galerie) — **pas de bouton appareil photo dédié**.
- **Comportement :** Sans photo → zone « Ajouter une photo ». Avec photo → bandeau + « Changer la photo ».
- **Réf maquette :** `proto-cuisine-cliquable.html` (Fiche, bandeau photo).
- **Règles :** **Distinction stricte** avec « en photo » de l'import (F4.3) qui transcrit une **recette
  écrite** ; ici = photo **du plat fini**. Stockage image côté Storage (UE).
- **Cas limites :** Gros fichier → redimensionner. Photo absente = état par défaut, pas d'erreur.
- **Critère de fini :** Ajout/changement de photo via sélecteur natif ; les deux « photo » ne se confondent pas.
- **Priorité :** 🟡 Moyenne.

### F5.4 — Barre du haut (hiérarchie + overlap corrigé)
- **Type :** Correctif UI + hiérarchie. **Module :** en-tête de fiche.
- **Objectif :** **Partager = dominant** (bouton plein libellé) · **favori = discret** (icône fantôme) · **⋯**
  (modifier/dupliquer/supprimer). **Overlap corrigé** (le chevauchement de la maquette resserrée).
- **Comportement :** ‹ retour à gauche ; à droite ♡ discret, ⋯, puis **« Partager »** plein.
- **Réf maquette :** `proto-cuisine-cliquable.html` (barre corrigée — la référence prime sur toute autre).
- **Règles :** Espacement suffisant (pas de chevauchement à la largeur cible). Partager = **F6.1**, pas un
  second canal.
- **Cas limites :** Écran étroit → ne jamais laisser les éléments se chevaucher (repli d'espacement).
- **Critère de fini :** Hiérarchie conforme ; aucun overlap à toutes largeurs testées.
- **Priorité :** 🟢 Moyenne.

### F5.5 — Alerte allergène sur la page du cuisinier
- **Type :** Application des règles du foyer (Q1, partie alerte). **Module :** projection cuisine / page reçue.
- **Objectif :** Mettre en **évidence** sur la page reçue par la cuisinière les allergènes concernés par les
  **restrictions du foyer** (Tranche 3).
- **Comportement :** Quand une recette servie touche une restriction du foyer, l'alerte est **visible** sur la
  projection cuisine.
- **Réf maquette :** — (comportement décrit ; la page reçue est déjà propre côté nutrition).
- **Règles :** **G3** — jamais d'application silencieuse ; l'alerte est **montrée**. Ne modifie **pas** la
  fiche enfant Nounou (D2). Traduction du sensible = registre du **gate** (cf. §7.4 du projet).
- **Cas limites :** Foyer sans restriction → aucune alerte. Restriction ajoutée après partage → se reflète à
  la prochaine mise à jour de la page (page vivante).
- **Critère de fini :** Allergène du foyer mis en évidence sur la projection ; rien en silence.
- **Priorité :** 🟡 Moyenne (dépend de Tranche 3 ; livrable juste après si nécessaire).

---

# TRANCHE 6 — Partager (recette → menu) + partage selon la vue
*Dépend de F5.4 (bouton Partager) et du modèle menu.*

### F6.1 — Partager une fiche recette = ajout au menu puis partage (D1)
- **Type :** Comportement (décision PO gravée). **Module :** fiche + menu + flux de partage (A2).
- **Objectif :** Sur une fiche, **« Partager »** = **ajouter la recette au menu**, **puis** partager —
  **jamais** un second canal de transmission.
- **Comportement :** Défaut = **prochain repas à venir** (un seul tap) ; la recette est posée dans ce créneau,
  puis le flux de partage s'ouvre sur le menu correspondant.
- **Réf maquette :** `proto-cuisine-cliquable.html` (Partager, aujourd'hui toast stub).
- **Règles :** **Un seul canal** = le menu → la cuisinière. Pas d'envoi de recette isolée hors menu.
- **Cas limites :** Créneau « prochain repas » déjà occupé → proposer d'ajouter/remplacer (un tap), sans
  perdre l'existant sans confirmation. Aucun repas à venir configuré → poser sur le prochain créneau logique.
- **Critère de fini :** Partager depuis une fiche pose au menu puis ouvre le partage ; aucun 2ᵉ canal.
- **Priorité :** 🟡 Haute (porte D1).

### F6.2 — Comportement du partage selon la vue
- **Type :** Comportement. **Module :** flux de partage (A2) + horizon (`CuisineScope`).
- **Objectif :** La **portée du digest** suit la **vue** : partager depuis le **jour** vs la **semaine** change
  le **message**, jamais la page (la page reste complète et vivante).
- **Comportement :** Réutiliser l'enum **`CuisineScope`** (remonté en A3) ; la vue courante détermine la
  portée du digest WhatsApp.
- **Réf maquette :** `RECAP_CUISINE_POUR_QA.md` §1.3 (portée auto-évidente via l'horizon).
- **Règles :** **« Le message informe, la page fait le travail »** — la portée ne change que le **message**.
- **Cas limites :** Vue semaine avec jours vides → le digest ne liste que le rempli.
- **Critère de fini :** Portée du digest = vue courante ; page inchangée quelle que soit la portée.
- **Priorité :** 🟡 Moyenne.

---

# TRANCHE 7 — Bibliothèque & Menu (structure restante)
*Largement de l'ajustement sur l'existant. Peut merger tôt ou tard.*

### F7.1 — Collections en rail + repère emoji (bibliothèque)
- **Type :** Ajustement. **Module :** `RecettesView` + rail collections.
- **Objectif :** Collections **en tête** quand la bibliothèque est pauvre (**seuil = ≤ 12 recettes**),
  **repliées** en ligne « ＋ Ajouter des recettes · Collections › » quand riche ; **repère emoji** sur les
  cartes.
- **Comportement :** Seuil ≤ 12 → rail en tête ; > 12 → ligne repliée en bas. Emoji par carte (mapping
  **mot-clé → repli rôle**, jamais choisi à la main).
- **Réf maquette :** `proto-cuisine-cliquable.html` (biblio) + `maquette-a6-*` (historique).
- **Règles :** Seuil = **12** (tranché PO, ajustable). Photos réservées fiche + page reçue (pas la liste).
- **Cas limites :** Exactement 12 → rail en tête (≤). Aucune recette → rail en tête + FAB visible.
- **Critère de fini :** Bascule pauvre/riche au seuil ; emoji sur toutes les cartes.
- **Priorité :** 🟢 Moyenne.

### F7.2 — Menu : horizon, repas, footer, état vide
- **Type :** Ajustement. **Module :** `SemaineView` + barre du bas.
- **Objectif :** Horizon **Aujourd'hui/Demain/Semaine défaut Demain**, **pas-à-pas dans le contenu** (jamais
  2ᵉ barre) ; repas **Matin/Midi/Soir** ; **footer visible** (fond blanc, bordure + ombre, actif = **pastille
  foncée**) ; état vide = **composer + Copier** (sans « Générer », cf. F1.2).
- **Comportement :** Ouverture sur **Demain**. Réutilise `CuisineScope`. Barre du bas Menu · Recettes · Courses.
- **Réf maquette :** `proto-cuisine-cliquable.html` (Menu).
- **Règles :** **Interdit : deux barres de navigation empilées.** Onglet actif = **pastille foncée** (override
  PO assumé). Cartes à hauteur naturelle, jamais étirées (espace dirigé).
- **Cas limites :** Aujourd'hui déjà passé/en cours → Demain reste le défaut de briefing. « Copier » propose
  journée/semaine, précédente/favorite.
- **Critère de fini :** Défaut Demain ; footer visible conforme ; état vide sans « Générer » ; une seule barre.
- **Priorité :** 🟢 Moyenne.

---

# CLÔTURE DU LOT

### C1 — Documentation projet v2.2
- À la **fermeture du lot** : passer `PROJET_MAISON_OS.md` en **v2.2**. Entrées à porter : opt-in nutrition
  généralisé (11 surfaces) ; **restrictions du foyer** (nouvelle brique, un seul endroit, passerelle Nounou
  parquée) ; **création de recette** (écrire / à partir d'instructions, « IA » bannie de l'UI) ; **Partager
  recette = ajout au menu puis partage** (jamais 2ᵉ canal) ; **« proposer un repas » reporté** (retrait de
  « Générer la semaine ») ; tags enrichis ; footer/FAB. Mettre à jour `DEVLOG.md` par tranche et
  `DECISIONS_STORE_V1.md` (restrictions foyer, Partager).

### C2 — Test device (recommandé)
- En fin de lot, **test sur appareil réel**, **foyer NEUF** (jamais le foyer prod). Vérifier en priorité :
  opt-in OFF = zéro nutrition sur les 11 surfaces · FAB visible sans scroll · relecture d'import non
  contournable · règles du foyer montrées + éditables · Partager depuis une fiche pose bien au menu · pas
  d'overlap sur la fiche · polices embarquées (rendu hors-ligne).

---

## Récapitulatif des tranches (ordre de merge conseillé)
1. **T1** Fondations/retraits/vocab (🟢) — polices, retrait Générer+F5b, « semaines favorites ».
2. **T2** Nutrition opt-in (🟡) — flag + 11 surfaces.
3. **T3** Règles du foyer (🔴 construction) — modèle + écran. **Précède T4.**
4. **T4** Création (🟡) — FAB, écrire, à partir d'instructions, adaptation+relecture (G1·G2·G3), collections.
5. **T5** Fiche recette (🟢/🟡) — structure, tags, photo, barre corrigée, alerte cuisinier.
6. **T6** Partager (🟡) — recette→menu (D1), portée selon la vue.
7. **T7** Biblio & Menu (🟢) — collections/emoji, horizon/repas/footer/état vide.
8. **Clôture** — doc v2.2, test device.

*Fin du brief. Claude Code : read-back + chiffrage 🟢🟡🔴 par tranche, questions/contestations, puis attendre
le GO. Réconcilier F2.2 (11 fichiers) et F1.2 (garde-fou F5b) avec le rapport `338abfb`.*
