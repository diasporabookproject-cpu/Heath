# BRIEF — Finitions prod + Coquille Capacitor
### `BRIEF_FINITIONS_COQUILLE_CLAUDE_CODE.md` · v1 · 5 juillet 2026

> **Deux parties, un objectif d'Amine : des APK de test sur plusieurs appareils rapidement.**
> Partie 1 = finir la mise en prod de Comptes+Sync (SMTP en tête — c'est aussi un prérequis
> de la coquille). Partie 2 = coquille Capacitor **minimale d'abord** (Android debug), iOS
> ensuite, store-readiness plus tard. Cadre : `DECISIONS_STORE_V1.md` (D1 Capacitor, D6) +
> `RESTITUTION_A1_ET_PLAN_PROD.md` (§ordre de marche validé).
> Méthode inchangée : read-back + chiffrage 🟢🟡🔴 par fiche avant code, branche
> `coquille-v1`, livraison fiche par fiche, STOP entre chaque, DEVLOG.

**Gate parallèle (Amine, pas toi)** : smoke minimal prod (1 compte) puis, après F1, la QA
complète Q1–Q10 sur prod. Ne bloque pas F1/C0, bloque la fin du lot.

---

## PARTIE 1 — Finitions prod

### F1 — SMTP Resend + OTP 6 chiffres 🟢→🟡 (EN PREMIER : débloque l'onboarding ET la coquille)
- ⚠️ **Le nom de marque n'est pas décidé** (« Manzil » = nom de travail) → **pas de domaine
  produit**. Domaine d'expédition Resend : utiliser un **domaine existant d'Amine** (SAS /
  apps précédentes, sous-domaine transactionnel type `mail.<domaine>.com`) — à lui de le
  fournir au read-back ; à défaut, petit domaine neutre dédié à l'envoi. L'adresse d'envoi
  est un détail remplaçable après naming (changer de domaine Resend = re-vérification, sans
  impact code).
- **Staging d'abord** : brancher le SMTP custom Supabase, passer le template au **code
  6 chiffres** (`{{ .Token }}`), écran de saisie déjà prêt côté client — vérifier le parcours
  complet, les spams, le rate-limit levé. Puis **prod** (mêmes étapes).
- Pourquoi prérequis coquille : **l'OTP saisi supprime tout besoin de redirect/deep-link
  d'auth dans la WebView** — le magic link en app native est fragile ; on ne le portera pas.
- Inclut (A4) : **Resend ajouté à RGPD.md** (sous-traitant + DPA) ; **rétention Sentry → 30 j**.
- *Fini :* login par code sur staging ET prod, e-mail reçu < 30 s, plus de rate-limit bloquant.

### F2 — Compte de smoke prod par mot de passe 🟢 (suite de la leçon E1)
- Un compte dédié `smoke@…` en **auth par mot de passe** (Supabase la permet en parallèle de
  l'OTP ; activer le provider, ce compte uniquement — pas d'UI publique), confiné à son
  propre foyer. Script `npm run smoke:prod` : login → push 1 doc → pull → publier un espace
  jetable → lecture anonyme du lien → suppression de l'espace + du doc. **Jamais de
  `service_role` côté client/CI.** Optionnel : job CI post-déploiement.
- *Fini :* le trou §3-2 du rapport de déploiement est fermé durablement.

### F3 — Révocation d'invitation (UI owner) 🟢 (tête du backlog P2, code WhatsApp qui traîne)
- Liste des invitations en cours dans la feuille Foyer (code masqué, expire dans…, bouton
  Révoquer = delete RLS owner). *Fini :* un code révoqué renvoie « invitation révoquée ».

### F4 — Hygiène (à date, sans code) : drop `*_bak_20260705` après quelques jours de Sentry
calme + Q1–Q10 passés. Entrée DEVLOG.

---

## PARTIE 2 — Coquille Capacitor

### Invariants de la partie 2
- **Le web reste le produit** : la cible Pages `/Heath/` continue de fonctionner à
  l'identique (les deux cibles cohabitent dans le même repo, deux configs de build).
