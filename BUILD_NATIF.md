# Builder l'app native (coquille Capacitor — v2)

> Réécrit pour **`coquille-v2`** (2026-07-11) : `dist-native/` séparé, `.env.local` désormais
> lu par le build (fix du « finding 8 » de la revue du 07/07). L'ancien BUILD_NATIF (v1) est
> archivé sur la branche `coquille-v1`.

## L'APK sans poste de dev (recommandé)
Chaque **push sur la branche du lot natif** (ou lancement manuel du workflow **« APK Android
(debug) »**, `workflow_dispatch`) construit l'APK en CI : GitHub → **Actions** → le run →
**Artifacts** → télécharger **`app-debug`** → installer l'`app-debug.apk` sur l'appareil
(autoriser « sources inconnues »).

## En local — 3 commandes
```bash
npm run build:native        # → dist-native/ (base './', service worker désactivé)
npx cap sync android        # copie dist-native/ dans la coquille + enregistre les plugins
(cd android && ./gradlew assembleDebug)   # → android/app/build/outputs/apk/debug/app-debug.apk
```
Prérequis locaux : JDK 21 (Capacitor 8) + Android SDK (ou Android Studio). Node ≥ 22
(exigé par la CLI Capacitor 8). Le keystore **debug** est auto-généré — aucun secret.

### Variables du build natif — `.env.local` FONCTIONNE désormais
`vite.config.ts` lit les clés via **`loadEnv()`** : les fichiers `.env`/`.env.local` **et**
l'environnement shell sont fusionnés (le shell reste prioritaire — la CI ne change pas).
Un build natif local avec un simple `.env.local` n'embarque donc plus des clés vides
(l'ancien piège v1 « comptes/sync morts dans l'APK » est soldé).
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — cible backend (clés publiques).
- `VITE_WEB_BASE_URL` — URL **web** publique utilisée par les liens publiés `#e=` et les
  redirects e-mail (défaut : l'URL GitHub Pages — cf. `src/lib/platform.ts`).
- `VITE_SENTRY_DSN` — crash-reporting (optionnel ; `environment` = `native`/`web` auto).

## Versions
`android/app/build.gradle` : `versionCode` (entier, **bump à chaque APK distribué**) ·
`versionName` (« 0.1 » en phase debug).

## Identité
`appId = studio.elysia.foyer` (domaine inversé de l'entité — **jamais le nom produit**).
**Gel définitif au premier upload store** (deadline de la décision de naming).
⚠️ Changer l'appId ensuite = « autre app » pour les testeurs (réinstallation, perte des
données locales de test).

## Deux cibles, un repo — DEUX répertoires de sortie
- **Web (produit)** : `npm run build` — → `dist/`, base `/Heath/` (Pages), service worker
  actif. Inchangé.
- **Natif** : `npm run build:native` — → **`dist-native/`** (`capacitor.config.ts` :
  `webDir: 'dist-native'`), base `'./'`, **pas** de SW ni de manifest. Les deux builds
  **coexistent sans s'écraser** (dette v1 soldée).
- La détection passe par `src/lib/platform.ts` (`isNative`, compile-time) ; **personne
  n'importe Capacitor directement** — toutes les APIs natives (Filesystem/Share/App)
  passent par `platform.ts` en imports dynamiques. Le bundle **web** contient zéro octet
  Capacitor (vérifié : élimination à la compilation).

## Pièges natifs soldés (C2, coquille-v2)
- **Micro** : `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` au manifest ; permission demandée à
  la 1ʳᵉ capture (validé sur appareil).
- **Export** : `downloadExport` ouvre la feuille de partage système en natif (le
  `<a download>` est un no-op WebView).
- **Bouton retour** : pile globale de feuilles (`ui/primitives` : `useSheetBack`) —
  feuille → écran → minimise, jamais de kill.
- **Safe-areas** : inset top porté par les en-têtes (`.cz-head`, `.topbar`, `.mz`).
  ⚠️ Parqué (chantier UX) : le contenu passe derrière les touches de navigation en bas.
