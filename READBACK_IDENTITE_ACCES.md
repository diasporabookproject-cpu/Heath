# Read-back — Lot « Identité & accès », PHASE 1 : le compte requis

**Étape ① du processus (read-back + inventaire) · AUCUN code écrit · en attente de validation PO.**
Processus : ① ce document → ② validation PO → ③ **l'inventaire (§6) part à l'agent UI** → ④ implémentation.

Sources : `DECISION_IDENTITE_ACCES.md` (v2, 25/07/2026) · `PROJET_MAISON_OS.md` (v2.5) · `ETAT.md` · le code.
Toutes les affirmations de code portent leur preuve `fichier:ligne`, vérifiée sur le défaut au 25/07/2026.

---

## 1. La décision, en une phrase

**Le compte devient requis dès le premier lancement.** Écran 1 = se connecter / créer un compte.
Écran 2 = le foyer. Les données naissent rattachées à un compte, **donc il n'y a plus rien à fusionner**.

Ce n'est **pas** une refonte d'authentification : la méthode ne change pas (`sendOtp`/`verifyOtp`
restent, le code à 6 chiffres par e-mail fonctionne). Ce qui change, c'est **quand** le compte est demandé.
Google/Apple = **Phase 2**, hors de ce lot (la règle Apple 4.8 imposera alors *deux* intégrations).

**L'invariant qui meurt** est écrit noir sur blanc dans le code : « L'auth n'est **JAMAIS** bloquante :
l'app marche sans compte » (`src/lib/auth.ts:6-7`, repris `components/AccountSheet.tsx:19-20`).

---

## 2. Ce qui MEURT — confirmé fichier par fichier

| Ce qui tombe | Où | Taille |
|---|---|---|
| `adopt()` | `lib/sync/engine.ts:143-178` | 36 l. |
| `remoteHasDocs()` — n'existait **que** pour le rituel de consentement | `lib/sync/engine.ts:130-141` | 12 l. |
| `planAdopt()` + `AdoptPlan` + `normNom`/`isPackDupe` (**la dédup de packs**) | `lib/sync/plan.ts:168-215` | 48 l. |
| Le contrat `dropLocal` (F5a-②) | `lib/sync/plan.ts:172-175`, appliqué `engine.ts:161` | — |
| Orchestration d'adoption : `adoptInto`, `asked`, `activeFoyer`, fenêtre « push interdit », `AdoptRequest` | `lib/sync/useSync.ts:18-22, 29-32, 41-49, 58-82` | ~45 l. |
| **Feuille de consentement « Fusionner nos maisons »** | `App.tsx:272-297` + état `adoptReq` (`App.tsx:41-43, 69`) | 26 l. |
| `SecuriserVolet` **en entier** + ses 2 branchements | `components/SecuriserVolet.tsx` (105 l.) · `cuisine/PartageSheet.tsx:23,269` · `nounou/PartageNounouSheet.tsx:9,248` | 105 l. |
| Garde « pas de session → volet sécuriser » | `cuisine/PartageSheet.tsx:129-132` · `nounou/PartageNounouSheet.tsx:143-148` | — |
| **9 tests** `planAdopt` sur les 25 de `plan.test.ts` | `:144-161` (1) · `:163-212` (4) · `:227-264` (4) | — |
| `sendMagicLink` — **code mort**, zéro appelant (trouvaille annexe) | `lib/supabase.ts:31-37` | 7 l. |

### ⚠️ Piège dans ces 9 tests — ne pas supprimer à l'aveugle
Le bloc `plan.test.ts:216-286` s'intitule « planAdopt & pull » mais contient **2 tests qui doivent
survivre** (`:266` garde G2 sur les règles, `:279` push dirty). Surtout, ses 4 tests `planAdopt` portent
une **exigence PO du GO du lot Cuisine T3** : *prouver que les restrictions du foyer voyagent*.
→ **Porter leur intention sur push/pull**, ne pas les perdre.

### Ce qui rétrécit sans mourir
`useSync` garde `lastFoyer` (détecter un changement de foyer pour purger méta/curseurs),
`clearSyncState` (appelé par `leaveFoyer`/`acceptInvite`/`deleteAccount`), et le push débouncé.

---

## 3. Ce qui reste INTACT

Local-first IndexedDB · le hors-ligne · `push`/`pull`/LWW/G2/curseurs (`lib/sync/plan.ts:93-166`) ·
les RLS · le foyer (`ensureFoyer`, `lib/auth.ts:41-59`) · **le partage et les pages reçues**.

