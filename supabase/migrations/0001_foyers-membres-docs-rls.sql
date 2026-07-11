-- 0001_foyers-membres-docs-rls.sql
-- Sous-lot S1 — schéma foyers/membres + miroir de sync (docs) + quota IA + tenancy espaces.
--
-- ⚠️ ARTEFACT DE READ-BACK — **NON APPLIQUÉ**. À relire (Amine) puis à jouer en **STAGING d'abord**
-- (SQL Editor), tests RLS, et seulement ensuite en prod après GO. Idempotent autant que possible.
-- Invariants : tenancy = `foyer_id` partout ; RLS stricte ; le local reste la source, le cloud = miroir.

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────
-- Foyers & membres  (un seul foyer par utilisateur en v1)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.foyers (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now()
);

create table if not exists public.membres (
  foyer_id   uuid not null references public.foyers(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  role       text not null default 'membre' check (role in ('owner','membre')),
  created_at timestamptz not null default now(),
  primary key (foyer_id, user_id),
  unique (user_id)                          -- v1 : un utilisateur = un seul foyer
);

-- Helpers RLS en SECURITY DEFINER => évitent la récursion de policy sur `membres`.
create or replace function public.is_foyer_member(f uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.membres m where m.foyer_id = f and m.user_id = auth.uid());
$$;

create or replace function public.is_foyer_owner(f uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.membres m
                 where m.foyer_id = f and m.user_id = auth.uid() and m.role = 'owner');
$$;

-- Création atomique foyer + membre owner (plutôt que des inserts client permissifs).
-- Appelée à la 1ʳᵉ connexion (rituel d'adoption, S2). `unique(user_id)` garantit l'unicité.
create or replace function public.create_foyer()
  returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'auth requise'; end if;
  insert into public.foyers (owner_user_id) values (auth.uid()) returning id into fid;
  insert into public.membres (foyer_id, user_id, role) values (fid, auth.uid(), 'owner');
  return fid;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Invitations  (opération SERVEUR ; couture premium ② — gratuite/ouverte en v1)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  foyer_id    uuid not null references public.foyers(id) on delete cascade,
  email       text,
  code        text not null,
  expires_at  timestamptz not null,
  accepted_by uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists invitations_code_idx on public.invitations(code);

-- ─────────────────────────────────────────────────────────────
-- Docs : miroir GÉNÉRIQUE de la donnée locale (choix du brief §2)
--   store  ∈ 'recipes'|'weeks'|'destinataires'|'securite'|'nounou'|'app'
--   doc_id = id de ligne, ou 'doc'/'app' pour les blobs. (audio => bucket privé, PAS ici.)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.docs (
  foyer_id   uuid not null references public.foyers(id) on delete cascade,
  store      text not null,
  doc_id     text not null,
  payload    jsonb,                    -- null admis quand tombstone
  updated_at timestamptz not null default now(),   -- POSÉ PAR LE SERVEUR (clé du LWW)
  deleted_at timestamptz,              -- tombstone (l'ordre reste porté par updated_at)
  updated_by uuid references auth.users(id),
  primary key (foyer_id, store, doc_id)
);
create index if not exists docs_foyer_updated_idx on public.docs(foyer_id, updated_at);

-- updated_at / updated_by TOUJOURS (re)posés par le serveur — jamais de confiance à l'horloge client.
create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Quota IA  (couture premium ① — écrit CÔTÉ SERVEUR par l'edge function en service_role)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.ai_usage (
  foyer_id uuid not null references public.foyers(id) on delete cascade,
  month    text not null,             -- 'YYYY-MM'
  used     int  not null default 0,
  primary key (foyer_id, month)
);

-- ─────────────────────────────────────────────────────────────
-- Tenancy sur `espaces` : ENTIÈREMENT REPORTÉ À 0002. Raisons :
--   1. La table `espaces` n'existe qu'en PROD (le staging est vierge) → un `alter table`
--      ici planterait sur staging. 0002 la traitera contre la vraie base prod.
--   2. Il faut d'abord inspecter l'état RLS actuel de `espaces` pour ne PAS casser la
--      lecture publique par jeton (le personnel n'a pas de compte).
--   SPEC 0002 (décision Amine) : `espaces.foyer_id … on delete CASCADE` — supprimer un
--   foyer DOIT couper tous ses liens envoyés (les lignes espaces partent → liens morts),
--   par sécurité. + policies « côté auteur » (lister/révoquer) réservées aux membres.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- RLS  (tables nouvelles uniquement — on ne touche pas `espaces` ici)
-- ─────────────────────────────────────────────────────────────
alter table public.foyers      enable row level security;
alter table public.membres     enable row level security;
alter table public.invitations enable row level security;
alter table public.docs        enable row level security;
alter table public.ai_usage    enable row level security;

-- foyers : lecture/suppression par membres/owner ; création via create_foyer() (definer), pas d'insert client.
-- `drop if exists`+`create` sur chaque policy → migration REJOUABLE (idempotence prouvée en E2).
drop policy if exists foyers_select on public.foyers;
create policy foyers_select on public.foyers for select using (public.is_foyer_member(id));
drop policy if exists foyers_delete on public.foyers;
create policy foyers_delete on public.foyers for delete using (public.is_foyer_owner(id));

-- membres : lecture par co-membres ; quitter = self-delete ; l'owner peut retirer un membre.
--   (insert géré par create_foyer()/RPC d'invitation en definer — pas de policy insert client.)
drop policy if exists membres_select on public.membres;
create policy membres_select on public.membres for select using (public.is_foyer_member(foyer_id));
drop policy if exists membres_delete on public.membres;
create policy membres_delete on public.membres for delete
  using (user_id = auth.uid() or public.is_foyer_owner(foyer_id));

-- invitations : gérées par les membres du foyer (l'acceptation par un invité = RPC serveur, S4).
drop policy if exists invitations_rw on public.invitations;
create policy invitations_rw on public.invitations for all
  using (public.is_foyer_member(foyer_id)) with check (public.is_foyer_member(foyer_id));

-- docs : tout le CRUD si membre du foyer (le cœur du miroir de sync).
drop policy if exists docs_rw on public.docs;
create policy docs_rw on public.docs for all
  using (public.is_foyer_member(foyer_id)) with check (public.is_foyer_member(foyer_id));

-- ai_usage : LECTURE seule côté client (l'écriture passe par l'edge function en service_role, qui bypass la RLS).
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage for select using (public.is_foyer_member(foyer_id));

-- Fin 0001. Tests RLS à écrire avant application prod (accès inter-foyer refusé, self-delete OK, etc.).
