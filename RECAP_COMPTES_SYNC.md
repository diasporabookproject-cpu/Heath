# Récap « Comptes + Sync » — pour l'instance de contrôle qualité

> **À qui** : l'instance de revue/QA (rôle : audit, revue, brainstorm — **n'écrit pas de code**).
> **Quoi** : où en est le lot Comptes+Sync, ce qui est validé, ce qui reste, et **ce sur quoi
> j'aimerais ton regard** avant la passe de déploiement prod.
> **Branche** : `comptes-sync-v1` (13+2 commits au-dessus du merge Manzil `8992a3f`). **Non mergé en prod.**
> 2026-07-05.

---

## 1. Ce qui a été construit (S0→S7)

La dette **local-only → local-first synchronisé** est levée. L'app reste **100 % utilisable
sans compte** ; se connecter ajoute sauvegarde + multi-appareil + IA.

| Sous-lot | Contenu | Où |
|---|---|---|
| **S0** | Scaffolding migrations versionnées | `supabase/migrations/README.md` |
| **S1** | Schéma `foyers`/`membres`/`invitations`/`docs`/`ai_usage` + **RLS** + RPC `create_foyer` | `0001_*.sql` |
| **S2** | **Auth OTP** (code 6 chiffres) + **foyer paresseux** + compte (profil, déconnexion, **suppression** Apple 5.1.1(v)) + **Sentry** | `auth.ts`, `AccountSheet.tsx`, `sentry.ts`, `delete-account/` |
| **S3** | **Moteur de sync** : cœur **pur & testé** (`plan.ts`) — dirty par **hash de contenu**, **LWW** sur `updated_at` **serveur**, tombstones, **garde anti-écrasement G2**, **adoption** (union, cloud gagne sur collision) ; IO `engine.ts` (push **batché**/pull/adopt) ; wiring `useSync.ts` | `src/lib/sync/*` |
| **S4** | **Invitation 2ᵉ membre** (code partageable + rejoindre) — edge functions serveur | `invite/`, `accept-invite/` |
| **S5** | **Quota IA serveur** (100/mois/foyer, **atomique** via RPC, refund sur échec) — couture premium ① | `generate-recipe/` (gate) + `0004_*.sql` |
| **S6** | **Quitter le foyer** · tenancy `espaces.foyer_id` (**cascade** = suppr. foyer coupe les liens) · export JSON (S2) | `auth.ts`, `espace.ts`, `0002_*.sql` |
| **S3′** | **Sauvegarde audio** (bucket privé par foyer, upload best-effort + restore paresseux) | `sync/audio.ts` + `0003_*.sql` |
| **S7** | **Paquet RGPD** (politique FR gabarit, rétention, checklist, options PIN/expiration liens) | `RGPD.md` |

**Invariants tenus** : identité = compte Manzil (jamais un ID de store) ; tenancy = `foyer_id`
partout ; le **local reste la source** (offline), le cloud = miroir ; quota IA **jamais** dans la
sync (**G3**, vérité serveur) ; tout gratuit v1 mais **coutures premium côté serveur** (quota /
invitation / partage), gatables sans refonte.

## 2. Ce qui est validé (et comment)

- **Portes** : `typecheck` · **101 tests** (dont cœur `plan.ts` : dirty, LWW, tombstone, G2,
  `nextCursor`, adoption) · `build` · `smoke` Playwright — **verts**.
- **Bout-en-bout contre staging réel** (script 2 sessions, service_role, comptes nettoyés) :
  `create_foyer` idempotent · **push→pull** multi-session · `updated_at`/`updated_by` **serveur** ·
  **LWW** · **tombstone** · **isolation RLS** (foyer B voit 0 doc de A, refusé en écriture) → **9/9**.
- **Auth sur appareil** : préview Cloudflare `manzil-staging.pages.dev` → staging. Connexion +
  création de foyer OK (login par **lien** faute de SMTP ; le code 6 chiffres viendra avec le SMTP).
- **Edge functions déployées & gardées** sur staging (401 sans session) : `delete-account`,
  `generate-recipe` (quota), `invite`, `accept-invite`.

## 3. Revue qualité à froid → 10 findings → **tous corrigés**

J'ai lancé une **revue à 8 angles** (32 candidats → vérif → 10 retenus). Détail complet et
statuts dans **`REVUE_QUALITE_COMPTES_SYNC.md`**. Les 3 **P0** étaient de vrais bloquants prod
qu'une QA nominale ne voit pas (ils vivent dans les **transitions**) :

