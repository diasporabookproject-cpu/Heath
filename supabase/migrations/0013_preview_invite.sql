-- 0013_preview_invite.sql — Lot « Identité & accès », Phase 1.
-- Écran « C'est bien cette maison ? » (maquette `identite-ecrans-compiles.html` §2).
-- On ne rejoint pas un foyer À L'AVEUGLE : avant d'engager, l'écran nomme la maison.
--
-- Le problème : `foyers` et `membres` sont fermés par `is_foyer_member` (0001) —
-- un invité n'est PAS encore membre, il ne peut donc rien lire. D'où ce RPC
-- `security definer`, **strictement en LECTURE**, qui n'expose que le minimum
-- affiché par la maquette : le prénom du fondateur (→ « Maison d'Amine »), le
-- nombre de membres et la date de création.
--
-- 🔴 CE RPC NE JOINT JAMAIS. Il ne crée ni membre, ni invitation consommée, ni
-- session : accepter reste le seul fait d'`accept_invite` (0007), qui garde son
-- verrou, son rate-limit et sa transaction. Un preview raté ne consomme rien.
--
-- Surface exposée, pesée : un code VALIDE révèle un prénom, un compte et un mois.
-- C'est exactement ce que l'invité doit voir pour reconnaître la maison, et il
-- détient déjà le code (canal privé). Un code invalide/expiré/déjà utilisé ne
-- révèle RIEN — `{ok:false}` sans détail, pour ne pas faire de ce RPC un oracle.
-- Le rate-limit d'`accept_invite` reste la barrière contre le balayage de codes.
--
-- Idempotent (RUNBOOK F-a) : rejouable deux fois sans erreur.

drop function if exists public.preview_invite(text);

create or replace function public.preview_invite(p_code text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inv record; v_prenom text; v_count int; v_created timestamptz;
begin
  -- Vivante = existe · pas expirée · pas encore consommée. Aucune fuite si non.
  select i.foyer_id into v_inv
    from public.invitations i
    where i.code = upper(trim(p_code))
      and i.accepted_by is null
      and i.expires_at > now();
  if v_inv.foyer_id is null then
    return jsonb_build_object('ok', false);
  end if;

  select m.prenom into v_prenom
    from public.membres m where m.foyer_id = v_inv.foyer_id and m.role = 'owner' limit 1;
  select count(*) into v_count from public.membres m where m.foyer_id = v_inv.foyer_id;
  select f.created_at into v_created from public.foyers f where f.id = v_inv.foyer_id;

  return jsonb_build_object(
    'ok', true,
    'prenom_fondateur', v_prenom,   -- peut être null : l'écran dira « cette maison »
    'nb_membres', v_count,
    'created_at', v_created
  );
end $$;

-- Appelé par un utilisateur CONNECTÉ qui saisit son code (l'Écran 1 précède le foyer).
revoke execute on function public.preview_invite(text) from public, anon;
grant  execute on function public.preview_invite(text) to authenticated;
