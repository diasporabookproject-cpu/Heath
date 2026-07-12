-- 0003_audio_bucket.sql
-- Sous-lot S3′ — sauvegarde des notes vocales : bucket PRIVÉ par foyer.
--
-- ✅ APPLIQUÉE en PROD le 2026-07-05 et REJOUÉE sur le staging reconstruit (lot
-- Environnements, 2026-07-08 — leçon F-c : le bucket se crée en SQL, ses objets non). Idempotente.
-- Objets préfixés par `foyer_id/…` ; accès réservé aux membres du foyer (RLS storage).

-- Bucket privé (non public).
insert into storage.buckets (id, name, public)
values ('foyer-audio', 'foyer-audio', false)
on conflict (id) do nothing;

-- RLS storage : un membre du foyer lit/écrit uniquement SES objets (1er segment = foyer_id).
-- `drop if exists`+`create` → migration REJOUABLE (idempotence prouvée en E2).
drop policy if exists "foyer-audio read" on storage.objects;
create policy "foyer-audio read" on storage.objects for select
  using (bucket_id = 'foyer-audio' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "foyer-audio insert" on storage.objects;
create policy "foyer-audio insert" on storage.objects for insert
  with check (bucket_id = 'foyer-audio' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "foyer-audio update" on storage.objects;
create policy "foyer-audio update" on storage.objects for update
  using (bucket_id = 'foyer-audio' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "foyer-audio delete" on storage.objects;
create policy "foyer-audio delete" on storage.objects for delete
  using (bucket_id = 'foyer-audio' and public.is_foyer_member(((storage.foldername(name))[1])::uuid));
