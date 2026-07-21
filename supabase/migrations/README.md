# Migrations SQL

Toute évolution de schéma Supabase passe par un **fichier de migration versionné** ici,
**relu au read-back** du lot concerné, **appliqué après GO** — jamais de SQL manuel non tracé.

## Convention de nommage
```
NNNN_slug.sql
```
- `NNNN` = numéro croissant sur 4 chiffres = ordre d'application (`0001b` s'intercale : cas legacy).
- `slug` = objet du changement en kebab-case.
- Chaque fichier = **une intention** (un lot / un thème), pas un fourre-tout.
- **IDEMPOTENCE OBLIGATOIRE** (leçon E2, lot Environnements) : `create table if not exists`,
  **`drop policy if exists` + `create`** (jamais `create policy` nu), `create or replace function`,
  `add column if not exists`, `on conflict do nothing`, revoke/grant rejouables. Un fichier doit
  se REJOUER sans casse (rebuild staging) comme s'appliquer sur la prod où tout existe.

## État — appliquées STAGING + PROD (parité prouvée, `npm run parity:check`)
| Fichier | Lot | Contenu |
|---|---|---|
| `0001` | Comptes+Sync S1 | `foyers`/`membres`/`invitations`/`docs`/`ai_usage` + RLS + `create_foyer` |
| `0001b` | Environnements E1 | legacy pré-comptes reproduit : `espaces`, `espace_opens`, bucket `shared` (état PRÉ-0002) |
| `0002` | Comptes+Sync S6 | `espaces.foyer_id` on delete cascade + policies auteur |
| `0003` | Comptes+Sync S3′ | bucket privé `foyer-audio` + RLS storage |
| `0004` | FIX revue n°9 | RPC atomiques quota IA (`reserve_ai_usage`/`refund_ai_usage`) |
| `0005` | HOTFIX A1/A2 | lockdown RPC quota (service_role only) + `reserve_abuse_guard` |
| `0006` | AS-2 Fiche 3 | fermeture de la fuite d'isolation `espaces`/`espace_opens` (écriture = membres du foyer ; lecture publique par jeton PRÉSERVÉE) |
| `0007` | AS-2 Fiche 1 | RPC `accept_invite` transactionnel (anti-TOCTOU, **retourne un statut jsonb** — ne lève pas, sinon le rollback effacerait le compteur de rate-limit) |
| `0008` | AS-2 Fiche 2 | `membres.owner_notice` + `dispose_foyer_for_deletion` (transfert de propriété au plus ancien membre) |
| `0009` | AS-2b | `ack_owner_notice` (le client acquitte le bandeau — `membres` n'a pas de policy update) |


## Comment on applique
1. **Staging d'abord** (`tryjcednzencepokodrs`) : via l'**API Management** (`/database/query`,
   token `sbp_` jetable — protocole : annonce « je vais écrire », application, vérification
   catalogue, révocation du token) ou le SQL Editor. Rejouer = prouver l'idempotence.
2. **Parité** : `npm run parity:check` (7 aspects catalogue + edge functions) doit être vert.
3. **Prod** (`pqeilsuqglmrvijndrwa`) : même fichier, même protocole, après GO explicite.
4. Journaliser dans `DEVLOG.md` (date · fichier · env · preuves).

## Environnements
- **Staging** : reconstructible depuis le repo (migrations + `npm run seed:staging`) — voir
  `RUNBOOK_ENVIRONNEMENTS.md` (et ses 3 fragilités F-a/F-b/F-c).
- **Prod** : projet `Health`. Les clés publiques (URL + publishable) vivent dans la CI ;
  **jamais** la clé `service_role`/`secret` dans le repo.
