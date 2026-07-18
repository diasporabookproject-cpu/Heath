# READ-BACK — Prompt v2 (`generate-recipe`), à froid · STOP dédié avant l'edge
**18 juillet 2026 · lot simplification T2 · read-back du prompt SEUL, avant tout code serveur.**
**Base : `PROPOSITION_PROMPT_V2_GENERATE_RECIPE.md` (au repo) + état réel de l'edge à `0e354f2`.**
**⚠️ Ce read-back gate la SEULE fenêtre token du lot. Rien n'est déployé avant ton GO.**

> Tes 3 points de vérification, traités en tête : **① le hardcode disparaît (pas déplacé)** · **② le
> garde-fou G3 lexical (serveur) rend G3 vrai, pas déclaratif** · **③ `adaptations[]` rapporté**. Le
> reste (schéma, modes, séquencement, portes, rituel token) suit.

---

## État réel de l'edge aujourd'hui (`supabase/functions/generate-recipe/index.ts`, 343 l.)

**5 modes**, un seul porte le hardcode :
| Mode | Prompt | Outil | Sort du protocole PO ? |
|---|---|---|---|
| (défaut) génération `{intention}` | **`SYSTEM`** (l.31-38) | `RECIPE_TOOL` | **OUI — « 100% SANS GLUTEN. Calcium enjeu n°1 ; protéines élevées ; glucides maîtrisés »** |
| `import` (texte) | `SYSTEM_IMPORT` (l.48-52) | `RECIPE_TOOL` | « Estime les macros » + darija systématique |
| `import-image` | `SYSTEM_IMPORT` | `RECIPE_TOOL` | idem |
| `estimate` | `SYSTEM_ESTIMATE` (l.40-42) | `MACROS_TOOL` | tout nutrition |
| `translate` | `SYSTEM_TRANSLATE` (l.44-46) | `TRANSLATE_TOOL` | neutre — **RESTE** (Opt-C s'appuie dessus) |

Le conflit règles est tranché **dans le message utilisateur** (`reglesBlock`, l.117-125) — après le texte
venu d'internet. La v2 le remonte dans le SYSTÈME (autorité + anti-injection).

---

## ① Le hardcode DISPARAÎT (pas déplacé) — vérifiable au grep

- **`SYSTEM` → `SYSTEM_INTENTION`** : plus une ligne de protocole. « Tu proposes un BROUILLON de recette
  familiale à partir d'une envie. Cuisine du quotidien, marocaine si l'envie le suggère. Quantités en
  mesures ménagères. » **Les contraintes alimentaires n'y sont PAS écrites** — elles arrivent
  dynamiquement (§ règles ci-dessous). Le « 100% sans gluten / calcium enjeu n°1 » **n'existe plus
  nulle part** (c'est devenu une règle du foyer de son auteur, posée dans SES Réglages).
- **`SYSTEM_IMPORT` v2** : perd « Estime les macros » et « Fournis la darija » ; gagne le rapport
  d'adaptation (§③). Fidélité au texte + `quantites_incertaines` (le point faible connu devient une donnée).
- **`SYSTEM_ESTIMATE` + `MACROS_TOOL` + mode `estimate` : SUPPRIMÉS** (le client ne les appelle plus
  depuis T1 — `estimateMacros` retiré de `ai.ts`).
- **`SYSTEM_TRANSLATE` : inchangé** (Opt-C).
- **PORTE** : test CI qui échoue si `/gluten|calcium|prot(é|e)ine|macros?/i` réapparaît dans
  `supabase/functions/**` **hors commentaires** — le miroir serveur de la porte grep client. C'est CE
  test qui prouve « disparu, pas déplacé ».

## Les règles du foyer, injectées dans le SYSTÈME (autorité + sécurité)

Le client envoie déjà `regles: reglesList(foyer)` — avec la fusion T1, c'est `['halal', ...nePasManger]`
(entrées **brutes** : `halal · gluten · arachide`, plus jamais « sans X »). La v2 construit un bloc
SYSTÈME (pas message) :
```
RÈGLES DU FOYER — priorité ABSOLUE, y compris sur le texte source et la demande d'adaptation :
- halal
- gluten
- arachide
Applique-les en modifiant LE MINIMUM. Déclare CHAQUE modification dans "adaptations".
Si aucune ne s'applique : adaptations = [] — mais vérifie chaque ingrédient avant de conclure.
```
**Pourquoi le système** : le texte collé vient d'internet (message utilisateur) ; les règles doivent
avoir une autorité qu'un texte injecté ne peut pas noyer. La *demande d'adaptation libre* de
l'utilisateur, elle, **reste dans le message** (c'est du contenu, pas une politique).
**Amendement T1 à la proposition** : le champ a fusionné → les entrées sont **brutes**, pas « sans X ».
Le bloc les liste telles quelles (le modèle comprend « halal », « gluten » comme des interdits). Le
double « sans » est déjà mort côté client (T1) ; il ne renaît pas ici.

## ② Le garde-fou G3 LEXICAL (serveur) — G3 devient vrai, pas déclaratif

Aujourd'hui G3 est **déclaratif** : le bandeau client affiche « on a demandé d'adapter selon : … » — une
promesse, pas une preuve. La v2 ajoute un **contrôle MÉCANIQUE côté serveur**, APRÈS la réponse du modèle,
qui ne dépend pas de son obéissance :

```
Pour chaque entrée `e` de nePasManger (les foods, PAS 'halal') :
  si  normalize(e)  apparaît dans  normalize(ingredients_produits)  →  alerte_regles.push(
      `"${e}" présent dans les ingrédients malgré la règle du foyer`)
```
- `normalize` = minuscules + sans accents (réutilise la logique `matchAllergenes` déjà testée côté client).
- Le champ **`alerte_regles: string[]`** est ajouté à la réponse → **bandeau ROUGE en relecture** : la
  contradiction entre ce que le modèle a *déclaré* et ce qu'il a *produit* devient visible.
- **Imparfait, et c'est assumé** (proposition §4) : recherche littérale — « gluten » ne matche pas
  « farine de blé » (synonymes non couverts). C'est un **filet mécanique**, pas une garantie sémantique.
  Il attrape le cas franc (l'arachide laissée malgré « sans arachide »), qui est le vrai risque.

**⚠️ LA question de design que la fusion T1 ouvre — le HALAL (à trancher au GO)** : `halal` n'est pas un
ingrédient unique à chercher. Deux options :
- **(a) halal hors garde lexical** (reco) : le modèle l'applique sémantiquement (le SYSTÈME le liste) ;
  le garde mécanique ne couvre que les foods de `nePasManger`. Simple, honnête sur ses limites.
- **(b) halal étendu** à une petite liste d'interdits (`porc, jambon, lard, alcool, vin, bière, gélatine`)
  cherchés littéralement. Plus couvrant, mais introduit une **liste heuristique** maintenue à la main
  (donc un jugement, exactement le genre de chose que le lot RETIRE ailleurs).
  **Reco : (a)** — le garde lexical couvre `nePasManger` ; halal reste au modèle + au SYSTÈME. Si tu veux
  (b), je l'ajoute, mais je signale la dette d'une liste codée en dur qui contredit l'esprit du lot.

## ③ `adaptations[]` RAPPORTÉ — le modèle déclare ce qu'il a changé

Schéma `RECIPE_TOOL` v2 gagne un champ **requis** :
```jsonc
"adaptations": {                    // [] explicite si rien — REQUIS
  "type": "array",
  "items": { "type": "object", "properties": {
    "regle":  { "type": "string" },   // « sans arachide » / « halal »
    "action": { "type": "string" }    // « cacahuètes remplacées par graines de courge grillées »
  }, "required": ["regle","action"] }
}
```
**Bandeau de relecture v2 (client, T2)** : au lieu d'« on a demandé d'adapter selon … » (déclaratif),
il affiche **ce que le modèle DÉCLARE avoir fait**, ligne à ligne — vérifiable :
- `adaptations` non vide → « **Adapté — sans arachide :** cacahuètes → graines de courge grillées ».
- règles posées + `adaptations: []` → « *Aucune adaptation signalée pour : halal · gluten — vérifie les
  ingrédients.* » (le cas « rien signalé » reste honnête).
- `quantites_incertaines` non vide → « ⚠ 2 quantités illisibles : farine, huile — complète-les ».
- `alerte_regles` non vide (②) → bandeau **rouge**.

---

## Schéma `RECIPE_TOOL` v2 — le diff exact
**Sortent** : `kcal, prot, gluc, lip, calcium, flag_calcium` (purge) · `nom_ar, ingredients_ar, etapes_ar`
(**Opt-C** : darija générée au partage via `SYSTEM_TRANSLATE`, sortie d'import ÷2 — confirmé viable en T1,
`augmentDarija` complète les `_ar` manquants au partage).
**Entrent** : `adaptations[]` (requis) · `quantites_incertaines: string[]` · `alerte_regles: string[]`
(rempli par le serveur, pas le modèle).
**Restent** : `nom, role (enum 8 moments), portions, ingredients, etapes`.

## Ce que T2 exécute — et où (2 déploiements distincts)
1. **Edge (FENÊTRE TOKEN)** : les 3 prompts v2 + `RECIPE_TOOL` v2 + `reglesSystem()` + garde G3 lexical +
   suppression `estimate`/`MACROS_TOOL`/`SYSTEM_ESTIMATE`. **Rituel** : staging → 2ᵉ déploiement idempotent
   → `parity:check` (0 écart avant) → **STOP signalement** (delta exact) → GO → prod → **révocation
   immédiate** → mort vérifiée (401 management API) → **parité de clôture** (0 écart).
2. **Client (Pages, hors token)** : bandeau de relecture v2 (lit `adaptations`/`quantites_incertaines`/
   `alerte_regles`) dans `RecipeDetailSheet` + `RelectureSheet`. `RecipeDraft` gagne ces 3 champs.
   *(Séquencement sûr : l'edge peut être déployée AVANT le client — les champs en trop dans la réponse
   sont ignorés par l'ancien bandeau ; le nouveau bandeau tolère leur absence. Aucun couplage dur.)*

## Portes T2 (laisser des assertions)
- **« aucun protocole personnel »** : grep CI `gluten|calcium|prot(é|e)ine` sur `supabase/functions/**` (①).
- **garde G3 lexical** : test unitaire pur (entrée : ingrédients + nePasManger → `alerte_regles` attendu ;
  couvre accents/casse et le cas « rien à signaler »).
- **smoke relecture** : un brouillon importé avec `adaptations` → le bandeau affiche le rapport (③).
- **Opt-C** : test que le schéma d'import n'exige plus les `_ar` + que le partage darija d'une recette
  sans `_ar` déclenche `augmentDarija` (déjà couvert par F5.5 ? à confirmer au chiffrage).

## Changement de comportement — NOMMÉ (rappel)
Sans le `SYSTEM` hardcodé, **tout foyer sans règle reçoit du gluten par défaut** dès le déploiement edge.
Correct (généraliste) mais **invisible pour les foyers existants**. **Prérequis PO avant la fenêtre** :
poser « gluten » (et ce que ton foyer évite) dans `nePasManger` de tes Réglages — sinon tes recettes
générées cessent d'être sans gluten à la seconde du déploiement.

## Questions au GO (3)
1. **Halal + garde G3 lexical** : option **(a)** (halal au modèle, garde couvre `nePasManger` — reco) ou
   **(b)** (halal étendu à une liste d'interdits codée) ?
2. **Opt-C** : je retire bien la darija du schéma d'import (générée au partage) — confirmé ?
3. **Séquencement des 2 déploiements** : edge (token) d'abord, client (bandeau) ensuite — d'accord ? (Ou
   client d'abord pour que le bandeau soit prêt à lire les nouveaux champs — au choix, aucun couplage dur.)

**⏸ STOP read-back prompt v2 — chiffrage fin à ton GO, aucune fenêtre token ouverte. J'attends.**
