# BRIEF — Lot « Flow FTUE » (socle du flow de test de bout en bout)
**Version 1.2 — 12 juillet 2026 · Statut : avis implémenteur intégré. DÉCISION DE CONCEPTION :
la FTUE est un GATE PRÉ-BOOT (clé de voûte F4/F5a). Décisions PO tranchées : collection à 30
(Écartée sortie) · marocain-quotidien conservé · état « rôles activés » créé.
Préalables avant GO : ① merge de `coquille-v2` (attend les 4 verdicts device du PO, STOP 2) ·
② maquette committée au repo. Puis read-back formel fiche par fiche.**

> **Objectif du lot.** Un flow cohérent de bout en bout — première ouverture → FTUE → foyer →
> contenu → envoi d'une page — pour tester l'app en conditions réelles. UX **fonctionnelle**,
> pas peaufinée : le chantier de perfectionnement (identité, refonte nav) vient APRÈS les tests.
>
> **Base de départ : le défaut POST-merge de `coquille-v2`.** Ne pas ouvrir la branche avant
> ce merge (leçon coquille-v1 : pas de branche longue sur une base qui bouge).
>
> **Référence visuelle : `ftue-v4-sans-scroll__2_.html`** (maquette validée = source de vérité
> visuelle, y compris la contrainte « chaque écran tient dans le viewport, sans scroll »).
> **À committer au repo** (ex. `docs/maquettes/ftue-v4.html`) à l'ouverture de la branche du
> lot — une source de vérité visuelle se versionne (méthode projet), elle ne vit pas dans un chat.
>
> **Règle de vigilance architecture (mandat permanent).** Toute pièce de ce lot doit se
> BRANCHER sur l'existant, jamais le réinventer : auth OTP existante, RPC `accept_invite`,
> rituel d'adoption (consentement + pré-export), mécanisme de packs (`lib/packs.ts`),
> import sécurité (`importSeed`), cartes de rôle du hub. Tout écart aux choix d'archi
> (local-first synchronisé, compte différé, une-langue-auteur, lecture seule côté personnel)
> doit être signalé AVANT d'être codé.

---

## Fiche F1 — Retrait du seed personnel Nounou
- **Type** : nettoyage · **Module** : `src/nounou/defaults.ts`, `useNounou.ts`
- **Objectif** : plus AUCUN contenu personnel pré-créé. Un nouveau foyer démarre vide de :
  enfants (Yasmine/Adam), rythme (5 moments), destinataire « Khadija · Nounou ».
- **Comportement** : `seedNounouDoc()` ne crée plus ces trois blocs (`defaults.ts:61-75, 83-94`).
  Les gabarits de conduites en sortent aussi (ils deviennent installables — F3).
- **Reste en place** : `emptyNounouDoc()` avec les 3 numéros d'urgence Maroc (19/15/150,
  « à vérifier ») — information pays générique, PAS du personnel. `mergeNounouDoc` inchangé.
- **Cas limites** : appareils EXISTANTS (données déjà présentes) : intouchés — le retrait ne
  s'applique qu'aux créations neuves. Aucune migration de données.
- **Critère de fini** : stockage vidé → l'app s'ouvre sans Khadija/enfants/rythme ; la carte
  de rôle Nounou du hub reste affichable (état sans destinataire déjà géré).
- **Priorité** : P1 (bloque le flow de test).

