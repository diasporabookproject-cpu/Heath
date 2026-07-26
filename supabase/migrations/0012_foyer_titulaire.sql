-- 0012_foyer_titulaire.sql — Lot « Identité & accès », Phase 1 (ADR 33).
--
-- CHANGEMENT DE DOCTRINE, assumé par le PO en connaissance de cause :
-- le foyer est **adossé à un TITULAIRE**, il ne lui survit pas.
-- Quand le fondateur supprime son compte, le foyer s'arrête pour TOUS ses
-- dépendants : membres retirés, contenu supprimé (cascade), pages partagées mortes.
--
-- ⚠️ CETTE MIGRATION RENVERSE `0008_owner_transfer` (AS-2 Fiche 2), qui posait
-- l'inverse : un foyer partagé survivait à son fondateur, la propriété étant
-- TRANSFÉRÉE au plus ancien membre. La contestation (« le fondateur détruit les
-- données d'un tiers ») a été posée au read-back et tranchée : le titulaire du
-- compte est le payeur, c'est le modèle du forfait familial. La mitigation vit à
-- l'écran : l'avertissement nomme les dépendants (« Sofia perd l'accès ») et
-- propose l'export juste avant.
--
-- 🔴 PORTÉE, à ne pas déborder (ADR 33) : cette règle couvre la suppression
-- VOLONTAIRE du compte. Elle ne couvre PAS un futur défaut de paiement — le churn
-- devra SUSPENDRE, jamais détruire. Ne pas réutiliser ce chemin pour le billing.
--
-- NON RÉTROACTIVE : un utilisateur ayant déjà hérité d'un foyer sous 0008 le garde.
--
-- Idempotent (RUNBOOK F-a) : rejouable deux fois sans erreur.

-- ── ① La disposition du foyer à la suppression de compte ─────────────────────
-- Owner (seul OU avec membres) → suppression du foyer : la cascade emporte
-- `membres`, `docs`, `espaces` (donc les pages partagées) et `invitations`.
-- Membre simple → retrait, le foyer d'autrui n'est jamais touché.
create or replace function public.dispose_foyer_for_deletion(p_uid uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_foyer uuid; v_role text;
begin
  for v_foyer, v_role in select foyer_id, role from public.membres where user_id=p_uid loop
    if v_role='owner' then
      -- Le titulaire s'en va : le foyer s'arrête pour tout le monde (cascade).
      -- Plus de promotion, plus de transfert — c'est le renversement de 0008.
      delete from public.foyers where id=v_foyer;
    else
      delete from public.membres where foyer_id=v_foyer and user_id=p_uid;
    end if;
  end loop;
end $$;

revoke execute on function public.dispose_foyer_for_deletion(uuid) from public, anon, authenticated;
-- Appelée UNIQUEMENT par l'edge `delete-account` en service_role (jamais le client).

-- ── ② La machinerie d'héritage n'a plus d'objet ──────────────────────────────
-- `owner_notice` (0008) signalait au membre PROMU qu'il héritait ; `ack_owner_notice`
-- (0009) effaçait le drapeau. Sans promotion, les deux sont morts. Le client cesse
-- de les appeler dans la même tranche (`checkOwnerNotice`/`ackOwnerNotice`).
drop function if exists public.ack_owner_notice();
alter table public.membres drop column if exists owner_notice;
