# Read-back — AS-2 reste (Fiches 1, 2, 4 backend + AS-2b client)
### `READBACK_AS2_BACKEND.md` · 8 juillet 2026 · **à valider (pas de token)**

> Actualise le read-back AS-2 initial avec le **SQL/la séquence exacts** post-Fiche 3.
> Branche `as2-backend-v1` (depuis `as2-fiche3-v1`). Rien n'est exécuté avant validation + token.

## Découpage proposé — **AS-2a backend (1+2+4) → STOP → AS-2b client**
- **AS-2a** : SQL (RPC + colonne) + edge functions. Sensible → **dry-run staging puis fenêtre prod**
  (token). Ne casse **pas** le client actuel (interfaces préservées).
- **STOP**.
- **AS-2b** : client (bascule `acceptInvite`→RPC, bandeau owner, copie de confirmation). **Sans
  token** (part par merge → Pages). Doit venir **après** AS-2a (le client appelle le nouveau RPC).

---

## Fiche 1 — `accept_invite` transactionnel (fin du TOCTOU + delete-avant-insert)
**Aujourd'hui** l'edge function `accept-invite` fait N requêtes non atomiques (check `accepted_by`
puis update = TOCTOU ; supprime l'ancien foyer **avant** d'insérer la nouvelle adhésion).
**Fix** : **un seul RPC transactionnel**, appelé **directement par le client** (`authenticated`),
`security definer` mais **strictement scopé à `auth.uid()`** (comme `create_foyer`). L'edge function
`accept-invite` devient inutile (undéployée en AS-2b).

```sql
-- 0007_accept_invite_rpc.sql (Fiche 1 + rate-limit Fiche 4)
create or replace function public.accept_invite(p_code text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv record; v_cur record; v_count int; v_myf uuid;
begin
  if v_uid is null then raise exception 'auth requise'; end if;

  -- RATE-LIMIT (Fiche 4) : max 5 tentatives / heure, sur le foyer actuel de l'appelant.
  select foyer_id into v_myf from public.membres where user_id = v_uid limit 1;
  if v_myf is not null
     and public.reserve_abuse_guard(v_myf, 'iaccept-'||to_char(now(),'YYYY-MM-DD-HH24'), 5) is null
  then raise exception 'Trop de tentatives, réessaie dans une heure.'; end if;

  -- VERROU sur l'invitation (fin du TOCTOU).
  select id, foyer_id, expires_at, accepted_by into v_inv
    from public.invitations where code = upper(trim(p_code)) for update;
  if v_inv.id is null           then raise exception 'Code inconnu.'; end if;
  if v_inv.accepted_by is not null then raise exception 'Invitation déjà utilisée.'; end if;
  if v_inv.expires_at < now()   then raise exception 'Invitation expirée.'; end if;

  -- déjà membre de ce foyer → idempotent
  if exists (select 1 from public.membres where user_id=v_uid and foyer_id=v_inv.foyer_id) then
    update public.invitations set accepted_by=v_uid where id=v_inv.id;
    return v_inv.foyer_id;
  end if;

  -- quitter le foyer actuel (invariant un-foyer-par-user) — APRÈS avoir validé l'invitation
  for v_cur in select foyer_id, role from public.membres where user_id=v_uid loop
    if v_cur.role='owner' then
      select count(*) into v_count from public.membres where foyer_id=v_cur.foyer_id;
      if v_count > 1 then
        raise exception 'Ton foyer a d''autres membres — retire-les avant de rejoindre un autre foyer.';
      end if;
      delete from public.foyers where id=v_cur.foyer_id;   -- seul membre → cascade
    end if;
  end loop;
  delete from public.membres where user_id=v_uid;
  insert into public.membres (foyer_id, user_id, role) values (v_inv.foyer_id, v_uid, 'membre');
  update public.invitations set accepted_by=v_uid where id=v_inv.id;
  return v_inv.foyer_id;
end $$;
revoke execute on function public.accept_invite(text) from public, anon;
grant  execute on function public.accept_invite(text) to authenticated;   -- appelé par le client
```
*Note* : toute la logique destructrice (quitter/supprimer) vit **après** la validation, **dans la
même transaction** que l'insertion — plus de fenêtre « ancien foyer perdu sans nouveau ».

## Fiche 2 — `deleteAccount` owner : transfert de propriété (pas de destruction)
**Aujourd'hui** un owner qui supprime son compte **détruit le foyer partagé**. **Fix** (décision ①) :
owner **seul** → suppression (inchangé) ; owner **avec d'autres membres** → **transfert** au **plus
ancien autre membre** (promu owner, `owner_notice=true`), puis retrait du partant. Transactionnel
via un RPC appelé par l'edge `delete-account` (service_role).

