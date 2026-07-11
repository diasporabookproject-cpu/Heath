# Rapport d'écart environnements — E0 (inventaire, lecture seule)
### `RAPPORT_ECART_ENVS.md` · lot « Environnements propres » · 8 juillet 2026

> **Méthode** : lectures catalogue via API Management sur **staging** (`tryjcednzencepokodrs`,
> manzil-staging) et **prod** (`pqeilsuqglmrvijndrwa`, Health). **Zéro écriture** — prod en
> lecture seule (principe du lot). Token E0 révocable **dès maintenant** (inventaire terminé).

---

## 0. Verdict

**Le cœur est en PARITÉ TOTALE.** Tout ce qui vient des migrations 0001/0004/0005 est **identique**
staging↔prod, y compris les **`proacl` des RPC** (→ le **hotfix A1 est prouvé verrouillé des deux
côtés**). F1 aussi est cohérent (SMTP Resend + OTP 6 chiffres + rate-limit 30 partout).

**La divergence = le legacy pré-comptes (prod-only) + 2 surprises** : des tables de **backup
oubliées** et un **bucket `shared` hors-migration**. Rien d'alarmant, tout est récupérable en E1.

---

## 1. Tableau objet par objet

Décision : **migrer** (migration rétro idempotente, E1) · **checklist** (`CONFIG_CHECKLIST`) ·
**drop** (cruft — écriture prod, **différée hors de ce lot**) · **repo** (déjà versionné).

