# Read-back — Avenant « F4-bis » (retours du test device APK #13)

**Branche `f4bis-v1`** depuis le défaut post-lot FTUE (`3c38955`). Pas de token (client/natif).
Fondation validée au test device (page reçue, anti-fuite, migration, 30 recettes) ; cet avenant
traite les **3 défauts + 1 investigation** remontés. Décisions PO intégrées (message du 12/07).
Ordre de code proposé : **A (bloquant) → C → B → D**, portes complètes par fiche, re-test
device final sur APK frais. **STOP : GO du PO avant le code.**

---

## Rapport d'investigation — Fiche C (« Envoyer » sans feuille de partage)

**Le décrochage exact : il n'y a AUCUNE branche native dans les chemins d'envoi — ce n'est pas
une API qui échoue en silence, c'est une absence.** Les deux feuilles de partage datent de l'ère
web et n'utilisent que des APIs web :

| Chemin | Code | Comportement APK observé |
|---|---|---|
| Destinataire AVEC numéro | `window.open('https://wa.me/…')` — `PartageSheet.tsx:139-140`, `PartageNounouSheet.tsx:150` | Délégué au système par Capacitor (Intent externe) — à re-vérifier au re-test, mais pas le cas rapporté |
| SANS numéro (ton test) | `navigator.clipboard.writeText(digest)` + toast « Publié ✓ — message copié » — `PartageSheet.tsx:144`, `PartageNounouSheet.tsx:153` | **Copie et s'arrête là** — rien d'autre n'existe |
| « Copier le lien » | `navigator.clipboard.writeText(url)` — `PartageNounouSheet.tsx:193` | idem |

