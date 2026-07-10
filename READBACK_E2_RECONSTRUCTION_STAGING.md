# Read-back E2 — Reconstruction de staging à blanc
### `READBACK_E2_RECONSTRUCTION_STAGING.md` · lot « Environnements propres » · 8 juillet 2026

> **À valider AVANT le token E2.** On rase le staging pour la première fois. Séquence complète
> écrite, SQL de reset en clair, et **points d'intervention d'Amine** balisés. Rien n'est exécuté
> tant que ce read-back n'est pas validé.
>
> **Principe rappelé** : écriture **staging uniquement**, **prod jamais touchée** (elle sera juste
> lue en E3 pour prouver la parité).

---

## 0. Correction découverte en préparant E2 (relecture à froid = utile)
La migration legacy d'E1 était numérotée `0006` → **elle ne rejouait pas** sur un staging vierge :
l'ordre `0001→0006` fait passer **`0002` (`alter table espaces …`) AVANT** la création d'`espaces`
(0006) → plantage. **Corrigé** : renumérotée **`0001b_espaces_legacy.sql`** (trie entre 0001 et
0002), et **débarrassée de `foyer_id`+index** (c'est `0002`, inchangé, qui les ajoute — fidèle à
l'histoire). Ordre de rejeu final : **0001 → 0001b → 0002 → 0003 → 0004 → 0005**.

## 1. Irréversibilité (assumée)
Le wipe est **définitif** sur staging. C'est **voulu** (staging = jetable, **aucune donnée réelle**,
que des comptes de test). **Pas de backup** : si on doutait, on rebâtit — c'est justement ce qu'on
institue. La prod, elle, n'est **pas** touchée.

---

## 2. Séquence E2 (ordre strict) — qui fait quoi

| # | Étape | Qui | Moyen |
|---|---|---|---|
| 1 | **WIPE** staging (SQL §3) | **moi** | token E2 (API Management) |
| 2 | **Rejeu migrations** 0001 → 0001b → 0002 → 0003 → 0004 → 0005 | **moi** | token E2 |
| 3 | **Déploiement des 5 edge functions** depuis le repo (verify_jwt conformes) | **moi** | token E2 |
| 4 | **CONFIG_CHECKLIST** (vérif + normalisations) | **Amine** (guidé) | dashboard |
| 5 | **Seed** staging (`npm run seed:staging`) | **Amine** (ou fallback) | env local |
| 6 | **Contrôle de cohérence** de fin E2 | **moi** | token E2 |

> Le DB-wipe **ne touche PAS** la config projet (SMTP, templates, URLs, OTP, secrets de fonctions) :
> ce sont des réglages **hors base** qui **survivent**. L'étape 4 est donc surtout une **vérification**
> (+ 2 petites normalisations), pas une re-saisie complète.

---

## 3. SQL de reset — à relire À FROID (exécuté à l'étape 1, sur STAGING uniquement)

