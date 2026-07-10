# Read-back — Lot « Environnements propres »
### `READBACK_ENVIRONNEMENTS.md` · réponse au brief `BRIEF_ENVIRONNEMENTS_CLAUDE_CODE.md` v1 · 8 juillet 2026

> **Statut** : GO d'Amine sur le principe et le plan. Branche `envs-propres-v1`.
> **AS-2 en pause** ; ce lot passe devant (fenêtre : prod = comptes de test uniquement).
> Méthode : E0→E4, **STOP entre chaque**, chiffrage 🟢🟡🔴, DEVLOG. Rituel **token jetable
> par étape** (E0, E2, E3), révoqué entre chaque.

---

## 0. Principe gravé (la meilleure addition au brief)

> **PROD EN LECTURE SEULE SUR TOUT LE LOT.** La prod se **lit** (E0) et s'**égale** (E3) ;
> elle ne s'**écrit jamais** ici. Toute écriture SQL/policy/fonction de ce lot va **sur
> staging uniquement**. **Première écriture prod = Fiche 3 d'AS-2**, après ce lot.

C'est le garde-fou central : il rend E1/E2 sans risque prod par construction, et supprime la
principale façon de se tirer une balle (rejouer une migration « idempotente » sur la référence).

**Règle de non-dérive** (extension de la règle schéma) : aucun changement d'environnement hors
repo/checklist ; toute manip dashboard exceptionnelle est back-portée dans la checklist **le jour même**.

---

## 1. Réponses aux questions du brief (Q-e1 → Q-e5)

**Q-e1 — Reset staging : DB-wipe, PAS re-création du projet.**
Recréer le projet Supabase changerait la **ref** → nouvelles URL + clés publishable → à
répercuter dans Cloudflare, `.env.local`, `ci.yml`, docs = churn + références périmées garanties.
On **vide le contenu** (schéma `public` : tables/fonctions/policies ; objets storage de nos
buckets ; users auth) en **gardant le projet** → ref, clés et config SMTP survivent.
*Nuance honnête* : un DB-wipe ne « répète » pas la partie **config dashboard** de la recette ;
c'est la `CONFIG_CHECKLIST.md` (déroulée en E2) qui la couvre — et c'est suffisant.

