# BRIEF — Lot « Comptes + Sync » (la clé de voûte)
### `BRIEF_COMPTES_SYNC_CLAUDE_CODE.md` · **v1.1** · 5 juillet 2026
### v1.1 intègre ton `READBACK_LOT_COMPTES_SYNC.md` : tes questions sont **tranchées** ci-dessous (§3) — tu peux passer directement au chiffrage final.

> **Objet.** Passer de *local-only* (dette de POC : perdre le téléphone = tout perdre) à
> **local-first synchronisé** : comptes Manzil, foyers, sauvegarde cloud, multi-appareil,
> récupération. Cadre décisionnel : `DECISIONS_STORE_V1.md` (D2, D3, D4, D7, D8) **+ la
> clarification D5 actée avec Amine** : le gratuit total v1 est un confort de test, **le
> premium est acté** (paliers plus tard) — les trois coutures (① volume IA serveur ·
> ② membres via invitation serveur · ③ partage avancé via capacités identifiables) sont
> **posées structurellement dès ce lot, débloquées pour tous**.
> Prérequis : **merge de la refonte Bento** (sinon, branche depuis `refonte/bento-v1`).

**Méthode inchangée, avec UNE nouveauté.** Ce lot touche Supabase (le premier) : **toute
évolution de schéma passe par des migrations SQL versionnées** (`supabase/migrations/`),
relues au read-back du sous-lot concerné, appliquées après GO — rien en manuel non tracé.
Policies RLS **testées**. Branche `comptes-sync-v1`, livraison sous-lot par sous-lot, STOP
entre chaque.

---

## 1. Invariants de ce lot (non négociables)

- **L'app reste 100 % utilisable sans compte** : l'auth n'est demandée **qu'au moment où
  elle sert** (publier, synchroniser, IA). Aucun écran de login à l'ouverture, jamais.
- **L'UX locale ne change pas** : lecture/écriture instantanées sur IndexedDB ; la sync est
  invisible (arrière-plan), jamais un spinner bloquant ; le local reste la source de
  lecture/écriture, le cloud = sauvegarde + miroir (tes « garanties » §5 : confirmées).
- **Les pages reçues `#e=` ne changent pas** : lecture publique par jeton, intouchée.
- **Identité = compte Manzil** (email OTP → `user_id`), jamais un ID de store (D2).
- **Tenancy : `foyer_id` partout sur le contenu**, jamais `user_id` (ta Q6 : confirmé,
  invariant).
- **Tout débloqué en v1, aucune UI de paiement** — mais les trois coutures premium restent
  **serveur** (D5 clarifiée) : rien d'illimité côté client.
