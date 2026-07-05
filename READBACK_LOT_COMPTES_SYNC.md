# Read-back technique — Lot « Comptes + Sync »

> **Cadrage de l'implémenteur** (instance qui code) pour le 1ᵉʳ lot de prod, en réponse
> à `DECISIONS_STORE_V1.md`. Ce n'est **pas** le brief formel (dont l'autre instance est
> autrice) : c'est l'ancrage dans la **codebase réelle** + les **risques** + les **points
> à trancher avant code** + une **décomposition chiffrée**. À fondre dans le brief.
> Base : `refonte/bento-v1`. 2026-07-05.

## 0. Alignement — aucune divergence de fond

J'ai relu D1→D8. **Je valide l'ensemble** ; les décisions intègrent ma colonne vertébrale
(foyer/`foyer_id` = clé de voûte ; quota IA serveur ; RGPD transverse) et tranchent
correctement les forks. Trois notes seulement :

- **D4 (terminologie) — d'accord** : l'app est aujourd'hui **local-only** (aucune sync),
  pas « local-first ». Cible = local-first-**avec-sync**. Je corrige le vocabulaire dans nos docs.
- **D5 (tout gratuit v1) — clarifié par Amine (2026-07-05).** Le gratuit total est un **confort
  de test** (ne pas avoir à jongler avec plusieurs comptes pendant la QA), **pas** le modèle
  final : **le premium est acté** — seuls les paliers/prix restent à définir plus tard. Les
  **leviers de gate** pressentis (à confirmer au moment de la monétisation) : **① plafonds
  d'usage IA · ② nombre de comptes/membres du foyer · ③ certaines fonctionnalités de partage
  avancées**. **Conséquence d'archi, à coût nul maintenant** : ces trois frontières doivent être
  **structurellement gatables** dès le schéma — (①) quota IA **serveur** ; (②) le compteur de
  membres passe par une **invitation serveur** (jamais purement client) ; (③) le partage avancé
  s'appuie sur des **capacités identifiables** côté serveur. On **débloque tout** en v1, mais on
  **pose les points d'ancrage** pour verrouiller plus tard **sans refonte**. ✅ **Q4 tranchée**
  (cf. §3) : **plafond serveur généreux** en v1 (anti-coût Anthropic + c'est déjà le futur point
  premium ①), **jamais illimité côté client**.
- **Séquence (sync avant coquille) — d'accord**, c'est la vraie dette et la coquille n'en
  dépend pas. **Un seul ajout** : je ferais un **mini-spike du build iOS très tôt, en parallèle**
  (signature Apple = le poste le plus surprenant), pour ne pas le découvrir à la fin.

## 1. Ce qui existe déjà (à mapper)

**Stores IndexedDB locaux** (`src/lib/db.ts`, `DB_VERSION 7`) :

