> **📦 ARCHIVE (contexte : `coquille-v1`, 2026-07-07).** Ce document a été écrit pour la
> première coquille (`coquille-v1`), **recréée depuis en `coquille-v2`** (décision du
> 2026-07-11, cf. DEVLOG). Les DÉCISIONS restent valables : Q-c1→Q-c5, gel de l'appId
> `studio.elysia.foyer` au premier upload store, les « 8 pièges » du natif. Les détails
> d'implémentation (webDir `dist`, `.env.local` non lu) sont OBSOLÈTES — voir `BUILD_NATIF.md`.

# GO — Lot « Finitions + Coquille » : décisions & lancement
### `GO_COQUILLE_DECISIONS.md` · 6 juillet 2026 · réponse au `READBACK_COQUILLE.md`

## 1. Décisions rendues (les deux bloquants levés)

- **Domaine : `elysia.studio`** (entité d'Amine) — sert les **deux** usages :
  - **Expéditeur Resend** : sous-domaine transactionnel **`send.elysia.studio`**
    (adresse d'envoi type `code@send.elysia.studio`). Remplaçable après le naming sans
    impact code (simple re-vérification Resend).
  - **appId : `studio.elysia.foyer`** (domaine inversé de l'entité + segment
    produit-neutre). Remplace le provisoire `com.dbp.foyer`. Conforme à la règle
    « l'appId porte l'entité, jamais le produit » → il peut même **survivre au naming**.
    Gel définitif au premier upload store.
- **Cut-list Q-c5 : validée en totalité** (6 coupes), backlog tracé au DEVLOG.
- **Séquencement : C0 démarre immédiatement** (pur code) ; **F1 en parallèle** dès que les
  créds Resend sont prêtes (voir §2). Limitation transitoire documentée : pas de login en
  natif avant F1 — sans impact sur les tests navigation/UX (app 100 % utilisable sans compte).
- **C2** : la checklist des 8 pièges sera jouée par Amine sur ses appareils **à partir d'une
  fiche de scénarios pas-à-pas** fournie par l'instance QA à la livraison de C1.
- **C3** : compte Apple fourni à ce moment-là ; spike signature inclus (jamais exécuté — acté).

## 2. Pas-à-pas Resend (Amine, ~15 min + propagation DNS)

1. **Créer le compte** sur resend.com (email de l'entité).
2. **Domains → Add domain** : saisir **`send.elysia.studio`** (le sous-domaine, pas le
   domaine racine — ça isole la réputation d'envoi et ne touche pas tes usages existants
   d'`elysia.studio`).
3. Resend affiche **3 enregistrements DNS** (2 TXT dont DKIM + 1 MX de retour) → les poser
   **chez le registrar d'`elysia.studio`**, tels quels, sur le sous-domaine indiqué.
   Propagation : de quelques minutes à quelques heures ; Resend passe le domaine à
   **Verified** tout seul.
4. **API Keys → Create** : clé de type **SMTP/sending** (pas besoin de scope full).
5. ⚠️ **Transmission de la clé — jamais dans un fichier du repo ni dans un chat versionné** :
   colle-la **directement dans Supabase** (Dashboard → Auth → SMTP settings, staging d'abord)
   ou passe-la à Claude Code par un canal jetable. Une clé SMTP qui fuite = du spam envoyé
   en ton nom.
6. Signale « Resend prêt » à Claude Code → il pilote le reste (config SMTP staging → tests
   code 6 chiffres → prod), conformément à F1.

*(F2, plus tard, sur demande de Claude Code : créer l'utilisateur `smoke@elysia.studio`
avec mot de passe dans le Dashboard prod — 1 minute.)*

## 3. Message de GO (à coller tel quel dans Claude Code)

> GO. **C0 démarre immédiatement** ; F1 en parallèle — domaine d'envoi :
> **`send.elysia.studio`** (je crée le compte Resend et pose les 3 DNS ; je te transmets la
> clé SMTP hors-repo, tu pilotes staging → prod). **Q-c1 tranché : appId
> `studio.elysia.foyer`** (entité `elysia.studio` inversée + segment neutre — remplace
> `com.dbp.foyer` ; gel au premier upload store, deadline naming au DEVLOG). **Cut-list Q-c5 :
> validée en totalité**, backlog au DEVLOG. **C2** : je jouerai la checklist des 8 pièges sur
> mes appareils à partir de la fiche de scénarios que l'instance QA fournira à la livraison
> C1 — préviens quand l'APK est dans les artifacts. **C3** : compte Apple fourni à ce
> moment-là, spike signature inclus. **F2** : je créerai `smoke@elysia.studio` au Dashboard
> quand tu me le demandes. Ordre confirmé : **F1 ∥ C0 → C1 → C2 → STOP QA → C3 → F2 → F3 →
> F4**. Rappel des invariants : le web ne bouge pas d'un pixel (diff dist web = néant), les
> liens publiés depuis le natif pointent vers l'URL web (piège n°8 = critère de fini), export
> JSON et micro = critères de fini à part entière.

## 4. Prochains jalons

| Qui | Quoi | Quand |
|---|---|---|
| Amine | §2 Resend (compte + DNS + clé) | maintenant, en tâche de fond |
| Claude Code | C0 puis C1 → **APK en artifact CI** | immédiat |
| Instance QA | **Fiche de test APK** (8 pièges en scénarios pas-à-pas) | à la livraison C1 |
| Amine | Checklist C2 sur appareils réels | à réception APK + fiche |
| — | STOP QA → GO C3 (iOS, compte Apple) | après C2 vert |
