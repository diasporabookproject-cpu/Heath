-- 0002_espaces_foyer.sql
-- Sous-lot S6 — tenancy sur `espaces` : rattache les pages publiées au foyer.
--
-- ⚠️ ARTEFACT DE READ-BACK — **NON APPLIQUÉ**. À jouer **EN PROD** (la table `espaces`
-- n'existe qu'en prod ; le staging est vierge), à la passe prod, après relecture.
--
-- DÉCISION AMINE : supprimer un foyer DOIT couper TOUS ses liens envoyés (sécurité)
-- → `on delete CASCADE`. Les espaces d'AVANT-comptes (foyer_id NULL après backfill)
-- restent publics jusqu'à expiration (le personnel n'a pas de compte) — inchangés.

alter table public.espaces
  add column if not exists foyer_id uuid references public.foyers(id) on delete cascade;
create index if not exists espaces_foyer_idx on public.espaces(foyer_id);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS côté auteur (lister/révoquer SES espaces) — À FINALISER APRÈS INSPECTION.
--   La LECTURE PUBLIQUE PAR JETON doit rester intacte (le personnel n'a pas de
--   compte). Avant d'ajouter des policies, vérifier l'état actuel :
--     select relrowsecurity from pg_class where relname='espaces';
--     select policyname, cmd, qual from pg_policies where tablename='espaces';
--   Puis, SANS casser la lecture publique existante, ajouter :
--     -- lister ses espaces (côté auteur, en plus de la lecture publique) :
--     -- create policy espaces_author_select on public.espaces for select
--     --   using (foyer_id is not null and public.is_foyer_member(foyer_id));
--     -- révoquer un lien :
--     -- create policy espaces_author_delete on public.espaces for delete
--     --   using (foyer_id is not null and public.is_foyer_member(foyer_id));
--   (La révocation « suppression du foyer → liens coupés » est DÉJÀ assurée par le
--   `on delete cascade` ci-dessus, indépendamment de la RLS.)
-- ────────────────────────────────────────────────────────────────────────────
