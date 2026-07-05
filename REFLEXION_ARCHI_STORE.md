# Réflexion archi & implémentation — vers le store (Manzil)

> **Posture : ce document n'ouvre pas de décisions, il les instruit.** Il reprend
> ma réflexion sur le passage natif (Capacitor) et l'étend aux briques que soulève
> Amine — hébergement, base de données, authentification & comptes, paywall,
> transverse. Chaque axe : **état actuel · options · mon penchant (avis, pas
> décision) · questions ouvertes**. Objectif : que l'instance de brainstorm/QA
> l'intègre à sa réflexion globale **avant** qu'on tranche quoi que ce soit.
> Écrit par l'instance qui code. Base : `refonte/bento-v1`. 2026-07-05.

---

## 0. La colonne vertébrale (à lire en premier)

Ces briques **ne sont pas indépendantes**. Une réalisation structurante les relie :

> **Comptes + base cloud par utilisateur (RLS) = la clé de voûte.** Elle débloque
> d'un coup : la **sauvegarde**, le **multi-appareil**, la **récupération de compte**,
> **et** l'**entitlement du paywall**. Presque tout le reste en découle.

Deux conséquences non-évidentes que je porte, comme implémenteur :

1. **Le quota IA est aujourd'hui *front-only*** (décision L3-2, assumée). Pour un
   **vrai paywall**, l'entitlement et le quota doivent passer **côté serveur** (une
   edge function vérifie le droit *avant* d'appeler Anthropic) — on ne peut pas faire
   confiance au client sur ce qui coûte de l'argent.
2. **La donnée est sensible : la page Nounou contient des données de mineurs**
   (prénoms, santé, allergies, école, urgences). La **vie privée / RGPD** n'est pas un
   axe à part — c'est une **contrainte transverse** qui pèse sur l'hébergement, la DB,
   l'auth et même les pages reçues.

---

## 1. Rappel — direction native : **Capacitor** (convergence des deux instances)

- **On ne réécrit pas.** L'app web actuelle (React/Vite/TS, local-first, testée) est
  embarquée dans une coquille native ; **un seul code** pour web + iOS + Android.
- **Argument qui tranche** : les **pages reçues restent du web pur** (le personnel
  n'installe rien). Toute autre voie (React Native/Flutter) imposerait **deux
  codebases** avec le moteur de rendu des pages dupliqué. Capacitor garde **un seul code**.
- **Ce que le natif débloque** : notifications push réelles (résout le backlog rappel
  L3-5), stockage plus durable qu'en PWA iOS (IndexedDB dans le conteneur, hors
  éviction Safari), partage WhatsApp natif, contacts, haptique/splash/icône.
- **Points que le brief « Lot Capacitor » doit me faire trancher au read-back** :
  deux cibles de build (web `/Heath/` vs natif base relative + **SW désactivé**) ;
  **auth OTP** (petit écran de code) ; permissions micro (`MediaRecorder` déjà
  multi-format et défensif → vérif device, pas réécriture) ; config bundle id/signing.
- **Levier à ne pas oublier** : **OTA / live-updates** (Capgo/Appflow) — pousser des
  correctifs de la couche web **sans repasser la revue store**.
- **Séquence** : ① finir QA + merge ② coquille (builds internes) ③ natif propre (OTA,
  safe-areas, icônes, partage) ④ push + soumission. Le lot coquille est **additif**
  (dossiers `ios/`/`android/`), il ne touche pas le web → démarrable juste après merge.

---

## 2. Hébergement

**Actuel** : GitHub Pages (statique, gratuit) sert **deux choses** : (a) l'app admin
(qui deviendra aussi le bundle Capacitor), (b) les **pages reçues `#e=`** (web, doivent
rester). Base servie sous `/Heath/`. Les digests du prototype citent déjà `manzil.ma`.

| Option | Pour | Contre |
|---|---|---|
| **Rester GitHub Pages + domaine custom** (`manzil.ma`) | Gratuit, simple, déjà en place ; le domaine custom **supprime le souci `/Heath/`** et professionnalise les liens reçus | Pas de logique serveur ; couplé au repo ; previews/analytics limités |
| **Cloudflare Pages / Netlify / Vercel + domaine** | Meilleure DX, previews, analytics, **edge functions** propres, région EU | Une migration (faible) ; un fournisseur de plus |

**Mon penchant** : **domaine custom `manzil.ma` rapidement**, quel que soit l'hébergeur.
Gain triple : crédibilité (Apple 4.2), **confiance des pages reçues** (un lien `manzil.ma/p/…`
rassure plus que `…github.io`), et **simplification du base-path** pour web + Capacitor.
Le choix Pages-vs-Cloudflare est secondaire ; Cloudflare Pages a ma préférence si on veut
de l'edge (utile pour le point paywall/entitlement, cf. §5).

**Questions ouvertes** : domaine `manzil.ma` déjà réservé ? région d'hébergement (EU pour
la donnée mineurs) ? veut-on des edge functions hors Supabase (Cloudflare Workers) ou tout
concentrer sur Supabase ?

