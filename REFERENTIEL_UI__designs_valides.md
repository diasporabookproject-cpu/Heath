# RÉFÉRENTIEL UI — designs validés · Manzil
### La porte d'entrée des écrans dont le design est **clos**. Un seul endroit pour les retrouver.

> **Ce que contient ce document.** Uniquement les designs **validés** (structure + direction graphique
> arrêtées PO). C'est la **source de vérité visuelle** — ce qu'on ouvre pour voir « à quoi ça ressemble,
> pour de vrai ». Les itérations qui ont mené aux décisions vivent ailleurs (cf. bas de page) ; elles ne
> sont **pas** ici, pour ne pas induire en erreur.
>
> **Ce que « validé » veut dire ici.** Le **design** est clos. Ça ne veut **pas** dire « livré » ni même
> « a un lot ». Chaque entrée porte son **statut d'implémentation** distinct.
>
> **Où vivent les fichiers.** `docs/maquettes/*.html` au repo (une maquette validée se committe, elle ne
> vit pas dans un chat). Ce référentiel les **liste et les qualifie** ; il ne les remplace pas.
>
> **Règle de tenue.** Une **maquette de référence par écran**, point. On ajoute une entrée quand un design
> se ferme ; on met à jour son statut quand il avance (design → spec → implémentation → livré).

---

## Le catalogue

> **⚠️ MISE À JOUR — DA v2 (18 juil., plus tard dans la journée).** La direction artistique a évolué :
> **accent terracotta**, **bleu layette** pour les enfants, **typo 100 % sans** (fin du serif Fraunces),
> base claire nette, **vouvoiement in-app**, salutation **Bonjour/Bonsoir**. Wording : **La Cuisine**,
> **Mon équipe**, **Infos clés**. Décision vocabulaire (**corrigée PO 19/07**) : le personnel s'affiche
> **« Mon équipe »** ; **« membre » reste réservé aux comptes** (table `membres`, policies — inchangé) ;
> ne jamais renommer « membre → personnel ». État finalisé →
> **`proto-b1-reference.html`**, **`tokens.css` v2**, **`PASSE_DA_v2__pour_implementation.md`**.
> *(Le socle visuel `DESIGN_SYSTEM__socle.html` et les fiches détaillées ci-dessous montrent encore la v1 —
> à rafraîchir ; la vérité DA est `tokens.css` v2.)*

| Écran | Fichier de référence | Design | Implémentation |
|---|---|---|---|
| **Fondations · Design system** | `tokens.css` **v2** (`src/tokens.css`) · socle visuel à rafraîchir | 🟢 **Socle DA v2** | ✅ importé (lot UI, T0) |
| **B1 · Accueil** | `proto-b1-reference.html` | 🟢 **Finalisé DA v2** | 🔨 **lot UI DA v2** (T1) |
| **Cuisine** (menu · biblio · projection) | `cuisine/CUISINE-prototype-cliquable.html` (4 moments, fait foi) · `cuisine/CUISINE-maquettes-compilees.html` (états — libellés périmés) | 🟢 **Validé DA v2** | 🔨 **lot UI DA v2** (T2→T5) |
| **A3 + A4** (composer un menu) | `proto-a3-a4-cliquable.html` | 🟢 Validé (DA v1) | absorbé dans le lot Cuisine |
| **A7 · Turnover** (Retirer / Gérer / Ajouter) | `proto-a7-cliquable.html` | 🟢 Validé (DA v1) | 🟡 spec §8 · à ré-aligner v2 |

*Légende : 🟢 design clos · 🟡 décisions posées, reste une étape · 🔨 en cours de build · ⚠️ pas encore de lot.*

---

## Fondations · Design system — *le socle, 18 juillet 2026*

