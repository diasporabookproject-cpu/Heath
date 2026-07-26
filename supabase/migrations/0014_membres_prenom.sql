-- 0014_membres_prenom.sql — Lot « Identité & accès », Phase 1 (décision PO ① — option A).
--
-- Le produit ne connaissait AUCUN nom d'utilisateur : `membres` porte
-- (foyer_id, user_id, role, created_at), `foyers` porte (id, owner_user_id,
-- created_at), et `auth.users` n'est pas lisible côté client. Les maquettes
-- affichent « Maison d'Amine », « Amine (vous) », « Sofia », « Vous voilà chez
-- Amine », « Sofia perd l'accès » : rien de tout cela n'était calculable.
--
-- Option A retenue (contre B « afficher les e-mails » — recul de confidentialité
-- entre colocataires du foyer — et C « pas de noms » — quatre écrans amputés).
-- Le prénom est demandé à la création (fondateur) et à l'arrivée (membre).
-- Cohérent avec le vocabulaire du produit : l'app ne connaît déjà qu'un PRÉNOM
-- pour les destinataires (le personnel).
--
-- Idempotent (RUNBOOK F-a) : rejouable deux fois sans erreur.

alter table public.membres add column if not exists prenom text;

-- `membres` n'avait QUE `select` (par appartenance) et `delete` — pas d'`update` :
-- sans policy, personne ne pourrait écrire son propre prénom. On ouvre le strict
-- minimum : CHACUN sa ligne, et RIEN d'autre que son prénom.
--
-- 🔴 La garde sur les colonnes ne peut pas s'exprimer en RLS (Postgres n'a pas de
-- policy par colonne) : on la pose par un GRANT restreint à la seule colonne
-- `prenom`, en plus de la policy qui restreint la LIGNE. Les deux sont nécessaires —
-- sans le grant, un membre pourrait se promouvoir `owner` sur sa propre ligne.
drop policy if exists membres_update_self on public.membres;
create policy membres_update_self on public.membres
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update on public.membres from authenticated;
grant  update (prenom) on public.membres to authenticated;