**Garantie par construction pour les pages reçues** : `ftue/Boot.tsx:21-23` court-circuite vers `App`
**avant tout** dès qu'un jeton d'espace est présent (`readEspaceToken()`). Un destinataire ne verra
jamais l'écran de compte. **C'est l'invariant à ne pas casser : le nouveau gate s'insère APRÈS ce test.**

---

## 4. 🔴 « Rejoindre force une fusion » — le bug ne disparaît PAS tout seul

L'intention est juste, la mécanique ne suit pas. Aujourd'hui : `acceptInvite` → `clearSyncState()`
(`lib/auth.ts:165`) → reload → `useSync` voit `last !== foyerId` → adoption + consentement.

**Si on supprime `adopt` sans rien d'autre**, le cycle devient `syncNow` = `push` puis `pull`. Or `push`
appelle `planPush(local, meta)` avec une méta **vidée** → `isDirty` vrai pour **tous** les docs locaux
(`plan.ts:88-91, 104`) → **tout le contenu local est téléversé dans le foyer rejoint**, silencieusement
et sans consentement. **Pire qu'aujourd'hui.**

**Le même défaut frappe le bénéfice annoncé au §3 du doc de décision** (« test sur compte neuf trivial :
déconnexion → autre compte ») : déconnexion (données locales du compte A) → connexion compte B → foyer B
neuf et vide → **les données de A atterrissent dans le foyer de B**.

> ### 🔑 La règle qui règle les deux
> **Changement de foyer ⇒ purge locale, puis `pull` seul.** Le foyer rejoint fait foi.
> Ce n'est pas une précaution : c'est **ce qui rend vraies** les deux promesses du document
> (« rejoindre ne fusionne plus rien » **et** « test sur compte neuf trivial »).

---

## 5. Les trois questions instruites

### ① La session survit-elle hors-ligne ? — risque réel, localisé, évitable
`supabase-js 2.108.2` / `auth-js`. Config : `persistSession: true`, `autoRefreshToken: true`
(`lib/supabase.ts:20-21`) → session en `localStorage` (WebView comprise), survit au redémarrage.

- **La session n'est PAS détruite hors-ligne** : un échec réseau lève `AuthRetryableFetchError`
  (`auth-js/lib/fetch.js:28`) et `_removeSession()` n'est appelé **que si** l'erreur n'est *pas* de ce
  type (`GoTrueClient.js:4155-4172`). Le jeton de rafraîchissement reste : au retour du réseau, la
  session revient.
- **Mais `getSession()` renvoie quand même `null`** quand le jeton d'accès est expiré : le refresh
  échoue, `accessTokenStillValid` est faux, `return { data: { session: null }, error }`
  (`GoTrueClient.js:2483-2505`). Durée de vie par défaut d'un jeton Supabase : **1 heure**.
- Jeton **non expiré** → session rendue **sans aucun appel réseau** (`GoTrueClient.js:2455-2481`). ✅

**Conséquence si le gate s'écrit `if (!session) → écran de connexion`** : hors-ligne depuis plus d'une
heure → mur de connexion → **et se connecter exige le réseau**. C'est le scénario du métro. **Bloquant.**

> ### 🔑 Parade retenue — le gate porte un drapeau local, pas la session vivante
> Au premier `verifyOtp` réussi, poser un drapeau **`compteLie`** en IndexedDB (`userId` + e-mail, à côté
> de `ftueDone`, `lib/db.ts:157-162`) et **gater dessus**. La session vivante reste ce qu'elle est : la
> condition des opérations réseau (sync, publication, IA), **déjà toutes best-effort**.
> **Bénéfice second, décisif :** les **3 smokes Playwright** entrent aujourd'hui en écrivant `ftueDone`
> en IDB puis en rechargeant (`scripts/smoke.mjs:36-51`, « zéro backdoor dans le code produit »). Un gate
> sur la session vivante **tue les 3 smokes** (ils exigeraient un vrai e-mail OTP) ; avec le drapeau, ils
> posent `compteLie` comme ils posent `ftueDone`. Le même choix sauve le métro **et** la CI.
> **Compatible Phase 2** : une connexion Google/Apple produit une session comme l'OTP → même drapeau.

### ② Le premier lancement exige-t-il le réseau ? — oui, par nature ; l'échec est moche aujourd'hui
S'authentifier appelle le serveur (`lib/auth.ts:13`, `:32`). **À assumer et à écrire à l'écran.**