1. **Owner qui rejoint/quitte un foyer** → foyer orphelin + FK `owner_user_id` RESTRICT ⇒
   **suppression de compte cassée à jamais** (Apple 5.1.1(v)). → *Corrigé : cascade sur l'ancien
   foyer si seul membre, 409 sinon ; `delete-account` balaye aussi les foyers possédés.*
2. **`publishEspace`** écrivait `foyer_id` inconditionnellement ⇒ **casse toute publication en
   prod** tant que 0002 n'est pas jouée. → *Corrigé : retry sans la colonne + le flux Nounou tague aussi.*
3. **`emailRedirectTo`** avait perdu le base path `/Heath/` ⇒ **login prod 404** (invisible sur la
   préview Cloudflare servie à la racine — d'où le test staging vert). → *Corrigé : `origin + pathname`.*

Les 7 **P1** (intégrité sync) sont corrigés aussi : adoption réécrite (curseur **par foyer**,
échec **retenté**, push **gaté** pendant l'adoption, **rituel de consentement Q1** enfin
implémenté — feuille « Fusionner nos maisons » + export auto), signal de changement **générique**
(le doc Nounou se recharge au pull → plus de clobber), curseur jamais avancé au-delà d'un doc
sauté G2, quota **atomique** + refund sur throw, purge de l'état de sync à la suppression.

## 4. Ce qui reste — **passe de déploiement prod** (ordre CRITIQUE)

Rien n'est en prod. La prod = Manzil (UI) **sans** comptes. Pour activer Comptes+Sync en prod :

1. **Région Supabase prod** : confirmer UE (sinon migrer — cf. `DECISIONS` QA).
2. **Migrations, dans l'ordre** : `0001` (schéma) → `0004` (RPC quota) → `0002` (espaces
   cascade — **avant** de merger le client, sinon publication cassée) → `0003` (bucket audio).
   ⚠️ **`0002` = spécifique prod** (la table `espaces` n'existe qu'en prod) — à relire finement,
   notamment la **RLS auteur** laissée en TODO (ne pas casser la lecture publique par jeton).
3. **Edge functions** en prod : `delete-account`, `generate-recipe`, `invite`, `accept-invite` +
   secret `ANTHROPIC_API_KEY`.
4. **SMTP** (Resend) → le code 6 chiffres remplace le lien + lève le rate-limit e-mail.
5. **Redirect URLs** prod dans Supabase Auth.
6. **Merge** `comptes-sync-v1` → prod.
7. **QA appareil** d'Amine (2 comptes : invite, quitter, fusion, suppression, IA+quota).

## 5. Ce sur quoi j'aimerais ton regard (QA / revue)

- **`0002` espaces** : valider l'approche « colonne + cascade d'abord, RLS auteur ensuite après
  inspection de l'état RLS prod ». Est-ce le bon découpage ? Risque sur la lecture publique ?
- **Adoption « cloud gagne sur collision »** (Q1) : acceptable pour la v1 mono-éditeur ? Le
  **rituel de consentement** (feuille + export préalable) suffit-il comme filet ?
- **Suppression de compte** : on efface le cloud mais on **garde la copie locale** (l'app reste
  utilisable hors-ligne) + on purge l'état de sync pour ne pas re-téléverser en silence. Bonne
  posture RGPD, ou faut-il aussi proposer un effacement local explicite ?
- **Un foyer par utilisateur** (v1) : rejoindre un foyer **remplace** le sien. Le libellé UI et le
  comportement (données locales re-fusionnées) sont-ils assez clairs pour ne pas surprendre ?
- **Backlog P2** (non bloquant, dans la revue) : dédup `_shared/` edge + `fnError`, boucles
  `engine.ts`, `collectLocalDocs` multi-chargé par cycle, `ensureFoyer` à chaque ouverture du
  sheet, **révocation d'une invitation** côté owner (pas encore d'UI). Priorité selon toi ?
- **RGPD** (`RGPD.md`) : le gabarit couvre-t-il l'essentiel loi 09-08 + RGPD diaspora ? Manque-t-il
  un traitement / un sous-traitant / une durée de rétention ?

## 6. Pointeurs

- Revue détaillée + plan : `REVUE_QUALITE_COMPTES_SYNC.md`
- Décisions d'archi : `DECISIONS_STORE_V1.md` · Brief : `BRIEF_COMPTES_SYNC.md` · Chiffrage : `CHIFFRAGE_COMPTES_SYNC.md`
- RGPD : `RGPD.md` · Journal complet : `DEVLOG.md` (session 9 + entrées S0→S7 + passe FIX)
- Code sync : `src/lib/sync/{plan,engine,map,useSync,audio}.ts` · Edge : `supabase/functions/*` · Migrations : `supabase/migrations/*`
