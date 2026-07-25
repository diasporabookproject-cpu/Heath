# ÉTAT — Manzil
**Photo de l'état réel · réécrite à chaque clôture de tranche/lot · dernière touche : 25 juillet 2026 (clôture lot Refonte mise en page Cuisine, merge `lot-cuisine-refonte-v1` → défaut)**

> **Rôle.** *Où on en est* (rapide). Le *quoi* (lent) = `PROJET_MAISON_OS.md` (côté PO). Le *journal* (append-only, détaillé) = `DEVLOG.md`.
> **Rituel d'ouverture de thread : « Contexte = `PROJET_MAISON_OS.md` + `ETAT.md` ».**
> **Un seul écrivain : Claude Code**, au commit de clôture — **critère de fini du STOP et de la clôture de lot** (CLAUDE.md règle n°1).
> **Règle de survie : une page-écran.** Si ça déborde → ça appartient au DEVLOG ou au parking.
> **Frontière avec le backlog qualité (DEVLOG)** : ETAT = **décidé et planifié** · backlog = **trouvé, pas encore décidé**. Sens unique : backlog → ETAT le jour où une décision le planifie.

## 🔵 En vol

**Rien en vol.** Prochain : au choix du PO — revue éditoriale du Fonds de départ (file n°1) · lot A7 (file n°2).

**Lot Refonte de la mise en page Cuisine (Option B, DA v2) : CLOS le 25/07** — mergé au défaut (`lot-cuisine-refonte-v1`, merge --no-ff), **les deux workflows repointés au défaut**. La maquette est adoptée **en entier** ; référence versionnée : `docs/maquettes/maquette-cuisine-finetune.html`.
- **T1 vue jour** — les 4 cartes de moment égales → **carte-repas HÉROS** (le **prochain repas à servir**, `hero.ts`/`pickHeroKey` testé ; dégradé + emoji Fluent par défaut, **vraie photo du plat si elle existe** via `PlatPhoto`, miroir exact de `FichePhoto`) + « le reste de la journée » en tuiles ; jour vide → **invitation** (disque, « Copier une journée », 4 moments tuilés). Nom de plat en **serif `'Fraunces'` EXPLICITE**.
- **T2 vue semaine** — cartes-jour `.cz-dcard` (date · résumé des plats · compteur ; `.void` « à composer » ; `.today`). **La semaine devient une vue d'ensemble : la carte mène à la journée**, où l'on compose (le geste `onOpenMeal` → radial/composeur est intact, un cran plus loin).
- **T3 finitions** — pastille régime = **icône de réglages** (lit les **vraies `ReglesFoyer`** : foyer neuf = « Aucune restriction », jamais de valeur en dur) ; passe pixel des deux vues (puces de jour, pastille semaine, contexte de date, en-tête semaine) ; la bande de jours **ancre le jour affiché** même passé (conséquence de T2).
- **Non touchés** (invariants tenus) : payload de la page reçue (**lien perpétuel**), `prochain.ts` (accueil B1), `MealKey`. **228 tests · 3 smokes** (Cuisine re-routé par la vue jour, robuste à la date ; 2 ancres régime).
- **Écarts à la maquette, assumés et signalés au PO** : « Partager » reste sur un jour vide (chemin d'accès/QR, un parcours réel en dépend) · titre « **Menu de la semaine** » et chevrons de navigation conservés (F1.3, vocabulaire verrouillé) · pastille régime laissée dans l'en-tête (atteignable depuis les deux vues).

**Lot Partage + suivi des tâches : CLOS le 21/07** — mergé au défaut (`lot-partage-v1`, merge --no-ff). **Premier flux BIDIRECTIONNEL** du produit. A : feuille d'envoi refondue (maquette — « Partager avec {nom} », message court + toggle Français|الدارجة, bulle WhatsApp, Accès permanent QR frigo + copier le lien, registre neutre). B : suivi des tâches — journal insert-only **`espace_checks` en prod** (migration 0011, policies **par jeton vivant** = jointure d'existence sur `espaces` → révocation rend les coches illisibles, prouvé staging+prod, parité 0), offline-first (file + cache, LWW par item), page reçue (cases sur **tout le menu** + tâches, tâches fr seul §7.4), retour employeur dans l'**aperçu** (lecture seule + « N coché · vu HH:MM »). **Bout-en-bout validé device.** `cl?`/`tasks?` optionnels à jamais (lien perpétuel prouvé). **223 tests · 3 smokes**. Réf : `READBACK_PARTAGE.md` · récit : `DEVLOG.md`.

**Lot UI DA v2 « cœur testable » : CLOS le 20/07** — mergé au défaut. Accueil B1 + Cuisine sur le socle DA v2 (terracotta, emoji Fluent 3D embarqués, 4 moments, geste radial, recette légère, Recettes vide/plein). 203 tests. Récit : `DEVLOG.md`.


## ⚪ File d'attente — ordre verrouillé

