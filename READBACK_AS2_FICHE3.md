# Read-back AS-2 Fiche 3 — Fermer la fuite d'isolation `espaces` / `espace_opens`
### `READBACK_AS2_FICHE3.md` · 8 juillet 2026 · **VALIDÉ**

> **Première écriture prod post-lot Environnements.** Ferme la fuite d'isolation inter-foyers
> (E0). Branche `as2-fiche3-v1` (depuis `envs-propres-v1`). Migration `0006_espaces_close_write.sql`.
> **Répétition à blanc sur staging d'abord**, puis prod **fenêtre d'écriture explicite avec go**.

---

## 1. Fermeture (migration `0006`) — invariant lecture publique préservé
Voir `supabase/migrations/0006_espaces_close_write.sql`. En clair :
- **`espaces` insert/update/delete** → `foyer_id is not null and is_foyer_member(foyer_id)`
  (écriture réservée aux membres du foyer propriétaire).
- **`espace_opens read auth`** → membre du foyer propriétaire du jeton (fin du `using(true)`).
- **`espaces read public`** → **NON touchée** (lecture par jeton, anon) = **invariant**.
- **`espace_opens insert anon`** → **NON touchée** (accusé écrit sans session ; nuisance mineure assumée).
- L'app publie/révoque avec `foyer_id = currentFoyerId()` → inchangée. Seul l'inter-foyers est bloqué.

**Conséquence legacy** — espaces `foyer_id NULL` deviennent non-écrivables par le client.
**Décision (b) « le chiffre décide »** : au snapshot prod (avant bascule) je **compte** les espaces
`foyer_id NULL` actifs. **0 → bascule directe** ; **> 0 → je te montre le compte, décision au cas par
cas** (backfill d'un foyer si une page doit rester révocable) **avant** d'appliquer. Jamais à l'aveugle.

## 2. Répétition à blanc — STAGING (token staging, révoqué après)
1. Appliquer `0006` sur staging.
2. **Lien anonyme toujours 200** (clé anon, sans session) sur `seed-espace-public-001` → invariant tient.
3. **Preuve d'isolation** (RLS simulée via `set local role authenticated` + `set local request.jwt.claims`) :
   - membre (uid smoke) : `update espaces … where token='seed-espace-public-001'` → **1 ligne** (OK).
   - 2ᵉ compte de test (créé pour l'occasion) : même update → **0 ligne** (refusé) ; insert sur le foyer
     d'autrui → **refusé** ; lecture `espace_opens` du jeton du foyer 1 → **refusé** (membre → OK).
4. → **STOP** : je te montre les preuves (isolation + anon 200) avant toute écriture prod.

## 3. Protocole PROD — fenêtre d'écriture explicite (préavis + **go** avant écriture)
1. **Snapshot AVANT** : `pg_policies` de `espaces`+`espace_opens` (défs exactes = référence rollback,
   je te les colle) **+ compte des espaces `foyer_id NULL` actifs** (décision §1).
2. **Test lien anonyme AVANT** → 200 (référence).
3. **Je confirme « je vais écrire en prod » → j'attends ton GO.**
4. **Bascule** : appliquer `0006` en prod.
5. **Test lien anonyme APRÈS** → **200** = **critère de fini** (lecture publique intacte).
6. **Vérif** `pg_policies` : nouvelles défs (écriture scopée, `espace_opens read` scopé).
7. **Drop `*_bak`** (même fenêtre) : `drop table if exists public.espaces_bak_20260705,
   public.espace_opens_bak_20260705;`
8. **Rollback prêt** : `0006` = `drop+create` → inverse = re-créer les policies **ouvertes** depuis le
   snapshot §1 (SQL gardé prêt à coller). Anomalie / lien anonyme cassé → rollback immédiat.

## 4. Tokens & séquencement
- **Token 1 (staging)** : répétition §2 → STOP (preuves).
- **Token 2 (prod)** : sur ta validation, fenêtre §3 avec **go explicite** avant la bascule. Drop
  `*_bak` dans la foulée. Révoqué après.

## 5. Après la Fiche 3
Reste d'AS-2 : **Fiche 1** (`accept-invite` RPC transactionnel/TOCTOU), **Fiche 2** (`deleteAccount`
owner transfert + `membres.owner_notice`), **Fiche 4** (entropie + rate-limit invitation), **AS-2b**
(client : bandeau owner + confirmation). Sur staging reconstruit d'abord, prod ensuite.
