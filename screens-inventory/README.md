# Inventaire visuel des écrans

Captures Playwright de tous les écrans/feuilles de l'app (mobile 390×844 @2x),
prises sur le **build de prod** servi par `vite preview`. **Aucune modification de
`src`** — build + preview + capture uniquement.

- `legende.txt` — pour chaque PNG : rôle de l'écran, chemin d'accès, et le texte
  visible (`innerText`) pour légender. Résumé + états vides + limites en fin de fichier.
- `capture.mjs` — script principal (20 captures).
- `capture-securite.mjs` — La maison / Sécurité (état vide + rempli après import).
- `capture-espace.mjs` — vue destinataire `#e=` (état vide/indisponible).

## Reproduire
```
npm ci
VITE_SUPABASE_URL=https://demo.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_demo_key_000000000000 \
  npm run build
npx vite preview --port 4173 &
OUT_DIR=$PWD/screens-inventory node screens-inventory/capture.mjs
OUT_DIR=$PWD/screens-inventory node screens-inventory/capture-securite.mjs
OUT_DIR=$PWD/screens-inventory node screens-inventory/capture-espace.mjs
```
Playwright est résolu globalement (`npm root -g`) comme pour `npm run smoke`.

## Cartographie (accès depuis Maison = hub)
- **Maison** : `01` hub · `02` feuille « Une page pour… » · `03` Compte & synchro.
- **Cuisine** (carte « Cuisine ») : `10` Semaine · `11` composeur repas ·
  `12` sélecteur de recette · `13` Bibliothèque · `14` fiche recette ·
  `15` ajout recette · `16` Collections · `17` Courses · `18` Objectif ·
  `19` Partage · `20` Copier semaine · `21` Semaine suivante (vide).
- **Nounou** (carte « Khadija ») : `30` Journée · `31` Conduites ·
  `32` Fiche urgence · `33` Partage Nounou.
- **La maison / Sécurité** (carte « La maison ») : `40` vide · `41` rempli.
- **Espace destinataire** (`#e=`) : `50` état vide/indisponible.
