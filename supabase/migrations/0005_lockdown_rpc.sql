-- 0005_lockdown_rpc.sql
-- HOTFIX sécurité/coût (revue globale 2026-07-07, points A1 + A2, confirmés QA).
--
-- ⚠️ Appliquer en STAGING d'abord (SQL Editor / API Management), VÉRIFIER que la
-- génération IA authentifiée marche toujours (service_role garde l'exécution) ET
-- qu'un `refund_ai_usage` appelé en `authenticated` renvoie 403, PUIS prod.
-- ORDRE : ce SQL AVANT le redéploiement des edge functions `generate-recipe` /
-- `generate-translation` (qui appellent le nouveau `reserve_abuse_guard`).
--
-- Périmètre volontairement RESTREINT à 2 fonctions (+1 nouvelle). On NE touche PAS
-- `create_foyer` (appelée par le client en `authenticated` — la verrouiller tuerait
-- le login) ni `is_foyer_member`/`is_foyer_owner` (invoquées par les policies RLS —
-- les verrouiller casserait toutes les lectures client). Le spam `create_foyer` part
-- dans le lot Assainissement.

-- ── A1 : les RPC de quota ne sont appelables QUE par l'edge function (service_role).
-- Faille : Postgres accorde EXECUTE à PUBLIC par défaut → n'importe quel client
-- authentifié pouvait appeler `refund_ai_usage(foyer_libre, mois)` (remise à 0 de
-- SON foyer OU d'un AUTRE, le param `f` étant libre) ou `reserve_ai_usage(f, m, 10^9)`
-- (plafond bidon) → plafond IA totalement contournable.
-- NB : `revoke ... from public` retire l'accès à TOUS les rôles, service_role inclus.
-- On RE-grant donc explicitement service_role, sinon l'edge function (donc l'IA) tombe.
revoke execute on function public.reserve_ai_usage(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.refund_ai_usage(uuid, text)       from public, anon, authenticated;
grant  execute on function public.reserve_ai_usage(uuid, text, int) to service_role;
grant  execute on function public.refund_ai_usage(uuid, text)       to service_role;

-- ── A2 : garde anti-abus pour les relais LLM utilitaires (estimate/translate), qui
-- n'étaient plafonnés par RIEN et appelables sans session (relais Anthropic ouvert).
-- Réutilise la table `ai_usage` avec une clé de mois NAMESPACÉE ('abuse-YYYY-MM') :
-- INVISIBLE du quota produit (D5 — la traduction/estimation restent HORS du plafond
-- IA facturable). Plafond très haut (1000/mois/foyer, fixé côté edge) : hors d'atteinte
-- d'un usage humain même intense, ne sert qu'à stopper un script.
create or replace function public.reserve_abuse_guard(f uuid, m text, cap int)
  returns int language plpgsql security definer set search_path = public as $$
declare new_used int;
begin
  insert into public.ai_usage (foyer_id, month, used) values (f, m, 1)
  on conflict (foyer_id, month) do update
    set used = ai_usage.used + 1
    where ai_usage.used < cap
  returning used into new_used;
  return new_used; -- null si la clause where a filtré (plafond atteint ⇒ 429)
end $$;

-- Même verrouillage : appelable uniquement par l'edge function (service_role).
revoke execute on function public.reserve_abuse_guard(uuid, text, int) from public, anon, authenticated;
grant  execute on function public.reserve_abuse_guard(uuid, text, int) to service_role;
