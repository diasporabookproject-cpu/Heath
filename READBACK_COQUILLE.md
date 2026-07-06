# Read-back & chiffrage — Lot « Finitions prod + Coquille Capacitor »

> **Réponse de l'implémenteur** au `BRIEF_FINITIONS_COQUILLE.md` (v1) avant tout code.
> Ancré dans la codebase réelle (audit 4 axes : build/base path, pièges WebView, auth/session,
> CI/smoke — références fichier:ligne vérifiées). Branche `coquille-v1` (créée depuis la prod).
> 2026-07-06.

## 0. Alignement & points d'attention

- **Je valide le brief** — le découpage F1→C4 et l'ordre (F1 → C0 → C1 → C2 → QA → C3 → F2/F3/F4)
  sont les bons. D6 amendée intégrée : **rien d'irréversible avant le naming** (appId provisoire,
  pas de domaine, gel = premier upload store).
- ⚠️ **Correction d'un présupposé du brief (C3)** : « le spike signature déjà réalisé » — **non** :
  le mini-spike iOS avait été accepté mais **jamais exécuté** (la priorité est restée sur Comptes+Sync).
  C3 l'absorbe (compte Apple d'Amine requis à ce moment-là). Aucune conséquence sur F1→C2.
- 🔴 **8ᵉ piège découvert à l'audit (absent du brief)** : `buildEspaceUrl` (`src/lib/espace.ts:46`)
  construit les liens publiés depuis `window.location.origin+pathname`. **En natif, publier une
  page produirait `https://localhost/#e=…` → lien MORT pour le personnel.** C'est l'action cœur
  du produit → intégré à C0 (constante `VITE_WEB_BASE_URL` injectée au build natif) + vérifié à C2.
- 🧹 Hygiène au passage : les en-têtes des migrations disent encore « NON APPLIQUÉ » alors que
  0001→0004 sont appliquées en staging **et** prod → je corrige les en-têtes au premier commit.

## 1. Chiffrage global

| Fiche | Contenu | Chiffrage | Jours |
|---|---|---|---|
| **F1** | SMTP Resend + OTP 6 chiffres (staging→prod) | 🟢 *(côté code : rien — tout est config)* | 0,5 (dont attente DNS) |
| **F2** | Compte smoke prod par mot de passe + `smoke:prod` | 🟢 | 0,5 |
| **F3** | Révocation d'invitation (UI owner) | 🟢 *(zéro migration : RLS `invitations_rw` couvre déjà SELECT+DELETE)* | 0,5 |
| **F4** | Hygiène (drop `*_bak`) | — (à date) | 0 |
| **C0** | Double cible de build (base `./`, SW off, Sentry env, **liens publiés**) | 🟡 | 0,5–1 |
| **C1** | APK debug + doc 3 commandes + job CI artifact | 🟡 | 1 |
| **C2** | Les 7 pièges natifs (+ le 8ᵉ) sur appareil | 🟡→🔴 *(la vérif est sur TES appareils)* | 1,5–2 |
| **C3** | iOS + TestFlight (spike signature inclus) | 🟡 | 1–1,5 + compte Apple |
| **C4** | Cloudflare + domaine | conditionné naming | — |

**Total F1→C2 (le livrable APK voulu) : ≈ 3,5–4,5 j.**

## 2. Read-back par fiche (ancrages codebase)

### F1 — SMTP Resend 🟢
- **Côté code : RIEN à écrire.** L'UI code 6 chiffres est **complète et prête**
  (`AccountSheet.tsx:300-333` : input `one-time-code`, `normalizeOtp`, `verifyOtp` → `ensureFoyer`).
  `verifyOtp` (`auth.ts:28-33`) n'a besoin d'**aucune redirect** — c'est exactement pourquoi F1
  supprime le besoin de deep-link d'auth en natif (le brief a raison).
