# DÉCISIONS — Passage store (v1, à valider)
### `DECISIONS_STORE_V1.md` · 5 juillet 2026 · répond au §8 de `REFLEXION_ARCHI_STORE.md`

> Chaque décision : **ce qu'on décide · pourquoi (friction minimale / best practice) ·
> conséquences · ce que ça exclut**. Statut : ☐ à valider par Amine — coche ou amende,
> puis ce document part à Claude Code comme cadre de ses read-backs.
> Orientations de cadrage : best practices éprouvées, budget OK pour une stack pro,
> RGPD traité sérieusement (posture en D8). **v1 = tout gratuit** ; la monétisation est
> reportée (recherche business + app mûrie), sans créer de dette d'architecture.
> Amendé le 5 juillet : D2 (identité Manzil, pas store ID), D4 (sync complète ≠ local-only),
> D5 (tout gratuit en v1).

---

## D1 ☐ — Véhicule natif : **Capacitor**, codebase conservée
Un seul code web + iOS + Android ; pages reçues inchangées (web pur). OTA (Capgo) activé
dès la coquille pour itérer sans revue store — dans les limites des guidelines (correctifs
de la couche web, jamais de changement de nature de l'app).
**Exclut :** React Native / Flutter / réécriture (réévaluable M12+ ; logique métier TS portable).

## D2 ☐ — Modèle de compte : **foyer = entité Manzil ; multi-membres spécifié au schéma**
Identité = compte **Manzil** (email OTP → `user_id` **chez nous**), **jamais** un Apple/Google
ID (la mère iPhone + le père Android doivent partager le même foyer ; la récup doit survivre
à un changement d'écosystème). Les stores ne servent **qu'à la facturation** (reçu →
RevenueCat → entitlement posé **sur le foyer**). Schéma dès le jour 1 : table `foyers`, table
`membres` (`user_id`, `foyer_id`, rôle `owner`/`membre`), **un seul foyer par utilisateur** en
v1 ; toute donnée rattachée au `foyer_id`. Invitation du 2ᵉ parent (email/code, opération
**serveur**) **construite** au lot Comptes+Sync — **activée pour tous en v1** (cf. D5),
architecturée pour devenir un **levier premium** plus tard sans refonte. Suppression de compte :
un membre **quitte** le foyer, l'owner **supprime** le foyer.
**Exclut :** foyer rattaché à un ID de store ; données sur `user_id` (migration douloureuse) ;
multi-foyer par utilisateur (complexité B2B inutile) ; rôles fins au-delà de owner/membre en v1.

## D3 ☐ — Auth : **email OTP seul en v1**, comptes complets, jamais bloquante à l'ouverture
Pas de social login au lancement (esquive le mandat Apple Sign In). L'auth n'est exigée
**qu'au moment où elle sert** (publier, synchroniser) — le « essaie d'abord » est conservé.
Le lot comptes inclut d'office : profil, déconnexion, **suppression de compte in-app**
(exigence Apple 5.1.1(v)) et **rituel d'adoption** de la donnée locale à la première
connexion (adoptée par le compte, jamais écrasée, confirmation explicite).
**Exclut :** Google/Apple sign-in v1 (ajoutables plus tard) ; SMS OTP (coût/complexité).

## D4 ☐ — Données : **sync cloud complète, local-first (≠ local-only)**
Correction d'un abus de langage de nos docs : l'app actuelle est **local-only** (aucune sync)
= dette de POC, pas un choix pro. Cible : l'app lit/écrit **localement** (instantané, offline)
**ET** synchronise **tout** le contenu du foyer vers le cloud — sauvegarde, **multi-appareil**,
récupération de compte : le standard d'une app pro. Couche Supabase RLS par `foyer_id`,
push-on-save / pull-on-login, périmètre = tout ce que l'utilisateur crée (recettes, semaines,
destinataires, sécurité, doc nounou, réglages). **Export JSON** dans le même lot (invariant
« contenu portable » + portabilité RGPD + confiance).
Résolution de conflits = **last-write-wins par document** en v1 : le seul trade-off réel est
*simplicité de conflit maintenant vs fusion fine plus tard* — suffisant pour **un seul éditeur,
même multi-appareil** ; imperceptible pour l'utilisateur. Moteur de fusion fin
(PowerSync/Electric) introduit **seulement si** l'édition simultanée à plusieurs le justifie
(≈ arrivée réelle du 2ᵉ parent actif).
**Exclut :** rester local-only ; sync partielle par sous-ensemble ; moteur de sync lourd tant
qu'aucun conflit réel ne l'exige.

## D5 ☐ — Monétisation : **TOUT GRATUIT en v1 — aucun paywall construit**
Décision Amine : **tout est gratuit et débloqué au lancement** — quota IA généreux/ouvert,
2ᵉ membre, collections, traduction. **On ne construit aucune mécanique de facturation en v1** :
pas de RevenueCat, pas d'IAP, pas de gate premium. Rationnel : sortir vite une app **propre**,
maximiser adoption + habitude, et **instruire les paliers plus tard** (recherche business +
produit mûri). Zéro friction de revue store.
**Une seule précaution d'architecture, à coût nul aujourd'hui** — pour ne pas se fermer la
porte : (a) garder le **quota IA côté serveur dès qu'il y a un backend** (une edge function
appelle Anthropic → c'est là que vivra un jour l'entitlement ; on ne veut pas dépendre d'un
compteur client contournable) ; (b) les points d'ancrage naturels d'un futur freemium — **volume
d'IA, 2ᵉ membre du foyer, collections premium** — sont déjà des frontières *structurelles*
(serveur / invitation serveur / catalogue), donc gatables plus tard **sans refonte**. La
**traduction restera hors couture** (cœur de la transmission, différenciateur darija) — noté
pour mémoire, non implémenté.
**Exclut :** construire un paywall, RevenueCat ou de l'IAP en v1 ; figer un prix ici ; gater
quoi que ce soit maintenant.