**Fichiers : `DESIGN_SYSTEM__socle.html`** (le socle rendu, à regarder) **+ `tokens.css`** (le fichier, à
importer). Extrait tel quel de B1, c'est le **spine partagé** : les maquettes **et** l'app réelle boivent aux
mêmes tokens. On aligne les écrans en partant de lui — **pas** en repeignant chacun à la main (ça recrée la
dérive qu'on vient de corriger).

Ce qu'il fige : **couleurs** (surfaces, encre, marque, domaine + teintes), **typo** (Fraunces titres / Plus
Jakarta UI), **rayons & ombres**, **composants** (carte, pastille+emoji, tuile, points des jours, ligne
équipe, actions, cerclage safran), et la **règle emoji** (Fluent Plat embarqué · dictionnaire mot-clé → emoji
· repli domaine · override). *Lois : un seul accent safran ; couleur de domaine = code de lecture ; zéro
filigrane, zéro dégradé ; photo sur la fiche recette.*

**⚠️ Côté app réelle :** Claude Code importe `tokens.css` — **mais vérifie d'abord s'il n'y est pas déjà**
(ne pas dupliquer). **Garde-fou :** éprouver le socle contre le **registre de la page reçue** (calme,
soulagement) avant de le figer côté personnel.

---

## B1 · Accueil — *nouvelle entrée, 18 juillet 2026*

**Fichier : `proto-b1-reference.html`.** L'écran d'accueil, en un seul rendu. Remplace **toutes** les
explorations B1 (`proto-navigation-b1-a7`, `b1-*`).

**Structure — verrouillée.** Trois blocs, doctrine *planifier / exécuter* :
- **Aujourd'hui** *(je consulte)* — une **seule bande** horizontale, tuiles égales, un seul titre. La tuile
  imminente est **cerclée safran** (pas de tag « Bientôt »).
- **Ton foyer** *(je prépare)* — **Cuisine en héros** (grande carte + bande de jours), Les enfants et La
  maison en deux cartes de soutien.
- **Ton équipe** *(je briefe)* — une ligne compacte ; une **pastille safran = une action** ; « Gérer › »
  ouvre la gestion (patron A7).

**Direction graphique — verrouillée.**
- **Emoji Fluent Plat** (Microsoft, licence **MIT**), **embarqué** dans l'app → rendu **identique
  Android/iOS**, hors-ligne. *Écarté : le jeu d'icônes maison (fini, pousse au cliché type « tagine ») ;
  l'emoji système (brillant, enfantin, variable selon l'OS).*
- **Aucun filigrane, aucun dégradé décoratif.** Cartes claires, palette « riad moderne » (tadelakt / terra /
  olive / Majorelle / safran), **Fraunces** (titres) + **Plus Jakarta Sans** (UI).
- **Points des jours** dans la carte Cuisine : point **plein** = repas posé, point **vide** = jour libre.
- **Cases repas** = **emoji du plat + nom + heure**, sur teinte douce (**chaud** = repas, **froid** =
  enfant). **Pas de photo dans la bande** — la photo du plat vit sur la **fiche recette**.
- Emoji posé par **dictionnaire mot-clé → emoji** (local, **déterministe**, hors-ligne), **repli** sur
  l'emoji du domaine si rien ne matche, **override** au rang 2. *(Même plomberie que l'emoji déterministe
  des recettes.)*

**⚠️ Design clos — mais PAS un lot.** L'ordre de livraison gravé s'arrête à la **purge nutrition** ; B1
arrive après. **À scoper avant tout chiffrage :**
1. **« Briefer » unique** réécrit le modèle d'action (`Envoyer > Briefer > Planifier > ✓`) — décision B1 ou
   décision produit qui part seule ?
2. La bande **veut les données menu sur l'accueil** (couplage à cadrer).
3. Le **dictionnaire mot-clé → emoji** est un petit chantier en soi (constitution, langues, override).

---

## Ce qui n'est PAS ici (et où le trouver)

- **Les explorations** (les dizaines de `b1-*`, `a7-*`, `maquette-*` qui ont mené aux décisions) →
  `INDEX_MAQUETTES.md` (la carte complète, avec l'avertissement A7↔B1) et le détail du raisonnement dans
  `JOURNAL_DES_PARCOURS__UX_passe1.md`.
- **Les parcours pas encore fermés** (A1, A2, A5, B2, B3…) → même journal, statuts ⬜/🔵/🟡.
- **L'état d'avancement réel du produit** (lots, ordre de livraison) → `ETAT.md` au repo.

*Ce référentiel ne dit pas où on en est ; il dit **ce qui est beau et arrêté**. Pour l'état, c'est `ETAT.md`.*
