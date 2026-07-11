# Checklist de configuration Supabase (par environnement)
### `supabase/CONFIG_CHECKLIST.md` · lot « Environnements propres » (E1)

> Ce que Supabase **ne permet pas de versionner** (réglages dashboard) mais qui fait partie
> de la **recette d'un environnement**. À dérouler à chaque reconstruction (E2). Les **valeurs**
> des secrets ne sont jamais ici (voir `SECRETS.md`) — seulement des placeholders.
>
> **Légende parité** : 🟰 diffable par la machine (entre au `parity:check`) · 🧪 **testé
> autrement** (la machine ne le prouve pas — voir la colonne « Preuve »).

---

## 1. Auth — Providers / Email
| Réglage | Attendu | Parité | Preuve |
|---|---|---|---|
| Email provider | **activé** (`external_email_enabled = true`) | 🟰 | config/auth |
| Email OTP length | **6** (impératif : l'UI n'accepte que 6 chiffres) | 🟰 | config/auth |
| Email OTP expiration | **600 s** (aujourd'hui 3600 des deux côtés — à harmoniser) | 🟰 | config/auth |
| Confirm email (autoconfirm) | `mailer_autoconfirm = false` | 🟰 | config/auth |

## 2. Auth — SMTP personnalisé (Resend)
| Réglage | Attendu | Parité | Preuve |
|---|---|---|---|
| Custom SMTP | **activé** | 🟰 | config/auth |
| Host | `smtp.resend.com` · user `resend` | 🟰 | config/auth |
| Sender email | `login@send.elysia.studio` (domaine Resend **vérifié**) | 🟰 | config/auth |
| Sender name | `Manzil` (⚠️ staging = `loginstaging` → **normaliser**) | 🟰 | config/auth |
| **Mot de passe SMTP** (clé Resend) | *(secret — voir SECRETS.md)* | 🧪 | **par l'effet** : un code arrive |

## 3. Auth — Templates email (les 2, code 6 chiffres)
| Template | Attendu | Parité | Preuve |
|---|---|---|---|
| **Magic Link** | objet + corps sur **`{{ .Token }}`**, **aucun** `{{ .ConfirmationURL }}` | 🧪 | **réception réelle** (rendu non lisible en SQL) |
| **Confirm signup** | idem (le 1ᵉʳ login d'un nouveau compte passe par là) | 🧪 | réception réelle |
> Corps de référence : voir la section « F1 » du DEVLOG (2026-07-08).

## 4. Auth — URL Configuration
| Réglage | Prod | Staging | Parité | Preuve |
|---|---|---|---|---|
| Site URL | `https://diasporabookproject-cpu.github.io/Heath/` | `https://manzil-staging.pages.dev` | 🧪 | **base-path** (asymétrie d'hébergement, résolue à **C4**) |
| Redirect URLs | `…/Heath/**` (prod actuel **sans `**`** → à compléter) | `…pages.dev/**` | 🧪 | idem |
> L'OTP n'a pas de redirect ; ces valeurs sont hygiène (utiles si un flux lien réapparaissait).

## 5. Edge functions — flag `verify_jwt`
| Fonction | `verify_jwt` attendu | Parité |
|---|---|---|
| `generate-recipe` | **false** (auth en code — hotfix A2) | 🟰 |
| `generate-translation` | **false** (auth en code — hotfix A2) | 🟰 |
| `invite`, `accept-invite`, `delete-account` | **true** | 🟰 |
> Déployées **depuis le repo** (E2), pas à la main. `verify_jwt` est lisible via l'API functions.

## 6. Storage — buckets
| Bucket | public | Source | Parité |
|---|---|---|---|
| `foyer-audio` | **false** (privé, RLS `is_foyer_member`) | migration 0003 | 🟰 |
| `shared` | **true** (notes vocales publiées) | migration 0006 (legacy) | 🟰 |

## 7. Secrets edge functions (valeurs hors repo — voir SECRETS.md)
| Secret | Où | Preuve |
|---|---|---|
| `ANTHROPIC_API_KEY` | Edge Functions secrets | 🧪 (une génération IA marche) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | injectés auto par la plateforme | 🟰 (présence) |

---
**Divergences volontaires, non-diffables** (restent en 🧪 jusqu'à C4) : Site URL / Redirect URLs
(base-path GitHub Pages `/Heath/` vs Cloudflare racine). Documenté, neutralisé dans les smokes.