Ce qui n'est pas acceptable en l'état : les trois appelants affichent le message **brut** de Supabase —
`ftue/Ftue.tsx:207`, `components/AccountSheet.tsx:127`, `components/SecuriserVolet.tsx:25`. Hors-ligne,
c'est « **Failed to fetch** » (Chrome) / « Load failed » (Safari) : de l'anglais technique.
→ **Message honnête à écrire** + bouton **Réessayer**. Pas d'écran mort, mais pas ça non plus.

Cas voisin : si les clés Supabase manquent au build, `sendOtp` renvoie « Connexion indisponible. »
(`lib/auth.ts:12`) et **l'app entière devient inutilisable** (compte requis). À traiter comme une erreur
de build, pas comme un état utilisateur.

### ③ Que deviennent les données locales existantes ? — option A, zéro code

| Option | Coût | Verdict |
|---|---|---|
| **A. Rattacher au premier compte** | **Zéro ligne.** Foyer neuf → cloud vide → le `push` normal les téléverse (méta absente ⇒ tout est dirty) | ✅ **retenue** |
| B. Les jeter | Code de purge + écran d'avertissement ; perd les données de test qui font tourner les smokes | ✗ plus cher, destructeur |
| C. Demander à l'utilisateur | Un écran et une décision de plus, pour 2 appareils | ✗ dette pour rien |

Aucune migration proposée (produit non lancé). `hasBootedBefore()` (`lib/db.ts:180`) existe pour
reconnaître un appareil pré-existant : **recommandation de ne pas s'en servir ici.**
**Condition** : cette adoption implicite ne vaut que pour un foyer **qu'on fonde**, jamais pour un foyer
**qu'on rejoint** (cf. la règle du §4).

---

## 6. 📋 INVENTAIRE DES ÉCRANS — le livrable pour l'agent UI

### 6.1 Le parcours cible

```
lien reçu (#e=…)  ─────────────────────────►  page du personnel   (JAMAIS de compte — invariant)
lancement normal → ① COMPTE (e-mail → code) → ② FOYER (la FTUE) → l'app
```

### 6.2 Écran par écran