Basé sur l'inventaire E0 (staging = objets de 0001/0004/0005 seulement, 0 bucket, quelques
comptes de test). **Teardown explicite** (pas de `drop schema public cascade` — trop nucléaire et
moins relisable ; l'explicite préserve les grants du schéma).

```sql
-- ⚠️ STAGING (tryjcednzencepokodrs) UNIQUEMENT — irréversible.
-- Tables (cascade → policies, triggers docs_touch, index, FK partent avec) :
drop table if exists
  public.docs, public.ai_usage, public.invitations, public.membres, public.foyers,
  public.espaces, public.espace_opens cascade;
-- Fonctions (signatures explicites) :
drop function if exists public.create_foyer() cascade;
drop function if exists public.is_foyer_member(uuid) cascade;
drop function if exists public.is_foyer_owner(uuid) cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.reserve_ai_usage(uuid, text, int) cascade;
drop function if exists public.refund_ai_usage(uuid, text) cascade;
drop function if exists public.reserve_abuse_guard(uuid, text, int) cascade;
-- Storage (objets + buckets + policies de nos buckets ; no-op si absents) :
delete from storage.objects where bucket_id in ('foyer-audio','shared');
delete from storage.buckets  where id       in ('foyer-audio','shared');
drop policy if exists "foyer-audio read"          on storage.objects;
drop policy if exists "foyer-audio insert"        on storage.objects;
drop policy if exists "foyer-audio update"        on storage.objects;
drop policy if exists "foyer-audio delete"        on storage.objects;
drop policy if exists "shared write authenticated" on storage.objects;
-- Comptes de test (les FK vers auth.users sont parties avec foyers) :
delete from auth.users;
```
*Pourquoi c'est sûr* : le schéma `public` **reste** (seuls ses objets partent) → les grants
`anon`/`authenticated`/`service_role` sur le schéma sont **intacts** ; les migrations recréent tout.
`espaces`/`espace_opens` sont `if exists` (absents de staging → no-op ; présents si run partiel → nettoyés).

---

## 4. Rejeu des migrations (étape 2)
Chaque fichier joué **dans l'ordre** via l'endpoint SQL de l'API :
`0001_foyers-membres-docs-rls.sql` → `0001b_espaces_legacy.sql` → `0002_espaces_foyer.sql` →
`0003_audio_bucket.sql` → `0004_ai_usage_rpc.sql` → `0005_lockdown_rpc.sql`.
**Preuve d'idempotence (Q-e2)** : je rejoue **une 2ᵉ fois** l'ensemble → doit passer sans erreur
(les `if not exists` / `drop+create` le garantissent). Si le 2ᵉ passage échoue, on corrige la
migration avant d'aller plus loin.

## 5. Déploiement des edge functions (étape 3)
Depuis le repo, via l'endpoint deploy (comme le hotfix), `verify_jwt` selon `CONFIG_CHECKLIST` :

| Fonction | verify_jwt |
|---|---|
| `generate-recipe` | **false** |
| `generate-translation` | **false** (aujourd'hui **absente** de staging → recréée) |
| `invite` · `accept-invite` · `delete-account` | **true** |

⚠️ **Prérequis (à vérifier étape 4)** : le secret **`ANTHROPIC_API_KEY`** doit exister sur staging
(il survit au wipe). Sans lui, les fonctions IA se déploient mais échouent à l'appel.

## 6. CONFIG_CHECKLIST — **point d'intervention Amine** (étape 4, dashboard)
Le wipe a préservé la config Auth. Amine **vérifie** et fait **2 normalisations** :
- ✅ Vérifier : Custom SMTP actif (sender `login@send.elysia.studio`), templates Magic Link **et**
  Confirm signup sur `{{ .Token }}`, OTP length **6**, `ANTHROPIC_API_KEY` présent (Edge Functions → Secrets).
- 🔧 Normaliser : **Sender name `loginstaging` → `Manzil`** ; OTP expiration → **600 s**.

## 7. Seed (étape 5) — **point d'intervention Amine**
Ton choix (tu poses `SEED_SMOKE_PASSWORD` toi-même, comme convenu) :
- **Option A (recommandée) — tu lances le seed** : depuis un clone du repo à jour,
  ```bash
  SUPABASE_URL=https://tryjcednzencepokodrs.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service_role staging> \
  SEED_SMOKE_PASSWORD=<ton mot de passe smoke> \
  npm run seed:staging
  ```
  Tout reste chez toi (service_role **et** password). Le script **refuse la prod** (garde vérifiée).
- **Option B (fallback si tu ne peux pas lancer Node)** : tu crées le compte smoke au dashboard
  (Auth → Add user, email `smoke@manzil.test` + password, **auto-confirm**), tu me donnes son
  **UUID** (non secret), et je seede le reste (foyer + docs + espace) via le token E2.

👉 **Dis-moi A ou B** (et si A, confirme que tu peux faire `npm run seed:staging` en local).

## 8. Contrôle de cohérence fin E2 (étape 6, moi)
Lectures rapides sur staging : 7 tables présentes (dont `espaces`/`espace_opens`), 7 fonctions +
`proacl` verrouillés, 2 buckets (`foyer-audio` privé, `shared` public), 5 fonctions ACTIVE, la
ligne espace seed lisible par jeton. → sinon on corrige avant E3 (parité).

---

## 9. Points d'intervention Amine (récap)
1. **Générer + passer le token E2** (Management API) après validation de ce read-back.
2. **Étape 4** : dérouler/vérifier la CONFIG_CHECKLIST au dashboard (2 normalisations).
3. **Étape 5** : choisir **A** (lancer le seed, tes secrets) ou **B** (créer le user + me donner l'UUID).

## 10. Ce dont j'ai besoin pour lancer E2
- **Validation de ce read-back** (surtout le SQL §3, à froid).
- **Token E2**. Ma 1ʳᵉ action = le **WIPE §3 sur staging** (je te le confirme juste avant d'appuyer).
- Ton choix **seed A/B** (§7).
