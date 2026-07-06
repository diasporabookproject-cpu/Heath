# Rapport de déploiement PROD — Comptes+Sync (pour l'instance QA)

> **À** : instance de contrôle/QA. **De** : l'implémenteur (Claude Code).
> **Objet** : compte-rendu de la passe de mise en production du lot Comptes+Sync, mappé sur ton
> plan (§3 de `RESTITUTION_A1_ET_PLAN_PROD.md`), avec **preuves**, **déviations assumées** et
> **ce qui reste**. Prod = projet Supabase `pqeilsuqglmrvijndrwa` (« Health ») + GitHub Pages `/Heath/`.
> Merge prod : **`e21d0ec`** · 2026-07-05.

## 0. Statut

**Le lot est EN PRODUCTION.** Backend (migrations + edge functions) et client (merge) déployés
et vérifiés. **1 déviation à connaître** (pas de smoke authentifié bout-en-bout sur prod avant
merge — expliqué §3) et **1 prérequis non bloquant restant** (SMTP). Aucune régression détectée
sur l'existant (les 4 liens `#e=` familles répondent toujours).

## 1. A1 corrigé (rappel) — ce que tu voulais re-auditer

`comptes-sync-v1 @ d3bf4bf` : « Rejoindre un foyer » fait maintenant, **avant** `acceptInvite** :
**① pull final** (rapatrie les docs cloud-only) → **② export JSON auto** → **③ écran de
consentement explicite** (« ton foyer actuel et sa **sauvegarde en ligne seront supprimés**… une
copie a été téléchargée »). A2 (libellé Quitter + suppression cloud) et A3 (TTL invitation **72 h**,
`invite` v2) faits ; A4 (RGPD : Resend au SMTP, Sentry 30 j, UE confirmée) fait. Le helper
pull+export est **IO** (Supabase + IndexedDB + download) → non extractible en test pur, laissé
inline dans `confirmedJoin`. Portes : typecheck · **101 tests** · build · smoke — verts.

## 2. Passe prod — mappée sur ton plan §3 (avec preuves)

| # (ton plan) | Fait | Preuve |
|---|---|---|
| 1. Région UE | ✅ | confirmée par Amine |
| 2. **Backup avant migration** | ✅ | `espaces_bak_20260705` (**4**) + `espace_opens_bak_20260705` (**66**) créées ; policies `espaces` snapshotées |
| 3. Migrations **0001→0004→0002→0003** | ✅ | 5 tables créées ; 4 RPC présents (`create_foyer`, `is_foyer_member`, `reserve_ai_usage`, `refund_ai_usage`) ; bucket `foyer-audio` (privé) |
| 3-bis. **Snapshot policies avant 0002** | ✅ | `espaces read public (anon, using true)` capturée avant |
| 3-ter. **Test `#e=` anonyme après 0002** | ✅ | lecture anonyme d'un **jeton réel** : **HTTP 200** avant ET après 0002 ; `foyer_id` null sur les liens existants (restent publics) |
| 4. Edge functions prod + secret | ✅ | `delete-account` v1 · `invite` v1 · `accept-invite` v1 · **`generate-recipe` v10** — toutes **401 sans session** ; `ANTHROPIC_API_KEY` prod **inchangé** (déjà présent) |
| 5. **SMTP Resend** | ⏳ **non fait** | login par **lien** en attendant (voir §4) |
| 6. Redirect URLs prod | ✅ | Site URL + allow-list = `https://diasporabookproject-cpu.github.io/Heath/` (déjà correct ; le fix P0-3 `origin+pathname` y renvoie) |
| 7. **Smoke prod authentifié pré-merge** | ⚠️ **partiel** — voir §3 | vérifs API des chemins (RPC gardés, tables, lecture publique) ✅, mais **pas** de cycle login→push→pull→publier→supprimer avec compte jetable |
| 8. Merge `comptes-sync-v1`→prod | ✅ | `e21d0ec` ; Pages **run #87 vert** ; prod en ligne (HTTP 200) |
| 9. QA appareil + Sentry watch | ⏳ **à faire (Amine)** | — |

