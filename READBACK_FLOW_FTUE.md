# Read-back — Lot « Flow FTUE » (brief v1.2)

**Branche `flow-ftue-v1`** depuis le défaut post-merge coquille-v2 (`18eda5b`). Pas de token
(tout client/natif). Sources de vérité committées avec ce read-back : `BRIEF_FLOW_FTUE.md`
(v1.2) + `docs/maquettes/ftue-v4.html` (version « personne d'entretien »). Discipline de lot :
rien d'autre ne touche `src/` ; tranches T1 (F1+F2+F3+F5b) → T2 (F4) → T3 (F5a), merge par
tranche. **STOP : aucun code de fiche avant le GO.**

---

## ⚠️ SIGNALEMENT AVANT CODE — la prémisse de F5a-② est fausse sur le mécanisme existant

Le brief écrit : « le rituel d'adoption existant (**remplacement** avec pré-export) doit
garantir » qu'aucun contenu FTUE local ne fuite dans un foyer rejoint. **Vérifié sur code :
l'adoption n'est PAS un remplacement, c'est une FUSION consentie.** `planAdopt`
(`src/lib/sync/plan.ts:177-182`) : local absent du cloud → **upload** ; distant → adopté ;
collision → le cloud gagne. La copie UI le dit d'ailleurs : « on garde tout, et en cas de
doublon c'est la version du foyer qui gagne » (rituel Q1).

Conséquence concrète pour le chemin ② : un appareil peuplé par la FTUE (30 recettes de
collection, gabarits) qui rejoint un foyer plus tard **uploadera ce contenu dans le foyer**
(docIds locaux ≠ docIds distants → « local seul » → upload). Pire : si le foyer avait
lui-même installé la collection, **doublons par nom** (les ids diffèrent).

**Décision PO requise — trois options :**
- **(a) Assumer la fusion** (comportement actuel, consenti par le rituel) et retirer
  l'exigence « jamais fuiter » du chemin ② — en acceptant les doublons possibles de
  collection. Coût : zéro code, mais l'exigence du brief tombe.
- **(b) Dédup à l'adoption pour le contenu de pack** : à l'adoption, les recettes locales
  portant un `packId` dont le nom existe déjà dans le foyer ne sont pas uploadées
  (extension ciblée de `planAdopt`, testable en pur). Le contenu personnel (recettes
  créées à la main) continue de fusionner — c'est lui qu'on « garde ».
- **(c) Remplacement strict** pour le parcours « rejoindre » : on aligne le mécanisme sur la
  prémisse du brief (le local est écarté après pré-export). Changement de sémantique produit
  du rituel Q1 existant — impact au-delà de la FTUE (le flux Compte actuel fusionnne).

**Ma reco : (b)** — elle préserve l'esprit du rituel (« on garde TES choses ») tout en
empêchant le bruit de contenu installable ; périmètre pur et testable. Tranche 3 quoi qu'il
arrive ; la décision peut attendre le GO de T3, mais je la voulais sur la table AVANT T1.

---

## ✅ Gate pré-boot (F4.1) — FAISABILITÉ CONFIRMÉE, design précis

C'est la clé de voûte demandée — j'ai vérifié chaque point de friction possible :

**Siège du gate : un composant `Boot` dans `main.tsx`** (au-dessus d'`App`), pas un early
return DANS App. Raison : les hooks d'App (`useSession`, `useSync`, `useStore`) s'exécutent
dès qu'App est monté (règles des hooks — un early return n'empêche PAS les hooks de tourner).
En ne montant pas App du tout, **rien ne s'initialise ni ne s'écoute** pendant la FTUE.
`main.tsx` est trivial (13 lignes, `<App/>` nu) — le wrapper s'y insère proprement.

Ordre du Boot : ① `readEspaceToken()` (synchrone) → si `#e=`, **EspaceView direct, jamais de
FTUE** (un destinataire qui ouvre un lien ne doit pas voir l'onboarding) ; ② `#mz-demo`
idem ; ③ lecture méta IndexedDB : `ftueDone` présent → App ; absent mais `seedVersion`
présent → **migration one-shot** (poser `ftueDone` + `rolesActifs=['cuisine','nounou']`) →
App ; les deux absents → FTUE. Pendant la lecture (async, ~ms) : rien n'est rendu (pas de
flash).

**Points vérifiés, aucun obstacle :**
- `ensureSeeded` ne tourne pas (il vit dans `useStore.init`, App non monté). La course
  `seedVersion`-posé-au-boot-courant disparaît par construction.
- `useNounou.init` ne tourne pas (appelé par App/MaisonView/NounouView, non montés) →
  **aucun doc fantôme persisté** pendant la FTUE.
- `useSync` ne tourne pas → même si l'utilisateur se connecte pendant `#join`, **aucun
  push/pull automatique** ne peut partir (F5a-① garanti par construction).
- `getDB()` (ouvert par la lecture du gate) crée les object stores vides — c'est du schéma,
  pas des données ; sans impact sur les critères « vierge ».
- `initSentry()` reste avant le gate (aucune donnée, inchangé).
- **Bouton retour Android pendant la FTUE** : le handler B3 d'App n'est PAS monté (App absent)
  → la FTUE monte son PROPRE `onBackButton` via `platform.ts` (déjà exporté, coquille-v2) :
  écran précédent ; sur `#entry` → `minimizeApp()`. Nuance vs brief (« s'enregistre au
  registre B3 ») : le registre de feuilles ne sert à rien ici, c'est le listener direct qui
  est le bon outil — même effet, mécanisme plus simple. La name-sheet de `#people` s'y
  intègre (retour = fermer la sheet d'abord).
- `#join` pilote les briques EXISTANTES en direct : `sendOtp`/`verifyOtp` (`lib/auth`),
  `acceptInvite` (RPC + `clearSyncState`), puis pose `ftueDone` et **recharge** — au reboot,
  App monte, `useSync.fullSync` fait l'adoption/pull standard (fenêtre d'adoption : push
  interdit tant que non adopté, `useSync.ts:58-60` — vérifié). Rien de réinventé.

**Peuplement : committé d'un bloc au `#welcome`** (pas au fil des taps) — kill au milieu de
la FTUE ⇒ zéro trace, elle se re-présente ; cohérent avec « `ftueDone` posé seulement au
#welcome ».

---

## Fiches — chiffrage et design

### F1 — Retrait du seed personnel Nounou — 🟢
`seedNounouDoc()` ne garde que `emptyNounouDoc()` (numéros Maroc « à vérifier » conservés —
ils vivent dans `emptyNounouDoc`/`mergeNounouDoc`, intouchés). Enfants/rythme/Khadija/gabarits
sortent. Appareils existants intouchés (leur doc existe → jamais re-seedé). Aucun test
n'épingle le contenu du seed (vérifié). *Note : `useNounou.init` persistera un doc VIDE au
premier montage post-FTUE — sans conséquence (post-gate, et c'est l'état voulu).*

### F2 — Collection-témoin (30 recettes) — 🟢
- Génération de `data/packs/collection-temoin.json` **par script one-shot** depuis
  `SEED_RECIPES` (strip `id`/`statut`, darija conservée), **la recette `Écarté` exclue** → 30.
  Le JSON généré est committé et relu (pas de génération au build).
- Registre `PACKS` : +1 ; `marocain-quotidien`/`leger-equilibre` **conservés** (décision PO —
  banc d'essai dédup/multi-packs).
- `ensureSeeded()` : la branche `version === 0` n'importe plus ; **le tampon `SEED_VERSION`
  et les migrations `version < 4` restent** (appareils existants). `SEED_RECIPES` reste
  exporté (les tests shopping/nutrition l'utilisent — vérifié).
- **⚠️ `SEED_CONFIG` intouché** (8 fichiers).
- Tests `packs.test.ts` étendus (le nouveau pack s'installe, dédup contre lui-même et contre
  `marocain-quotidien`).
- **Smoke Cuisine adapté** : préambule qui ouvre Collections → installe la collection → puis
  parcours actuel inchangé (ses recettes viennent de l'installation).
- **Nom (décision PO au GO)** : ① « Le premier fonds » · ② « L'essentiel du quotidien » ·
  ③ « Fonds de départ ». Ma préférence : ①.

### F3 — Gabarits de conduites installables — 🟢
`installConduiteModeles()` (nouvelle, `nounou/`) : matérialise `CONDUITE_MODELES` dans le doc
via le store, idempotente **par titre**. Appelée par la FTUE (« Les enfants ») ; le bouton
d'import dans Conduites (pattern Sécurité) est ajouté **si** trivial une fois là — sinon
signalé et parqué.

### F4 — FTUE v4 — 🟡 (le gros morceau, design ci-dessus pour le gate)
- **`src/ftue/`** : les 7 écrans portés de la maquette (composants + CSS scopé `.ftue-`).
  **Écart assumé à signaler : les POLICES.** La maquette charge Fraunces/Plus Jakarta/Noto
  Naskh via Google Fonts — l'app est offline-first (CSP/SW), on n'ajoute **pas** de fetch de
  fonts : rendu avec la pile de polices de l'app. Fidèle en structure/couleurs/sans-scroll,
  pas au glyphe près. Si tu veux les polices exactes, c'est un embed d'assets (~200 Ko) — dis-le.
- **Mapping domaines** : cuisine → install collection (F2) · enfants → gabarits (F3) ·
  sécurité → **extraction préalable de `importSeed`** hors de `SecuriteView` en
  `lib/securiteSeed.ts` (fonction pure : charge, anti-doublon par titre, statut Test) — la
  vue et la FTUE appellent la même fonction. Entretien/vie pratique : visibles, badge
  « Bientôt », non sélectionnables.
- **#people → état « rôles activés »** (décision PO actée) : nouvelle clé méta
  `rolesActifs: PersonneKind[]` (IndexedDB). `MaisonView` ne montre les cartes de rôle sans
  destinataire QUE si activées (les personnes réelles restent toujours affichées).
  **Câblage du « ＋ Une page pour… »** : la feuille actuelle (App.tsx) ne liste que des
  « Bientôt » — elle gagne deux entrées RÉELLES Cuisine/Nounou qui activent le rôle
  (chemin d'ajout post-FTUE, sinon « rien coché » serait un cul-de-sac). Rôles à venir
  (Chauffeur/Ménage/Toute la maison) : non sélectionnables, comme la maquette.
- **Migration one-shot** (dans le gate, cf. supra) : appareils existants → `ftueDone` +
  rôles activés rétroactivement, JAMAIS la FTUE.
- **Replay « Revoir l'introduction »** : entrée dans la feuille Compte → mêmes écrans avec
  `demo=true` (taps simulés, **zéro install/import**, `#join` sauté). Monté DANS App (pas de
  gate), au-dessus du hub.
- **CGU/politique** : liens inertes (URLs inexistantes) — **signalé ici** comme demandé.
- **Smokes** : les 2 smokes existants gagnent un préambule déterministe **sans backdoor
  prod** : `goto` → la FTUE apparaît → `page.evaluate` écrit `ftueDone` en méta IndexedDB →
  `reload` → parcours inchangé. (Écrire avant le boot serait une course ; écrire puis
  recharger est déterministe.) **Mini-smoke FTUE dédié** en CI : traversée
  entry → domaines (cuisine) → memory → people (cuisine) → send → welcome → hub, avec
  assertions : carte Cuisine visible, bibliothèque peuplée, `ftueDone` posé.
- **Cas limites couverts** : rien coché → hub sans carte d'équipe (le « ＋ » comme chemin) ;
  kill mi-parcours → re-présentation (peuplement atomique au #welcome) ; code invalide/expiré
  → l'erreur du RPC (`data.error`) affichée, retour possible ; retour Android (cf. gate).

### F5(b) — Générateur sur bibliothèque vide — 🟢
`SemaineView` : si `recipes.length === 0`, « Générer la semaine » ouvre la proposition
d'installer la collection (redirection `CollectionsSheet`, copie sobre) au lieu de partir en
IA. Biblio non vide → strictement inchangé. Voyage en T1 avec F2 (le garde-fou accompagne ce
qu'il garde).

### F5(a) — Preuve anti-fuite — 🟡 (T3, suspendue à la décision du signalement)
- **Chemin ①** (vierge qui rejoint) : garanti **par construction** du gate (aucun store
  monté, aucun push possible avant reboot ; au reboot, fenêtre d'adoption = push interdit,
  `useSync.ts:58`). Preuve par lecture + trace DEVLOG + le mini-smoke FTUE.
- **Chemin ②** (peuplé-par-FTUE qui rejoint plus tard) : dépend de l'option (a)/(b)/(c)
  ci-dessus. Si (b) : test Vitest pur sur `planAdopt` étendu + trace DEVLOG.

---

## Récapitulatif des 9 points de conception tranchés (traités ci-dessus)
① Gate pré-boot : **faisable, confirmé** — wrapper `Boot` dans `main.tsx`, pas d'early return
dans App (les hooks y tourneraient) · ② rôles activés : méta `rolesActifs` + filtre hub + le
« ＋ » comme chemin d'activation · ③ collection à **30** (Écartée sortie) · ④ les 2 packs
existants **conservés** · ⑤ `importSeed` extrait en `lib/securiteSeed.ts` · ⑥ retour Android :
listener direct `onBackButton` de la FTUE (le registre feuilles ne s'applique pas — App non
monté), name-sheet intégrée · ⑦ smokes : préambule write-meta-puis-reload + mini-smoke FTUE
dédié · ⑧ migration one-shot rétroactive dans le gate (`seedVersion` lu AVANT tout boot de
store — la course est éliminée par le gate lui-même) · ⑨ signalements : polices de la
maquette non embarquées (pile app), liens CGU inertes, **prémisse F5a-② fausse → décision
(a)/(b)/(c)**.

## Questions au GO (bloquantes pour leur fiche seulement)
- **Q-1 (F2)** : nom de la collection — ① « Le premier fonds » ② « L'essentiel du quotidien »
  ③ « Fonds de départ » ?
- **Q-2 (F4)** : polices — pile de l'app (défaut proposé, zéro réseau) ou embed des fonts de
  la maquette (~200 Ko d'assets) ?
- **Q-3 (F5a, décidable au GO de T3)** : option (a) fusion assumée / **(b) dédup pack à
  l'adoption (reco)** / (c) remplacement strict ?

## Portes (chaque tranche)
typecheck · Vitest (dont nouveaux tests F2/F4) · build web + natif · smokes Cuisine + Comptes
(zéro régression) · mini-smoke FTUE (T2+) · APK CI vert · test device PO en fin de lot
(protocole du brief : foyer NEUF ; scénario mise à jour = jamais de FTUE ; « Rejoindre » réel).

**Chiffrage global** : T1 🟢 (F1/F2/F3/F5b — mécanique sur rails existants) · T2 🟡 (F4 — le
gate est conçu, le volume est dans les 7 écrans + replay + smokes) · T3 🟡 (F5a — court mais
suspendu à Q-3). **Rouge : rien.**
