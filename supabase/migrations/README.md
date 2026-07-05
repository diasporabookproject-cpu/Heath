# Migrations SQL — Lot « Comptes + Sync »

Toute évolution de schéma Supabase passe par un **fichier de migration versionné** ici,
**relu au read-back** du sous-lot concerné, **appliqué après GO** — jamais de SQL manuel non tracé
(règle du `BRIEF_COMPTES_SYNC.md`).

## Convention de nommage
```
NNNN_slug.sql
```
- `NNNN` = numéro croissant sur 4 chiffres (`0001`, `0002`, …) = ordre d'application.
- `slug` = objet du changement en kebab-case (`0001_foyers-membres-rls`).
- **Idempotence encouragée** (`create table if not exists`, `create policy … ` gardé) pour rejouer sans casse en staging.
- Chaque fichier = **une intention** (un sous-lot / un thème), pas un fourre-tout.

## Ordre d'application (prévu, à confirmer sous-lot par sous-lot)
| Fichier | Sous-lot | Contenu |
|---|---|---|
| `0001_*` | S1 | `foyers`, `membres`, `invitations`, `docs`, `ai_usage` + RLS + index (tables neuves, s'applique sur staging vierge) |
| `0002_*` | S6/QB | `espaces.foyer_id` **on delete cascade** (suppr. foyer ⇒ liens morts) + policies auteur — contre la prod (table `espaces` préexistante) |
| `0003_*` | S3′ | bucket privé audio par foyer + policies storage |
| `0004_*` | FIX n°9 | **RPC atomiques quota IA** (`reserve_ai_usage`/`refund_ai_usage`) — à appliquer AVANT de redéployer `generate-recipe` |
| … | | (complété au fil des read-backs) |

## Comment on applique (staging d'abord, toujours)
1. **Staging** : coller le SQL dans *Supabase Dashboard → SQL Editor → Run*, **ou** `supabase db push`
   si le CLI est configuré. Vérifier + jouer les **tests RLS**.
2. **Prod** : seulement après validation staging + GO, même fichier, même ordre.
3. Journaliser dans `DEVLOG.md`, section **« migrations appliquées »** du sous-lot (date · fichier · env).

## Environnements
- **Staging** = 2ᵉ projet Supabase (bac à sable) — on y teste **avant** toute application prod.
- **Prod** = projet Heath actuel (`pqeilsuqglmrvijndrwa`).
- Région : traitée comme **setting** (à confirmer) ; cible **UE** pour toute donnée hébergée (RGPD, D8).
- Les clés `anon`/URL vivent dans la config CI ; **jamais** la clé `service_role` dans le repo.

> État : dossier initialisé (S0). Le premier fichier de migration (`0001`, schéma S1) arrive
> comme **artefact de read-back** — relu par Amine, appliqué en staging après GO.
