# Revue globale — base « Comptes+Sync » + « Coquille » (2026-07-07)

Revue à froid des deux lots livrés depuis la refonte, pour repartir sur une base saine.
Méthode : 9 dimensions passées en revue par agents (cœur sync, intégration sync, parcours
comptes, sécurité backend, coquille native, couche IndexedDB, tests, intégration app, docs),
**puis re-vérification manuelle par lecture directe du code** des constats P0/P1 (la passe de
vérification adversariale automatique a été coupée par la limite de session — les constats
bruts ne sont donc PAS pris pour argent comptant, seuls ceux confirmés à la main figurent ici).

## Portes qualité — toutes vertes ✅
- `typecheck` (tsc -b) : 0 erreur · `vitest` : **101/101** · build **web** (SW + precache OK) ·
  build **natif** (base './', SW off) · **smoke Playwright** : parcours Cuisine complet, 0 erreur console.
- Architecture local-first saine : cœur de sync **pur et testé** (`plan.ts`), IO isolée
  (`engine.ts`/`map.ts`), gardes G1/G2/G3 en place, RLS par foyer via helpers security-definer.

## Bilan de sévérité
**Aucun P0 ne casse la prod web actuelle.** Les risques se concentrent en P1 sur quatre axes :
(a) sécurité/coût backend, (b) robustesse sync sur cas multi-appareils, (c) coquille native
incomplète, (d) dérive documentaire. Détail ci-dessous, chaque point **vérifié dans le code**.

---

## P1 — à traiter avant de bâtir dessus

### Sécurité / coût backend
1. **RPC quota appelables en direct** — `reserve_ai_usage` / `refund_ai_usage`
   (`0004_ai_usage_rpc.sql`) sont `security definer` sans `revoke execute ... from public/anon`.
   Un client peut appeler `refund_ai_usage(mon_foyer, mois)` en boucle pour remettre son
   compteur à 0, ou `reserve_ai_usage(f, m, 999999)` → **plafond IA contournable**. *Coût, pas
   perte de données.* Fix : `revoke execute` sur `anon`+`authenticated` (seule l'edge function
   service_role les appelle).
2. **Relais LLM sans quota dans `generate-recipe`** — les modes `estimate` (l.200) et `translate`
   (l.219) appellent `callTool` **sans `reserveQuota`**, contrairement à `import`/génération.
   `generate-translation` n'a **aucun** contrôle JWT ni quota en code. ⚠️ *À confirmer selon le
   réglage plateforme « Verify JWT » de la fonction déployée* : si la vérification JWT est
   imposée à la passerelle, l'appel est bloqué sans session (défense en profondeur manquante) ;
   sinon, c'est un relais Anthropic ouvert (abus de coût avec la clé anon publique). Fix : gate
   quota sur estimate/translate + vérifier/forcer Verify-JWT sur les deux fonctions.

### Robustesse sync (cas multi-appareils)
3. **Hash non canonique → ping-pong des réglages** — `hashPayload` (`plan.ts:53`) fait
   `JSON.stringify` **sensible à l'ordre des clés**. `loadSettings`/`loadApp` reconstruisent
   l'objet par spread (`{...DEFAULT_SETTINGS, ...s}`), alors que Postgres `jsonb` réordonne les
   clés au stockage. Après chaque **pull**, le doc `settings`/`app` peut ressortir « dirty » à
   tort → re-push → l'autre appareil re-pull → re-push… **churn permanent** entre 2 appareils
   (batterie/bande passante + fenêtre LWW inutile). Fix : hash canonique (clés triées) — peu coûteux.
4. **`accept-invite` non transactionnel** — l'ancien foyer est supprimé (l.74) **avant** que
   l'adhésion au nouveau soit acquise (insert l.79). Si l'insert échoue, l'utilisateur perd la
   sauvegarde cloud de son ancien foyer sans être dans le nouveau. *Local préservé + ré-adopté au
   reload ; perte = docs cloud-only.* Fix : insérer la nouvelle adhésion **avant** de supprimer
   l'ancien foyer, ou rendre l'opération atomique côté RPC.
5. **`leaveFoyer` (owner seul) sans filet** — supprime le foyer + docs cloud (cascade) **sans**
   pull/export préalable, contrairement à `confirmedJoin` qui, lui, fait pull→export→accept
   (le fix A1). Asymétrie réelle (`auth.ts:109-118`). *Impact limité : la copie locale reste et
   se re-téléverse ; perte = docs cloud-only d'un 2ᵉ appareil.* Fix : même filet pull+export.
6. **`deleteAccount` d'un owner ne compte pas les autres membres** — l'edge `delete-account`
   supprime le foyer inconditionnellement pour un owner (l.47-50), alors que `leaveFoyer` et
   `accept-invite` refusent si `count>1`. Un owner qui supprime son compte **efface le foyer
   partagé pour tous**. À trancher : comportement voulu ou garde à ajouter ?

### Coquille native (APK livré)
7. **`RECORD_AUDIO` absent du manifest** — `AndroidManifest.xml` ne déclare que `INTERNET`.
   `getUserMedia({audio})` (VoiceNote / ConsigneVocale) est **toujours refusé dans l'APK** →
   enregistrement vocal mort en natif. *Web non affecté.* Déjà prévu en **C2**, mais bloque tout
   test audio sur l'APK actuel. Fix : `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` + demande runtime.
