# Builder l'app native (coquille Capacitor)

## L'APK sans poste de dev (recommandé)
Chaque **push sur `coquille-v1`** (ou lancement manuel du workflow **« APK Android (debug) »**)
construit l'APK en CI : GitHub → **Actions** → le run → **Artifacts** → télécharger
**`app-debug`** → installer l'`app-debug.apk` sur l'appareil (autoriser « sources inconnues »).

## En local — 3 commandes
```bash
npm run build:native        # dist en base './', service worker désactivé
npx cap sync android        # copie le dist dans la coquille + plugins
(cd android && ./gradlew assembleDebug)   # → android/app/build/outputs/apk/debug/app-debug.apk
```
Prérequis locaux : JDK 21 (Capacitor 8) + Android SDK (ou Android Studio). Le keystore **debug** est
auto-généré — aucun secret.

Variables utiles au build natif (défauts corrects sinon) :
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — cible backend (prod par défaut en CI).
- `VITE_WEB_BASE_URL` — URL **web** publique utilisée par les liens publiés `#e=` et les
  redirects e-mail (défaut : l'URL GitHub Pages — cf. `src/lib/platform.ts`).

## Versions
`android/app/build.gradle` : `versionCode` (entier, **bump à chaque APK distribué**) ·
`versionName` (« 0.1 » en phase debug).

## Identité
`appId = studio.elysia.foyer` (domaine inversé de l'entité — **jamais le nom produit**).
**Gel définitif au premier upload store** (deadline de la décision de naming).
⚠️ Changer l'appId ensuite = « autre app » pour les testeurs (réinstallation, perte des
données locales de test).

## Deux cibles, un repo
- **Web (produit)** : `npm run build` — base `/Heath/` (Pages), service worker actif. Inchangé.
- **Natif** : `npm run build:native` — base `'./'`, **pas** de SW ni de manifest ; la détection
  runtime passe par `src/lib/platform.ts` (`isNative`, `webBaseUrl()`), personne n'importe
  Capacitor directement.