| # | Écran | Fichier | Ce qu'il fait AUJOURD'HUI | Ce qu'il devra faire |
|---|---|---|---|---|
| 1 | **Gate pré-boot** (invisible) | `ftue/Boot.tsx:20-43` | Ordre : jeton d'espace / `#mz-demo` → App · `ftueDone` → App · appareil déjà booté → migration → App · sinon FTUE | Insérer le test **compte** entre le jeton d'espace et `ftueDone`. Nouvel ordre : jeton d'espace → App · **pas de compte → Écran 1** · `ftueDone` → App · sinon FTUE. **Le test du jeton reste EN PREMIER** |
| 2 | **① Connexion / création** — *nouvel écran plein* | à créer ; matière : `AccountSheet.tsx:293-361` | N'existe pas en plein écran ; aujourd'hui feuille optionnelle en 2 temps (e-mail → code 6 chiffres) | Écran **1** de l'app. E-mail → code. **Aucune échappatoire** (« Plus tard — je continue sans compte », `AccountSheet.tsx:318`, disparaît). Message honnête hors-ligne (Q②) + **Réessayer**. Un seul chemin visuel « se connecter **ou** créer un compte » : `shouldCreateUser: true` (`lib/auth.ts:21`) fait déjà les deux sans les distinguer |
| 3 | **② Le foyer (FTUE)** | `ftue/Ftue.tsx` (692 l.) — écrans `entry, join, domain, memory, people, send, welcome` (`:20-23`) | Premier écran de l'app ; domaines, gabarits, rôles + prénoms, puis **commit unique** du peuplement (`populate`, `:41-106`) | **Elle reste, elle ne fond pas** — mais passe **après** le compte et perd deux choses : `#entry` n'est plus l'accueil de l'app, et **« Rejoindre un foyer existant » (`:246-249`) quitte la FTUE** (rejoindre suppose désormais un compte → c'est `acceptInvite` depuis la page de compte). Le sous-parcours `#join` (`:120-124, 196-226, 261-330`) — code → e-mail → OTP — **disparaît d'ici** : son OTP faisait double emploi avec l'Écran 1 |
| 4 | **Page de compte** | `components/AccountSheet.tsx` (362 l.) | Feuille à 3 états (e-mail / code / connecté) mêlant connexion, export, déconnexion, invitation, rejoindre, quitter, suppression, « revoir l'intro » | Les états e-mail/code **partent à l'Écran 1**. Reste une **vraie page de compte** : voir §6.3 |
| 5 | **Volet « sécuriser ta page »** | `components/SecuriserVolet.tsx` (105 l.) | Au partage sans session : e-mail + code dans la feuille, puis l'envoi repart | **SUPPRIMÉ.** Sa raison d'être (« on ne partage pas sans compte », `:5-8`) est absorbée : le compte existe forcément |
| 6 | **Feuille de partage Cuisine** | `cuisine/PartageSheet.tsx:122-132, 269` | Avant publication : `getSession()` live ; si absente → bascule sur le volet | Le garde tombe. **Un cas honnête reste à dessiner** : session expirée **hors-ligne** au moment de publier → « Publication impossible hors-ligne, réessaie avec du réseau ». **Jamais** un écran de connexion |
| 7 | **Feuille de partage Nounou** | `nounou/PartageNounouSheet.tsx:143-148, 224, 248` | Idem + `if (!supabaseEnabled) toast('Connexion indisponible.')` | Idem #6 |
| 8 | **Consentement « Fusionner nos maisons »** | `App.tsx:272-297` | Feuille : « Ce foyer a déjà du contenu… le foyer gagne » + export de précaution | **SUPPRIMÉ** — plus rien à fusionner |
| 9 | **Bouton compte — 4 emplacements** | `App.tsx:158-169` · `maison/MaisonView.tsx:297-299` · `cuisine/CuisineView.tsx:181` · `nounou/NounouView.tsx:86-91` | « ☁︎ **Connexion** » ou « ☁︎ » selon `connected` ; masqué si `supabaseEnabled` faux | L'état « déconnecté » n'existe plus : **un seul libellé** (Compte / réglages). La prop `connected` devient inutile — **ne pas** la remplacer par un indicateur de session vivante, il clignoterait hors-ligne (Q①) |
| 10 | **Page reçue** | `views/EspaceView.tsx` · `cuisine/EspaceCuisine.tsx` | Lecture publique par jeton, sans compte, cache offline | **NE CHANGE PAS.** À vérifier explicitement en recette : le gate ne doit jamais s'afficher sur un lien reçu |

### 6.3 La page de compte propre — proposition

**Bloc 1 — Identité** : e-mail connecté (`session.user.email`) · **Se déconnecter**.
> ⚠️ Se déconnecter **renvoie à l'Écran 1** et, l'app exigeant un compte, l'utilisateur ne peut plus
> entrer sans réseau. Le bouton doit le dire (« Tu devras te reconnecter avec ton e-mail ») et se ranger
> **sous** l'e-mail, pas en action principale.

**Bloc 2 — Foyer partagé** (aujourd'hui `AccountSheet.tsx:189-260`) : inviter par code · rejoindre par
code · quitter. Conservé tel quel — l'invitation par lien est **hors périmètre Phase 1**.
*Question ouverte pour le PO : la page devient dense ; ce bloc mérite peut-être son propre écran.*

**Bloc 3 — Zone rouge** : **Supprimer mon compte** (exigence Apple 5.1.1(v)), avec la confirmation et le
texte existants (`:270-287`), qui restent justes.

**Sous-écran « Avancé »** : c'est là que **l'export JSON s'enterre** (aligné sur §5 du doc de décision :
*« sa place est un avancé, pas la page de compte »*). Il doit rester atteignable — portabilité RGPD —
mais quitte la page de compte et cesse d'être un bouton de premier rang (`AccountSheet.tsx:175-177`).
Le code ne bouge pas (`lib/exportData.ts`) ; seul son emplacement change. Il **perd son rôle de filet
avant fusion** (`App.tsx:288`, `AccountSheet.tsx:75, 100`) : il n'y a plus de fusion.

**À déplacer** : « Revoir l'introduction » (`:262-264`, replay démo de la FTUE) — utile, mais ce n'est
pas du compte.

### 6.4 Contraintes non négociables pour le dessin

1. **Un lien reçu ne voit jamais le gate** (§3). Le personnel n'a pas de compte — invariant du produit.
2. **Aucune échappatoire** sur l'Écran 1 : pas de « plus tard », pas de mode invité.
3. **Hors-ligne ≠ déconnecté.** Aucun écran ne doit proposer de se (re)connecter parce que le réseau
   manque : l'app s'ouvre, seules les opérations réseau échouent, poliment (Q①).
4. **Langue de l'UI : français.** Aucun message d'erreur technique en anglais ne doit atteindre l'écran (Q②).

---

## 7. Trois corrections au document de décision — avant de le verser dans `DECISIONS_STORE_V1.md`

**🔴 A. « 3 surfaces UI » (§1) est juste pour la Phase 2, faux pour la Phase 1.**
Le doc écrit : « changer la méthode d'authentification ne touche que 2 fonctions et **3 surfaces UI**
(`Ftue.tsx`, `AccountSheet.tsx`, `SecuriserVolet.tsx`) ». Exact pour *changer la méthode*. Mais la Phase 1
ne change pas la méthode, elle change **le moment** — et le moment est un **gate** : il touche tout ce qui
suppose qu'on peut entrer sans compte. L'inventaire §6 en recense **10**, dont 7 hors des trois nommées.
*Formulation proposée : « changer la MÉTHODE ne touche que 2 fonctions et 3 surfaces ; changer le MOMENT
(Phase 1) en touche 10 — cf. `READBACK_IDENTITE_ACCES.md` §6. »*

**🔴 B. « Le skip FTUE (il existe, `Ftue.tsx:527`, mais on ne le voit pas) » (§5) — il n'existe pas.**
Vérifié exhaustivement. `Ftue.tsx:527` est `<button className="skip">` **« Plus tard — poser la page sans
nom »** : il vit dans la feuille de nommage et active le rôle **sans prénom** — il ne saute pas la FTUE.
Les trois autres `.skip` du fichier sont des retours arrière dans `#join` (`:282`, `:308`, `:333`).
Le **seul** chemin de la FTUE réelle vers l'app est `finish()` (`:545`, écran `#welcome`), qui appelle
`populate()` ; les `onDone()` de `:138`/`:183` sont réservés au mode démo.
**Il n'existe aucun moyen de sauter la FTUE.** La confusion vient probablement de la classe CSS `skip`.
*Conséquence : le lot onboarding ne doit pas planifier de « rendre visible » un skip — s'il en veut un,
c'est une fonctionnalité à écrire.*

**🟡 C. « la sync devient plus simple : un seul sens » (§3) — formulation à resserrer.**
La sync reste **bidirectionnelle** : `push` et `pull` survivent intacts (`engine.ts:79-128`). Ce qui
disparaît, c'est la **réconciliation** (l'union local↔cloud d'`adopt`). Pris au mot, « un seul sens »
ferait croire qu'on abandonne une direction.
*Formulation proposée : « la sync perd sa réconciliation d'orphelins ; push et pull restent, et gagnent
une règle de changement de foyer. »* Même remarque pour la tension entre §1 (« la sync : rien ne bouge »)
et §3 (« la sync devient plus simple ») : la version juste est **la sync perd `adopt` et gagne une règle**.

---

## 8. Décisions à valider avant l'étape ③

1. **Le gate porte un drapeau local `compteLie`**, pas la session vivante *(Q① — préserve l'invariant
   offline que le doc dit préserver, et sauve les 3 smokes)*.
2. **Changement de foyer ⇒ purge locale + `pull` seul** *(§4 — condition de « rejoindre ne fusionne
   plus » **et** du « test compte neuf trivial » promis par le doc)*.
3. **Données locales existantes : option A**, zéro code *(Q③)*.
4. Les 4 tests « les règles du foyer voyagent » **portés** sur push/pull, pas supprimés *(§2)*.
5. **Export JSON → sous-écran « Avancé »** *(§6.3, aligné sur le doc)*.
6. **Supprimer `sendMagicLink`** (code mort, `lib/supabase.ts:31-37`).
7. **Corriger A, B et C** dans le doc de décision avant de le verser dans `DECISIONS_STORE_V1.md`.

**Questions ouvertes pour le PO** (à trancher avant ou avec l'agent UI) :
- Le bloc « Foyer partagé » reste-t-il sur la page de compte, ou prend-il son propre écran ?
- Où va « Revoir l'introduction » ?
- Le doc de décision corrigé : je le verse dans `DECISIONS_STORE_V1.md` maintenant, ou à l'étape ④ ?

**Deux points de calendrier, qui appartiennent au PO :**
- Le §4 du doc note que **si le test par des amis est proche, la Phase 2 devrait précéder la Phase 1**
  (le mur des six chiffres pèse plus une fois obligatoire). Rien dans la conception Phase 1 ne l'empêche.
- Le §2.4 signale un possible désengagement d'Ionic vis-à-vis de **Capacitor**, socle de la coquille
  native. **À instruire séparément** — non traité ici.

---

*Fin du read-back. Aucun code ne sera écrit avant l'étape ④ (réception des maquettes).*
