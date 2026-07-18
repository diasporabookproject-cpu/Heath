-- 0010_images_bucket.sql
-- Lot Cuisine T5 (F5.3) — photo du plat : bucket PRIVÉ par foyer, MIROIR EXACT
-- de 0003 (foyer-audio). Objets préfixés `foyer_id/recipes/…` ; accès réservé aux
-- membres du foyer (RLS storage, 1er segment du chemin = foyer_id). Idempotente
-- (`on conflict do nothing` + `drop policy if exists` → rejouable, preuve en
-- double passage au rituel de fenêtre).
-- ⏳ À appliquer : STAGING d'abord (×2) → parity:check → validation PO → PROD →
-- parity de clôture (RUNBOOK §3 étape 5).

-- Bucket privé (non public).
insert into storage.buckets (id, name, public)
values ('foyer-images', 'foyer-images', false)
on conflict (id) do nothing;

-- RLS storage : un membre du foyer lit/écrit uniquement SES objets.
drop policy if exists "foyer-images read" on storage.objects;
create policy "foyer-images read" on storage.objects for select
  using (bucket_id = 'foyer-images' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "foyer-images insert" on storage.objects;
create policy "foyer-images insert" on storage.objects for insert
  with check (bucket_id = 'foyer-images' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "foyer-images update" on storage.objects;
create policy "foyer-images update" on storage.objects for update
  using (bucket_id = 'foyer-images' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "foyer-images delete" on storage.objects;
create policy "foyer-images delete" on storage.objects for delete
  using (bucket_id = 'foyer-images' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));