- **Côté config (je pilote via l'API Management une fois les créds en main)** : brancher le SMTP
  custom (host/port/user/pass Resend) + passer les templates *Magic Link* et *Confirm signup* au
  `{{ .Token }}` — **staging d'abord**, test complet (délai < 30 s, spams, rate-limit levé), puis prod.
- **Actions Amine** : ① compte Resend ; ② le **domaine d'envoi** (un domaine existant de ta SAS —
  dis-moi lequel ; sous-domaine type `mail.<domaine>`) + poser 3 enregistrements DNS que Resend
  affichera ; ③ me passer la **clé SMTP Resend**. RGPD.md a déjà Resend (fait en A4).

### F2 — Smoke prod par mot de passe 🟢
- Le smoke actuel (`scripts/smoke.mjs`) est **100 % anonyme** (Playwright UI, ignore supabase.co) —
  le smoke prod est une **brique neuve** : script **Node + supabase-js** (déjà en dépendance), sans
  navigateur : `signInWithPassword` → `ensureFoyer` (RPC) → upsert 1 doc `docs` → pull → publier un
  espace jetable → **lecture anonyme via un 2ᵉ client SANS session** (sinon on ne prouve rien) →
  cleanup (delete espace + doc). Jamais de `service_role` (créds = env CI/locales).
- **Action Amine (1 min)** : créer l'utilisateur `smoke@…` avec mot de passe (Dashboard → Auth →
  Add user) — je n'ai pas d'API pour le faire sans service_role.

### F3 — Révocation d'invitation 🟢
- **Vérifié** : la policy `invitations_rw` (`0001…sql:136`) est un `for all` membre → **SELECT et
  DELETE marchent déjà côté client, zéro migration, zéro edge function**.
- À écrire : `listInvites()`/`revokeInvite(id)` dans `auth.ts` + liste dans la section « Foyer
  partagé » (`AccountSheet.tsx:170-182`) : code **masqué** (…4 derniers), « expire dans X h »,
  bouton Révoquer. Un code révoqué → `accept-invite` renvoie déjà « Code inconnu » (404).

### C0 — Double cible de build 🟡
- **Un seul fichier pilote la bascule** : `vite.config.ts`. `isNative = process.env.BUILD_TARGET==='native'`
  → `base: './'` (l.8/11) + **`VitePWA({ disable: isNative })`** (l.23 — l'audit confirme : AUCUN
  `registerSW` manuel dans src/, le plugin injecte tout ; `disable` coupe SW **et** manifest proprement).
