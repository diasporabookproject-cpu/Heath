# Secrets requis par environnement (inventaire — NOMS seulement)
### `supabase/SECRETS.md` · lot « Environnements propres » (E1)

> **Aucune valeur ici, jamais.** Ce fichier liste *ce qui doit exister* par environnement et
> *où ça vit*, pour qu'une reconstruction ne découvre pas un secret manquant au dernier moment.
> Les valeurs se posent à la main (dashboard / canal jetable), se testent par leur effet.

| Secret | Où il vit | Environnements | Comment on sait qu'il est bon |
|---|---|---|---|
| **Clé SMTP Resend** | Supabase → Auth → SMTP (mot de passe) | staging + prod | un code 6 chiffres arrive (F1) |
| **`ANTHROPIC_API_KEY`** | Supabase → Edge Functions → Secrets | staging + prod | une génération IA authentifiée réussit |
| **`SUPABASE_SERVICE_ROLE_KEY`** | injecté auto par la plateforme dans les edge functions | staging + prod | les fonctions serveur marchent (invite, quota…) |
| **Personal Access Token (`sbp_…`)** | **jamais stocké** — jetable, par étape, révoqué après | poste opérateur | usage ponctuel (migrations / diff) |
| **`SEED_SMOKE_PASSWORD`** | env local au moment du seed (jamais commité) | staging uniquement | le compte smoke se connecte par mot de passe (F2) |

## Clés PUBLIQUES (pas des secrets — peuvent vivre dans le repo/CI)
| Clé | Où | Note |
|---|---|---|
| `VITE_SUPABASE_URL` | `ci.yml`, Cloudflare, `.env.local` | URL du projet, publique |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | idem | publique par design (protégée par RLS) |
| `VITE_SENTRY_DSN` | idem | clé d'ingestion publique |

## Règle
Un secret **jamais** dans le repo, un chat versionné, ou un log. Une valeur exceptionnelle passée
par canal jetable. La **présence** d'un secret est vérifiable ; sa **valeur** se prouve par l'effet.