- **Les pages reçues `#e=` restent du web pur** (le personnel n'installe rien) — la coquille
  ne les concerne pas, mais les liens ouverts DEPUIS l'app doivent sortir proprement (voir C2).
- **Aucune dépendance de la coquille au domaine** `manzil.ma` (assets embarqués) : la
  migration Cloudflare+domaine reste un sous-lot **conditionné à l'achat** (C4, optionnel ici).
- Coquille **minimale** : pas d'OTA, pas de push, pas de RevenueCat dans ce lot.

### C0 — Double cible de build 🟡 (le piège n°1 : le base path)
- Le build Pages vit sous `/Heath/` ; **Capacitor sert ses assets localement** → le build
  natif doit être en base **`./`** (relative). Introduire un mode de build `native` (env
  Vite) : base relative, **service worker DÉSACTIVÉ** (inutile et nuisible en natif — les
  assets sont locaux ; le SW est l'affaire du web), Sentry `environment: 'native'`.
- Vérifier que `origin+pathname` (P0-3) et tous les chemins d'assets tiennent en base relative.
- *Fini :* `npm run build:native` produit un `dist` autonome qui s'ouvre en `file`-like sans
  404 ; le build web est inchangé (diff de `dist` web avant/après = néant).

### C1 — Android : APK debug installable 🟡 (l'objectif d'Amine)
- `@capacitor/core|cli|android`, `appId` = **décision Q-c1 au read-back** (irréversible en
  pratique après store — proposer `ma.manzil.app` vs `com.manzil.app`), `webDir` = dist natif.
- Build APK **debug** (keystore debug auto) + **doc « builder en 3 commandes »** + idéalement
  **job CI manuel** qui attache l'APK en artifact (distribution multi-appareils sans poste
  dev). `versionCode`/`versionName` gérés dès maintenant.
- *Fini :* APK installé sur ≥ 2 appareils Android réels, app complète fonctionnelle
  (navigation, sync, publication) — c'est le livrable que veut Amine.

### C2 — Adaptations natives minimales 🟡 (la liste des pièges, à traiter UN PAR UN)
1. **Export JSON** : `a[download]` ne marche pas en WebView Android → basculer sur
   `@capacitor/filesystem` + `@capacitor/share` en natif (le web garde `a[download]`).
   ⚠️ C'est notre **filet de sécurité** (adoption, rejoindre) — critère de fini à part entière.
2. **Micro / notes vocales** : permission `RECORD_AUDIO` (manifest + runtime) pour
   `getUserMedia` dans la WebView — la voix est un invariant produit, ça doit marcher.
3. **Liens sortants** : `wa.me` doit ouvrir **WhatsApp** (intent), les liens `#e=` le
   navigateur — configurer `allowNavigation`/ouverture externe proprement.
4. **Bouton retour Android** : sheet ouverte → la fermer ; page de rôle → Maison ; Maison →
   minimiser (jamais quitter sèchement).
5. **Safe-areas & status bar** : plugin StatusBar (fond `#F6F5F1`, icônes sombres), vérifier
   `viewport-fit` et les paddings existants sur encoches.
6. **Clavier** : les sheets de saisie (OTP, recette) ne doivent pas être masquées
   (resize/scroll-into-view).
7. **Icône + splash placeholder** (fond crème, « M » — les vrais assets viendront avec la
   direction d'identité).
- *Fini :* checklist 1–7 démontrée sur appareil, captures à l'appui.

### C3 — iOS : coquille + TestFlight interne 🟡 (après C1/C2 validés par Amine)
- `cap add ios`, mêmes adaptations (safe-areas iOS, clavier, permission micro
  `NSMicrophoneUsageDescription`), le **spike signature déjà réalisé** sert ici ; build vers
  **TestFlight interne** sur le compte d'Amine.
- *Fini :* app installée via TestFlight sur l'iPhone d'Amine, checklist C2 rejouée.

### C4 (optionnel, conditionné) — Hébergement Cloudflare + domaine
- **Conditionné à la décision de NAMING** (le nom de marque n'est pas arrêté — « Manzil » =
  nom de travail ; l'achat du domaine est la première conséquence du naming, pas un préalable
  technique). D'ici là : la coquille embarque ses assets (aucune dépendance), et une
  migration Cloudflare sur `*.pages.dev` reste possible si utile (previews par branche).
  Quand le nom tombe : domaine, redirects, Site URL/redirects Supabase, `#e=` legacy
  redirigés, domaine d'envoi Resend basculé.

### Questions au read-back (partie 2)
- **Q-c1** : `appId` — ⚠️ **le nom de marque n'est pas décidé**. Best practice : l'appId
  porte le **domaine inversé de l'entité** (la SAS d'Amine), jamais le nom du produit
  (les produits se renomment). Propose un appId **provisoire neutre** sur cette base pour
  toute la phase APK debug ; **gel définitif = au premier upload store, pas avant** — c'est
  la vraie deadline de la décision de naming, à inscrire au DEVLOG.
- **Q-c2** : stratégie de détection natif/web dans le code (`Capacitor.isNativePlatform()`
  centralisé où ?).
- **Q-c3** : la session Supabase persiste-t-elle correctement dans la WebView (storage) —
  vérifier, sinon adapter le storage adapter.
- **Q-c4** : audio (enregistrement + lecture blob) en WebView Android : points de friction
  connus ? Chiffre un spike si doute.
- **Q-c5** : ce que tu couperais/reporterais — liste explicite.

### Ordre global du lot
**F1 → C0 → C1 → C2 → (QA Amine sur APK) → C3 → F2 → F3 → F4** · C4 si domaine acheté.
(F2/F3 peuvent s'intercaler pendant les validations d'Amine.)

---

## Message de lancement (à coller tel quel dans Claude Code)

> Lis `BRIEF_FINITIONS_COQUILLE_CLAUDE_CODE.md` + `DECISIONS_STORE_V1.md` (D1/D6). Branche
> `coquille-v1`. Objectif prioritaire d'Amine : **des APK Android debug installables sur
> plusieurs appareils, vite** — coquille minimale (pas d'OTA/push/paywall), le web reste le
> produit et ne doit pas bouger d'un pixel. Ordre : **F1 (SMTP staging→prod, OTP 6 chiffres,
> Resend au RGPD, Sentry 30 j)** puis **C0 (double build, base relative, SW off en natif)**
> → **C1 (APK debug + doc + artifact CI)** → **C2 (les 7 pièges natifs, dont export JSON =
> filet de sécurité et micro = invariant voix)** → STOP QA Amine → C3 iOS/TestFlight → F2
> (smoke prod par mot de passe, jamais de service_role) → F3 (révocation d'invitation) → F4.
> Avant tout code : read-back + chiffrage 🟢🟡🔴 par fiche + réponses Q-c1→Q-c5 + ce que tu
> couperais. Portes qualité à chaque fiche (typecheck · tests · build web ET natif · captures
> appareil), DEVLOG, STOP entre les fiches.