### Schéma `public` — tables & RLS
| Objet | Prod | Staging | Versionné | Décision |
|---|---|---|---|---|
| `foyers`, `membres`, `invitations`, `docs`, `ai_usage` (+colonnes, RLS, policies) | ✅ | ✅ | 0001/0004 | **repo — parité ✓** |
| `espaces` (token, payload, owner, updated_at, **foyer_id**) + RLS | ✅ | ❌ | ⚠️ non (0002 ne fait qu'`alter`) | **migrer** (legacy) |
| `espace_opens` (id, token, opened_at) + RLS | ✅ | ❌ | ❌ non | **migrer** (legacy) |
| `espaces_bak_20260705` (4 lignes) | ✅ | ❌ | ❌ | **drop** (cruft, snapshot du 05/07) |
| `espace_opens_bak_20260705` (66 lignes) | ✅ | ❌ | ❌ | **drop** (cruft) |

### Policies (détail des legacy à reproduire tel quel — Fiche 3 les durcira **plus tard**)
| Policy (prod) | cmd / rôles | using / check | Décision |
|---|---|---|---|
| `espaces read public` | SELECT anon+auth | using **true** | migrer (lecture publique par jeton — **à garder intacte**) |
| `espaces insert auth` | INSERT auth | check **true** | migrer AS-IS ⚠️ **écriture ouverte** (n'importe quel authentifié) → **Fiche 3** ferme |
| `espaces update auth` | UPDATE auth | using+check **true** | migrer AS-IS ⚠️ idem (peut modifier l'espace d'un autre foyer) |
| `espaces delete auth` | DELETE auth | using **true** | migrer AS-IS ⚠️ idem |
| `espace_opens insert anon` | INSERT anon+auth | check true | migrer (best-effort) |
| `espace_opens read auth` | SELECT auth | using **true** | migrer AS-IS ⚠️ **fuite** : tout authentifié lit tous les jetons → peut moissonner et lire les pages publiées d'autres foyers → **Fiche 3 / durcissement** |

> ⚠️ Ces `using/check = true` sont les **vulnérabilités connues** (écriture espaces ouverte,
> énumération `espace_opens`). **Ce lot les REPRODUIT à l'identique** (il ne change pas le
> comportement) ; leur **fermeture est le cœur de la Fiche 3 d'AS-2**, sur le staging reconstruit
> puis en prod. Documenté ici pour que le lien soit explicite.

### Storage (buckets & policies)
| Objet | Prod | Staging | Versionné | Décision |
|---|---|---|---|---|
| bucket `foyer-audio` (privé) + 4 policies (CRUD scopées `is_foyer_member`) | ✅ | ❌ | ✅ 0003 | **migrer** — 0003 existe, **absent de staging** (rejoué en E2) |
| bucket `shared` (**public=true**) + policy `shared write authenticated` (INSERT check `bucket_id='shared'`) | ✅ | ❌ | ❌ non | **migrer** (legacy hors-migration — notes vocales publiées) ⚠️ écriture ouverte à tout authentifié (reproduire, noter) |

### Fonctions & triggers
| Objet | Parité | Note |
|---|---|---|
| 7 fonctions `public` (`create_foyer`, `is_foyer_member`, `is_foyer_owner`, `touch_updated_at`, `reserve_ai_usage`, `refund_ai_usage`, `reserve_abuse_guard`) + **`proacl`** | ✅ **identique** | **hotfix A1 prouvé des deux côtés** |
| trigger `docs_touch` | ✅ identique | — |

### Edge functions (`+ verify_jwt`)
| Fonction | Prod | Staging | Décision |
|---|---|---|---|
| `generate-recipe` | v11 · verify_jwt **false** | v3 · verify_jwt **false** | code aligné (hotfix), **redéployer depuis repo en E2** (versionne le n°) |
| `generate-translation` | v2 · verify_jwt **false** | ❌ **absente** | **déployer en E2** (divergence) |
| `invite`, `accept-invite`, `delete-account` | v1 · verify_jwt true | v2/v3 · verify_jwt true | redéployer depuis repo en E2 (n° cosmétiques) |

> `verify_jwt` **est diffable** (lisible ici) : cohérent là où les fonctions existent des deux côtés.

### Config Auth (majoritairement en parité — reste = `CONFIG_CHECKLIST`)
| Réglage | Prod | Staging | Décision |
|---|---|---|---|
| SMTP (host/sender/pass posé) | Resend · `login@send.elysia.studio` · set ✅ | idem · set ✅ | **checklist** (secret « testé par l'effet ») |
| OTP length / exp | 6 / 3600 | 6 / 3600 | checklist (length 6 ✓ ; exp 3600 — on visait 600, **cohérent** au moins) |
| rate_limit_email_sent | 30 | 30 | ✓ |
| `smtp_sender_name` | `Manzil` | `loginstaging` | checklist (cosmétique, à normaliser) |
| `site_url` / `uri_allow_list` | `…github.io/Heath/` | `…pages.dev` | **testé autrement / base-path** (asymétrie d'hébergement → C4) ; prod allow_list **sans `**`** (noter) |
| templates email (`{{ .Token }}`) | non lisible en SQL | — | **testé par réception réelle** (F1) |

---

## 2. Objets hors-système trouvés (au-delà d'`espaces`, comme demandé)
- **`espace_opens`** (+ 2 policies) — legacy, prod-only.
- **bucket `shared`** (public) **+ policy `shared write authenticated`** — legacy hors-migration.
- **`espaces_bak_20260705` / `espace_opens_bak_20260705`** — **cruft** (snapshots du 05/07, mêmes
  comptes que le live) → à **dropper** (écriture prod → **hors de ce lot**).
- **Aucune** fonction orpheline ni policy orpheline sur les tables cœur (parité).

## 3. Décisions pour E1 (à valider au STOP)
1. **`000X_espaces_legacy.sql`** (idempotent, `drop policy if exists`+`create` en transaction) :
   table `espaces` (+`foyer_id`, = état prod avec 0002) + ses 4 policies **AS-IS** ; table
   `espace_opens` + ses 2 policies AS-IS ; bucket `shared` (public) + policy `shared write` ;
   RLS enable. → rejouable sur prod (existe) comme staging (n'existe pas).
2. **0003** (foyer-audio) : déjà versionné → **rien à écrire**, juste s'assurer qu'il est rejoué en E2.
3. **`*_bak`** : **non migrées**. Leur DROP est **rattaché explicitement à la fenêtre d'écriture
   prod de la Fiche 3 d'AS-2** — le drop des `espaces_bak_20260705` / `espace_opens_bak_20260705`
   se fera **dans la même session prod** que la fermeture des policies `espaces`. (Pas un item de
   backlog flottant : il vit dans le plan de la Fiche 3.)
4. **`generate-translation`** : sa source est déjà dans le repo → **déployée en E2** (pas une migration).
5. **`CONFIG_CHECKLIST.md`** / **`SECRETS.md`** : capturent SMTP, templates, URLs, OTP, sender_name,
   verify_jwt, secrets requis (noms).

---
**Statut E0 : terminé, zéro écriture.** Token révocable. **STOP** — on valide les décisions §3
avant d'écrire quoi que ce soit (E1).