---

## 3. Base de données & synchronisation

**Actuel** : **local-first, IndexedDB = source de vérité.** Supabase Postgres ne stocke
que les **espaces publiés** (lignes à jeton-capability) + l'audio (bucket `shared`). Les
**recettes / menus / destinataires / sécurité / doc nounou vivent UNIQUEMENT sur
l'appareil.** ⇒ **pas de sauvegarde, pas de multi-appareil : perdre le téléphone = tout perdre.**
C'est la dette n°1 pour un produit de store avec de vrais utilisateurs.

| Option | Ce que ça donne | Coût / risque |
|---|---|---|
| **Statu quo local-first** | Simple, offline, privé | Aucune sauvegarde/récup ; inacceptable à terme |
| **Sync « pragmatique » Supabase (RLS par `user_id`)** : push-on-save / pull-on-login, last-write-wins, doc JSONB par utilisateur | Sauvegarde + multi-appareil de base ; reste dans l'écosystème ; effort modéré | Conflits gérés grossièrement (LWW) ; schéma + migration du modèle local |
| **Moteur local-first** (PowerSync, ElectricSQL, Replicache/Yjs) sur Postgres | Sync offline **propre** + résolution de conflits, taillé pour exactement notre cas | Brique d'infra sérieuse ; sur-dimensionné si l'édition multi-appareil simultanée reste rare |

**Mon penchant** : garder **le local-first comme modèle d'UX** (c'est un atout, pas un
défaut) et ajouter une **couche de sauvegarde/sync cloud par utilisateur (Supabase, RLS)**.
Commencer **pragmatique** (push/pull LWW, doc JSONB par rôle) — l'app écrit déjà des docs
JSON, la marche est courte ; **n'introduire un moteur local-first** (PowerSync/Electric)
que si le multi-appareil *simultané* devient réel. **Contrainte non négociable** : RLS
stricte + région EU + chiffrement au repos (données mineurs).

**Questions ouvertes** : périmètre synchronisé (tout, ou d'abord recettes+nounou+sécurité) ?
stratégie de conflits acceptable en v1 (LWW suffit ?) ? rétention & **export de données**
(portabilité RGPD + confiance : « exporte le savoir de ta maison ») ? faut-il chiffrer
côté client le sensible avant upload ?

---

## 4. Authentification & gestion de compte

**Actuel** : Supabase **magic link** (→ OTP en natif), **un seul utilisateur implicite**,
connexion **optionnelle** (nécessaire seulement pour publier). Pas de gestion de compte.

**Bascule structurante** : dès qu'il y a **paywall** et **sync**, l'auth devient
**obligatoire** (identité = porteur de l'abonnement + des données) → un **vrai onboarding**.

| Sujet | Options / contraintes |
|---|---|
| **Méthode** | **Email OTP** (prévu, simple, mobile-friendly). Ajouter Google/Apple ? ⚠️ **Apple impose « Sign in with Apple »** (guideline 4.8) *si* on propose un autre social login → soit **email seul**, soit **ajouter Apple** |
| **Gestion de compte** | Profil, déconnexion, **suppression de compte in-app OBLIGATOIRE** côté Apple (5.1.1(v)) dès qu'il y a création de compte — **à construire**, pas optionnel |
| **Modèle : par parent ou par foyer ?** | **Fork produit majeur.** Le savoir du foyer est partagé entre **deux parents** → veut-on un **espace « foyer »** (inviter le 2ᵉ parent) ? Ça touche la DB (workspace partagé), le paywall (abonnement par foyer vs par personne) et l'auth (rôles/invitations) |

**Mon penchant** : **email OTP en primaire** (évite le mandat Apple Sign In au départ),
Apple/Google **plus tard** si utile ; construire **profil + suppression de compte** dès le
lot « comptes » (exigence store) ; **trancher tôt** le fork **par-parent vs par-foyer** car
il conditionne DB + paywall. Intuition produit : le foyer est l'unité naturelle (deux
parents, un même savoir) → un **espace foyer avec invitation** serait plus juste, mais c'est
plus de travail — **à instruire, pas à décider ici**.

**Questions ouvertes** : un ou deux comptes par foyer ? invitation du conjoint en v1 ou v2 ?
que devient la donnée locale existante à la première connexion (migration → compte) ?

---

## 5. Paywall / monétisation

**Actuel** : gratuit. **Le vrai 🔴** (déjà signalé) : Apple/Google prélèvent **15–30 %** sur
les abonnements **numériques** vendus in-app, et **imposent leur IAP** pour le digital
(règles en évolution EU/US). À instruire **avant** d'activer un abonnement.

**Atout déjà en place** : **le quota IA est la couture freemium naturelle.** L'éthique
produit est déjà « **l'IA est un accélérateur, jamais un péage** » (saisie manuelle
gratuite/illimitée). Donc le paywall gate **l'accélérateur** (IA, traductions, collections
riches), **pas le cœur**. Et c'est aligné avec le **coût variable réel** = les appels
Anthropic des edge functions.