1. **Revue éditoriale du Fonds de départ** — *HORS lot simplification (le moteur est déjà neutre : hardcode mort). Reste le **contenu** : 30 recettes = protocole personnel PO (« Msemmen SG », « batbout GF », « Creami (whey) » ×2 — même racine que l'ancien `SYSTEM`). Éditorial à neutraliser pour un foyer lambda. Chantier §7.2.*
2. **Lot A7** — implémentation *(design clos ; film mesuré + spec §8 à venir)*.
3. **Lot visuel « Riad moderne »** — passe 2, à part.

## 🟡 Chantier UX — passe 1 (simplicité & fluidité)

**Traités :** A3+A4 (composer/grain) · A6 (bibliothèque) · volet C partiel → **lot Cuisine** · **A7** (design clos).
**Restants :** **A1** parcours roi · **A2** les envois · **A5** Nounou page blanche · **B1** accueil *(piste radiale)* · **B2** Sécurité legacy · **B3** compte & accès.

## 🔴 Bloquants avant mise en ligne

- **A7-C2** — le token survit au renommage (faille **symétrique** Cuisine + Nounou) → durcissement des liens, parking « avant lancement public »
- **Naming** — deadline dure = 1ᵉʳ upload store · **domaine `manzil.ma`** (bloque landing + branding des liens)
- **RGPD** — registre des traitements : **ligne « allergies → relais IA » RÉDIGÉE** (DEVLOG, clôture C1) — à porter au registre (PO)

## 📦 Parking — assumé, avec son signal de réouverture

| Sujet | Pourquoi parqué | Rouvrir si… |
|---|---|---|
| Semaines favorites | « copier la précédente » couvre le levier | l'usage réclame des modèles |
| « Proposer un repas » | l'IA n'est pas une vitrine ; `mealBudgets` conservé | — |
| **Option 2 — fusion** (une personne, plusieurs domaines) | vrai prix = **compat perpétuelle** des payloads publiés | **un foyer crée deux personnes du même prénom** |
| Accusés de lecture (perdus à la coupure — D9) | personne ne l'a demandé | l'usage le réclame |
| Passerelle allergies enfants ↔ foyer | D2 : un seul endroit | — |
| Push natif · ICS · PIN/expiration des liens | §7.5 | — |
| Gate de traduction du sensible | §7.4 — non bloquant aujourd'hui | **avant mise en ligne publique** |
| **Halal sans filet mécanique** (garde G3 lexical le couvre PAS) | Le halal est un concept COMPOSÉ (interdits + mode d'abattage invisible dans une liste d'ingrédients) — un garde lexical mentirait sur sa couverture. Repose sur le modèle + la relecture humaine. Décision lot simplification T2 (option (a)). | **chantier sécurité alimentaire** (pas ce lot) |
| **Durcissement des liens** (expiration · PIN · rotation) — audit §7.8 ③/A7-C2 | Protège du lien oublié/fuité — risques qui n'existent qu'avec du **trafic public**. Options instruites (`READBACK_AUDIT_SECURITE.md`). *Rotation au renommage DÉFINITIVEMENT écartée : une faute de frappe corrigée casserait le lien légitime (readout A7).* | **avant lancement public** |
| **`create_foyer` — message d'erreur propre** — audit §7.8 ⑤ | Le spam est déjà borné à **1 foyer/compte** (`membres.unique(user_id)`) ; reste un échec *propre* au lieu d'une violation de contrainte. Ne vaut pas une fenêtre token maintenant. | **sous trafic réel** |
| **Rate-limit des accusés anon** (`espace_opens insert`) — audit §7.8 ①-résidu | Insert anon volontaire (l'accusé s'écrit sans compte) → « Dernier accès » spammable. Nuisance, **pas une fuite** (la lecture est fermée, 0006). Ingénierie pour risque marginal. | **sous trafic réel** |
| Module Entretien maison (socle référentiel→espace) | aucun demandeur | un foyer le demande · A7 ouvre la 3ᵉ sorte |
| Kit d'installation (QR imprimable, aide iOS) | jamais réclamé depuis F1 | l'onboarding réel coince |
| Repas verrouillés · export PDF · contenu sous nav-bar Android | jamais réclamés / lot visuel | l'usage · passe 2 |
| Nettoyage bucket `shared` (fichiers de test) | mineur, dashboard | prochain passage dashboard |

## ⚠️ Ouvert — à trancher

- **D4 + D10 contre le modèle** — un rôle sans écran dédié (Chauffeur/Entretien/Famille) ne doit voir que « La maison ». Or `PersonneKind = 'cuisine'|'nounou'` et le `menu` est **inconditionnel** dans `publishEspace` : un Chauffeur recevrait le menu, ou pire le planning des enfants. → 3ᵉ sorte ou payload conditionnel (≈ un pas vers l'option 2). **À trancher dans la spec A7.**
- **Vocabulaire banni proposé par l'UI** — `PartageSheet.ROLES` (« Cuisinière »… + défaut de création rapide), idem FTUE. → **A7/D2** (neutralité, liste ouverte + « Autre… »).
- **Le code de l'arabe standard SUR LE FIL** — `'ar'` dans les payloads `espaces` v:1 = darija, pour toujours (compat perpétuelle). L'élargissement D5 (4 langues Cuisine) devra porter le MSA sous un autre contrat : **proposition = `v: 2`** (champ existant) où `langue` adopte le vocabulaire catalogue ; lecteurs gardent l'interprétation v:1. **À valider avant D5 — que l'élargissement ne le découvre pas.**
- **Tag Q3 : défaut ou filtre ?** — T6 filtre la **liste entière** des créneaux (l'amendement visait le seul défaut) ; le tag devient fonctionnel, or la chakchouka au petit-déj est un usage réel. **Senti au device C2 sans blocage signalé** — rouvrir si l'usage coince (le filtre redeviendrait un défaut).
