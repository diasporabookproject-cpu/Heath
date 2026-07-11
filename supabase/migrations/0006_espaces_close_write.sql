-- 0006_espaces_close_write.sql — AS-2 Fiche 3.
-- FERME la fuite d'isolation inter-foyers révélée en E0 :
--   - `espaces` insert/update/delete étaient `check/using = true` → tout authentifié
--     pouvait écrire/modifier/supprimer l'espace de N'IMPORTE QUEL foyer.
--   - `espace_opens read auth` était `using (true)` → tout authentifié pouvait
--     énumérer TOUS les jetons et lire les pages publiées d'autres foyers.
--
-- ⚠️ INVARIANT PRÉSERVÉ : la policy `espaces read public` (lecture par jeton, anon)
-- N'EST PAS TOUCHÉE — le personnel n'a pas de compte, le lien public doit marcher.
-- Critère de fini de la bascule prod = lien anonyme d'un jeton réel → 200 avant ET après.
--
-- ⚠️ NON TOUCHÉE volontairement : `espace_opens insert anon` (`check true`) — l'accusé
-- de lecture s'écrit à l'OUVERTURE PUBLIQUE (sans session) → doit rester ouvert.
-- Nuisance mineure (spam de reçus) assumée ; ce n'est pas une fuite d'isolation.
--
-- ⚠️ Conséquence connue : les espaces legacy à `foyer_id NULL` (pré-comptes)
-- deviennent non-écrivables par le client (`is_foyer_member(null)` = faux) → plus
-- révocables via l'app. Décision Fiche 3 : COMPTER au snapshot avant bascule ; si 0
-- actif → bascule directe ; si > 0 → décision au cas par cas (backfill éventuel).
--
-- Idempotent (`drop policy if exists`+`create` — pattern rejouable, cf. RUNBOOK F-a).

-- ── ESPACES : écriture réservée aux MEMBRES DU FOYER propriétaire ──────────────
drop policy if exists "espaces insert auth" on public.espaces;
create policy "espaces insert auth" on public.espaces
  for insert to authenticated
  with check (foyer_id is not null and public.is_foyer_member(foyer_id));

drop policy if exists "espaces update auth" on public.espaces;
create policy "espaces update auth" on public.espaces
  for update to authenticated
  using      (foyer_id is not null and public.is_foyer_member(foyer_id))
  with check (foyer_id is not null and public.is_foyer_member(foyer_id));

drop policy if exists "espaces delete auth" on public.espaces;
create policy "espaces delete auth" on public.espaces
  for delete to authenticated
  using (foyer_id is not null and public.is_foyer_member(foyer_id));

-- ── ESPACE_OPENS : lecture réservée aux membres du foyer propriétaire du jeton ──
drop policy if exists "espace_opens read auth" on public.espace_opens;
create policy "espace_opens read auth" on public.espace_opens
  for select to authenticated
  using (exists (
    select 1 from public.espaces e
    where e.token = espace_opens.token
      and e.foyer_id is not null
      and public.is_foyer_member(e.foyer_id)
  ));