| Store | Clé | Contenu | Granularité sync |
|---|---|---|---|
| `recipes` | `id` | recettes | **par ligne** (LWW fin — OK) |
| `weeks` | `id` | menus de semaine | par ligne |
| `destinataires` | `id` | destinataires Cuisine | par ligne |
| `securite` | `id` | fiches sécurité | par ligne |
| `nounou` | `'doc'` | **UN gros blob JSON** (`NounouDoc` : enfants, rythme, périodes, ponctuels, conduites, urgence, destinataires nounou) | **blob entier** ⚠️ |
| `app` | `'app'` | réglages transverses (quota, rappels) | blob |
| `audio` | `recipeId` | **Blobs vocaux** (non sauvegardés aujourd'hui) | binaire ⚠️ |
| `meta` | — | seeded/seedVersion/settings | local, non sync |
| `published` | `token` | trace locale des envois | dérivé, non sync |

**Côté Supabase déjà en place** : table **`espaces`** (jeton → payload = pages publiées,
**lecture publique par jeton**), bucket **`shared`** (audio public, à la publication), edge
functions **`generate-recipe` / `generate-translation`** (Anthropic).

## 2. Les vrais risques (par ordre)

1. **🔴 Adoption / fusion de la donnée locale (le point dur).** À la 1ʳᵉ connexion (D3),
   la donnée du téléphone doit être **adoptée** dans le foyer (uploadée, taguée `foyer_id`),
   **jamais écrasée**. Cas piège : se connecter à un foyer qui a **déjà** de la donnée cloud
   (2ᵉ appareil / 2ᵉ parent) → il faut **fusionner** local + cloud, pas remplacer. C'est le
   chemin le plus délicat du lot.
2. **🟡 Granularité de sync du doc Nounou.** `recipes/weeks/destinataires/securite` = lignes
   → LWW fin, indolore. Mais **`nounou` = un seul blob** : deux appareils qui éditent des
   *parties différentes* hors-ligne → LWW sur le blob **perd** les changements de l'un.
   Acceptable en **v1 mono-éditeur** ; à décider : (a) blob entier LWW (simple, reco v1) vs
   (b) éclater en entités (enfants/moments/…) pour un LWW fin (beaucoup plus de travail).
3. **🟡 Sauvegarde de l'audio.** Les notes vocales locales ne sont **pas** sauvegardées
   aujourd'hui (seulement uploadées en public à la publication). Une vraie sauvegarde exige
   un **bucket privé par foyer**. En v1 ou plus tard ?
4. **🟡 Quota IA serveur (D5-a).** Les edge functions doivent identifier le **foyer** (via le
   JWT) et vérifier/décrémenter un **compteur serveur** (nouvelle table `ia_usage`). Cf. la
   clarification §0/§3-Q4 (plafond généreux vs aucun).
5. **🟡 Locataire de `espaces`.** Ajouter `foyer_id` (nullable + backfill) pour la **gestion
   côté auteur** (lister/révoquer les espaces d'un foyer) ; la **lecture reste publique par
   jeton** (inchangée pour le personnel). RLS côté auteur seulement.

## 3. Points à trancher AVANT code (mon read-back)

- **Q1 — Fusion local↔cloud** à la connexion à un foyer déjà peuplé : règle de fusion
  (union par id, LWW sur collisions) ? *(je propose : union, LWW par document sur collision d'id)*
- **Q2 — Granularité doc Nounou** : blob entier LWW en v1 (reco) ou éclatement en entités ?
- **Q3 — Audio** : sauvegarde des notes vocales dans un bucket privé foyer dès v1, ou différé ?
- **Q4 — Quota IA v1** : ✅ **tranchée (2026-07-05)** → plafond serveur **généreux** (anti-coût
  Anthropic + futur levier premium ①), **jamais illimité côté client**. Reste à fixer la valeur.
- **Q5 — Périmètre d'adoption** (Q-c des décisions) : tout d'un coup, ou par store ? *(je
  propose : tout d'un coup, un « import » unique atomique par store, transactionnel)*
- **Q6 — Clé de tenancy** : confirmer **`foyer_id` partout** dès le schéma (jamais `user_id`
  sur le contenu) — conforme D2, je le pose comme invariant.

## 4. Décomposition proposée (sous-lots, chiffrage 🟢🟡🔴)

| # | Sous-lot | Chiffrage | Notes |
|---|---|---|---|
| S1 | **Schéma + RLS** : `foyers`, `membres(user_id, foyer_id, role)`, `+ foyer_id` sur le contenu ; tables de contenu (recettes/semaines/destinataires/sécurité/doc nounou/réglages) | 🟡 | RLS par `foyer_id` ; migration côté cloud |
| S2 | **Auth OTP + comptes** : écran code 6 chiffres (`verifyOtp`), profil, déconnexion, **suppression de compte** (Apple 5.1.1(v)), auth **non bloquante** | 🟡 | + **rituel d'adoption** de la donnée locale (D3) |
| S3 | **Moteur de sync** : push-on-save / pull-on-login, **LWW par document**, mapping stores IndexedDB ↔ cloud, fusion (Q1) | 🔴 | le gros morceau + le risque n°1 |
| S4 | **Export JSON** (portabilité RGPD + invariant « contenu portable ») | 🟢 | |
| S5 | **Invitation 2ᵉ membre** (email/code, **opération serveur**) — gratuite en v1 | 🟡 | architecturée pour devenir premium plus tard |
| S6 | **Quota IA côté serveur** (edge function : foyer via JWT + compteur) | 🟡 | Q4 tranchée : plafond **généreux** en v1 = **levier premium ①** déjà en place |
| S7 | **Staging** (2ᵉ projet Supabase) + **Sentry** | 🟢 | D7 |
| — | **Paquet RGPD** (région EU, DPA, RLS, politique FR, rétention, étude PIN/expiration liens) | 🟡 | transverse, non négociable à ce lot (D8) |

**Ordre d'exécution suggéré** : S1 → S2 → S3 (cœur) → S4/S5/S6 en parallèle → S7. RGPD en continu.

> **Ancrages premium (D5 clarifié) — à poser en v1, à activer plus tard.** Le premium est acté
> (paliers à définir). Les trois leviers pressentis sont déjà des **frontières serveur** dans ce
> lot, donc gatables sans refonte : **① volume IA** = compteur serveur (S6) · **② nombre de
> membres du foyer** = invitation serveur (S5, gratuite/ouverte en v1 mais comptabilisée) · **③
> partage avancé** = capacités identifiables côté auteur (`espaces.foyer_id`, §2-5). On ne
> construit **aucun** paywall maintenant ; on garde juste ces trois coutures nettes.

## 5. Ce qui NE bouge pas (garanties)

- **Pages reçues `#e=`** : web public par jeton, **inchangées** (le personnel n'a pas de compte).
- **Logique des edge functions** : inchangée **sauf** l'ajout du contrôle de quota (S6).
- **Toute l'UI Manzil** (Lots 0→3) : intouchée — on **ajoute** une couche compte/sync **sous** l'app.
- **Le local reste la source de lecture/écriture** (instantané, offline) ; le cloud est la
  **sauvegarde + le miroir** — on ne rend jamais l'app dépendante du réseau pour fonctionner.

## 6. Ce que j'attends pour lancer

Les réponses à **Q1–Q3, Q5–Q6** dans le brief formel (**Q4 tranchée** : plafond IA serveur
généreux), puis je fais le **read-back chiffré définitif par sous-lot** et on part **S1
d'abord**, après le **merge de la refonte** (priorité actuelle = ta QA).
