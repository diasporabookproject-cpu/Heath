-- 0011_espace_checks.sql — Lot partage + suivi des tâches, T2 (read-back GO).
-- SUIVI DES TÂCHES : le personnel coche sur sa page reçue (par jeton, sans
-- compte) ; l'employeur voit l'état quand il consulte. Premier flux
-- BIDIRECTIONNEL du produit.
--
-- Modèle : JOURNAL INSERT-ONLY (patron `espace_opens`, la surface anon déjà
-- auditée — AS-2/audit ①-r). Chaque geste (cocher OU décocher) = une ligne ;
-- l'état courant = la DERNIÈRE ligne par item (réduction LWW côté client,
-- `src/lib/espace-checks.ts`). Jamais d'UPDATE/DELETE anon : la capacité
-- d'écrasement n'est accordée à personne, l'historique est gratuit, la
-- concurrence (deux personnes cochent) se règle par l'ordre d'arrivée.
--
-- 🔴 EXIGENCE PO (read-back, non négociable) : la lecture porte une JOINTURE
-- D'EXISTENCE sur `espaces` — un jeton révoqué (ligne supprimée, F1) rend ses
-- coches ILLISIBLES PAR CONSTRUCTION. Le trou fermé par l'audit ④ pour la page
-- ne se rouvre pas pour l'historique d'activité de la maison. La purge
-- best-effort au revoke reste un bonus ; CETTE policy est la garantie.
--
-- Résidu assumé (documenté, pas nouveau) : un `select` sans filtre expose les
-- coches des jetons VIVANTS — même classe d'exposition que la table mère
-- (`espaces read public using(true)`, 0001b:42-44, le modèle capability du
-- produit). 0011 est PLUS restrictif que la table qu'il accompagne.
--
-- Idempotent (RUNBOOK F-a) : rejouable deux fois sans erreur.

create table if not exists public.espace_checks (
  id bigint generated always as identity primary key,
  token text not null,
  item text not null,
  done boolean not null,
  at timestamptz not null default now()
);

-- Lecture d'état = balayage par jeton dans l'ordre d'arrivée (réduction LWW).
create index if not exists espace_checks_token_idx on public.espace_checks (token, at);

alter table public.espace_checks enable row level security;

-- ── ÉCRITURE : anonyme (la page reçue n'a pas de compte — patron espace_opens),
--    MAIS bornée aux jetons VIVANTS : cocher sur un lien révoqué est REFUSÉ
--    (la file offline cliente purge ses événements sur ce refus — comportement
--    correct : le lien est coupé, l'activité ne remonte plus). Plus strict
--    qu'`espace_opens insert anon check(true)` : on ne journalise pas dans le
--    vide. `authenticated` inclus : l'employeur qui ouvre le lien connecté
--    coche par le même chemin.
drop policy if exists "espace_checks insert by living token" on public.espace_checks;
create policy "espace_checks insert by living token" on public.espace_checks
  for insert to anon, authenticated
  with check (exists (select 1 from public.espaces e where e.token = espace_checks.token));

-- ── LECTURE : par jeton vivant (anon = la page affiche l'état ; authenticated =
--    l'employeur consulte). 🔴 la jointure d'existence est L'EXIGENCE.
drop policy if exists "espace_checks read by living token" on public.espace_checks;
create policy "espace_checks read by living token" on public.espace_checks
  for select to anon, authenticated
  using (exists (select 1 from public.espaces e where e.token = espace_checks.token));

-- Pas de policy update/delete : journal append-only, pour tout le monde.

-- ─────────────────────────────────────────────────────────────────────────────
-- RÉPÉTITION À BLANC (staging, fenêtre — protocole AS-2 Fiche 3, preuves à
-- journaliser au DEVLOG). Prendre un jeton VIVANT du staging ($TOK) :
--
-- 1) INSERT anon sur jeton vivant → OK :
--    set role anon;
--    insert into public.espace_checks (token, item, done) values ('$TOK', 'd:lun:dej:test01', true);
--
-- 2) INSERT anon sur jeton INCONNU → doit ÉCHOUER (RLS) :
--    insert into public.espace_checks (token, item, done) values ('token-inexistant', 'x', true);
--    -- attendu : new row violates row-level security policy
--
-- 3) SELECT anon par jeton vivant → la ligne du 1) :
--    select item, done from public.espace_checks where token = '$TOK';
--
-- 4) 🔴 TEST BLOQUANT n°4 — RÉVOCATION : supprimer la ligne espaces du jeton
--    (reset role; delete from public.espaces where token = '$TOK';) puis :
--    set role anon;
--    select count(*) from public.espace_checks where token = '$TOK';
--    -- attendu : 0 (les lignes existent, la policy les rend ILLISIBLES)
--
-- 5) Rejouabilité : relancer 0011 entier une 2e fois → aucune erreur.
-- ─────────────────────────────────────────────────────────────────────────────