- **Région EU** pour toute donnée hébergée (D8) — vérification en S0, potentiellement
  structurante (ton read-back ne la couvre pas : c'est le premier geste du lot).

## 2. Architecture cible

**Schéma cloud (migrations S1) :**
- `foyers (id, created_at, owner_user_id)`
- `membres (foyer_id, user_id, role 'owner'|'membre', created_at)` — **un foyer par
  utilisateur** (contrainte unique `user_id`).
- `invitations (id, foyer_id, email, code, expires_at, accepted_by)` — création/acceptation
  **serveur** (couture premium ②, gratuite/ouverte en v1, comptabilisée).
- `docs (foyer_id, store, doc_id, payload jsonb, updated_at, deleted_at null, updated_by)` —
  **DÉCISION (diverge de ton S1)** : table **générique** plutôt que des tables typées par
  contenu. Rationnel : un seul moteur de sync, une seule policy RLS, des tombstones
  uniformes, zéro besoin v1 de requêter le contenu côté serveur (le cloud est un miroir).
  Les tables typées ne se justifieront que si un besoin serveur concret apparaît
  (requêtes/validation) — si tu vois un tel besoin **dès maintenant**, conteste avec le cas
  d'usage précis au chiffrage final, sinon générique.
- `ai_usage (foyer_id, month, used)` — quota IA **serveur** (couture ①).
- **`espaces` + `foyer_id` (nullable + backfill)** — ton §2-5 : adopté. Gestion côté auteur
  (lister/révoquer), RLS **côté auteur seulement**, lecture publique par jeton inchangée
  (couture ③ : capacités identifiables).
- RLS partout : accès si `auth.uid()` membre du foyer ; `ai_usage` lecture seule client.

**Moteur de sync (client) :** push-on-save débouncé + file offline persistée ; pull au
login, au focus et périodique léger ; **LWW par document** sur `updated_at` **posé par le
serveur** au push ; tombstones dans les deux sens ; `syncedAt` local par doc pour le delta ;
**garde anti-écrasement** : jamais de pull sur un doc localement « dirty » non poussé.
Indicateur discret ☁︎ sur l'écran Compte uniquement.

## 3. Tes questions — tranchées

- **Q1 (fusion local↔cloud, le risque n°1)** : ta proposition validée — **union par id,
  LWW par document sur collision** — avec **un ajout obligatoire** : **export JSON local
  automatique avant toute première fusion** (filet de sécurité ; l'export de S6 arrive donc
  en brique technique dès S3). La fusion est précédée d'un écran de confirmation explicite
  (« ta maison sur cet appareil va rejoindre le foyer X »), jamais silencieuse.
- **Q2 (doc Nounou)** : **blob entier LWW en v1** (ta reco = la mienne). Mono-éditeur
  assumé ; l'éclatement en entités n'arrive que si le 2ᵉ parent actif crée des conflits
  réels. La garde anti-écrasement (§2) est la protection minimale exigée.
- **Q3 (audio)** : **inclus en v1 si ton chiffrage reste 🟡** — bucket **privé par foyer**
  (RLS storage), upload différé/wifi-friendly acceptable. Rationnel produit : « la voix est
  la référence, jamais synthétisée » — une recette perdue se retape, **une voix perdue est
  perdue**. Si ton chiffrage passe 🔴 : différé, avec bannière d'honnêteté sur l'écran
  Compte (« tes notes vocales ne sont pas encore sauvegardées ») + entrée backlog.
- **Q4 (quota IA)** : tranchée (plafond serveur généreux). **Valeur v1 : 100 générations /
  mois / foyer**, constante serveur modifiable sans redéploiement client. Le compteur front
  devient un affichage de l'état serveur ; l'IA exige désormais une session (cohérent §1 :
  c'est un « moment où l'auth sert »).
- **Q5 (adoption)** : ta proposition validée — **tout d'un coup, atomique par store,
  transactionnel**, avec l'export préalable de Q1.
- **Q6 (tenancy)** : confirmé, invariant §1.

**Restent ouvertes pour ton chiffrage final** (mes questions, absentes de ton read-back) :
- **QA — Région du projet Supabase actuel ?** Si hors UE : nouveau projet EU + bascule —
  chiffre les deux voies (les espaces publiés existants migrent ou expirent ?). À traiter
  en S0 avant toute migration.
- **QB — Suppression du foyer** : sort des **espaces publiés** (liens chez le personnel) ?
  Reco : révocation avec avertissement explicite dans la confirmation — propose.
- **QC — Fréquence du pull périodique** et coût (invocations/bande passante) : propose.

## 4. Sous-lots (ta décomposition, réordonnée : fondations d'abord)

| # | Sous-lot | Contenu | Base chiffrage |
|---|---|---|---|
| S0 | **Fondations** | Vérif **région** (QA) ; projet **staging** + config par env ; outillage migrations ; **Sentry** | ton S7, remonté : on ne migre pas un schéma sans staging ni filet |
| S1 | **Schéma + RLS** | Tables §2 (dont `espaces.foyer_id` backfill) + policies + **tests RLS** | ton S1 🟡 |
| S2 | **Auth OTP + Compte** | Écran code 6 chiffres, création lazy du foyer (owner), profil, déconnexion, **suppression de compte** (Apple 5.1.1(v)) ; **rituel d'adoption** (Q5 + export préalable Q1) | ton S2 🟡 |
| S3 | **Moteur de sync** | §2 client complet + **fusion Q1** + garde anti-écrasement ; scénario 2 appareils | ton S3 🔴 — le cœur |
| S4 | **Invitation 2ᵉ membre** | Email/code serveur, rôle membre, révocation owner — gratuite, comptabilisée | ton S5 🟡 |
| S5 | **Quota IA serveur** | Edge functions : foyer via JWT, vérif/incrément `ai_usage` **avant** Anthropic ; plafond 100 (Q4) | ton S6 🟡 |
| S6 | **Export + suppressions** | Export JSON complet (déjà brique en S3, ici l'UI) ; quitter le foyer ; supprimer le foyer (cascade + QB) | ton S4 🟢 élargi |
| S7 | **Paquet RGPD** | Politique FR (gabarit par toi, contenu Amine), rétention proposée, DPA/chiffrement vérifiés, **instruction** PIN/expiration des liens (note d'options, pas d'implémentation) | transverse, clôture |

**Ordre : S0 → S1 → S2 → S3 → (S4·S5·S6 parallélisables) → S7.** RGPD en continu.
**En parallèle, hors lot** : ton **mini-spike build iOS** (signature Apple) — accepté, timeboxé
à une journée, ne bloque rien, entre au DEVLOG.

## 5. Qualité

Typecheck/tests/build verts par sous-lot ; **tests nouveaux** : LWW, tombstones, file
offline, fusion (Q1), policies RLS, quota serveur ; **scénario E2E deux appareils** joué et
documenté (créer sur A → B ; supprimer sur B → A ; édition offline rejouée) ; zéro régression
pages reçues/publication/hors-ligne ; DEVLOG par sous-lot avec section **« migrations
appliquées »**.

## 6. UX imposée

Connexion présentée comme un **bénéfice**, jamais une barrière : « Mets ta maison à l'abri —
sauvegardée, sur tous tes appareils ». Moments de sollicitation : premier envoi (existant),
moment IA (nouveau, Q4), écran Compte, bannière discrète optionnelle sur Maison si non
connecté. Registre habituel (tutoiement, chaleureux, honnête).

## 7. Hors périmètre

Paywall/IAP/RevenueCat (coutures posées, rien d'activé) · coquille Capacitor (lot suivant ;
le spike iOS n'en est pas le début) · push natif · implémentation PIN des liens (instruit
S7) · moteur de sync fin (PowerSync/Electric) · éclatement du doc Nounou · multi-foyer ·
rôles au-delà de owner/membre.

---

## 8. Message de lancement (à coller tel quel dans Claude Code)

> Lis `BRIEF_COMPTES_SYNC_CLAUDE_CODE.md` **v1.1** (tes Q1–Q6 y sont tranchées, §3) +
> `DECISIONS_STORE_V1.md`. Branche `comptes-sync-v1` après merge de la refonte. Schéma
> uniquement par migrations versionnées, RLS testée. Rends maintenant ton **chiffrage final**
> par sous-lot S0→S7 (§4) + réponses **QA/QB/QC** (§3) + contestation éventuelle de la table
> `docs` générique (avec cas d'usage concret) + liste de ce que tu couperais. QA (région) se
> traite en S0 avant toute migration. Après mon GO : S0 d'abord, livraison sous-lot par
> sous-lot, qualité complète (typecheck · tests dont RLS/LWW/fusion · build · scénario 2
> appareils · captures), DEVLOG avec « migrations appliquées », STOP entre les sous-lots.
> Invariants §1 : app 100 % utilisable sans compte, UX locale intacte, pages reçues
> intactes, tout débloqué mais coutures serveur.
