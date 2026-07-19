# ÉTAT — Manzil
**Photo de l'état réel · réécrite à chaque clôture de tranche/lot · dernière touche : 19 juillet 2026 (clôture lot simplification transverse, merge `lot-simplification-v1` → défaut, edge `generate-recipe` v2 en prod)**

> **Rôle.** *Où on en est* (rapide). Le *quoi* (lent) = `PROJET_MAISON_OS.md` (côté PO). Le *journal* (append-only, détaillé) = `DEVLOG.md`.
> **Rituel d'ouverture de thread : « Contexte = `PROJET_MAISON_OS.md` + `ETAT.md` ».**
> **Un seul écrivain : Claude Code**, au commit de clôture — **critère de fini du STOP et de la clôture de lot** (CLAUDE.md règle n°1).
> **Règle de survie : une page-écran.** Si ça déborde → ça appartient au DEVLOG ou au parking.
> **Frontière avec le backlog qualité (DEVLOG)** : ETAT = **décidé et planifié** · backlog = **trouvé, pas encore décidé**. Sens unique : backlog → ETAT le jour où une décision le planifie.

## 🔵 En vol

**Lot UI DA v2 « cœur testable »** — branche `lot-ui-v1` (`apk.yml` pointé dessus). Accueil (B1) + Cuisine sur le socle DA v2 (terracotta, 100 % sans, emoji Fluent embarqué). **T0 + T1 CLOS** : pack committé + `tokens.css` importé (T0) · **B1 re-skinné** (bande Aujourd'hui, héros La Cuisine + points, duo Les enfants/Infos clés, « Mon équipe », vouvoiement, Bonjour/Bonsoir) · **emoji Fluent EMBARQUÉ** (43 SVG bundlés via `gen-fluent.mjs` + `Em.tsx` — **preuve offline : mode avion, 0 requête CDN**) · purge `--mz-*` de `mz.css` (**preuve : capture Cuisine avant/après identique à l'octet**) · modèle d'action intact (pastilles par personne). Décisions gravées : `gouter?` **optionnel + gardes, pas de migration** (tolérance bidirectionnelle du modèle local — **zéro fenêtre prod**) · goûter = plat seul · « اللمجة » · 16:30 🍪 · recette légère = lever la porte UI `AddRecipeSheet` (modèle intact) · « Briefer » hors lot · « Gérer › » attend A7. Reste : **T2** Cuisine socle (en-tête + pastille règles, sélecteur, footer) → **T3 4 moments** (2 tests bloquants : lien perpétuel + sync ancien client) → **T4** radial + recette légère → **T5** Recettes. Réf : `BRIEF_CUISINE_UX__CLAUDE_CODE.md` · le prototype cliquable **fait foi**.

**Lot simplification transverse : CLOS le 19/07** — app « foyer particulier » → **app généraliste**. T1 (purge nutrition : macros/calcium/calories/objectif retirés, porte grep **par suppression**) + T2a (client tolérant, bandeau relecture v2, merge intermédiaire `ef13db2`) + T2b (**edge `generate-recipe` v2 déployée en prod, version 14**) : hardcode « 100% SANS GLUTEN / calcium enjeu n°1 » **mort** → contraintes **dynamiques par foyer** via `reglesSystem` ; `guard.ts` (module pur testé CI : anti-injection `cleanRegles`, garde G3 lexical `alerteRegles`, **halal exclu**) ; `adaptations[]` rapporté ligne à ligne ; `estimate`/macros supprimés ; **Opt-C** darija conservée. Portes CI : `edge-no-hardcode` + `guard`. 185 tests. **1 fenêtre token** (staging ×2 idempotent → prod `201` v14 → invocation prod `401` propre → parité `0 écart` → token révoqué + **mort vérifiée 401**). Foyer sans règle → gluten possible (**hardcode mort prouvé**). Récit : `DEVLOG.md`.
**Audit sécurité §7.8 : CLOS le 18/07** (Ambition A) — ④ cache d'une page révoquée coupé (complément client de F1) · C4 « Retirer » Nounou câblé · ⑥ registre RGPD complété. ①/② confirmés fermés par AS-2/0006 (rien recodé). ③⑤①-résidu au parking avec leur signal. **Mergé au défaut**, 172 tests · zéro fenêtre token. **Bloquant A7-C4 levé.** Récit : `DEVLOG.md` · fiche : `READBACK_AUDIT_SECURITE.md`. *(Ambition B — chasse offensive : avant lancement public.)*
**Mini-lot destinataires : CLOS le 18/07** — T1 « échecs silencieux » (revoke honnête session-d'abord · `revoked` supprimé · `backedUp?` · cache 404-only ×2) + T2 remappage `'ar'`→`'dr'` (migration idempotente 2 portes, fil v:1 intact, `cuisineSig` stable, D6, verrou statique). **Device migration ✓ 4/4** (appareil existant, destinataire darija d'avant), **mergé au défaut**. 163 tests · zéro fenêtre token. **Le prérequis dur d'A7 est levé.**
**Lot Cuisine : CLOS le 18/07** — T1→T7 + C1 + C2 (device foyer neuf ✓), mergé au défaut. 143 tests · 2 fenêtres token closes (0009 · 0010+edge v13, parité 0). Récit : `DEVLOG.md` · audit : `READOUT_QUALITE_LOT_CUISINE.md`.

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