- **Aucun asset absolu dans src/** (audit grep exhaustif) ; le manifest est déjà tout-relatif
  (`start_url:'.'`, icônes relatives) → la base `./` passe sans autre modif.
- **Sentry** : ajouter `environment: 'native'|'web'` (`sentry.ts:12-19`, champ absent aujourd'hui).
- 🔴 **Liens publiés & espace** (le 8ᵉ piège) : `buildEspaceUrl` (`espace.ts:46`) et les
  `emailRedirectTo` (`auth.ts:21`, `supabase.ts:33`) basculent sur une constante
  `WEB_BASE_URL` (env `VITE_WEB_BASE_URL`, = URL Pages en natif, `origin+pathname` sinon).
- Scripts : `build:native` dans package.json. **Critère de fini renforcé** : diff du `dist` web
  avant/après = **néant** (je le prouve), et `dist` natif s'ouvre sans 404 en base relative.
- Note : polices Google = remote (`index.html:11-16`) → en natif offline, repli système. Acceptable
  pour l'APK de test ; bundler les woff2 = backlog (cf. cut-list).

### C1 — APK debug 🟡
- Greenfield total (aucune dep Capacitor). `@capacitor/core|cli|android`, `npx cap add android`,
  **dossier `android/` committé** (requis pour le job CI), `webDir` = dist natif.
- **Job CI `apk.yml`** : `workflow_dispatch` manuel — checkout → temurin **17** → node 20 → `npm ci`
  → `build:native` (clés publiques en env, comme deploy.yml) → `cap sync android` →
  `gradlew assembleDebug` → **upload-artifact `app-debug.apk`**. Les runners GitHub ont le SDK
  Android préinstallé + keystore debug auto → **aucun secret nécessaire**. C'est ta distribution
  multi-appareils : tu télécharges l'APK depuis l'onglet Actions.
- `versionCode`/`versionName` : manuels dans `build.gradle` (démarre 1 / « 0.1 ») — stratégie simple,
  bump à chaque APK distribué.
- Doc « builder en 3 commandes » : `BUILD_NATIF.md`.

### C2 — Les 7 (+1) pièges natifs 🟡→🔴 (l'audit a localisé chaque site)
1. **Export JSON** : `downloadExport()` (`exportData.ts:67-78`) = LE point unique (3 appelants :
   rituel d'adoption `App.tsx:188`, avant `acceptInvite` `AccountSheet.tsx:71`, bouton export
   `:156`) → helper partagé `saveOrShareFile` : web = `a[download]` inchangé ; natif =
   `@capacitor/filesystem` (Cache) + `@capacitor/share`. **Filet de sécurité → critère de fini à part.**
   Même traitement pour le fallback partage vocal (`VoiceNote.tsx:149-153`).
2. **Micro** : `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` (manifest) — Capacitor gère le grant
   `getUserMedia` WebView si la permission runtime est accordée. La WebView Android supporte
   `audio/webm;codecs=opus` (notre 1ᵉʳ candidat `pickMime`). Vérif sur appareil.
3. **Liens sortants** : 2 sites `window.open(wa.me…,'_blank')` (`PartageSheet.tsx:138`,
   `PartageNounouSheet.tsx:150`) + 3 `tel:` (`NounouEspaceView.tsx:347,368`, `SecuriteSection.tsx:61`)
   → helper `openExternal(url)` (natif : AppLauncher/Browser ; web : window.open inchangé).
4. **Bouton retour Android** : rien n'existe (navigation par état, `App.tsx:29` ; seul `hashchange`
   écouté). Plan : listener `@capacitor/app` `backButton` + **pile de sheets** — la primitive
   `Sheet` (`primitives.tsx:150`) **s'auto-enregistre** (couvre Account/newPage/adopt/toutes les mz) ;
   les 3 grosses `.cz-sheet` cuisine (composer, fiche recette, partage) reçoivent un petit hook
   `useBackClose`. Ordre : sheet ouverte → fermer ; page de rôle → Maison ; Maison → minimiser.
5. **Safe-areas/status bar** : `viewport-fit=cover` déjà là (`index.html:6`), `--safe-bottom`
   partout, **mais AUCUN `safe-area-inset-top` dans tout src/** → les en-têtes sticky passeraient
   sous la status bar. Plugin StatusBar (fond `#F6F5F1`, icônes sombres) + padding-top sur
   `.topbar`/héros.
6. **Clavier** : sheets ancrées `bottom:0` (`.mz-sheet`, `.cz-sheet`) sans gestion clavier →
   `windowSoftInputMode=adjustResize` d'abord (souvent suffisant) ; plugin Keyboard seulement si
   insuffisant sur appareil.
7. **Icône + splash placeholder** : fond crème `#F6F5F1` + « M » (générés via `@capacitor/assets`).
8. **Liens publiés** (nouveau, cf. C0) : vérifier **sur appareil** que publier depuis l'APK produit
   un lien `https://…github.io/Heath/#e=…` qui s'ouvre chez un tiers.
- *Fini :* checklist 1–8 démontrée sur **tes** appareils (moi je livre l'APK CI + auto-vérifs).

### C3 — iOS 🟡 (après ta validation C1/C2)
- `cap add ios`, `NSMicrophoneUsageDescription`, safe-areas iOS, **spike signature inclus** (jamais
  fait, cf. §0). Requiert ton compte Apple Developer. Point de vigilance iOS : `MediaRecorder`
  produit `audio/mp4` (notre `pickMime` le gère déjà) ; localStorage WKWebView évictable →
  j'évaluerai l'adaptateur `@capacitor/preferences` pour la session **à C3, si constaté**.

## 3. Réponses Q-c1 → Q-c5

- **Q-c1 (appId)** : d'accord avec la règle « domaine inversé de l'ENTITÉ, jamais le produit ».
  **Il me faut le domaine de ta SAS** (celui que tu donneras pour Resend peut servir). Proposition
  provisoire neutre en attendant : **`com.dbp.foyer`** (initiales Diaspora Book Project, produit
  neutre « foyer »). ⚠️ Changer d'appId ensuite = les testeurs réinstallent une « autre app »
  (perte des données locales de test) — acceptable en phase debug, **gel au premier upload store**
  (deadline naming, inscrite au DEVLOG).
- **Q-c2 (détection natif)** : module unique **`src/lib/platform.ts`** exportant `isNative()`
  (wrap `Capacitor.isNativePlatform()`, import dynamique-safe) + `WEB_BASE_URL`. **Personne
  d'autre n'importe Capacitor directement** — tout le code passe par ce module (grep-able, testable).
- **Q-c3 (session WebView)** : le client n'a **pas** de storage explicite (`supabase.ts:17-24`)
  → défaut `localStorage`, **persistant dans la WebView Android** (fiable). `verifyOtp` pose la
  session sans redirect → aucun deep-link nécessaire (F1 d'abord = la bonne séquence).
  `detectSessionInUrl:true` reste inoffensif en natif. iOS : cf. C3.
- **Q-c4 (audio WebView Android)** : pas de spike séparé nécessaire — la chaîne est déjà robuste
  (candidats mime multiples `VoiceNote.tsx:38-45`, fix-webm-duration, repli `audio/mp4`), la
  WebView moderne supporte webm/opus, et l'échec est déjà UX-géré (`t.denied`). Le risque réel est
  la **permission** (piège n°2) → vérif appareil à C2. iOS = le vrai point dur, traité à C3.
- **Q-c5 (ce que je couperais)** — liste explicite :
  1. **Polices Google en natif** : repli système en v1 (bundler les woff2 = backlog).
  2. **Plugin Keyboard** : seulement si `adjustResize` ne suffit pas (constaté sur appareil).
  3. **Adaptateur storage Preferences** : différé à C3, seulement si éviction constatée sur iOS.
  4. **Back-button pour les petites sheets cuisine secondaires** : v1 couvre la primitive `Sheet`
     (toutes les mz-) + les 3 grosses cz- ; les mini-sheets restantes = backlog.
  5. **`smoke:prod` en job CI post-déploiement** : le script d'abord (usage manuel) ; le job CI
     après (optionnel).
  6. Déjà hors lot (brief) : OTA, push, RevenueCat, C4.

## 4. Ce qu'il me faut de toi pour lancer

| Quand | Quoi |
|---|---|
| **F1 (maintenant)** | Compte **Resend** + **domaine d'envoi** (lequel ?) + DNS (3 enregistrements) + **clé SMTP** |
| **F2** | Créer l'utilisateur **`smoke@…`** (email+mdp) dans le Dashboard prod |
| **Q-c1** | Le **domaine de ta SAS** (ou GO sur le provisoire `com.dbp.foyer`) |
| **C2** | Tes **appareils Android** pour la checklist (j'attache l'APK en artifact CI) |
| **C3 (plus tard)** | Compte **Apple Developer** |

## 5. Ordre d'exécution proposé (= brief)

**F1** (config, peut attendre tes DNS en tâche de fond) **→ C0 → C1 → C2** *(l'APK que tu veux)*
→ **STOP QA Amine sur APK** → C3 → F2 → F3 → F4. *(F2/F3 s'intercalent pendant tes validations.)*

⚠️ Si tu veux **l'APK au plus vite** : je peux démarrer **C0 immédiatement** (pur code, aucune
dépendance à toi) pendant que tu prépares Resend — F1 n'est bloquant que pour l'expérience
« code 6 chiffres » dans l'app, pas pour builder la coquille (le login par lien ne marchera
simplement pas en natif d'ici F1, c'est documenté et attendu).
