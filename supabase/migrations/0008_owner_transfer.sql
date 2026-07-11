-- 0008_owner_transfer.sql — AS-2 Fiche 2.
-- `deleteAccount` d'un owner ne DÉTRUIT plus le foyer partagé : si d'autres membres,
-- la propriété est TRANSFÉRÉE au plus ancien d'entre eux (promu owner + `owner_notice`),
-- puis le partant est retiré. Owner seul → suppression (inchangé). Membre → retrait.
-- Transactionnel via un RPC appelé par l'edge `delete-account` (service_role).
-- Idempotent (`add column if not exists`, `create or replace`, revoke/grant rejouables).

alter table public.membres add column if not exists owner_notice boolean not null default false;

create or replace function public.dispose_foyer_for_deletion(p_uid uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_foyer uuid; v_role text; v_count int; v_new uuid;
begin
  for v_foyer, v_role in select foyer_id, role from public.membres where user_id=p_uid loop
    if v_role='owner' then
      select count(*) into v_count from public.membres where foyer_id=v_foyer;
      if v_count = 1 then
        delete from public.foyers where id=v_foyer;                     -- seul → cascade
      else
        -- TRANSFERT au plus ancien AUTRE membre (le foyer + son contenu SURVIVENT).
        select user_id into v_new from public.membres
          where foyer_id=v_foyer and user_id<>p_uid order by created_at asc limit 1;
        update public.membres set role='owner', owner_notice=true
          where foyer_id=v_foyer and user_id=v_new;                     -- promotion + notif
        update public.foyers set owner_user_id=v_new where id=v_foyer;  -- lève la FK RESTRICT
        delete from public.membres where foyer_id=v_foyer and user_id=p_uid;  -- retrait du partant
      end if;
    else
      delete from public.membres where foyer_id=v_foyer and user_id=p_uid;
    end if;
  end loop;
end $$;

revoke execute on function public.dispose_foyer_for_deletion(uuid) from public, anon, authenticated;
grant  execute on function public.dispose_foyer_for_deletion(uuid) to service_role;