## D6 ☐ — Hébergement : **domaine `manzil.ma` MAINTENANT ; Cloudflare Pages à la coquille**
Achat/vérification du domaine **cette semaine** (les digests le citent déjà ; il conditionne
la crédibilité Apple, la confiance des liens reçus, et supprime le base-path `/Heath/` qui
compliquerait Capacitor). Migration GitHub Pages → **Cloudflare Pages** dans le lot coquille :
previews par branche (règle au passage « la préview vit sur l'URL de prod »), analytics,
edge disponible. Région/UE pour tout ce qui héberge de la donnée (cf. D8).
**Exclut :** rester durablement sur `github.io` pour des liens envoyés à de vraies familles.

## D7 ☐ — Observabilité & environnements : **le minimum pro**
Sentry (crash reporting) dès la coquille ; **staging séparé** (2ᵉ projet Supabase + preview)
au lot comptes/sync ; analytics produit : rien ou PostHog minimal, **jamais** sur le contenu.
**Exclut :** analytics tierces bavardes dans une app qui contient des données d'enfants.

## D8 ☐ — RGPD / vie privée : **posture claire sur l'UGC**
Lecture juridique de départ : le parent qui saisit sa maison relève de l'**exemption
domestique** — mais **Manzil, hébergeur de ces données, est responsable de traitement** ;
au Maroc c'est la **loi 09-08 (CNDP)** qui s'applique d'abord, le RGPD s'ajoute pour la
diaspora UE. Notre **local-first est l'argument de conformité n°1** (minimisation par
architecture : rien ne touche le serveur avant publication/sync). Le paquet devient non
négociable **au lot sync** : région EU + DPA Supabase, RLS stricte, chiffrement au repos,
politique de confidentialité lisible (FR), suppression + export in-app (déjà en D3/D4),
rétention définie, et **étude « expiration / PIN optionnel » sur les liens reçus** (un lien
WhatsApp se transfère). Pas de sur-juridicisation au seed ; rien construire qui rende la
conformité douloureuse ensuite.
**Exclut :** traiter le RGPD comme une case à cocher de fin de projet ; toute analytics sur
le contenu des pages.

---

## Séquence validée (exécution)
1. **Maintenant** : finir QA → **merge** refonte · **acheter `manzil.ma`** (action Amine).
2. **Lot Comptes + Sync** (la clé de voûte, la vraie dette) : schéma foyers/membres, OTP,
   adoption de la donnée locale, **sync cloud complète** (LWW), export JSON, suppression de
   compte, invitation 2ᵉ parent (gratuite), staging, paquet RGPD. Quota IA **côté serveur**.
3. **Lot Coquille** (additif) : Capacitor iOS/Android, builds internes (TestFlight / internal
   testing), OTA, Sentry, migration Cloudflare Pages + domaine. *(Peut chevaucher le lot 2 :
   il ne touche pas le modèle de données.)*
4. **Lot Push** : rappels natifs (résout le backlog L3-5) + assets stores.
5. **Soumission — app entièrement gratuite** aux deux stores.
6. **Plus tard, hors v1** : chantier monétisation (recherche business) → *si* validé, paliers
   + RevenueCat + activation des gates sur les frontières déjà en place (D5). Aucune dette
   d'ici là.

> Note d'ordonnancement : la **sync** passe **avant** la coquille — c'est la vraie dette (une
> app pro sauvegarde et suit l'utilisateur sur ses appareils), et la coquille n'en dépend pas.

## Questions restant ouvertes (aucune ne bloque 1–3)
Q-a Prix/paliers : reporté au chantier monétisation (hors v1). · Q-b PIN/expiration des liens
reçus : instruire au lot sync (D8). · Q-c Périmètre exact de la première adoption locale→cloud
(tout d'un coup vs par store) : chiffrage Claude Code. · Q-d Vente web (Stripe) : sans objet
tant que tout est gratuit.

---

## Addendum lot Cuisine (15 juillet 2026) — 2 décisions produit GRAVÉES

**Restrictions du foyer = UN SEUL endroit, verrouillé (D2 du lot Cuisine).** Allergies (champ
libre), halal, régime vivent dans Réglages Cuisine → « Restrictions du foyer », attachées au
`foyer_id` (store de sync `'foyer'` sur la table `docs` — zéro SQL). Elles s'appliquent d'office
aux imports (montrées, « à vérifier », jamais silencieuses — G1·G2·G3) et alertent la page de la
cuisinière. La fiche enfant Nounou ne bouge pas ; AUCUNE passerelle construite (parquée).

**« Partager » une recette = AJOUT AU MENU puis partage (D1 du lot Cuisine).** Jamais un second
canal de transmission : défaut = prochain repas à venir COMPATIBLE avec le moment (jamais un plat
au Matin), créneau occupé annoncé avant le tap. Un brouillon ne se partage pas (le bouton n'existe
pas — cohérence topologique avec la relecture obligatoire) : on valide d'abord.
