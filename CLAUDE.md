# Instructions projet — Manzil (nom de travail)

App PWA mobile-first (React + Vite + TS) + coquille native Capacitor : organiser le foyer
et briefer chaque personne de maison dans sa langue. Voir **`ETAT.md`** (où on en est —
la photo de l'état) + **`DEVLOG.md`** (journal, ADR, backlog qualité — le récit),
`BRIEF_FLOW_FTUE.md`/`READBACK_*.md` (lots récents) ; `BRIEF_PRODUIT.md` = brief
d'ORIGINE (« Menu de la semaine », historique).

## Règle n°1 — tenir ETAT.md + le DEVLOG
- **Au début de chaque session** : lire `ETAT.md` (où on en est) puis les ADR de `DEVLOG.md`.
- **À chaque commit** : ajouter une entrée dans le **Journal des sessions** de `DEVLOG.md`
  (date · sujet · pourquoi), de préférence **dans le même commit** que le travail.
- **À chaque STOP de tranche et clôture de lot** : **réécrire `ETAT.md`** (photo de l'état,
  une page-écran, un seul écrivain). C'est un **critère de fini** du STOP, au même titre
  que l'entrée DEVLOG — un STOP sans `ETAT.md` à jour n'est pas fini.
- **À chaque décision d'architecture** : ajouter/mettre à jour une **ADR** dans `DEVLOG.md`.
- **Frontière** : `ETAT.md` = décidé et planifié · backlog qualité (`DEVLOG.md`) = trouvé,
  pas encore décidé. Sens unique backlog → ETAT quand une décision planifie.

## Règle n°2 — ouvrir un lot : geler la prod AVANT d'écrire une ligne
🔴 **Le premier geste d'un lot, avant tout code** : brancher `lot-<nom>-v1` depuis la
prod, puis **repointer les DEUX workflows** (`deploy.yml` *et* `apk.yml`) sur cette
branche, dans le commit d'ouverture. La prod reste **figée** pendant tout le lot ; elle
ne bouge qu'au **GO de clôture** du PO — moment où les deux workflows repartent sur la
branche de prod.

- **Ne JAMAIS supposer le déclencheur de `deploy.yml` : l'ouvrir et le lire.** La
  branche de prod est aussi la branche par défaut du dépôt **et** la branche désignée
  des sessions — rien dans son nom ne dit qu'elle publie. Lot Identité (26/07) : le lot
  entier est parti en prod cinq jours avant son GO parce que `apk.yml` a été lu (il
  nommait bien la branche de lot) et `deploy.yml` supposé.
- La règle est **portée par une porte**, pas par la mémoire : `src/lib/portes.test.ts`
  échoue quand un lot en vol n'a pas ses workflows repointés, ou quand les deux
  workflows visent des branches différentes. Un test rouge y est une consigne, pas un bug.
- Les **portes de CI et de déploiement sont les MÊMES** (`.github/workflows/portes.yml`,
  appelé par `ci.yml` et `deploy.yml`) : typecheck · tests · build · **3 smokes**. Ne
  jamais recréer une copie réduite dans `deploy.yml` — la prod ne doit jamais être gardée
  moins sévèrement qu'une branche de travail.
- **Fenêtre serveur** (migration, edge) : protocole AS-2 complet, jeton jetable, **rien
  ne part sans le GO explicite du PO** — cf. `RUNBOOK_ENVIRONNEMENTS.md`.

## Conventions
- **Langue de l'UI : français** (darija en lettres arabes pour la vue Cuisinière).
- **Local-first** : IndexedDB = source de vérité (`src/lib/db.ts`), migrations via `SEED_VERSION`.
- **Tests** : logique métier couverte par Vitest (`npm run test`) ; parcours bout-en-bout via **3 smokes Playwright** (Cuisine `npm run smoke` · Comptes `node scripts/smoke-comptes.mjs` · FTUE `node scripts/smoke-ftue.mjs`) — tous en CI. Lancer `npm run typecheck` avant de committer.
- **Déploiement** : push sur la branche par défaut → GitHub Actions → Pages. Vérifier le run, puis **le bundle réellement servi** (pas le commit : c'est ce contrôle qui a attrapé un tutoiement resté en prod à la clôture du lot Identité). Cf. règle n°2 pour le gel de la prod pendant un lot.
- **Secrets** : ne jamais committer la clé Supabase `secret`/`service_role`. La `publishable` (publique) et l'URL vivent dans `.github/workflows/deploy.yml`.
- Ne pas « normaliser » les mesures à la cuillère (càc/càs) ; le calcium doit rester visible partout.

## Commandes utiles
```
npm run dev            # dev local
npm run typecheck      # types
npm run test           # tests unitaires (Vitest)
npm run smoke          # smoke Cuisine (prévoir un build + preview d'abord)
node scripts/smoke-comptes.mjs   # smoke Comptes (flux déconnecté)
node scripts/smoke-ftue.mjs      # smoke FTUE (gate + peuplement + migration)
npm run build          # build web (dist/, base BASE_PATH)
npm run build:native   # build coquille (dist-native/, base './') — cf. BUILD_NATIF.md
npm run seed:staging   # (re)peupler le staging Supabase — cf. RUNBOOK_ENVIRONNEMENTS.md
npm run parity:check   # parité staging ↔ prod (catalogue + edge functions)
```
