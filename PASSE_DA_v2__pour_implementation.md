# PASSE → IMPLÉMENTATION · DA v2 + B1 · Manzil
### Ce que Claude Code reçoit et fait. 18 juillet 2026.

> **En un mot.** La direction artistique a changé. Cette passe fige **B1 (l'accueil)** et pose la **DA v2**
> comme socle. B1 est l'écran de référence ; les autres écrans s'aligneront ensuite **sur le même socle**
> (pas en repeignant à la main).

---

## Fichiers de cette passe
- **`tokens.css` (v2)** — le socle. **Remplace** l'ancienne palette « riad moderne » (tadelakt/olive/Majorelle/safran + Fraunces).
- **`proto-b1-reference.html`** — l'écran B1 finalisé + décisions verrouillées (la maquette qui fait foi).

## À faire, dans l'ordre
1. **Importer `tokens.css`** dans l'app — **⚠️ vérifier d'abord s'il n'y est pas déjà** (ne pas dupliquer un `:root`).
2. **Appliquer la DA v2 à l'accueil (B1)** en suivant `proto-b1-reference.html`.
3. **Ne pas re-skinner les autres écrans dans cette passe** — ils viendront un par un (Cuisine → A7 → …), toujours depuis le socle.

---

## DA v2 — l'essentiel
- **Accent UNIQUE : terracotta `#d9622f`** (imminent, action, pastille). Rien d'autre en terracotta.
- **Base claire nette** `#f8f6f4`, cartes `#ffffff`, **contraste haut** (encre `#1c1815`).
- **Typographie 100% sans** (Plus Jakarta Sans) — **plus de serif**. Titres poids 800, letter-spacing ~-.02em.
- **Zéro filigrane, zéro dégradé décoratif.** Cartes claires.
- **Domaines = code couleur** : Cuisine = ambre `#d98a2e` · Enfants = **bleu layette** (fond `#e4eef8` pâle, **texte `#4a84bd` foncé** pour rester lisible) · Infos clés = violet `#7c5cf0`.
- **Points des jours** (carte Cuisine) : plein = repas posé, vide = jour libre.
- Toutes les valeurs sont dans `tokens.css`.

## Emoji — implémentation
- **Jeu Fluent Emoji Flat embarqué** (Microsoft, **licence MIT**) → rendu **identique Android/iOS**, hors-ligne. **Ne pas** utiliser l'emoji système. **Ne pas** dessiner un jeu maison.
- **Source concrète** : paquet **`@iconify-json/fluent-emoji-flat`** (npm) ou dépôt **`iconify/icon-sets`** (GitHub) — MIT, grille **32×32**. *(Artwork vérifié identique entre npm et la source Iconify.)*
- **⚠️ EMBARQUER, pas de CDN.** Dans l'app, rendre les SVG **inline** ou en **assets bundlés**. La maquette `proto-b1-reference.html` charge les emoji depuis le **CDN Iconify** — c'est **uniquement une béquille de l'aperçu Claude**, à **NE PAS** reproduire dans l'app : un CDN casse l'affichage **hors-ligne**, or l'offline est un invariant (côté personnel surtout). *(Inline SVG et `data:` marchent parfaitement dans un vrai navigateur/webview — c'est seulement l'aperçu Claude qui ne les rend pas, d'où le CDN dans la maquette.)*
- **Icônes utilisées dans B1** (amorce) : `bust-in-silhouette` · `shallow-pan-of-food` · `person-swimming` · `books` · `pot-of-food` · `teddy-bear` · `shield`.
- **Attribution** : dictionnaire **mot-clé → emoji** (local, **déterministe**, hors-ligne) · **repli** sur l'emoji du domaine si rien ne matche · **override** utilisateur au rang 2. *(Même logique que l'emoji déterministe des recettes.)*

## Registre & wording — décidés
- **Vouvoiement in-app** : « Votre foyer », « Bonjour/Bonsoir ». Le personnel s'affiche **« Mon équipe »** *(corrigé PO — voir encadré ci-dessous)*.
- **Salutation** : « Bonjour » / « Bonsoir » selon l'heure (remplace « Salam »).
- Libellés : **La Cuisine** · **Mon équipe** · **Infos clés** (remplace « La Maison »).

## ✅ Vocabulaire — CORRIGÉ PAR LE PO (19/07) — remplace la proposition initiale

> **Cette section remplace la décision "product-wide" de la version précédente**, qui inversait le sens de
> « membre » et créait une dette. Décision PO retenue, au plus simple :

- **Le personnel s'affiche « Mon équipe »** (les *destinataires*, sans compte) — c'est ce qu'affiche l'accueil.
- **« membre » RESTE réservé aux comptes / co-gestionnaires** (avec compte). C'est la table `membres`, ses
  policies RLS, la gestion des accès — **inchangé dans le code et la base.**
- **NE PAS renommer « membre → personnel » nulle part.** Aucun nouveau nom à trouver : « membre » reste aux
  comptes, « mon équipe » est le libellé d'affichage du personnel.
- **Impact réel : QUASI NUL.** Contrairement à la proposition initiale (renommage product-wide), ce choix
  n'ajoute qu'un **libellé d'affichage** (« mon équipe ») là où l'UI montrait le personnel. Zéro changement de
  table, de policy, de code métier. *(La proposition initiale — « Membres » = le personnel — est écartée : elle
  aurait retourné un mot qui vit dans la base, la confusion même qu'on chasse.)*

## Gotcha d'implémentation
- Le **cerclage** de la tuile imminente (`box-shadow` de 2,5px) est **rogné** si le rail (`overflow-x`) n'a pas de **marge haute/basse**. Prévoir un padding vertical sur la bande (cf. la maquette : `padding: 6px 16px`).

## Ouverts (mineurs, non bloquants)
- Emoji de « Infos clés » : **🛡️** (actuel) ou **🔑** (colle au mot).
- Couleur du domaine « Infos clés » : **violet** (actuel) ou **vert** (ancrage).

## ⚠️ Statut
**B1 a un design clos, mais PAS de lot.** L'ordre de livraison gravé s'arrête à la **purge nutrition** ; B1 arrive après. Cette passe est un **socle DA + une référence**, pas un ordre de build de l'accueil. À scoper avant tout chiffrage de B1 : « Briefer » unique · données menu sur l'accueil · dictionnaire mot-clé → emoji.
