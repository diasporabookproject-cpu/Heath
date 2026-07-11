# Read-back — Lot « Coquille v2 » (C0′ + C2 + Curation)

**Décision amont (2026-07-11, analyse mesurée validée par Amine)** : la coquille native est
**recréée à neuf** sur `coquille-v2` (depuis le défaut durci `0cc3538`, post-AS-2) plutôt que
de réaligner `coquille-v1` (branchée 24 commits en arrière). Le merge aurait été bon marché
(2 conflits mesurés à sec) — la raison du redo est ailleurs : hygiène documentaire (ne pas
déverser des instantanés datés partiellement faux sur le défaut), dette `dist`/`dist-native`
et finding 8 soldés d'entrée, historique linéaire propre.

**Obligations non négociables (décision Amine)** :
1. **Porter les 4 docs vivants** de `coquille-v1` + distiller les 2 instantanés datés en
   entrées DEVLOG **au passé** (répare la référence pendante `DEVLOG.md:235`).
2. **Re-domicilier TOUS les findings ouverts** de la revue du 07/07 — **classés**, pas en vrac :
   périmètre C2 traité dans C2 ; le reste en backlog **avec gravité** pour décision consciente.
3. **`coquille-v1` reste intacte** (référence + preuve CI de l'APK) jusqu'à la clôture de C2.
4. **Porte obligatoire** : diff de contrôle `coquille-v1` ↔ `coquille-v2` sur les fichiers
   hors-`android/` — résultat montré à Amine, **zéro delta sémantique** hors deltas voulus.

**Pas de token** : tout le lot est client/natif — zéro écriture Supabase, zéro fenêtre prod.
**STOP entre chaque volet.** Méthode : portes complètes à chaque fiche.

---

## Volet A — C0′ : coquille recréée proprement — 🟢

Reconstruction depuis le diff relu de `coquille-v1` (~120 lignes de décision + scaffold
régénérable). `@capacitor` 8.4.1 est **toujours la dernière version npm** (vérifié 2026-07-11)
→ régénération à l'identique, zéro dérive.

- **A1 — Dépendances + config Capacitor** : `@capacitor/{core,android}` + `@capacitor/cli`
  (dev), épinglés 8.4.1. `capacitor.config.ts` : `appId studio.elysia.foyer` (gel Q-c1
  inchangé), `appName Manzil`, **`webDir: 'dist-native'`** ← la dette est soldée ici.
- **A2 — Double cible de build, version corrigée** : `vite.config.ts` —
  `BUILD_TARGET=native` ⇒ base `'./'`, **`outDir: 'dist-native'`** (les deux builds
  coexistent, plus d'écrasement), PWA/SW désactivés.
  **Finding 8 soldé d'entrée** : le bloc `define` lit les clés via **`loadEnv()`**
  (fusionne `.env.local` ET l'env shell) au lieu de `process.env` seul → le build natif
  **local** n'embarque plus des clés vides. CI inchangée (l'env shell reste prioritaire).
- **A3 — Port des greffes** (diff v1 sous les yeux, oubli = casse de typecheck, pas silence) :
  `src/lib/platform.ts` (point unique natif/web + `webBaseUrl()`, 8ᵉ piège) ; `auth.ts`
  (`sendOtp` → `webBaseUrl()`) ; `espace.ts` (`buildEspaceUrl`) ; `supabase.ts`
  (`sendMagicLink` legacy) ; `sentry.ts` (`environment: native|web`) ; `vite-env.d.ts`
  (types `VITE_BUILD_TARGET`, `VITE_WEB_BASE_URL`, `VITE_SENTRY_DSN`).
- **A4 — Scaffold Android** : `npx cap add android` (stock pur — vérifié sur v1 : seul
  `strings.xml` porte Manzil, et il est généré depuis la config). **Pas** de permission
  micro ici — c'est le travail de C2 (B1), on ne mélange pas.
- **A5 — Workflow APK** : `apk.yml` porté (JDK 21, Node 22, **portes typecheck+tests avant
  artifact** — acquis de v1 conservé), déclencheur `push: coquille-v2` + `workflow_dispatch`.

**PORTE OBLIGATOIRE A6 — diff de contrôle v1 ↔ v2** (hors `android/`, hors `package-lock`) :
zéro delta sémantique attendu **sauf 3 deltas VOULUS** — ① `dist-native` (config+vite),
② `loadEnv` (finding 8), ③ nom de branche dans `apk.yml`. Tout autre écart = à justifier
ou corriger. Résultat montré tel quel à Amine au STOP.

**Portes A** : typecheck · Vitest · build **web** (`dist/` identique à avant — la prod web ne
bouge pas d'un octet) · `build:native` (`dist-native/` : base `./`, pas de `sw.js`) ·
smokes web · **CI APK verte sur `coquille-v2`** (artifact téléchargeable).

**Risques A** : dérive du scaffold régénéré (mitigé : diff informel `android/` v1↔v2 en plus
de la porte A6) ; régression CI par `loadEnv` (mitigé : `loadEnv` de Vite fusionne
`process.env`, la CI passe ses vars en env shell — comportement conservé).

---

## Volet B — C2 : les pièges natifs — 🟡 (dépend de tests sur appareil réel)

Constats préalables (relevés dans le code actuel) : capture micro dans `VoiceNote.tsx` et
`ConsigneVocale.tsx` (getUserMedia/MediaRecorder) ; `downloadExport` = `<a download>`
(no-op WebView) ; `viewport-fit=cover` déjà posé ; insets **bottom** déjà gérés
(`mz.css`, `cuisine.css`, `styles.css`) ; inset **top** géré nulle part ; **aucune** gestion
du bouton retour.

- **B1 — Micro (🟡)** : `AndroidManifest.xml` + `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` ;
  le Bridge Capacitor relaie la demande WebView → dialogue Android à la première capture.
  Code web **inchangé** (les deux composants gardent leur getUserMedia). Vérifier que le
  refus utilisateur retombe sur un message propre (catch existant à contrôler).
  *Pourquoi 🟡 : le flux permission WebView est spécifique appareil — testable uniquement
  sur APK réel, pas en CI.*
- **B2 — Export natif (🟢→🟡)** : `@capacitor/filesystem` + `@capacitor/share`.
  `downloadExport` : si `isNative` → écrire le JSON en cache + feuille de partage système ;
  sinon comportement web inchangé. **Invariant architecture conservé : `platform.ts` reste
  le SEUL module qui importe Capacitor** — l'export passe par un helper
  `platform.saveAndShareFile()`. **Rétablit le filet A1 sur l'APK** (P2 de la revue, soldé).
- **B3 — Bouton retour (🟡)** : `@capacitor/app`, listener `backButton`. Priorité :
  **sheet ouverte → la fermer** ; sinon **écran ≠ Maison → retour Maison** ; sinon
  **minimiser** (pas de kill). Design proposé : registre global dans le composant `Sheet`
  partagé (`ui/primitives`) — chaque sheet montée s'enregistre, le retour ferme la plus
  haute ; couvre AccountSheet/adoption/ownerNotice/newPage d'un coup.
  **Q-1 (à trancher au GO)** : les sheets internes non-primitives (ex. `cz-sheet` de
  Cuisine) — v1 les couvre via un `CustomEvent` léger, ou on les accepte hors périmètre v1.
  Reco : CustomEvent si ≤ ~10 lignes par vue, sinon hors périmètre assumé.
- **B4 — Safe-areas (🟡)** : ajouter l'inset **top** (topbar sous la status bar en
  edge-to-edge Android 15) : `padding-top: env(safe-area-inset-top)` sur la coquille de
  l'app. *Pourquoi 🟡 : `env(safe-area-inset-*)` peut rendre 0 sur WebView Android selon
  device/OS — à vérifier sur APK ; plan B documenté = gestion edge-to-edge de Capacitor 8
  (marges automatiques).*

**Portes B** : typecheck · tests · build web + smokes (**zéro régression web — les 4 fiches
doivent être invisibles pour le web**) · CI APK verte · **checklist appareil pour Amine au
STOP** : ① dicter une note vocale (dialogue permission puis capture OK), ② exporter (feuille
de partage s'ouvre, JSON lisible), ③ retour ferme sheet → revient à Maison → minimise,
④ topbar dégagée de la status bar.

---

## Volet C — Curation : docs + findings — 🟢

- **C-1 — Porter les 4 docs vivants** depuis `coquille-v1` :
  `GO_COQUILLE_DECISIONS.md` et `READBACK_COQUILLE.md` tels quels + bannière d'archivage
  (« contexte : coquille-v1, recréée en v2 — décisions Q-c1→Q-c5 et 8 pièges toujours
  valables ») ; `BRIEF_FINITIONS_COQUILLE.md` tel quel ; **`BUILD_NATIF.md` RÉÉCRIT**
  (dist-native, `.env.local` désormais lu par `loadEnv` — l'ancien piège documenté disparaît,
  branche v2).
- **C-2 — Distiller les 2 instantanés datés** (`REVUE_GLOBALE_2026-07-07.md`,
  `UPDATE_QA_2026-07-07.md`) en **entrées DEVLOG au passé** (ce qui fut trouvé, ce qui est
  soldé par AS-1/AS-2, ce qui reste) — les fichiers ne sont **pas** portés (ils resteraient
  faux au présent). **Répare `DEVLOG.md:235`** : la référence pointe l'entrée distillée +
  l'archive sur `coquille-v1`.
- **C-3 — Vérité des en-têtes migrations** : `0001`, `0002`, `0003` affirment encore
  « ⚠️ ARTEFACT DE READ-BACK — NON APPLIQUÉ » — **faux depuis le 05/07** (appliquées en prod,
  rejouées par le lot Environnements). Aligner les trois en-têtes (« appliquée prod +
  staging, rejouable/idempotente »). Périmètre repo seul — ne change aucun SQL exécutable.
- **C-4 — Re-domiciliation des findings ouverts**, classés (vérifiés dans le code actuel) :

| Finding (revue 07/07) | État vérifié | Gravité | Domicile |
|---|---|---|---|
| `downloadExport` no-op WebView | ouvert | — | **traité en C2 (B2)** — de droit |
| Cache audio négatif (`sync/audio.ts:44` : `missing` sur toute erreur, réseau inclus) | **ouvert** | **Moyenne-haute** — une note vocale présente au cloud paraît perdue toute la session (se rétablit au redémarrage) ; fix ~3 lignes (404-only) | Backlog priorisé — candidat mini-lot correctifs |
| `revokeEspace` silencieux (`espace.ts:237` : erreur delete ignorée, l'UI affirme la révocation) | **ouvert** | **Haute (confiance)** — un lien annoncé mort peut rester vivant | Backlog priorisé — candidat mini-lot correctifs |
| Faux « Envoyé ✓ » WhatsApp (`PartageSheet` : `window.open` post-await bloquable) | à re-vérifier | Moyenne (confiance) | Backlog |
| Adoption échouée sans retry (`useSync` : `asked.current` jamais réarmé) | à re-vérifier | Moyenne (contournement : recharger) | Backlog |
| `confirmedJoin` sans `try/finally` (`busy` bloqué sur exception) | à re-vérifier | Basse-moyenne (contournement : recharger) | Backlog |
| Compteur IA local utilisé comme barrière | à re-vérifier | Basse | Backlog |
| Couverture tests `engine`/`map`/`useSync` | partiellement soldé (AS-1 : hash canonique testé, smoke Comptes en CI) | Moyenne (dette) | Backlog |
| Erreurs de push avalées | **soldé** (`useSync.ts:45` ne marque rien, retente) | — | Clos |

  Les « à re-vérifier » sont contrôlés pendant C-4 (lecture directe, 5 min chacun) et leur
  ligne DEVLOG mise à jour — pas de gravité affirmée sans vérification.

**Portes C** : typecheck·build (aucun code touché — sécurité) · relecture DEVLOG par Amine.

---

## Ordre, STOP et fin de lot

```
A (C0′)  → STOP 1 : diff de contrôle A6 montré + APK CI verte
B (C2)   → STOP 2 : checklist appareil à Amine (micro/export/retour/safe-areas)
C (Curation) → STOP 3 : relecture DEVLOG + tableau findings
→ merge unique --no-ff vers le défaut, puis décision sur le sort de coquille-v1
```

**Chiffrage global** : A 🟢 (mécanique, diff sous les yeux, ~1-2 h) · B 🟡 (le code est
simple ; l'incertitude est le **comportement appareil** — permission micro et `env()` top,
d'où la checklist) · C 🟢 (docs + classification, déjà à moitié faite par ce read-back).
**Rouge : rien** — aucun volet ne touche backend, prod web, ou données.

**Q-1 (seule question ouverte)** : périmètre du bouton retour sur les sheets non-primitives
(Cuisine `cz-sheet`) — CustomEvent léger ou hors périmètre v1 ? Reco : CustomEvent si ≤ ~10
lignes par vue.
