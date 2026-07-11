-- 0009_ack_owner_notice.sql — AS-2b (volet client), petit RPC de service.
-- `owner_notice` (posé par `dispose_foyer_for_deletion`, 0008) signale au membre
-- PROMU owner qu'il a hérité du foyer. Le client lit ce drapeau (via la policy
-- `membres` select, déjà en place) pour afficher un bandeau, puis doit le remettre
-- à `false` une fois le bandeau vu. Or `membres` n'a PAS de policy UPDATE → le client
-- ne peut pas l'effacer directement. Ce RPC `security definer`, strictement scopé à
-- `auth.uid()` (comme `create_foyer`/`accept_invite`), fait juste cette bascule.
-- Idempotent (`create or replace` + revoke/grant rejouables).

create or replace function public.ack_owner_notice()
  returns void language plpgsql security definer set search_path = public as $$
begin
  update public.membres set owner_notice = false
    where user_id = auth.uid() and owner_notice = true;  -- scope strict : sa propre ligne
end $$;

revoke execute on function public.ack_owner_notice() from public, anon;
grant  execute on function public.ack_owner_notice() to authenticated;  -- appelé par le client