**Q-e2 — Idempotence des policies : `drop policy if exists … ; create policy …` dans UNE transaction.**
⚠️ `create policy if not exists` **n'existe pas** en Postgres. Le pattern retenu : `drop … if
exists` puis `create …`, **dans la même transaction** → au rejeu sur prod (plus tard, hors de ce
lot) rien n'est visible avant le commit, **aucune fenêtre de coupure** de la lecture publique.
L'idempotence se **prouve en jouant deux fois sur staging** (à blanc puis rejeu) — **jamais** en
rejouant sur prod. La parité avec prod se prouve par le **diff** (E3), pas par un rejeu risqué.

**Q-e3 — Parité : requêtes catalogue normalisées, pas `pg_dump`.**
L'API Management ne donne pas `pg_dump`, mais tout est lisible en SQL. Périmètre du diff :
- `information_schema.columns` (tables + colonnes + types)
- `pg_policies` (RLS : nom, cmd, `qual`, `with_check`)
- `pg_proc` **+ `proacl`** (fonctions **ET grants des RPC**) — **incontournable** : c'est le
  hotfix A1 (`reserve_ai_usage`/`refund_ai_usage`/`reserve_abuse_guard` = service_role only).
  Si `proacl` n'est pas dans le diff, on ne prouve pas ce qui compte.
- `storage.buckets` + policies storage
- triggers (`information_schema.triggers`)
Chaque item = une requête à sortie **ordonnée et normalisée**, comparée **texte-à-texte** entre
staging et prod. Script `npm run parity:check` (token à l'exécution, **jamais en CI**).

**Q-e4 — Angles morts : « testé autrement, pas diffé ».**
La checklist *décrit* ces réglages mais la machine ne les *prouve* pas par diff :
| Réglage | Pourquoi non-diffable | Comment on le prouve |
|---|---|---|
| Secret SMTP (valeur) | hors repo (correct) | par l'**effet** : un e-mail part |
| Templates email (`{{ .Token }}`) | rendu non lisible en SQL | **réception réelle** d'un code 6 chiffres |
| Base-path GitHub Pages `/Heath/` | structurellement absent de staging (Cloudflare racine) | **test** (neutralisé dans les smokes) jusqu'à l'unification **C4** |
| `verify_jwt` par fonction | — | **DIFFABLE** : lisible via l'API functions → entre dans le diff |
On **documente noir sur blanc** ce que la machine prouve vs ce qui repose sur nous.

**Q-e5 — Coupes / allègements validés :**
- **`espace_opens`** (accusés de lecture) : migration **idempotente légère**, **pas de seed dédié**
  (best-effort non critique).
- **`parity:check`** : **discipline de RUNBOOK** (commande lancée sciemment), **PAS** une règle
  « obligatoire avant tout lot backend » qu'aucune CI n'impose — on ne se raconte pas une sécurité
  automatique qu'on n'a pas.
- **Seed** : **strictement minimal** — 1 foyer de test, 1 espace publié à **jeton connu**,
  2 recettes, 1 doc nounou. Ne pas le laisser grossir en fixtures de démo.

---

## 2. Plan chiffré E0 → E4 (STOP entre chaque)

### E0 — Inventaire d'écart 🟢 · token (lecture) · **1ʳᵉ action = lectures, zéro écriture**
Sur **prod ET staging** : structure (`information_schema`), `pg_policies`, `pg_proc`+`proacl`,
buckets+policies storage, triggers ; **liste des edge functions + versions + `verify_jwt`** (API
functions) ; réglages Auth lisibles (SMTP activé ?, URLs, OTP length/expiry). **Chercher
explicitement les objets hors-système** au-delà d'`espaces` (buckets legacy, policies orphelines,
fonctions oubliées).
- **Livrable** : `RAPPORT_ECART_ENVS.md` — tableau objet par objet : présent prod ? présent
  staging ? versionné repo ? → **décision** (migrer / checklist / supprimer). **Avant toute écriture.**
- *Collaboratif ?* Non — je lis, tu passes le token. **Prod = lecture seule.**

### E1 — Rattraper le repo 🟡 · pas de token (écriture repo + tests sur staging en E2)
- **Migrations rétroactives idempotentes** : `000X_espaces_legacy.sql` (table `espaces` +
  `espace_opens` + policies d'origine snapshotées, pattern `drop if exists`+`create` en
  transaction) **+ tout ce que E0 révèle**. État visé = **prod actuel + 0002 déjà appliquée**.
  ⚠️ Ce lot **reproduit** l'existant, il **ne le change pas** (la fermeture d'écriture espaces
  reste en **AS-2 Fiche 3**).
- **`supabase/CONFIG_CHECKLIST.md`** : réglages par env (Auth/SMTP/templates/toggles/URLs/buckets),
  valeurs attendues, **placeholders** pour les secrets.
- **`supabase/SECRETS.md`** : secrets requis par env (**noms + où ils vivent**, jamais les valeurs).
- **Seed** : `npm run seed:staging` (foyer + 2 recettes + 1 nounou + 1 espace à jeton connu) **+
  compte smoke par mot de passe** → **absorbe F2** (débloque le vrai smoke authentifié du backlog).
- *Collaboratif ?* Léger (design du compte seed/F2 à valider).

### E2 — Reconstruire staging à blanc 🟡 · token (écriture **staging**) · collaboratif
**DB-wipe staging** (le geste « jetable » qu'on institue) → rejouer **toutes** les migrations
0001→000X dans l'ordre → **déployer toutes** les edge functions depuis le repo (`verify_jwt`
conformes à la checklist) → **dérouler `CONFIG_CHECKLIST`** (Amine sur les écrans dashboard,
guidé) → `seed:staging`.
- *Fini* : staging **entièrement** issu de la recette, zéro geste non tracé.
- *Collaboratif* : **oui** (Amine pour la checklist dashboard).

### E3 — Prouver la parité 🟢 · token (lecture prod+staging)
`npm run parity:check` : **diff de structure staging vs prod = vide** (hors données). Lien public
du seed → **200 anonyme** ; smokes verts contre staging ; **login OTP staging OK** (F1).
- *Fini* : « staging prouve la prod » est **vraie, démontrée, documentée**. **Prod = lecture seule.**

### E4 — Gouvernance 🟢 · pas de token
`RUNBOOK_ENVIRONNEMENTS.md` (reconstruire un env de zéro, promouvoir, rollback, rituel token) ;
règle de non-dérive + **principe prod-read-only** au DEVLOG ; backlog (unification hébergement C4,
smoke authentifié CI via compte seed F2, parity:check périodique).

---

## 3. Ce que ce lot NE fait pas (calibrage assumé)
Pas de Terraform/IaC ; pas de 3ᵉ env ; pas de copie prod→staging (inutile aujourd'hui, interdit
demain sans anonymisation) ; pas de changement de comportement (repro de l'existant seulement).

## 4. Réserves honnêtes (actées avec Amine)
- **Investissement, pas feature** : valeur = « ne plus jamais déboguer une divergence en prod ».
  **Déclencheur de re-priorisation** : si mise en ligne imminente → AS-2 repasse devant. Pas le cas.
- **Lot collaboratif** (comme F1) : E2 (checklist dashboard) et E4 (test templates) demandent Amine.
- **Pendant ce lot, les P1 d'AS-2** (TOCTOU `accept-invite`, `deleteAccount` owner) **restent
  ouverts** — acceptable car prod = comptes de test ; c'est le même argument que la fenêtre.

## 5. Après ce lot
**AS-2 reprend, Fiche 3 en premier** : la bascule RLS `espaces` se **répète sur le staging
reconstruit** (table + page seedée), puis s'applique en prod avec le protocole convenu (snapshot
avant, lien anonyme 200 après). Puis fiches 1, 2, 4, AS-2b.

---
**Prochaine action** : sur ton token E0, je lance les **lectures catalogue prod+staging** et je
produis `RAPPORT_ECART_ENVS.md` — **zéro écriture**, prod en lecture seule. STOP ensuite pour E1.
