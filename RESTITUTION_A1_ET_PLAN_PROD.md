# RESTITUTION — Audit Comptes+Sync (A1) & plan de mise en production
### `RESTITUTION_A1_ET_PLAN_PROD.md` · 5 juillet 2026 · branche `comptes-sync-v1` @ `bd6490c` · auditeur : instance QA (clone frais, indépendant)

## 0. Verdict

Le lot est **de très bonne facture** — la revue à froid auto-initiée (10 findings corrigés,
dont 3 vrais bloquants de *transition*) est le meilleur signal de maturité du projet. Les
portes sont vertes chez moi (**typecheck · 101/101 tests · build**), les trois correctifs P0
sont **vérifiés dans le code**, le cœur de sync tient ses gardes.
**Mais l'audit trouve 1 bloquant résiduel (A1)** dans le même registre que leurs P0 — une
transition destructive sans filet — plus 2 points 🟠. **GO pour la passe prod après
correctif A1** (petit périmètre, ~1 fichier UI + 1 helper).
Région Supabase prod : **UE confirmée par Amine** → la question bloquante de la passe prod
est levée.

## 1. Résultats de l'audit

| Vérification | Résultat |
|---|---|
| Portes (typecheck / 101 tests / build) | ✅ reproduites sur clone frais |
| **P0-1** owner orphelin : `leaveFoyer` (client) **et** `accept-invite` (serveur) — cascade si seul membre, refus 409 sinon, purge de l'état de sync | ✅ conforme, des deux côtés |
| **P0-2** `publishEspace` tolérant à la colonne `foyer_id` absente (retry) + réparation au prochain publish | ✅ conforme |
| **P0-3** `emailRedirectTo = origin + pathname` (base path `/Heath/` préservé) | ✅ conforme |
| Cœur `plan.ts` : dirty par hash, LWW serveur, tombstones, **G2** (jamais de pull sur un doc dirty) | ✅ conforme aux tests |
| Quota IA : RPC `reserve_ai_usage` / `refund_ai_usage` (atomique + refund) | ✅ présent |
| Confirmation **suppression de compte** (copy : cloud effacé, pages coupées, copie locale conservée, irréversible) | ✅ — répond déjà à ma reco §5-3 |
| Migration `0002` : cascade + RLS auteur différée avec requêtes d'inspection commentées | ✅ bonne discipline (voir §2-1) |
| RGPD.md : sous-traitants **Anthropic, Sentry, Supabase, Cloudflare** listés + checklist DPA | ✅ mieux que craint (voir A4) |

### Findings de l'audit (nouveaux)

