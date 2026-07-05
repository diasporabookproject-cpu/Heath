# Chiffrage final — Lot « Comptes + Sync »
> **Réponse de l'implémenteur** au `BRIEF_COMPTES_SYNC_CLAUDE_CODE.md` **v1.1** (§8).
> Chiffrage S0→S7 + réponses **QA/QB/QC** + position sur la table `docs` générique + ce que je
> couperais. Base : `refonte/bento-v1` (branche `comptes-sync-v1` **après merge**). 2026-07-05.

## 0. Verdict global

**Je valide le brief v1.1 tel quel.** Q1–Q6 tranchées me suffisent pour chiffrer. Deux apports
du brief que je salue parce qu'ils corrigent une faiblesse de mon read-back :
- **`updated_at` posé par le SERVEUR** au push (§2) — indispensable : les horloges client mentent,
  un LWW sur horloge client serait faux. C'est la bonne décision, je l'adopte.
- **Export JSON local AVANT toute première fusion** (Q1) — le filet exact au bon endroit ; l'export
  devient donc une **brique technique de S3**, pas seulement l'UI de S6.

**Je ne conteste PAS la table `docs` générique** (§1 ci-dessous : je l'affirme, avec le mapping précis).
**Une seule chose que je couperais/reporterais** (§5) et **trois gardes techniques** que je pose (§4).

## 1. Table `docs` générique — je confirme (pas de contestation)

Aucun besoin serveur de **requêter le contenu** en v1 → le générique gagne (un moteur, une policy,
des tombstones uniformes). Vérifié dans le code : la publication d'espace **snapshote déjà** le
payload côté client dans la table `espaces` (`src/lib/espace.ts`, `publishEspace` → `upsert`), donc
le miroir de sync n'a **jamais** besoin d'être lu par le serveur pour publier. L'export RGPD =
« pull tous les docs du foyer » = **une** requête indexée. Des tables typées multiplieraient RLS et
migrations pour **zéro** bénéfice v1.

**Mapping stores IndexedDB → `docs(foyer_id, store, doc_id, payload, updated_at, deleted_at, updated_by)` :**

| Store local | → `docs` ? | `store` / `doc_id` | Note |
|---|---|---|---|
| `recipes` | ✅ | `'recipes'` / `recipe.id` | LWW fin par ligne |
| `weeks` | ✅ | `'weeks'` / `week.id` | |
| `destinataires` | ✅ | `'destinataires'` / id | |
| `securite` | ✅ | `'securite'` / id | |
| `nounou` | ✅ | `'nounou'` / `'doc'` | **blob entier** LWW (Q2) |
| `app` | ⚠️ **partiel** | `'app'` / `'app'` | sync **des prefs (rappels)** — **PAS** `aiQuota` (cf. §4-G3) |
| `audio` | ❌ → **bucket privé** | — | binaire, pas du JSON → S3′ (Q3), jamais dans `docs` |
| `meta` | ❌ | — | seedVersion/settings locaux, non sync |
| `published` | ❌ | — | trace locale dérivée des envois, non sync |

**Raffinements de schéma que je propose** : PK composite `(foyer_id, store, doc_id)` ; index
`(foyer_id, updated_at)` pour le pull delta ; `updated_by = user_id` **stocké** (aucune UI v1, sert
le futur « qui a modifié »). `payload jsonb`, tombstone = `deleted_at not null`.

## 2. Réponses QA / QB / QC

### QA — Région du projet Supabase actuel *(à traiter en S0, avant toute migration)*
Le project ref est `pqeilsuqglmrvijndrwa` ; **la région n'est pas déductible de l'URL** → **action
Amine** : Dashboard → *Project Settings → General → Region*. Arbre de décision + chiffrage des deux voies :
- **Déjà UE** (`eu-*`) → **🟢** : rien à migrer, on confirme + DPA activé (S7). Fin.
- **Hors UE** (`us-*`, etc.) → **nouveau projet EU + bascule**. À migrer : table `espaces` (liens
  `#e=` déjà chez des familles), bucket `shared` (audio publiés), utilisateurs auth, secrets edge
  (`ANTHROPIC_API_KEY`), clés `VITE_*`. Deux voies :
  - **(a) Migrer** — dump `espaces` + copie des objets `shared` vers le projet EU, repointage des clés.
    **Les jetons `#e=` survivent** (mêmes tokens) → aucun lien cassé. **🟡** (~1j, volume faible : pas
    encore public). **Reco si de vrais liens sont dehors.**
  - **(b) Expirer** — on repart propre sur EU, les anciens `#e=` meurent (lecteur voit « lien
    expiré »). **🟢** mais casse tout lien vivant. **Acceptable uniquement si `espaces` = données de test.**
  → **Amine tranche (a)/(b)** selon qu'il y a ou non des liens réels en circulation.

### QB — Suppression du foyer & espaces publiés
**Reco = révocation avec avertissement explicite** (comme le brief le pressent). À la suppression du
foyer (action **owner** uniquement) : cascade `DELETE espaces WHERE foyer_id = X` (les liens `#e=`
déjà envoyés **cessent de fonctionner**) + purge des objets du **bucket privé audio** du foyer.
La confirmation dit la vérité : « Les pages déjà envoyées cesseront de fonctionner, et tes données
seront effacées du cloud (ta copie locale reste sur cet appareil). » Un **membre** (non-owner) ne
supprime rien : il **quitte** (sa ligne `membres` part, le contenu du foyer reste). **🟢**.
*(Les `espaces` orphelins d'avant-comptes — `foyer_id` null après backfill — restent publics jusqu'à
expiration, inchangés : le personnel n'a pas de compte.)*

### QC — Fréquence du pull périodique
**Déclencheurs de pull** : (1) au **login**, (2) au **focus** (`visibilitychange → visible`), (3)
**après chaque push réussi** (rattrape l'autre appareil tout de suite). **Battement de fond** :
**delta-only** toutes les **90 s uniquement quand l'app est au premier plan** (requête indexée
`updated_at > syncedAt` → ~0 ligne en régime normal). **Aucun** polling app fermée en v1 (pas d'infra
push). Coût : quelques invocations/min/utilisateur-actif, payload delta quasi vide → **négligeable**.
90 s = constante ajustable. *(Le battement de fond est même **coupable** — cf. §5 : focus + post-push
couvrent déjà bien le multi-appareil.)*

## 3. Chiffrage final S0→S7

Unité = **jour-idéal** (dev concentré, hors interruptions). 🟢 sûr · 🟡 attention · 🔴 gros risque.

| # | Sous-lot | Risque | Jours | Ce qui pèse |
|---|---|---|---|---|
| **S0** | Fondations : région (QA) · projet **staging** + config par env · outillage `supabase/migrations/` · **Sentry** | 🟢 | **1–1,5** | surtout de la config ; **débloque QA avant tout SQL** |
| **S1** | Schéma + RLS : tables §2 (dont `espaces.foyer_id` nullable+backfill) + policies + **tests RLS** | 🟡 | **2** | les **tests RLS** (accès inter-foyer refusé) = le vrai travail |
| **S2** | Auth OTP + Compte : code 6 chiffres, **création lazy du foyer** (owner), profil, déconnexion, **suppression de compte** (Apple 5.1.1(v)), **rituel d'adoption** (Q5) + **export préalable** (brique Q1) | 🟡 | **2–3** | le **rituel d'adoption** (confirmation, atomique par store) est délicat |
| **S3** | **Moteur de sync** : push débouncé + file offline persistée · pull (login/focus/post-push/delta) · **LWW `updated_at` serveur** · tombstones 2 sens · **fusion Q1** · **garde anti-écrasement** · scénario 2 appareils | 🔴 | **4–5** | **le cœur + le risque n°1** ; la fusion et la garde dirty sont le nerf |
| **S3′** | **Sauvegarde audio** (Q3) : bucket **privé/foyer** (RLS storage), upload-on-save wifi-friendly, **download paresseux** à la lecture, pointeur dans le doc recette | 🟡 | **1,5–2** | binaire, **hors `docs`** ; 🔴 **si** on exige une restauration eager multi-appareil → alors on différe (bannière d'honnêteté) |
| **S4** | Invitation 2ᵉ membre : email/code **serveur** (RPC/edge), rôle `membre`, révocation owner — **gratuite, comptabilisée** (couture ②) | 🟡 | **1,5–2** | l'opération **serveur** d'acceptation + le rattachement au bon foyer |
| **S5** | Quota IA serveur : `ai_usage(foyer_id, month, used)` · **vérif/incrément AVANT `fetch` Anthropic** dans les 2 edge functions · foyer via JWT · plafond **100/mois** (constante serveur) · le front n'affiche que l'état serveur | 🟡 | **1,5** | l'IA **exige désormais une session** (nouveau « moment où l'auth sert ») |
| **S6** | Export + suppressions : UI d'**export JSON** (brique déjà en S3) · **quitter** le foyer · **supprimer** le foyer (cascade + QB) | 🟢 | **1–1,5** | le gros est déjà fait en S3 ; ici l'UI + les cascades |
| **S7** | Paquet RGPD : gabarit **politique FR** (contenu Amine), rétention proposée (dont **purge des tombstones**), DPA/chiffrement vérifiés, **instruction** PIN/expiration liens (note d'options, **pas** d'implémentation) | 🟡 | **1–2** | transverse, surtout rédactionnel + vérifs |

**Total ≈ 15,5–20,5 jours-idéaux.** C'est **de loin** le plus gros lot du projet ; **S3 est le mât
de tente**. Ordre : **S0 → S1 → S2 → S3 → (S3′·S4·S5·S6 parallélisables) → S7**, RGPD en continu.
**Mini-spike build iOS** (signature Apple) : **timeboxé 1 j**, en parallèle, ne bloque rien, entre au DEVLOG.

## 4. Trois gardes techniques que je pose

- **G1 — File offline collapsée par doc.** Deux éditions hors-ligne du même doc → on **écrase la file
  par `(store, doc_id)`** et on ne pousse que le **dernier** payload (pas un replay d'intermédiaires).
- **G2 — Garde anti-écrasement stricte.** Un doc localement **dirty** (modifié, pas encore poussé)
  n'est **jamais** écrasé par un pull ; il gagne le prochain push. Le pull n'applique que sur les docs
  **clean**. C'est la protection minimale de Q2 (blob nounou mono-éditeur).
- **G3 — Le quota IA ne transite pas par la sync.** `aiQuota` **sort** du payload `app` synchronisé :
  la vérité est **serveur** (`ai_usage`, S5), le client n'en garde qu'un **cache d'affichage**. Sinon un
  client pourrait s'auto-créditer du quota en poussant un doc `app` trafiqué. *(Les prefs `rappels`, elles, se synchronisent normalement.)*

**Limite assumée (documentée, pas bloquante).** Même recette créée **indépendamment** sur deux
appareils avant la 1ʳᵉ sync → ids différents → **pas** de collision → **doublon** (l'union ne peut
pas dédupliquer sémantiquement). Acceptable v1 ; noté au backlog (dédup par nom possible plus tard,
comme pour les packs).

## 5. Ce que je couperais / reporterais en v1

1. **Battement de fond 90 s (QC) — coupable.** `focus` + `post-push` couvrent déjà le multi-appareil
   d'un mono-éditeur. Je **le garde derrière une constante à `null`** (activable sans redéploiement) et
   **démarre sans**. Zéro perte perçue, moins d'invocations.
2. **Restauration audio *eager* — reportée.** S3′ fait l'**upload** (sauvegarde réelle = l'important) +
   le **download paresseux** à la lecture. Re-télécharger **tout** l'audio sur un nouvel appareil
   d'emblée (coûteux, wifi) = backlog. Ça garde S3′ en 🟡.
3. **`updated_by` = colonne sans UI.** On **stocke** qui a modifié (utile plus tard) mais **aucun**
   écran « modifié par » en v1.
4. **PIN/expiration des liens `#e=`** — déjà **instruction seule** en S7 (note d'options), conforme au brief.

Rien d'autre à couper : le reste est soit invariant, soit le cœur de la dette qu'on solde.

## 6. Prêt à lancer

Après ton **GO** (et le **merge de la refonte**) : branche `comptes-sync-v1`, **S0 d'abord**
(la région QA **avant** tout SQL), schéma **uniquement** par migrations versionnées relues au
read-back, **RLS testée**, livraison **sous-lot par sous-lot avec STOP**, qualité complète par
sous-lot (typecheck · tests dont **RLS/LWW/tombstones/file offline/fusion** · build · **scénario
E2E 2 appareils** joué et documenté · captures), **DEVLOG avec section « migrations appliquées »**.
Invariants §1 du brief tenus : app 100 % utilisable sans compte, UX locale intacte, pages reçues
intactes, tout débloqué mais **coutures serveur**.

**Il me manque juste, avant S1** : ta réponse **QA** (région → voie (a)/(b) si hors UE) et **QB**
(je pars sur révocation-avec-avertissement sauf objection). QC : je démarre sans battement de fond.