## Fiche F2 — Collection-témoin de recettes (remplace l'import automatique)
- **Type** : packaging · **Module** : `src/data/packs/`, `src/lib/db.ts`
- **Objectif** : les recettes seed deviennent une COLLECTION installable de **30 recettes**
  (« banc d'essai » du principe de collection), plus jamais importées automatiquement.
  **La recette en statut `Écarté` du seed SORT de la collection** — une collection
  n'embarque que du contenu assumé, et le packaging `RecipeSeed` la ferait revenir « Validé ».
- **Comportement** : (a) générer `data/packs/collection-temoin.json` au format `Pack`/`RecipeSeed`
  depuis `SEED_RECIPES` (retirer `id`/`statut`, conserver darija) ; (b) l'ajouter au registre
  `PACKS` ; (c) neutraliser l'import auto dans `ensureSeeded()` (branche `version === 0`).
- **Règles** : ⚠️ **NE PAS TOUCHER `SEED_CONFIG`** (jours/kcal — config structurelle vivante,
  8 fichiers en dépendent). Nom de la collection : proposer 2-3 options au read-back
  (ex. « L'essentiel marocain », « Le premier fonds ») — décision PO au GO.
- **Cas limites** : recouvrement avec les packs existants — **DÉCISION : `marocain-quotidien`
  et `léger-équilibré` sont CONSERVÉS malgré le recouvrement** ; c'est précisément le banc
  d'essai de la dédup par nom et du rail multi-packs (et un rail à plusieurs entrées rend
  mieux en démo). Documenter le comportement de réinstallation partielle.
- **Critère de fini** : install frais → bibliothèque VIDE ; CollectionsSheet propose la
  collection-témoin ; installation → recettes présentes, statut Validé, `packId` tracé.
  Tests `packs.test.ts` étendus au nouveau pack. **Smoke Cuisine adapté** : il installe
  d'abord la collection-témoin (préambule) puis déroule son parcours — la porte teste ainsi
  F2 de bout en bout au lieu de supposer une bibliothèque pré-seedée.
- **Priorité** : P1.

## Fiche F3 — Gabarits de conduites installables
- **Type** : packaging léger · **Module** : `src/nounou/defaults.ts` (CONDUITE_MODELES), FTUE
- **Objectif** : les 6 gabarits (« Fièvre… à compléter ») ne sont plus seedés ; ils s'installent
  quand le domaine « Les enfants » est choisi dans la FTUE (ou plus tard, via un bouton
  d'import dans Conduites — pattern `importSeed` de Sécurité, si trivial).
- **Comportement** : `CONDUITE_MODELES` reste la constante source ; une fonction
  `installConduiteModeles()` idempotente (anti-doublon par titre) les matérialise.
- **Critère de fini** : sans installation → Conduites vide (état vide existant) ; après
  installation → 6 gabarits « À compléter », pas de doublon en réinstallant.
- **Priorité** : P1.

## Fiche F4 — FTUE v4 implémentée (le cœur du lot)
- **Type** : feature · **Module** : nouveau `src/ftue/` + branchement `App.tsx`
- **Objectif** : les 7 écrans de la maquette, branchés au premier lancement, qui PILOTENT
  le peuplement (opt-in par domaine) et posent les cartes de rôle.
- **Comportement** :
  1. **Déclenchement — DÉCISION DE CONCEPTION : la FTUE est un GATE PRÉ-BOOT.** Elle
     s'évalue et s'affiche AVANT tout init de store (early return dans `App`, pattern
     existant de la vue `#e=`) : tant que la FTUE est active, RIEN ne s'initialise ni ne
     se persiste (ni `ensureSeeded`, ni `useNounou.init`). Conséquences voulues : le
     critère se lit sur un état vierge (plus de course avec `seedVersion` posé au boot
     courant) ; aucune donnée fantôme créée pendant la FTUE ; rien à pousser avant le
     pull d'un foyer rejoint (F5a-①). Critère : `ftueDone` absent → FTUE. **Appareils
     existants** : migration one-shot au premier boot post-update — `seedVersion` déjà
     présent ⇒ poser `ftueDone` + activer les rôles rétroactivement. La FTUE ne s'affiche
     JAMAIS sur un appareil déjà booté (scénario de mise à jour testé explicitement).
     Si le read-back révèle un obstacle au gate, le SIGNALER avant de coder.
  2. **#entry** : « Entrer » → parcours création ; « Rejoindre un foyer existant » → **#join**.
  3. **#join** : saisie du code → **se branche sur l'existant** : auth OTP (email + code 6
     chiffres) puis `accept_invite` RPC puis rituel d'adoption (consentement + pré-export,
     fix A1) puis pull du foyer. RIEN de réinventé. Si l'utilisateur n'a pas de compte,
     le flux de connexion existant le crée. Après adoption réussie → **#welcome** (pas de
     peuplement local : le contenu vient du foyer rejoint).
  4. **#domain** (Étape 1) : sélection multiple. **Sélectionnables : La cuisine · Les enfants ·
     La sécurité** (le réel). **« À venir », visibles mais NON sélectionnables** : L'entretien ·
     La vie pratique (badge discret « Bientôt », tap sans effet ou toast léger). Mapping :
     - La cuisine → installe la collection-témoin (F2)
     - Les enfants → installe les gabarits de conduites (F3)
     - La sécurité → importe le pack sécurité EXISTANT (`importSeed`, statut Test — le parent
       relit/valide, conforme au principe « réceptacle des consignes du parent »). Nécessite
       l'EXTRACTION de `importSeed` hors du composant `SecuriteView` en fonction de lib
       appelable — refactor conforme au mandat (se brancher ⇒ parfois extraire), à chiffrer
  5. **#memory** et **#send** : planches narratives statiques (portage fidèle de la maquette).
  6. **#people** (Étape 2) : tap = active le rôle, SANS nom (nommage au premier partage —
     archi existante). **Actifs : Cuisine · Nounou** ; **« À venir » non sélectionnables :
     Chauffeur · Ménage · Toute la maison.** **DÉCISION : un nouvel état « rôles activés »
     est créé** (aujourd'hui le hub affiche toujours les deux cartes — sans cet état,
     #people serait un no-op visuel) : les cartes de rôle ne s'affichent que si activées
     (via la FTUE ou via « ＋ Une page pour quelqu'un d'autre ») ; rien coché → hub sans
     carte d'équipe, le « ＋ » reste le chemin d'ajout. Appareils existants : tout activé
     rétroactivement (même migration one-shot que `ftueDone`).
  7. **#welcome** : « Entrer » → hub Maison, `ftueDone` posé.
  8. **« Revoir l'introduction »** : entrée dans la feuille Compte/réglages qui rejoue la FTUE
     en mode DÉMO **strictement visuel : AUCUNE action de peuplement déclenchée** (taps sur
     domaines/rôles simulés à l'écran, aucun install/import réel) — pour les démos auprès de
     tiers sans vider le stockage ni polluer les données existantes. L'écran **#join est
     sauté en replay** (c'est un vrai flux, pas une planche).
- **Règles** : sans-scroll respecté (viewport) ; bilingue du titre (Manzil منزل) ; CGU/politique
  mentionnées comme dans la maquette (liens inertes tant que les URL n'existent pas — signaler) ;
  aucune création de compte dans le parcours « Entrer » (compte différé au premier partage/sync) ;
  **smokes** : les smokes existants (Cuisine, Comptes) posent `ftueDone` avant le boot
  (mécanisme de test à préciser au read-back) et un **mini-smoke FTUE dédié** entre en CI
  (traversée entry → domaines → personnes → welcome → hub) — on ne contourne pas la FTUE
  dans les tests, on la teste séparément.
- **Cas limites** : aucun domaine coché + Continuer → autorisé, app guidée par ses états vides ;
  retour arrière entre écrans ; kill de l'app au milieu de la FTUE → elle se re-présente
  (ftueDone posé seulement au #welcome) ; « Rejoindre » avec code invalide/expiré → erreur
  claire, retour possible ; bouton retour Android : la FTUE n'étant ni une Sheet ni un écran du state machine, elle
  S'ENREGISTRE explicitement au registre B3 — retour = écran FTUE précédent ; sur #entry =
  minimiser (jamais de kill en plein parcours).
- **Critère de fini** : install frais → FTUE → domaines cochés → hub avec cartes de rôle
  choisies + contenu installé ; « Rejoindre » aboutit sur un foyer réel via le rituel existant ;
  appareil existant mis à jour → JAMAIS la FTUE ; « Revoir l'intro » rejoue sans doublonner.
- **Priorité** : P1.

## Fiche F5 — Verrous du flow
- **Type** : garde-fous · **Module** : sync, `SemaineView`
- **Objectif** : deux pièges connus fermés.
- **Comportement** :
  (a) **Aucune fuite de contenu local vers un foyer rejoint** — DEUX chemins à prouver :
  ① appareil vierge qui rejoint (via FTUE #join) : rien n'est poussé avant le pull ;
  ② appareil PEUPLÉ par la FTUE (parcours « Entrer », collection/gabarits installés) qui
  rejoint un foyer PLUS TARD : le contenu FTUE local ne doit JAMAIS fuiter dans le foyer
  rejoint — le rituel d'adoption existant (remplacement avec pré-export, fix A1) doit le
  garantir. Le PROUVER (test ou preuve par lecture + trace au DEVLOG), pas le supposer.
  (b) **Générateur IA sur bibliothèque vide** : si 0 recette, « Générer la semaine » propose
  d'abord d'installer la collection (redirection vers CollectionsSheet) au lieu de partir en
  génération IA intégrale (connexion + quota). Copie sobre, pas de blocage sec.
- **Critère de fini** : (a) preuve écrite au DEVLOG ; (b) biblio vide → tap Générer → invite
  collection ; biblio non vide → comportement inchangé.
- **Priorité** : P2 (mais dans le lot — c'est ce qui rend le flow « cohérent »).

---

## Portes du lot (chaque fiche + lot entier)
typecheck · Vitest (tests existants + nouveaux F2/F4) · build web ET build:native ·
smokes Cuisine + Comptes verts (zéro régression) · APK CI vert · **test device de la FTUE
par le PO** — avec trois exigences de protocole : ① le test de bout en bout se fait sur un
**FOYER NEUF** (le foyer prod existant contient le seed historique — Khadija — dans son
cloud : il ne peut pas servir de référence « vide ») ; ② un **scénario de mise à jour**
(appareil avec données → update → la FTUE ne DOIT PAS apparaître) ; ③ la branche
« Rejoindre » testée réellement (2ᵉ compte + invitation active).

## Hors périmètre explicite (parking)
Identité de marque · refonte nav · harmonisation visuelle (écran Sécurité) · page foyer QR
(« Toute la maison ») · système d'états du foyer · pages Entretien/Chauffeur réelles ·
peaufinage des états vides au-delà du chemin critique · CGU/politique réelles (naming requis) ·
bibliothèque éditoriale curatée (la collection-témoin est du contenu de TEST, pas ce livrable).

## Ordre & merges — PAR TRANCHES (leçon coquille-v1 : pas de branche longue)
**Tranche 1** : F1+F2+F3 **+ F5(b)** (socle contenu + garde-fou générateur — le garde-fou
voyage avec ce qu'il garde : sans lui, le défaut déployé entre les tranches aurait une
bibliothèque vide et un « Générer » qui part en IA/quota) → portes vertes → **merge --no-ff**.
Coût assumé : entre tranche 1 et 2, le défaut déployé est une app sans seed ni FTUE
(vide-muette pour un visiteur neuf) — acceptable : prod = comptes de test uniquement,
les appareils existants gardent leurs données.
**Tranche 2** : F4 (la FTUE) → portes → **merge**. **Tranche 3** : F5(a) — la preuve sync,
dont le chemin ② (peuplé-par-FTUE puis rejoint) n'existe qu'une fois F4 en place → **merge**.
**Discipline de lot : AUCUN autre chantier ne touche `src/` tant que le lot court.**
Read-back complet AVANT tout code, avec chiffrage par fiche et questions — puis GO du PO.