| Brique | Options |
|---|---|
| **Modèle** | Freemium (cœur gratuit + IA/traductions payantes) — mon penchant, cohérent avec l'existant. Abonnement mensuel/annuel |
| **Facturation native** | **RevenueCat** (abstraction cross-store : reçus, entitlements, iOS+Android, **webhooks → Supabase**) — standard, fait gagner des semaines |
| **Facturation web** (si vente hors app) | Stripe — mais il faut **réconcilier l'entitlement** web/natif (RevenueCat ou table maison) |
| **Source de vérité de l'entitlement** | Table `subscriptions`/`entitlements` Supabase, mise à jour par **webhooks** RevenueCat/Stripe, **lue côté serveur** |

**Conséquence d'implémentation que je porte** : **déplacer le quota/entitlement IA
côté serveur.** Aujourd'hui `aiQuota` est front-only ; un paywall crédible exige qu'une
**edge function vérifie le droit avant d'appeler Anthropic** (sinon contournable en vidant
le stockage). C'est le principal chantier back du paywall.

**Mon penchant** : **freemium, la couture = le quota IA/traductions déjà bâti**, cœur
gratuit à vie (fidèle à l'éthique), **RevenueCat** pour la facturation native +
entitlement synchronisé sur Supabase, **Stripe/web différé**. App **gratuite au seed** au
lancement = **zéro friction de revue** le temps d'instruire l'IAP.

**Questions ouvertes** : prix / palier(s) ? quota gratuit cible (les 5/mois actuels ?) ?
abonnement par foyer ou par personne (cf. §4) ? vend-on aussi sur le web ?

---

## 6. Transverse (« autre ») — à ne pas oublier

- **Application côté coût** : Pages gratuit ; **Supabase free tier** sera dépassé avec de
  vrais usages (stockage audio, lignes DB, invocations edge, bande passante) ; **Anthropic**
  = coût par génération/traduction. L'économie **conditionne le paywall** (le prix doit
  couvrir l'IA). À modéliser tôt.
- **Enforcement serveur** (cf. §5) : quota/entitlement IA → edge function.
- **Sécurité des pages reçues** : URL à **jeton-capability** (non devinable) = bon modèle,
  mais **lecture publique par quiconque a le lien**. Pour de la donnée d'enfants, un
  **jeton + expiration/PIN optionnel** mérite discussion. Question ouverte, pas un blocage.
- **RGPD / données de mineurs** (transverse) : politique de confidentialité, **DPA Supabase**,
  région **EU**, minimisation, rétention, chiffrement au repos, droit à l'effacement/export.
  **Première classe**, pas une case à cocher.
- **Observabilité** : crash reporting (Sentry) devient nécessaire pour une app de store.
- **Analytics** : minimal et respectueux (données sensibles → conservateur ; PostHog
  self-host ou rien).
- **Environnements** : aujourd'hui **un seul** projet Supabase + prod Pages. Un vrai produit
  veut **dev/staging/prod** séparés (secrets, données de test).
- **i18n admin** : admin en FR uniquement — probablement suffisant (cible foyers
  marocains/francophones) ; le **contenu reçu** est déjà multilingue (darija/ar/en).

---

## 7. Comment ça s'imbrique (dépendances)

```
                 ┌─────────────────────────────┐
                 │  Comptes + DB cloud (RLS)    │  ← clé de voûte
                 └───────┬───────────┬─────────┘
        sauvegarde/multi-appareil    │            entitlement
                 │                    │                 │
        ┌────────▼─────┐      ┌───────▼──────┐   ┌──────▼───────┐
        │  RGPD /      │      │  Auth OTP +  │   │  Paywall     │
        │  mineurs     │      │  suppr. compte│  │  (RevenueCat)│
        │  (transverse)│      │  foyer vs perso│ │  + quota back │
        └──────────────┘      └──────────────┘   └──────────────┘
   Hébergement (domaine manzil.ma) : transverse, faible effort, débloque crédibilité + base-path
   Capacitor : le véhicule ; le push résout le rappel L3-5 ; OTA = itération sans revue
```

**Ordre logique de décision** (pas d'exécution) : ① **modèle de compte (foyer vs personne)**
— il commande DB + paywall ; ② **stratégie DB/sync** (pragmatique LWW vs moteur) ; ③ **paywall**
(modèle + RevenueCat + quota serveur) ; ④ **hébergement/domaine** (indépendant, faisable tôt).
Le tout **après** le merge de la refonte et **en parallèle** du lot Capacitor coquille (additif).

---

## 8. Ce que j'attends de la réflexion globale (pour que je puisse exécuter ensuite)

Pour chaque axe, un **read-back** me fera trancher avec toi ces points sensibles **avant code** :
compte **foyer vs personne** ; **périmètre + conflits** de la sync ; **méthode d'auth** (email
seul vs +Apple) ; **modèle & prix** du paywall + **passage du quota côté serveur** ; **domaine
+ région** d'hébergement ; **posture RGPD** (EU, chiffrement, rétention). Aucune de ces
décisions n'est prise ici — ce document sert à ce qu'elles soient prises **éclairées**.