| ID | Gravité | Constat | Correctif demandé |
|---|---|---|---|
| **A1** | 🔴 **bloquant merge** | **Flux « Rejoindre un foyer » sans consentement ni filet.** `doJoin` appelle `acceptInvite` directement (une ligne d'info passive seulement). Or le serveur **supprime le foyer possédé — donc sa sauvegarde cloud —** avant que le rituel d'adoption (et son export auto) n'ait lieu au rechargement. Les docs cloud-only (poussés depuis un autre appareil, jamais tirés ici) seraient perdus sans trace. | Avant l'appel serveur : **① pull final** (rapatrie les éventuels docs cloud-only) → **② export JSON local automatique** → **③ écran de confirmation explicite** : « Ton foyer actuel et sa **sauvegarde en ligne seront supprimés**. Tes données sur cet appareil rejoindront le foyer {nom}. (Une copie vient d'être exportée.) » Réutiliser la mécanique du rituel Q1. |
| **A2** | 🟠 | Libellé « **Quitter le foyer** » (cas owner seul membre) ne dit pas que **la sauvegarde cloud du foyer est supprimée** — il ne parle que du local. | Une phrase : « …et la sauvegarde en ligne de ce foyer est supprimée. » |
| **A3** | 🟠 | Invitations : **TTL 7 jours**, pas de révocation (P2 connu). Un code WhatsApp circule ; le single-use (`accepted_by`) atténue, mais 7 jours reste long. | TTL **72 h** (constante) maintenant ; **révocation UI = tête du backlog P2**. |
| **A4** | ⚪ | RGPD.md : **Resend** absent (normal, SMTP pas branché) ; rétention Sentry « à régler court » non chiffrée. | Ajouter Resend au moment du SMTP (passe prod, étape 4) ; fixer Sentry à 30 j. |

## 2. Réponses aux 6 questions de la revue (§5 du récap)

1. **`0002` espaces — découpage validé** (colonne+cascade d'abord, RLS auteur après
   inspection). Exigences ajoutées : **snapshot des policies avant** (leurs deux requêtes
   commentées sont les bonnes), et **test de non-régression juste après** : ouvrir un lien
   `#e=` réel **en anonyme**. La cascade ne doit toucher que les espaces du foyer supprimé.
2. **Adoption « cloud gagne » — acceptable v1** (collisions d'id quasi impossibles ; le cas
   réel est le re-login). Le rituel suffit **si** l'export est vérifié téléchargé et le foyer
   nommé — **et le même filet doit couvrir « Rejoindre » (A1)**, c'est le trou.
3. **Suppression de compte — posture validée** (cloud effacé, local conservé = juridiquement
   juste + honnête offline) ; la copy vérifiée est déjà bonne. Ajout **P2** : bouton séparé
   « effacer aussi de cet appareil » (appareils partagés/revendus ; les reviewers Apple
   apprécient).
4. **« Rejoindre remplace » — comportement défendable, UI actuelle insuffisante** → A1 + A2.
   Avec le consentement brutal de clarté + export préalable, c'est propre pour la v1.
5. **Backlog P2 — priorités** : ① révocation d'invitation (A3) ; ② effacement local
   optionnel (cf. 3) ; ③ perfs `engine.ts`/`collectLocalDocs`/`ensureFoyer` — **mesurer
   avant d'optimiser** (Sentry perf ou simple console.time sur un gros foyer) ; ④ dédup
   `_shared/` + `fnError`.
6. **RGPD.md — l'essentiel y est** (les 4 sous-traitants + DPA + rétentions). Compléments :
   Resend (A4), rétention Sentry 30 j, et côté business (chat dédié) : **confirmer l'entité
   responsable de traitement** (la SAS française → RGPD frontal + CNDP/09-08 pour le Maroc).

## 3. Plan de travaux

### Étape 1 — Correctifs pré-merge (Claude Code, petit lot)
A1 🔴 (pull → export → consentement avant `acceptInvite`) · A2 🟠 (libellé Quitter) ·
A3 🟠 (TTL 72 h). Portes complètes + 1 test sur le nouveau helper « préparer le départ »
(pull+export) si extractible pur. **Gate : je re-audite le diff (rapide).**

### Étape 2 — QA fonctionnelle staging (Amine, ~30 min, multi-profils navigateur)
Environnement : `manzil-staging.pages.dev`. Technique : **profil Chrome A** (foyer
principal), **profil B** (2ᵉ compte), **incognito** (from-scratch). Deux emails à toi.

| # | Scénario (profil) | Attendu |
|---|---|---|
| Q1 | A : connexion OTP (lien pour l'instant), création paresseuse du foyer, ☁︎ sur l'écran Compte | Compte + foyer créés, sync « à jour » |
| Q2 | A : créer 2 recettes, modifier la semaine → recharger la page | Tout persiste (cloud) ; rien ne « saute » |
| Q3 | Incognito : se connecter avec le **même** email → rituel d'adoption | Feuille « Fusionner » + export téléchargé + données présentes après |
| Q4 | A : générer une invitation → B : rejoindre (code) | **Après correctif A1** : pull+export+confirmation explicite, puis B membre du foyer de A |
| Q5 | A crée une recette ↔ B la voit après pull ; B la supprime ↔ disparaît chez A | Sync croisée + tombstones |
| Q6 | A modifie une recette **hors-ligne** (mode avion réseau), rouvre en ligne | Poussée rejouée, pas d'écrasement (G2) |
| Q7 | B : « Quitter le foyer » | Libellé A2, foyer neuf au rechargement |
| Q8 | A : IA — générer 1 recette, vérifier le compteur ; recharger | Décrément **serveur**, persistant |
| Q9 | B (nouveau compte jetable) : « Supprimer mon compte » | Copy vérifiée, compte supprimé, app utilisable en local ensuite |
| Q10 | A : publier une page → l'ouvrir en incognito (anonyme) | Lien public OK (pré-requis avant 0002 en prod) |

**Gate : zéro bloquant.**

### Étape 3 — Passe de déploiement prod (leur ordre, complété — région UE ✅ acquise)
1. ~~Région~~ **✅ UE confirmée.**
2. **Backup complet (dump) de la prod** avant toute migration ← ajout, filet obligatoire.
3. Migrations dans l'ordre **0001 → 0004 → 0002 → 0003**, avec autour de **0002** :
   snapshot des policies (requêtes du fichier) **avant**, test lien `#e=` anonyme **après**.
4. Edge functions prod (`delete-account`, `generate-recipe`, `invite`, `accept-invite`) +
   secret `ANTHROPIC_API_KEY`.
5. **SMTP Resend** — tester l'OTP 6 chiffres **sur staging d'abord** ; ajouter Resend à
   RGPD.md (A4).
6. Redirect URLs prod dans Supabase Auth (vérifier le base path — leçon P0-3).
7. **Smoke prod pré-merge** (compte jetable) : login → push/pull → publier → lien anonyme →
   supprimer le compte. ← ajout.
8. **Merge** `comptes-sync-v1` → prod.
9. **QA appareil réelle** (Amine, 2 comptes, rejouer Q3-Q10 en conditions vraies) + Sentry
   sous surveillance quelques jours.

### Étape 4 — Post-merge (backlog priorisé, non bloquant)
① Révocation d'invitation (UI owner) · ② « Effacer aussi de cet appareil » · ③ mesure perfs
puis optimisations `engine.ts` · ④ dédup `_shared/` · ⑤ compléments RGPD (Resend, Sentry
30 j, entité responsable — chat business). Ensuite : **lot Coquille (APK Android debug
d'abord)** sur fondation testée, puis push natif.

## 4. Message de lancement (à coller dans Claude Code)

> Audit A1 de l'instance QA sur `comptes-sync-v1` : portes reproduites vertes, P0-1/2/3
> vérifiés conformes. **1 bloquant résiduel + 2 points** avant merge — même registre que tes
> P0 (transitions destructives) : **A1 🔴** le flux « Rejoindre » appelle `accept-invite`
> sans consentement ni filet, alors que le serveur supprime le foyer possédé (sauvegarde
> cloud) avant le rituel d'adoption — implémente **pull final → export JSON auto → écran de
> confirmation explicite** (« ton foyer actuel et sa sauvegarde en ligne seront supprimés »)
> AVANT l'appel, en réutilisant la mécanique du rituel Q1. **A2 🟠** libellé « Quitter le
> foyer » : ajouter la suppression de la sauvegarde cloud (cas owner). **A3 🟠** TTL
> invitation 7 j → **72 h**. Portes complètes + test sur le helper si extractible. Détail :
> `RESTITUTION_A1_ET_PLAN_PROD.md` (§1 findings, §3 plan — la passe prod suivra ce document,
> région UE confirmée). STOP après le correctif pour re-audit du diff.
