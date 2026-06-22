# Instructions projet — Menu de la semaine

App PWA mobile-first (React + Vite + TS) pour composer des menus hebdo. Voir
`BRIEF_PRODUIT.md` (produit) et **`DEVLOG.md`** (architecture, décisions, journal).

## Règle n°1 — tenir le DEVLOG
- **Au début de chaque session** : lire `DEVLOG.md` (état actuel + décisions).
- **À chaque commit** : ajouter une entrée dans le **Journal des sessions** de `DEVLOG.md`
  (date · sujet · pourquoi), de préférence **dans le même commit** que le travail.
- **À chaque décision d'architecture** : ajouter/mettre à jour une **ADR** dans `DEVLOG.md`.
- Mettre à jour « État actuel » et « À faire / en cours » quand ça bouge.

## Conventions
- **Langue de l'UI : français** (darija en lettres arabes pour la vue Cuisinière).
- **Local-first** : IndexedDB = source de vérité (`src/lib/db.ts`), migrations via `SEED_VERSION`.
- **Tests** : logique métier couverte par Vitest (`npm run test`) ; parcours bout-en-bout via `npm run smoke` (Playwright). Lancer `npm run typecheck` avant de committer.
- **Déploiement** : push sur la branche par défaut → GitHub Actions → Pages. Vérifier le run, puis l'URL de prod.
- **Secrets** : ne jamais committer la clé Supabase `secret`/`service_role`. La `publishable` (publique) et l'URL vivent dans `.github/workflows/deploy.yml`.
- Ne pas « normaliser » les mesures à la cuillère (càc/càs) ; le calcium doit rester visible partout.

## Commandes utiles
```
npm run dev          # dev local
npm run typecheck    # types
npm run test         # tests unitaires (Vitest)
npm run smoke        # parcours Playwright (préviser un build + preview d'abord)
npm run build        # build prod
```
