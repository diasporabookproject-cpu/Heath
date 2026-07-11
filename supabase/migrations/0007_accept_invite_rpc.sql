-- 0007_accept_invite_rpc.sql — AS-2 Fiche 1 (+ rate-limit Fiche 4).
-- Remplace l'edge function `accept-invite` (N requêtes non atomiques) par UN RPC
-- transactionnel appelé DIRECTEMENT par le client (`authenticated`), `security
-- definer` mais strictement scopé à `auth.uid()` (comme `create_foyer`).
-- Ferme : (a) le TOCTOU (`for update` sur l'invitation) ; (b) le « delete l'ancien
-- foyer AVANT d'insérer la nouvelle adhésion » (tout dans la même transaction).
--
-- ⚠️ RETOURNE UN STATUT jsonb {ok, foyer_id, error} — NE LÈVE PAS sur les erreurs
-- métier. Raison (bug attrapé au dry-run AS-2a) : une exception annulerait TOUTE la
-- transaction, y compris l'incrément du rate-limit → chaque tentative ratée effacerait
-- son propre compteur → rate-limit inefficace contre le brute-force. En retournant un
-- statut, la transaction COMMIT et le compteur persiste.
-- Rate-limit Fiche 4 : 5 tentatives / heure via `reserve_abuse_guard` (clé horaire).
-- Idempotent (`create or replace` + revoke/grant rejouables).

-- L'ancienne signature (returns uuid) doit partir avant le changement de type de retour.
drop function if exists public.accept_invite(text);

create or replace function public.accept_invite(p_code text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv record; v_cur record; v_count int; v_myf uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'auth requise'); end if;

  -- RATE-LIMIT (Fiche 4) : max 5 tentatives / heure, sur le foyer actuel de l'appelant.
  -- Compté même sur les tentatives ratées (grâce au retour-statut : pas de rollback).
  select foyer_id into v_myf from public.membres where user_id = v_uid limit 1;
  if v_myf is not null
     and public.reserve_abuse_guard(v_myf, 'iaccept-'||to_char(now(),'YYYY-MM-DD-HH24'), 5) is null
  then return jsonb_build_object('ok', false, 'error', 'Trop de tentatives, réessaie dans une heure.'); end if;

  -- VERROU sur l'invitation (fin du TOCTOU).
  select id, foyer_id, expires_at, accepted_by into v_inv
    from public.invitations where code = upper(trim(p_code)) for update;
  if v_inv.id is null              then return jsonb_build_object('ok', false, 'error', 'Code inconnu.'); end if;
  if v_inv.accepted_by is not null then return jsonb_build_object('ok', false, 'error', 'Invitation déjà utilisée.'); end if;
  if v_inv.expires_at < now()      then return jsonb_build_object('ok', false, 'error', 'Invitation expirée.'); end if;

  -- déjà membre de ce foyer → idempotent
  if exists (select 1 from public.membres where user_id=v_uid and foyer_id=v_inv.foyer_id) then
    update public.invitations set accepted_by=v_uid where id=v_inv.id;
    return jsonb_build_object('ok', true, 'foyer_id', v_inv.foyer_id);
  end if;

  -- quitter le foyer actuel (invariant un-foyer-par-user) — APRÈS validation, même transaction
  for v_cur in select foyer_id, role from public.membres where user_id=v_uid loop
    if v_cur.role='owner' then
      select count(*) into v_count from public.membres where foyer_id=v_cur.foyer_id;
      if v_count > 1 then
        return jsonb_build_object('ok', false, 'error',
          'Ton foyer a d''autres membres — retire-les avant de rejoindre un autre foyer.');
      end if;
      delete from public.foyers where id=v_cur.foyer_id;   -- seul membre → cascade
    end if;
  end loop;
  delete from public.membres where user_id=v_uid;
  insert into public.membres (foyer_id, user_id, role) values (v_inv.foyer_id, v_uid, 'membre');
  update public.invitations set accepted_by=v_uid where id=v_inv.id;
  return jsonb_build_object('ok', true, 'foyer_id', v_inv.foyer_id);
end $$;

revoke execute on function public.accept_invite(text) from public, anon;
grant  execute on function public.accept_invite(text) to authenticated;  -- appelé par le client