```sql
-- 0008_owner_transfer.sql (Fiche 2)
alter table public.membres add column if not exists owner_notice boolean not null default false;

create or replace function public.dispose_foyer_for_deletion(p_uid uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_foyer uuid; v_role text; v_count int; v_new uuid;
begin
  for v_foyer, v_role in select foyer_id, role from public.membres where user_id=p_uid loop
    if v_role='owner' then
      select count(*) into v_count from public.membres where foyer_id=v_foyer;
      if v_count = 1 then
        delete from public.foyers where id=v_foyer;                    -- seul → cascade
      else
        select user_id into v_new from public.membres
          where foyer_id=v_foyer and user_id<>p_uid order by created_at asc limit 1;
        update public.membres set role='owner', owner_notice=true
          where foyer_id=v_foyer and user_id=v_new;                    -- transfert + notif
        update public.foyers set owner_user_id=v_new where id=v_foyer; -- lève la FK RESTRICT
        delete from public.membres where foyer_id=v_foyer and user_id=p_uid;
      end if;
    else
      delete from public.membres where foyer_id=v_foyer and user_id=p_uid;
    end if;
  end loop;
end $$;
revoke execute on function public.dispose_foyer_for_deletion(uuid) from public, anon, authenticated;
grant  execute on function public.dispose_foyer_for_deletion(uuid) to service_role;
```
**Edge `delete-account`** : remplacer la boucle actuelle par un appel unique
`admin.rpc('dispose_foyer_for_deletion', { p_uid: uid })` **avant** `deleteUser(uid)` ; garder le
balayage orphelins existant. *(Le foyer transféré et son contenu **restent** pour les autres ; la
copie locale du partant reste sur son appareil.)*

## Fiche 4 — invitation : entropie + rate-limit
- **Entropie** (`invite` edge, `makeCode`) : le `byte % 31` a un **biais modulo** → **rejection
  sampling** (rejeter les octets ≥ 248) + **10 signes** (au lieu de 8). Pur code, pas de migration.
- **Cap 5 invitations actives / foyer** (`invite` edge) : avant l'insert,
  `select count(*) from invitations where foyer_id=<f> and accepted_by is null and expires_at>now()`
  ; si **≥ 5** → refus `429`.
- **Rate-limit 5 acceptations / h** : **déjà dans le RPC `accept_invite`** ci-dessus (Fiche 1),
  via `reserve_abuse_guard` (clé horaire `iaccept-YYYY-MM-DD-HH`, cap 5).

## AS-2b — client (après AS-2a, sans token)
1. **`auth.ts` `acceptInvite`** : `functions.invoke('accept-invite')` → **`rpc('accept_invite',{p_code})`**.
   (Le flux `confirmedJoin` d'`AccountSheet` — pull+export avant — est **inchangé**.)
2. **Bandeau nouveau propriétaire** : au chargement, lire `owner_notice` du membre courant ; si
   `true`, afficher un bandeau qui **explicite la responsabilité héritée** (pas « tu es
   propriétaire » cosmétique) — p.ex. *« On t'a confié la responsabilité de ce foyer. C'est toi
   qui le gères désormais — et toi seule peux le supprimer. »* Puis **effacer** le flag
   (`update membres set owner_notice=false where user_id=me`).
3. **Copie de confirmation `deleteAccount`** (`AccountSheet`) : rendre le transfert explicite —
   *« Si ton foyer a d'autres membres, sa propriété (et son contenu) leur est transférée ; sinon
   il est supprimé. Ton compte est effacé ; ta copie locale reste sur cet appareil. »*
4. Après AS-2b en prod : l'edge `accept-invite` est **morte** → undéploiement (nettoyage optionnel).

> **Nommage** : le bandeau et la confirmation restent **génériques** (pas de nom du membre) — nommer
> exigerait d'exposer l'identité/e-mail d'un co-membre côté client (RLS ne l'expose pas). La copie
> reste **exacte** sans nommer. *(À confirmer : OK générique, ou tu veux nommer → décision RLS ?)*

---

## Séquence & points d'intervention
**AS-2a** :
1. J'écris les 2 migrations + les 3 edge functions (repo, sans token).
2. **Dry-run STAGING** (token 1) : appliquer 0007/0008, déployer `invite`/`delete-account`, **prouver**
   sur les comptes seedés — accept transactionnel (code réutilisé refusé, expiré refusé), transfert
   (créer un 2ᵉ membre, supprimer l'owner → l'autre devient owner + `owner_notice`), cap 5, rate-limit.
   → **STOP**, je te montre les preuves.
3. **Fenêtre PROD** (token 2, **go explicite avant écriture**) : appliquer 0007/0008 + déployer les 2
   edge functions. (Pas de lecture publique touchée ; pas de snapshot anon nécessaire — périmètre
   interne comptes/invitations.) Token révoqué après.

**AS-2b** : je code + portes (typecheck/tests/build/smokes) → merge → Pages. **Aucun token.**

**Ce qui exige le token** : AS-2a uniquement (staging dry-run + fenêtre prod). AS-2b : aucun.

## Décisions à confirmer
1. **Découpage AS-2a (1+2+4) → STOP → AS-2b** : OK ?
2. **`accept_invite` appelé en direct par le client** (RPC `authenticated`, edge `accept-invite`
   retirée en AS-2b) plutôt que via edge function : OK ? *(plus simple, atomique, moins de code)*
3. **Copie bandeau/confirmation générique** (sans nommer le membre) : OK, ou on nomme (→ décision RLS) ?
4. **Rate-limit** via `reserve_abuse_guard` clé horaire sur le foyer de l'appelant : OK ?
