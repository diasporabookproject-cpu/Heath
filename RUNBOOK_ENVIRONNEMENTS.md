# Runbook — Environnements (reconstruire, promouvoir, gouverner)
### `RUNBOOK_ENVIRONNEMENTS.md` · lot « Environnements propres » (E4) · 8 juillet 2026

> **Principe** : le repo est la **recette complète** d'un environnement (migrations + edge
> functions + `CONFIG_CHECKLIST` + `SECRETS` + seed). **Staging est jetable** : en cas de doute,
> on le **rebâtit**, on ne le répare pas. **PROD EN LECTURE SEULE** hors d'une fenêtre d'écriture
> explicitement ouverte (ex. AS-2 Fiche 3). **Non-dérive** : aucun changement d'environnement hors
> repo/checklist ; toute manip dashboard exceptionnelle est **back-portée le jour même**.

---

## 1. ⚠️ Les 3 fragilités apprises (la valeur réutilisable — lire AVANT toute repro)

Ce lot a révélé trois pièges non évidents. **Les respecter est ce qui rend la recette fiable.**

### F-a — Toute migration doit être REJOUABLE (`drop + create`, pas `create` nu)
`0001` et `0003` créaient leurs policies avec `create policy` **nu** → rejeu = `42710 already
exists`. Une migration doit passer **deux fois de suite** sans erreur.
- **Policies** : `drop policy if exists "<nom>" on <table>;` **puis** `create policy …` (même fichier).
- **Tables** : `create table if not exists`. **Index** : `create index if not exists`.
- **Fonctions** : `create or replace function`. **Buckets** : `insert … on conflict (id) do nothing`.
- **Preuve** : au rebuild, on rejoue **tout l'ensemble 2×** ; le 2ᵉ passage doit être `6/6 OK`.

### F-b — Un objet legacy se REQUÊTE, il ne s'APPROXIME pas
La repro de `espaces` (E1) a été écrite « au jugé » → types faux (`owner text` vs **`uuid default
auth.uid()`**, `payload` nullable vs **`not null`**, `updated_at not null` vs **nullable**). Invisible
jusqu'au `parity:check`.
- **Règle** : avant de reproduire un objet hors-migration, **relever ses types EXACTS** en prod
  (`information_schema.columns`, `pg_get_functiondef`, `pg_policies`) — copier, ne pas deviner.
- **Filet** : `parity:check` (E3) attrape l'écart si on a approximé. Mais autant viser juste.

### F-c — Le STORAGE ne se vide PAS en SQL (Storage API uniquement)
`delete from storage.objects …` est **bloqué** par Supabase (trigger `protect_delete`,
`42501`). Un `delete` SQL sur les tables storage **fait échouer toute la transaction**.
- **Vider un bucket** : passer par la **Storage API** (ou le dashboard), pas par SQL.
- **Dans un wipe** : ne mettre **que** `drop policy if exists … on storage.objects` (DDL, autorisé)
  et la suppression des **buckets** via l'API si besoin — **jamais** `delete from storage.objects`.

---

## 2. Reconstruire STAGING de zéro (la recette, ordre strict)

Token jetable **lecture+écriture staging** (révoqué après). Prod **non touchée**.

1. **Pré-vol** : confirmer la cible = **staging** (`tryjcednzencepokodrs`), pas prod. (Le wipe est
   irréversible ; staging est jetable, pas de backup.)
2. **WIPE** (SQL, cf. §5) : `drop table … cascade`, `drop function …`, `drop policy if exists … on
   storage.objects`, `delete from auth.users`. **Pas** de `delete from storage.objects` (F-c).