## 3. Déviations assumées (à ton attention)

1. **Ordre `generate-recipe`** — déployée **APRÈS** le merge du client (pas avec les 3 autres).
   *Pourquoi* : la fonction prod existante (v9, sans quota) servait l'IA aux sessions
   magic-link existantes ; déployer la version **gate-quota** (exige foyer) **avant** que le
   nouveau client (qui crée le foyer via `ensureFoyer`) soit live aurait cassé l'IA. Séquence
   retenue : migrations → 3 fonctions inoffensives → **merge client (live)** → **puis**
   `generate-recipe` v10. Fenêtre de casse : uniquement d'anciens clients **encore en cache SW**
   **et** connectés **et** utilisant l'IA — population ≈ nulle, auto-réparée au rechargement.
2. **Pas de smoke authentifié bout-en-bout sur prod avant merge (ton point 7)** — je n'ai **pas**
   de `service_role` **prod**, et l'OTP réel est rate-limité (pas de SMTP). J'ai donc validé les
   **plombiers** (RPC présents + gardés, tables, lecture publique préservée, functions 401) mais
   **pas** un cycle authentifié complet en prod. **→ C'est le trou ; la QA appareil d'Amine (point 9)
   doit le couvrir en priorité** (login → foyer → push/pull → publier → lien anonyme → supprimer).
3. **Merge avant ta QA staging (Étape 2 Q1–Q10)** — décision d'Amine (« avance, déploie »), même
   posture que le merge Manzil. Les comptes sont **opt-in/additifs** : les utilisateurs local-first
   existants ne voient aucun changement. Le risque est donc contenu, mais **Q1–Q10 restent à jouer**
   (sur prod maintenant, ou staging) pour valider les parcours connectés.

## 4. Ce qui reste (non bloquant pour l'existant, requis avant lancement large)

- **SMTP Resend** (ton §5 + A4) : sans lui, e-mail = **lien** (pas le code 6 chiffres) **et**
  rate-limit Supabase (~quelques/h) → OK pour tester, **pas** pour ouvrir en grand. À tester
  **sur staging d'abord** (ton exigence). Login par lien fonctionne d'ici là.
- **QA appareil réelle** (2 comptes, Q1–Q10 en conditions vraies) + **Sentry sous surveillance**.
- **Rétention Sentry → 30 j** (A4).
- **Dropper `*_bak_20260705`** après quelques jours de stabilité.
- **RLS auteur `espaces`** (lister/révoquer) : toujours différée (0002 = colonne+cascade seul).
  La **révocation par suppression de foyer** fonctionne (cascade) ; l'UI de révocation par lien
  reste backlog P2.

## 5. Ce sur quoi j'aimerais ton regard

- **Le trou du smoke authentifié prod (§3-2)** : es-tu d'accord que la **QA appareil** le couvre,
  ou veux-tu que je monte un moyen de smoke authentifié automatisé sur prod (nécessiterait le
  `service_role` prod, ou un compte de test + OTP via le futur SMTP) ?
- **Fenêtre PWA/`generate-recipe` (§3-1)** : acceptable, ou faut-il un garde (ex. la fonction
  tolère l'absence de foyer en repli gratuit pendant la transition) ?
- **Priorité SMTP vs Coquille** : tu recommandais APK Android debug d'abord (Étape 4). Vu qu'on
  est en prod web, je pencherais pour **SMTP d'abord** (débloque le vrai onboarding e-mail) puis
  Coquille. Ton avis ?

## 6. Rollback (si besoin)

- Client : tag **`pre-comptes-sync`** (`0bd5863`) ou `git revert -m 1 e21d0ec` (sans force-push).
- Données : backups `espaces_bak_20260705` / `espace_opens_bak_20260705` en base. Les nouvelles
  tables (foyers/membres/docs/…) sont additives — les laisser ne casse rien si on revient au
  client d'avant (il ne les lit pas).
