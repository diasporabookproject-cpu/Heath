-- 0004_ai_usage_rpc.sql
-- FIX revue Q n°9 — réservation ATOMIQUE du quota IA (plus de read-modify-write
-- en 3 requêtes : une course au double-tap ne sous-compte plus, et on ne peut
-- plus dépasser le plafond). Appelées par l'edge function en service_role.
--
-- ⚠️ À appliquer en STAGING (SQL Editor) AVANT de redéployer `generate-recipe`,
-- puis en PROD à la passe prod (même ordre : SQL d'abord, fonction ensuite).

-- Réserve 1 génération pour (foyer, mois) sous le plafond `cap`.
-- Renvoie le compteur après réservation, ou NULL si plafond atteint (⇒ 429).
create or replace function public.reserve_ai_usage(f uuid, m text, cap int)
  returns int language plpgsql security definer set search_path = public as $$
declare new_used int;
begin
  insert into public.ai_usage (foyer_id, month, used) values (f, m, 1)
  on conflict (foyer_id, month) do update
    set used = ai_usage.used + 1
    where ai_usage.used < cap
  returning used into new_used;
  return new_used; -- null si la clause where a filtré (plafond atteint)
end $$;

-- Rembourse 1 génération (échec de l'appel Anthropic : on ne fait pas payer un échec).
create or replace function public.refund_ai_usage(f uuid, m text)
  returns void language sql security definer set search_path = public as $$
  update public.ai_usage set used = greatest(used - 1, 0)
  where foyer_id = f and month = m;
$$;
