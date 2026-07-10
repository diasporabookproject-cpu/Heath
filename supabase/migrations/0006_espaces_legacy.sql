-- 0006_espaces_legacy.sql
-- Lot « Environnements propres » — E1. RATTRAPE dans le repo les objets legacy
-- créés en prod HORS migration (ère pré-comptes) : table `espaces`, table
-- `espace_opens`, bucket public `shared`. Reproduit l'état PROD **À L'IDENTIQUE**
-- (relevé E0 — `RAPPORT_ECART_ENVS.md`).
--
-- ⚠️ CE FICHIER NE CORRIGE RIEN. Les règles d'écriture ouvertes (`espaces`
-- insert/update/delete `using/check = true`, `espace_opens read auth using true`)
-- sont des FUITES D'ISOLATION INTER-FOYERS connues ; leur fermeture est le cœur de
-- la **Fiche 3 d'AS-2**, sur le staging reconstruit puis en prod. On les reproduit
-- telles quelles ici pour que staging == prod (parité), pas pour les entériner.
--
-- IDEMPOTENT (rejouable sur staging où rien n'existe, comme sur prod où tout existe) :
--   `create table if not exists`, `drop policy if exists`+`create`, `on conflict do
--   nothing`, `create index if not exists`. Le pattern drop+create des policies vit
--   dans la transaction implicite de l'exécution → aucune fenêtre de coupure de la
--   lecture publique au rejeu.
--
-- ⚠️ Les tables de backup `espaces_bak_20260705` / `espace_opens_bak_20260705`
-- (prod-only, snapshots du 05/07) ne sont **PAS** reproduites : ce sont des cruft.
-- Leur DROP est rattaché à la **fenêtre d'écriture prod de la Fiche 3 d'AS-2**
-- (même session prod que la fermeture des policies espaces).

-- ── Table espaces (capability : une page publiée = une ligne à jeton) ──────────
create table if not exists public.espaces (
  token      text primary key,
  payload    jsonb,
  owner      text,                                   -- legacy pré-comptes (non utilisé par le code actuel)
  updated_at timestamptz not null default now(),
  foyer_id   uuid references public.foyers(id) on delete cascade  -- ajouté par 0002 (cascade = suppr. foyer coupe les liens)
);
create index if not exists espaces_foyer_idx on public.espaces(foyer_id);
alter table public.espaces enable row level security;

-- Policies espaces — AS-IS (état prod E0). ⚠️ écriture OUVERTE (Fiche 3 fermera).
drop policy if exists "espaces read public" on public.espaces;
create policy "espaces read public" on public.espaces
  for select to anon, authenticated using (true);       -- lecture publique par jeton — À GARDER
drop policy if exists "espaces insert auth" on public.espaces;
create policy "espaces insert auth" on public.espaces
  for insert to authenticated with check (true);        -- ⚠️ ouvert
drop policy if exists "espaces update auth" on public.espaces;
create policy "espaces update auth" on public.espaces
  for update to authenticated using (true) with check (true);  -- ⚠️ ouvert
drop policy if exists "espaces delete auth" on public.espaces;
create policy "espaces delete auth" on public.espaces
  for delete to authenticated using (true);             -- ⚠️ ouvert

-- ── Table espace_opens (accusé de lecture — best-effort) ──────────────────────
create table if not exists public.espace_opens (
  id         bigint generated always as identity primary key,
  token      text not null,
  opened_at  timestamptz not null default now()
);
create index if not exists espace_opens_token_idx on public.espace_opens (token, opened_at desc);
alter table public.espace_opens enable row level security;

drop policy if exists "espace_opens insert anon" on public.espace_opens;
create policy "espace_opens insert anon" on public.espace_opens
  for insert to anon, authenticated with check (true);
drop policy if exists "espace_opens read auth" on public.espace_opens;
create policy "espace_opens read auth" on public.espace_opens
  for select to authenticated using (true);             -- ⚠️ fuite : tout authentifié lit tous les jetons (Fiche 3)

-- ── Bucket public `shared` (notes vocales publiées dans les espaces) ──────────
insert into storage.buckets (id, name, public)
  values ('shared', 'shared', true)
  on conflict (id) do nothing;

-- Écriture réservée aux authentifiés (AS-IS prod) ; lecture = URL publique (bucket public).
drop policy if exists "shared write authenticated" on storage.objects;
create policy "shared write authenticated" on storage.objects
  for insert to authenticated with check (bucket_id = 'shared');
