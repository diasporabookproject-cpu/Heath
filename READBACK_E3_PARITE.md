# Read-back E3 — Prouver la parité staging ↔ prod
### `READBACK_E3_PARITE.md` · lot « Environnements propres » · 8 juillet 2026

> **À valider AVANT le token E3.** E3 démontre que « staging prouve la prod ».
> **PROD EN LECTURE SEULE** (le principe du lot) : la prod se **lit** pour être **égalée**,
> **jamais écrite**. E3 = **deux SELECT** par aspect, rien d'autre.

---

## 1. `npm run parity:check` — périmètre EXACT (dans le script `scripts/parity-check.mjs`)

Le diff porte sur **7 aspects** de structure, chacun = **une requête catalogue** dont la sortie
est une **ligne normalisée par objet, ordonnée** ; on compare **texte-à-texte** (ensemble des
lignes staging vs prod → `PROD-ONLY` / `STAGING-ONLY`).

| Aspect | Requête (source) | Ce que ça prouve |
|---|---|---|
| **tables + colonnes** | `information_schema.columns` (public) → `table.colonne :: type null= def=` | même schéma, mêmes types |
| **policies** | `pg_policies` (public **+ storage**) → `schema.table.policy \| cmd \| roles \| using= \| check=` | **RLS identique, `using`/`check` inclus** |
| **fonctions + `proacl`** | `pg_proc` (public) → `nom(args) secdef= lang= acl=<proacl>` | **⭐ PREUVE DU HOTFIX A1** : `reserve_ai_usage`/`refund_ai_usage`/`reserve_abuse_guard` doivent apparaître avec `acl=postgres=X/postgres;service_role=X/postgres` **des deux côtés** — pas juste « la fonction existe », mais **qui a le droit de l'exécuter** |
| **triggers** | `information_schema.triggers` (public) → `table.trigger timing événement` | `docs_touch` présent |
| **rls** | `pg_class.relrowsecurity` (public) → `table rls=t/f` | RLS activée sur les bonnes tables |
| **index** | `pg_indexes` (public) → `table.index` | mêmes index (dont `espace_opens_token_idx`, `espaces_foyer_idx`) |
| **buckets** | `storage.buckets` → `id public=t/f` | `foyer-audio`(privé) + `shared`(public) |

**+ edge functions** (via l'API functions, hors SQL) : **slugs présents + `verify_jwt`** comparés
(on **ignore les numéros de version** — cosmétiques). Prouve que `generate-translation` est bien
des deux côtés et que `verify_jwt` est conforme (recipe/translation = false, le reste = true).

### Méthode de comparaison
Texte-à-texte : chaque aspect renvoie une **liste ordonnée de lignes normalisées** ; le script
calcule les lignes **présentes d'un seul côté**. **Zéro ligne d'écart = parité prouvée.**

### Écarts ATTENDUS (non bloquants, classés à part)
- Les tables **`espaces_bak_20260705` / `espace_opens_bak_20260705`** (cruft prod) apparaîtront
  en `PROD-ONLY` → le script les **reconnaît** (`bak_2026`) et les compte comme **« attendu »**,
  pas comme échec. Elles seront droppées dans la **fenêtre prod de la Fiche 3**.
- **Hors périmètre de `parity:check`** (catégorie « testé autrement ») : Site URL / Redirect URLs
  (base-path, → C4), sender name / OTP exp (config Auth) — **ce ne sont PAS** des objets SQL, le
  diff ne les regarde pas. Ils vivent dans `CONFIG_CHECKLIST`.

### Ce que le script renvoie
`✓`/`✗` par aspect + un verdict final ; **exit 1** s'il reste **un** écart non attendu → on ne
déclare pas la parité tant que ce n'est pas `✓` partout.

---

## 2. Les autres preuves d'E3 (au-delà du diff structurel)
| Preuve | Comment | Qui |
|---|---|---|
| **Lien public anonyme → 200** | GET du payload de l'espace seed (`token=seed-espace-public-001`) **sans auth** sur staging → doit renvoyer la ligne (policy `espaces read public`) | moi (token) |
| **Smokes verts** | `smoke` (Cuisine) + `smoke-comptes` (déconnecté) contre un build staging | moi |
| **Login OTP staging** | déjà **prouvé bout-en-bout en F1** (staging + prod) → **optionnel** de le refaire | Amine (optionnel) |

> Le lien anonyme 200 est le pendant « côté externe » : il prouve que la lecture publique par
> jeton (le mécanisme le plus sensible du produit) marche sur le staging reconstruit — et c'est
> exactement ce que la Fiche 3 devra **préserver** en fermant l'écriture.

## 3. Points d'intervention Amine
1. **Générer + passer le token E3** (lecture prod + staging) après validation de ce read-back.
   → **révoqué à la fin d'E3** (rituel par étape).
2. *(optionnel)* refaire un login OTP sur staging si tu veux le revoir — sinon F1 fait foi.
3. Les **2 normalisations de checklist** (sender name → `Manzil`, OTP exp → 600) restent à faire
   quand tu veux ; hors `parity:check`, elles n'affectent pas le verdict structurel.

## 4. Ce dont j'ai besoin pour lancer E3
- **Validation de ce read-back** (surtout le §1 : le périmètre, dont `proacl` = preuve A1).
- **Token E3** (lecture seule, deux projets). Ma 1ʳᵉ action = `npm run parity:check`, puis le
  test du lien anonyme et les smokes. **Aucune écriture, nulle part.**

---
**Rappel gravé** : E3 = **prod en lecture seule**. La première (et seule) écriture prod du futur
sera la **Fiche 3 d'AS-2**, après ce lot.