8. **Build natif LOCAL casse Supabase** — `vite.config.ts` (l.20) lit `process.env.VITE_SUPABASE_URL`
   dans le bloc `define`. En build local (`npm run build:native` documenté dans BUILD_NATIF.md),
   les clés vivent dans `.env.local` que Vite met dans `import.meta.env` **mais pas** dans
   `process.env` → compilé à `''` → **comptes/sync morts dans l'APK**. La CI est OK (elle passe
   les vars en env shell), et l'APK que je t'ai livré est correct car j'ai passé les clés
   explicitement. Fix : que la doc impose l'export shell, ou lire aussi `loadEnv` dans define.

### Robustesse app
9. **Erreurs de sync avalées** — le push débouncé (`useSync.ts:124`) ignore `{error}`, `fullSync`
   ignore `r.error`. Un doc « poison » qui fait échouer le batch upsert fige tout le push **en
   silence**, sans trace ni Sentry. Fix : remonter les erreurs de sync à Sentry (best-effort mais
   observable).
10. **Cache négatif audio empoisonné par le hors-ligne** — `restoreAudio` (`audio.ts`) ajoute au
    Set `missing` sur **tout** échec de download, y compris réseau/hors-ligne → une note vocale
    réellement présente au cloud est marquée « absente » pour toute la session. Fix : ne cacher
    `missing` que sur un vrai 404, pas sur erreur réseau.

---

## P2 — dette à planifier (ne bloque pas)
- **Révocation d'espace silencieuse** (`espace.ts`) : `revokeEspace` ignore l'erreur du delete ;
  l'UI affirme le succès et jette le token local → le lien peut rester vivant. Vérifier l'erreur.
- **Adoption échouée après consentement** (`useSync.ts`) : `asked.current` jamais réinitialisé →
  si `adoptInto` échoue après le « Fusionner », pas de nouvelle invite de la session. Retry/reset.
- **`downloadExport` no-op en WebView** (`exportData.ts`) : le `<a download>` ne produit pas de
  fichier en natif → le filet A1 est absent sur l'APK (lié à C2 : passer par Filesystem/Share).
- **`confirmedJoin` sans `try/finally`** (`AccountSheet.tsx`) : une exception laisse `busy=true`
  bloqué. Envelopper.
- **Compteur IA local utilisé comme barrière** (`AddRecipeSheet.tsx`) : blocage possible à tort
  après changement de foyer (le vrai quota est serveur). Utiliser le compteur comme affichage seul.
- **Faux « Envoyé ✓ » WhatsApp/clipboard** (`PartageSheet.tsx`) : `window.open(wa.me)` après un
  await peut être bloqué (anti-popup) mais le toast affirme l'envoi.

## Couverture de tests — angles nus
Seul le cœur pur `plan.ts` est testé. **Sans test** : `engine`/`map`/`useSync` (orchestration,
adoption, curseur G2), `auth`, `clearSyncState`, le flux A1 `confirmedJoin`, les edge functions.
Le smoke Playwright ne couvre que l'ancien produit Cuisine (zéro parcours comptes/sync) et n'est
**pas** lancé en CI. Priorité : tests d'invariants sur adoption/LWW/G2 + un smoke comptes.

## Dérive documentaire (induit en erreur la prochaine session)
- **DEVLOG « État actuel » se contredit** : dit à la fois « Comptes+Sync mergé en prod » (l.92) et
  « Rien n'est mergé en prod » (l.112/120) ; ne mentionne pas le lot Coquille. À dédupliquer.
- **ADR manquantes** : double build (`BUILD_TARGET`/VitePWA disable/platform.ts), appId
  `studio.elysia.foyer` + gel au 1ᵉʳ upload, CI JDK21/Node22, « pas de SDK Android local ».
- **`RGPD.md`** liste Cloudflare Pages comme hébergeur ; la prod est **GitHub Pages** (absent de
  la liste des sous-traitants). Resend/Sentry à réaligner sur l'état réel.
- **Docs racine obsolètes** : `PASSATION_REFONTE_BENTO.md` (« Non fusionnée » alors que mergée),
  `README.md` (« Déploiement Vercel »), `ETAT_CODEBASE.md`, `PLAN_ACTION.md` (QW1). À archiver/dater.

---

## Plan proposé (à valider avant code — méthode read-back)
1. **Lot « Assainissement » P1 backend+sync** (petit, ciblé) : revoke RPC quota · gate/JWT
   estimate+translate · hash canonique · ordre insert/delete de `accept-invite` · filet
   `leaveFoyer` · garde `deleteAccount` owner. → migration SQL + edge functions + `plan.ts`.
2. **Repli dans C2** (déjà prévu) : `RECORD_AUDIO`, export natif via Filesystem/Share, define
   `.env.local`. On les traite dans C2 plutôt que maintenant.
3. **Tests d'invariants** : adoption/LWW/G2 + smoke comptes, branché en CI.
4. **Passe doc** : dédupliquer « État actuel », ajouter les 4 ADR, corriger RGPD, dater les
   passations obsolètes.

> Dis-moi lesquels tu veux que je prenne, dans quel ordre. Rien n'est corrigé pour l'instant —
> ceci est la restitution.