- Le plugin **`@capacitor/share` est déjà embarqué** (B2, coquille-v2 — l'export l'utilise) mais
  **aucun chemin d'envoi ne l'appelle**. L'API Web Share (`navigator.share`) n'est pas utilisée
  non plus (et la WebView Android ne l'implémente pas).
- **Web : normal** — aucune feuille native n'a jamais été codée, et le desktop n'en a pas.
  (Note : Chrome Android *web* sait faire `navigator.share` — amélioration possible, HORS
  périmètre sauf demande.)
- **APK : bug confirmé** = branche native absente.

**Correctif (fiche C)** : `platform.ts` gagne `shareText(text, title?)` (import dynamique du
plugin déjà épinglé — même moule que `saveAndShareFile`). Dans les DEUX feuilles : en natif,
l'envoi ouvre la **feuille de partage Android** avec le digest (lien inclus) — WhatsApp y est
un tap ; le web garde son comportement actuel (wa.me / presse-papiers). `platform.ts` reste
l'unique porte Capacitor. **Chiffrage : 🟢.**
Question C-1 (mineure, à trancher au GO) : en natif avec numéro renseigné, on garde le
wa.me direct (WhatsApp pré-ciblé) et la feuille seulement sans numéro — ou la feuille
partout ? **Reco : wa.me direct quand le numéro existe** (moins de taps vers la bonne
personne), feuille sinon.

---

## Fiche A — Création de moment bloquée sur foyer neuf — 🟢 (P1, bloquant)

**Diagnostic exact** : `MomentSheet.tsx:66` et `:88` — `if (kids.size === 0) return
toast('Choisis au moins un enfant')`. Sur un foyer neuf post-F1 (zéro enfant), la présélection
(`:52`, « tous les enfants » = vide) donne `kids = ∅` → **blocage dur, sans issue**. Régression
induite par F1 : l'exigence datait de l'ère où deux enfants étaient toujours seedés.
(`PonctuelSheet` n'exige rien → les ponctuels passent ; seul le MOMENT bloque.)

**Le modèle est déjà prêt** : `Moment.enfants = []` signifie « tous les enfants » partout
(`JourneeView.tsx:45`, `MomentBrick`, projection). Rendre l'association optionnelle est donc
une **levée de contrainte UI, pas un changement de modèle**.

**Correctif (décision PO)** :
1. Supprimer le blocage aux deux endroits — `enfants: []` = « pour tous » (libellé UI ajouté
   sous les puces : « Personne de coché = pour tous »).
2. **Raccourci « ＋ ajouter un enfant »** dans la rangée des puces enfants de `MomentSheet` :
   mini-champ prénom inline → `upsertEnfant` (action store existante) → puce créée et
   auto-cochée — **sans quitter la feuille, saisie du moment préservée** (même état React).
**Critère de fini** : foyer neuf → créer un moment sans enfant ✓ ; en créer un en ajoutant
« Yasmine » depuis la feuille ✓ ; heure/intitulé/jours intacts après l'ajout ✓.

---

## Fiche B — Partage « sans friction » : compte transparent, vécu « sécuriser sa page » — 🟡 (P1)

**Point de friction actuel (localisé)** : `publish.ts:24-29` — sans session, `getAccessToken()`
**jette** « Connecte-toi (☁︎ en haut) pour partager… » → toast d'erreur dans la feuille de
partage → l'utilisateur est renvoyé vers un AUTRE écran (le nuage), rupture complète du geste.
(La RLS `espaces` post-Fiche 3 exige `authenticated` + membre du foyer : la Lecture 1 — « le
partage EST l'écriture cloud » — est aussi une réalité backend.)

**Design (décision PO — Lecture 1)** : la création de compte devient UNE ÉTAPE DU PARTAGE,
dans la MÊME feuille, au vocabulaire « sécuriser » :
1. `send()` détecte l'absence de session AVANT `publishEspace` → la feuille bascule sur un
   volet inline « **Sécurise ta page pour créer son lien** » : « Ton lien doit vivre quelque
   part de sûr. Ton e-mail, un code à 6 chiffres — c'est tout. » (jamais « inscription »,
   « compte », « connexion »).
2. E-mail → `sendOtp` → code 6 chiffres → `verifyOtp` → `ensureFoyer` (briques EXISTANTES,
   zéro nouveau backend).
3. **L'envoi repart TOUT SEUL** là où il s'était arrêté (le destinataire sélectionné, la
   portée choisie — tout l'état de la feuille est encore là) → feuille de partage/wa.me →
   « Envoyé ✓ ». Une seule respiration, pas de rupture.
4. Même volet dans les DEUX feuilles (Cuisine + Nounou) — composant partagé
   (`SecuriserVolet`), et `publish.ts` garde son garde-fou (dernier filet, message inchangé).
**Cas limites** : e-mail invalide / code erroné → erreurs inline, le partage reste en attente ;
hors-ligne → message sobre « impossible de créer le lien hors connexion » ; utilisateur DÉJÀ
connecté → strictement rien ne change.
**Critère de fini** : sans compte, « Envoyer » aboutit à « Envoyé ✓ » en une séquence continue
(e-mail + code au milieu), sans jamais quitter la feuille ; le smoke Comptes (invariant
« jamais imposé ») reste vert — l'app hors partage ne demande toujours rien.
**Chiffrage 🟡** : le volet UI × 2 feuilles + reprise d'état + copies. C'est le morceau le plus
sensible de l'avenant (il touche le geste central du produit).

---

## Fiche D — Nom + langue à la FTUE (name-sheet de la maquette) — 🟢/🟡 (P2)

**Décision PO** : porter la name-sheet (« Comment s'appelle votre cuisinière ? » — prénom +
langue الدارجة/Français/العربية/English) ; tap sur un rôle actif → feuille ; « Ajouter » →
carte « ✓ Fatima · darija » ; « **Annuler » = carte SANS nom** (le cas turnover reste premier).
Rôles « Bientôt » inchangés.

**Le garde-fou demandé — le gate et F5a TIENNENT, vérifié point par point** :
- **Gate pré-boot : intact.** La name-sheet est de l'état React interne à `Ftue` (comme
  domains/roles) — App toujours pas monté, aucun store initialisé, rien de persisté pendant
  la saisie.
- **Atomicité : conservée.** Les destinataires nommés sont créés **au #welcome, dans le même
  `populate()` d'un bloc**, hors-store, en écriture directe IndexedDB : Cuisine →
  `saveDestinataire` (store `destinataires`, jeton `newToken()`) ; Nounou →
  `doc.destinataires` + `saveNounou` (même canal que les gabarits F3). Kill mi-parcours =
  zéro trace, comme avant.
- **F5a-① : inchangé** — le chemin #join ne passe JAMAIS par `populate()` (le contenu vient
  du foyer rejoint).
- **F5a-② : un destinataire nommé est du contenu PERSONNEL** (pas de `packId`) → il FUSIONNE
  à une adoption ultérieure, comme une recette faite main — c'est « on garde TES choses »,
  voulu et cohérent. Son jeton ne référence AUCUN espace publié tant que rien n'est envoyé
  (aucun lien mort, aucune fuite).
- **Replay démo : toujours strictement visuel** (la feuille s'affiche, rien n'est créé).
**Langue** : mêmes codes que l'archi (`fr`/`ar`/`dr`/`en`). **Smoke FTUE étendu** : nommer
« Fatima » sur Cuisine → hub « Fatima · Cuisine » ; annuler sur Nounou → carte de rôle vide.
**Critère de fini** : maquette respectée (feuille, chips langue, « ✓ prénom · langue » sur la
carte) ; hub prêt à envoyer sans re-saisie ; Annuler = comportement actuel.

---

## Portes (chaque fiche + avenant)
typecheck · Vitest (tests A/D ajoutés là où c'est pur) · build web+natif · 3 smokes (Cuisine ·
Comptes · FTUE étendu) · APK CI vert · **re-test device PO final** (protocole : fiche A sur
foyer neuf · envoi APK → feuille de partage native · envoi sans compte → « sécuriser » →
Envoyé ✓ · FTUE avec nommage).

**Chiffrage global** : A 🟢 · C 🟢 · B 🟡 (le sensible) · D 🟢/🟡. **Rouge : rien.**
**Questions au GO** : C-1 (wa.me direct quand numéro présent — reco oui) ; B-1 : la copie
exacte du volet « Sécuriser » ci-dessus te va, ou tu veux la retoucher au STOP de la fiche B
(comme la copie AS-2b) ?
