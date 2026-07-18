# ÉTAT — Manzil
**Photo de l'état réel · réécrite à chaque clôture de tranche/lot · dernière touche : 18 juillet 2026 (clôture audit sécurité §7.8, merge `audit-securite-v1` → défaut)**

> **Rôle.** *Où on en est* (rapide). Le *quoi* (lent) = `PROJET_MAISON_OS.md` (côté PO). Le *journal* (append-only, détaillé) = `DEVLOG.md`.
> **Rituel d'ouverture de thread : « Contexte = `PROJET_MAISON_OS.md` + `ETAT.md` ».**
> **Un seul écrivain : Claude Code**, au commit de clôture — **critère de fini du STOP et de la clôture de lot** (CLAUDE.md règle n°1).
> **Règle de survie : une page-écran.** Si ça déborde → ça appartient au DEVLOG ou au parking.
> **Frontière avec le backlog qualité (DEVLOG)** : ETAT = **décidé et planifié** · backlog = **trouvé, pas encore décidé**. Sens unique : backlog → ETAT le jour où une décision le planifie.

## 🔵 En vol

**Lot simplification transverse** — branche `lot-simplification-v1`. **T1 CLOSE (validée PO, CI+APK verts `0e354f2`)** : purge nutrition · fusion régime→`nePasManger` (double « sans » mort) · porte grep en CI. **STOP dédié : read-back prompt v2 livré (`READBACK_PROMPT_V2.md`) — ⏸ attente GO** (3 questions : halal dans le garde G3 lexical (a)/(b) · Opt-C darija · ordre des 2 déploiements). T2 = edge (hardcode `SYSTEM` disparaît, garde G3 lexical serveur, `adaptations[]` rapporté, **seule fenêtre token**) + client bandeau relecture v2 (Pages). Prérequis PO avant fenêtre : poser « gluten » dans `nePasManger`. Fonds de départ éditorial + consignes personnel = HORS lot.
**Audit sécurité §7.8 : CLOS le 18/07** (Ambition A) — ④ cache d'une page révoquée coupé (complément client de F1) · C4 « Retirer » Nounou câblé · ⑥ registre RGPD complété. ①/② confirmés fermés par AS-2/0006 (rien recodé). ③⑤①-résidu au parking avec leur signal. **Mergé au défaut**, 172 tests · zéro fenêtre token. **Bloquant A7-C4 levé.** Récit : `DEVLOG.md` · fiche : `READBACK_AUDIT_SECURITE.md`. *(Ambition B — chasse offensive : avant lancement public.)*
**Mini-lot destinataires : CLOS le 18/07** — T1 « échecs silencieux » (revoke honnête session-d'abord · `revoked` supprimé · `backedUp?` · cache 404-only ×2) + T2 remappage `'ar'`→`'dr'` (migration idempotente 2 portes, fil v:1 intact, `cuisineSig` stable, D6, verrou statique). **Device migration ✓ 4/4** (appareil existant, destinataire darija d'avant), **mergé au défaut**. 163 tests · zéro fenêtre token. **Le prérequis dur d'A7 est levé.**
**Lot Cuisine : CLOS le 18/07** — T1→T7 + C1 + C2 (device foyer neuf ✓), mergé au défaut. 143 tests · 2 fenêtres token closes (0009 · 0010+edge v13, parité 0). Récit : `DEVLOG.md` · audit : `READOUT_QUALITE_LOT_CUISINE.md`.

## ⚪ File d'attente — ordre verrouillé

1. **Audit sécurité §7.8** — + A7-C2/A7-C4 en durcissement · reliquat `create_foyer` (`public`/`anon`).
2. **Lot simplification transverse** — purge nutrition (méthode gravée au DEVLOG : production d'abord, flag T2 = carte, porte par suppression) **+** prompt v2 **+ revue éditoriale du Fonds de départ** *(30 recettes = protocole personnel : « Msemmen SG », « batbout GF », « Creami (whey) » ×2 — même racine que le `SYSTEM` hardcodé. Premier contenu du chantier §7.2)*. *Signal = audit clos. Prérequis : poser « sans gluten » dans les Réglages du foyer PO **avant** la bascule.* → `PROPOSITION_PROMPT_V2_GENERATE_RECIPE.md` *(committé — schéma v2, règles au SYSTÈME, rapport `adaptations`, Opt-C darija à valider au read-back)*
3. **Lot A7** — implémentation *(design clos ; film mesuré + spec §8 à venir)*.
4. **Lot visuel « Riad moderne »** — passe 2, à part.

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