3. **Rejeu migrations** dans l'ordre : `0001 → 0001b → 0002 → 0003 → 0004 → 0005`, **puis un 2ᵉ
   passage** (preuve d'idempotence, F-a).
4. **Déployer les 5 edge functions** depuis le repo (`generate-recipe`, `generate-translation`,
   `invite`, `accept-invite`, `delete-account`), `verify_jwt` selon `CONFIG_CHECKLIST` (recipe &
   translation = **false**, le reste = **true**).
5. **Dérouler `supabase/CONFIG_CHECKLIST.md`** (dashboard) : SMTP, templates `{{ .Token }}`, OTP,
   URLs, secrets. (Le DB-wipe **préserve** la config projet — c'est surtout une **vérification**.)
6. **Seed** : `npm run seed:staging` (foyer + recettes + nounou + espace à jeton connu + compte
   smoke mot de passe = F2). Le script **refuse la prod**. *(Alternative sans terminal : créer le
   compte au dashboard + seeder les données via token.)*
7. **Prouver** : `npm run parity:check` = **0 écart** (hors `*_bak`) ; lien public anonyme du seed
   → **200** ; smokes verts ; login OTP.

## 3. Promouvoir un changement de schéma VERS la prod
Le principe prod-read-only vaut **pendant les lots** ; une promotion est une **fenêtre d'écriture
explicite**, ouverte et annoncée (ex. AS-2 Fiche 3).
1. Écrire la migration (idempotente, F-a), l'appliquer et la **prouver sur staging** d'abord.
2. **Snapshot** de l'état prod concerné **avant** (ex. `pg_policies` de la table visée).
3. Appliquer en prod (fenêtre annoncée) ; **vérifier immédiatement** l'invariant sensible (ex.
   lien public anonyme → **200 avant/après**).
4. **Rollback** : migration = pur `grant/revoke` ou `drop+create` → inverse trivial ; sinon
   `git revert` du merge + re-déploiement des versions précédentes des fonctions.

## 4. Rituel token
- **Jetable, par étape** (inventaire / écriture staging / diff), **révoqué entre chaque** — jamais
  une clé qui vit des jours.
- **Personal Access Token `sbp_…`** (API Management) uniquement ; **jamais** dans le repo/chat/log.
- **Préavis** avant toute lecture/écriture sensible sur prod (ex. snapshot `pg_policies`).

## 5. Annexe — SQL de wipe staging (référence)
```sql
-- STAGING UNIQUEMENT — irréversible.
drop table if exists
  public.docs, public.ai_usage, public.invitations, public.membres, public.foyers,
  public.espaces, public.espace_opens cascade;
drop function if exists public.create_foyer() cascade;
drop function if exists public.is_foyer_member(uuid) cascade;
drop function if exists public.is_foyer_owner(uuid) cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.reserve_ai_usage(uuid, text, int) cascade;
drop function if exists public.refund_ai_usage(uuid, text) cascade;
drop function if exists public.reserve_abuse_guard(uuid, text, int) cascade;
drop policy if exists "foyer-audio read"           on storage.objects;
drop policy if exists "foyer-audio insert"         on storage.objects;
drop policy if exists "foyer-audio update"         on storage.objects;
drop policy if exists "foyer-audio delete"         on storage.objects;
drop policy if exists "shared write authenticated" on storage.objects;
delete from auth.users;
-- ⚠️ PAS de `delete from storage.objects` (bloqué — F-c ; buckets via Storage API).
```

## 6. `parity:check` — discipline, pas garantie automatique
`npm run parity:check` (token à l'exécution, **jamais en CI**) prouve staging == prod sur la
structure (tables/colonnes, policies, **fonctions + `proacl`**, triggers, rls, index, buckets,
edge functions). **À lancer sciemment avant tout lot backend** — ce n'est **pas** imposé par une
CI, donc c'est une **discipline d'équipe**, pas une sécurité qu'on prétend automatique.

## 7. Backlog (noté, hors de ce lot)
- **Unification hébergement (naming / C4)** : prod GitHub Pages `/Heath/` → tout sur Cloudflare
  racine → supprime la classe base-path et rend Site URL diffable.
- **Smoke authentifié en CI** : utilise le **compte seed F2** (mot de passe) → session réelle
  contre staging → prouve enfin la sync & la RLS (au-delà de l'UI déconnectée).
- **`parity:check` périodique** + **drop des `*_bak`** dans la fenêtre prod d'**AS-2 Fiche 3**.
