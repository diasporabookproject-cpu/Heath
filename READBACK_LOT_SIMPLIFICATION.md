# READ-BACK — Lot simplification transverse (la purge nutrition + prompt v2)
**18 juillet 2026 · lot qui RETIRE → le risque est de casser en silence. Read-back AVANT tout code — STOP en bas.**
**Branche `lot-simplification-v1`, `apk.yml` pointé. Cadre : passer de « l'app d'un foyer » à une app généraliste.**

> **Critère de tri appliqué partout** : spécifique à un régime particulier → **sort** · utile à un foyer
> quelconque → **reste**. Structure : **T1 purge (client) → STOP dédié (read-back prompt v2 à froid) →
> T2 prompt v2 (seule fenêtre token)**. Fusion du champ régime au fil de T1.

---

## Les 5 vérifications demandées (état réel du code)

### ① `SEED_CONFIG` — **MIXTE** : structure vivante + nutrition morte + JSON inerte. Tri fin requis.
`src/data/seed.json → config` a 4 clés, mais **`AppConfig` (types.ts:95) ne déclare que `jours: DayConfig[]`**,
et **`DayConfig` (types.ts:90) n'est que `{ key, nom }`**. Donc :

| Clé JSON | Contenu | Lue par le code ? | Verdict |
|---|---|---|---|
| `jours[].key` / `.nom` | « lun » / « Lundi » | **OUI** (`useStore:28` crée les jours, `digest.ts:17`) | **RESTE** — structure de la semaine |
| `jours[].type` | « Repos »/« Muscu »/« Cardio » (jours d'entraînement) | **NON** (hors `DayConfig`) | **SORT** — vocabulaire du protocole PO, déjà inerte |
| `jours[].cible_kcal` | 1720… | **NON** | **SORT** — nutrition, déjà inerte |
| `cibles` | kcal_par_type, proteines, calcium… | **NON** (aucune référence dans src) | **SORT** — inerte |
| `elements_fixes` | collation + kéfir coucher (macros) | **NON** | **SORT** — protocole PO personnel, inerte |
| `repas_verrouilles_suggeres` | `{lun_dej:'DEJ-02'…}` | **NON** (aucun consommateur) | **SORT** — inerte |

**Conclusion (ta question tranchée)** : `SEED_CONFIG` **ne meurt pas** — seule sa clé `jours` (réduite à
`{key,nom}`) est vivante et **le composeur en dépend, on n'y touche pas**. Tout le reste est soit nutrition
soit **déjà du JSON mort** (personne ne le lit) : on le retire du fichier sans aucun point mort compilateur.
**Le composeur ne casse pas.**

### ② `nutrition.test.ts` / `macros.test.ts` — **suppression franche**, mais `nutrition.ts` est MIXTE.
`src/lib/nutrition.ts` mélange **structure** et **macros** — il ne se supprime PAS en bloc :
- **RESTE (structurel)** : `emptyDay` (`useStore`), `emptyMeal`, `dayComplete`, `dayHasAny`, `mealHasDraft`
  (« ce créneau a-t-il du contenu / un brouillon ? » — zéro nutrition).
- **SORT (nutrition)** : `componentMacros`, `mealMacros`, `dayMacros`, `weekAverage`, `objectiveStatus`,
  `mealBudgets` + l'interface `Macros`, `CalciumFlag`, `ObjectiveStatus`.
- **`macros.ts` — SORT en entier** (un seul consommateur : `ai.ts` `estimateMacros`, qui sort aussi).
- **Tests** : `nutrition.test.ts` et `macros.test.ts` → **suppression franche** (pas de neutralisation).
  Ce qui reste de `nutrition.ts` (structure) est couvert indirectement par les smokes ; si tu veux une
  porte sur `emptyDay`/`dayComplete`, je peux garder un test de structure minimal — dis-le.
- **⚠️ Tension à trancher — `mealBudgets`** : le **parking dit « conservé »** (pour un futur « Proposer un
  repas »), mais il **calcule des budgets kcal**, il a **zéro consommateur aujourd'hui**, et il ferait
  **échouer la porte grep** (`kcal|macro`). Garder du code mort qui contredit la porte n'a pas de sens.
  **Reco : le SUPPRIMER** — « Proposer un repas » le re-dérivera de ce qui existera alors. *(Question 3.)*

### ③ L'objectif comme plafond — `CuisineSettings.objective` (kcal/pers/jour). **SORT**, `persons` RESTE.
- `objective` est un **plafond calorique** (`types.ts:101`, `DEFAULT_SETTINGS.objective=1800`), lu SEULEMENT
  dans `SemaineView` (`objectiveStatus`, barre de %) et **réglé dans `ReglagesSheet`** (± 50), le tout
  **derrière le flag `suivi`**. Écrit par `useStore.setObjective` (`:202`).
- **Quand il disparaît** : `CuisineSettings` devient `{ persons }` (le nombre de personnes = mise à l'échelle
  des quantités, **utile à tout foyer → RESTE**). `setObjective` sort, `DEFAULT_SETTINGS` perd `objective`,
  la section objectif de `ReglagesSheet` sort avec le flag. **Rien de structurel ne dépend de `objective`**
  hors affichage nutrition — il tombe proprement.

### ④ La fusion du champ régime — touche `reglesList` + la migration, **PAS l'interface du prompt**.
État actuel : `ReglesFoyer = { allergies: string[], halal: boolean, regime: string|null }` (types.ts) ;
UI `ReglagesSheet` = toggle Halal + toggle Végétarien + textarea Allergies ; `reglesList()` construit
`['halal', regime, ...allergies.map(a => 'sans '+a)]` → **c'est CE « sans » préfixé qui produit le bug
« sans Sans gluten »**. Le prompt lit la **sortie de `reglesList`** (via `opts.regles`, `ai.ts:40/99/113`),
donc **une `string[]`**.
- **Fusion (décision PO)** : `regime` + `allergies` → **un champ unique** `nePasManger: string[]`
  (« ce que le foyer ne mange pas », une entrée par ligne, brute : « gluten », « porc »…). `reglesList`
  devient quasi-identité (retourne la liste telle quelle) → **le double « sans » disparaît par
  construction** (le bénéfice que tu annonces).
- **Ce que ça touche** : `ReglesFoyer` (type) · `reglesList`/`reglesActives`/`EMPTY_REGLES` (types.ts) ·
  `ReglagesSheet` (fusionner 2 toggles + textarea en 1 textarea ; le toggle Végétarien devient une ligne) ·
  la **migration** (ci-dessous). **Le prompt NON** : il reçoit toujours une `string[]` — l'interface
  `{regles: string[]}` ne bouge pas, seul son contenu est plus propre.
- **⚠️ Question précise — le HALAL** : tu as dit « fusionner **regime + allergies** ». Halal n'est pas
  nommé. Deux lectures : **(a)** halal **reste un toggle** séparé (concept religieux net, bien traduit,
  fiable pour le prompt) et seuls regime+allergies fusionnent ; **(b)** halal **fond aussi** dans le champ
  unique (une ligne « halal »). Ton exemple « pas de porc en foyer halal » pousse vers un champ qui *inclut*
  halal, mais un toggle est plus fiable qu'une ligne libre. **Reco : (a) — halal reste un toggle.**
  *(Question 2 — tranche-la.)*
- **Migration (idempotente, façon langue T2 du mini-lot) — DEUX portes** : le store `foyer` est un **doc
  synchronisé** (`docs`, docId `regles`). Un ancien format `{allergies, halal, regime}` peut arriver de
  **l'IDB locale** ET d'un **appareil pas à jour via la sync**. Normalisation `normalizeRegles(old)` →
  `nePasManger = [...allergies, regime].filter(Boolean)` appliquée aux 2 portes : `loadFoyerRegles`
  (`db.ts:411`) **et** `applyRemote 'foyer'` (`map.ts` → `saveFoyerRegles`). `planAdopt` lui-même est
  **générique** (il transporte des docs sans connaître leur forme) → **il ne change pas** ; c'est le
  mapper/loader qui normalise. **Zéro SQL** (le store `foyer` vit dans `docs`, texte libre).

### ⑤ Opt-C darija — **VIABLE, on la garde**. Le flux de partage sait déjà traduire sans `_ar`.
Vérifié dans le code : `espace.ts` **`augmentDarija`** (appelée par `publishEspace` quand
`dest.langue === 'dr'`) complète les champs `_ar` **manquants** des recettes utilisées via
`translateToDarija` (edge mode `translate`), **plafonné à 12**, figé dans le payload. **Donc le partage
génère déjà la darija à la volée pour une recette sans `_ar`.** → **Opt-C tient** : le schéma d'import v2
peut **retirer `nom_ar/ingredients_ar/etapes_ar`** (aujourd'hui **requis** dans `RECIPE_TOOL`,
`index.ts:79`), sortie d'import ÷2 ; la darija se génère **au partage**, plus conforme à l'invariant
« traductions dérivées, figées au partage ». Rien à ajouter côté flux.
*(Nuance mineure : `augmentDarija` est plafonné à 12 recettes/envoi — un menu de semaine partagé en darija
au-delà de 12 recettes distinctes traduirait les 12 premières ; comportement EXISTANT, inchangé, tracé.)*

---

## Découpage & chiffrage

### T1 — la purge nutrition (CLIENT) · 🟡 M (large surface, mais mécanique + porte grep)
Ordre gravé (couper la production d'abord) : **① le schéma client** (`MacrosOut`/`estimateMacros` dans
`ai.ts`, champs macros de `Recipe`) **puis `macros.ts`** → le compilateur allume tous les points morts
d'affichage → on les retire → **le flag `suivi` meurt en dernier** (68 références, 13 fichiers — c'est la
carte). Inclut : champs macros des 30 recettes seed (technique, pas éditorial) · `SEED_CONFIG` réduit à
`jours{key,nom}` · fusion du champ régime (④) · suppression `nutrition.test`/`macros.test`.
**Porte finale (remplace les assertions ON/OFF de T2)** : un **test qui échoue la CI si
`/\b(kcal|macros?|calcium|prot(?:éines?|eines?)?)\b/` reapparaît dans le code exécuté** (src hors tests,
hors commentaires, hors `_ar`/darija). Je le calibre pour ne pas mordre les faux positifs (« protéine »
dans une recette texte = donnée, pas code — le grep vise `src/**/*.ts(x)` identifiants/champs, pas le
contenu des recettes seed). **À cadrer avec toi au STOP T1.**
*Note de séquencement* : T1 **arrête la CONSOMMATION client** des macros ; l'edge PROD continue d'en
**renvoyer** (ignorées, sans effet) jusqu'à T2. `RECIPE_TOOL` (edge) est réécrit en **T2** avec le prompt
v2, dans la **seule fenêtre token**. C'est cohérent avec « une seule fenêtre token » — je ne déploie rien
en T1.

### STOP DÉDIÉ — read-back du prompt v2 seul, à froid (ton gate avant tout code serveur).

### T2 — prompt v2 + fusion lue par le prompt · 🟡 M · **FENÊTRE TOKEN unique**
`PROPOSITION_PROMPT_V2_GENERATE_RECIPE.md` (déjà au repo) : `RECIPE_TOOL` sans macros · `adaptations[]`
rapportées · `quantites_incertaines` · **le `SYSTEM` hardcodé « 100% sans gluten / calcium enjeu n°1 »
DISPARAÎT** (le prompt lit `nePasManger` du foyer, rien en dur) · garde-fou G3 mécanique · Opt-C (darija
retirée du schéma d'import). Rituel token : staging ×2 idempotence → `parity:check` → STOP signalement →
GO → prod → révocation → mort vérifiée → parité de clôture. Portes : test « aucun protocole personnel dans
les prompts » (grep `gluten|calcium` sur `supabase/functions/`) + test du garde-fou lexical + smoke
relecture (le rapport `adaptations` s'affiche).

---

## Hors de ce lot — tracé au DEVLOG (ne PAS tirer ces fils)
- **Revue éditoriale du Fonds de départ** (« Msemmen SG », « batbout GF », « Creami whey »…) → **lot à
  part**. Ce lot retire les **macros** des 30 recettes (technique), **pas leur contenu**.
- **Consignes au personnel** — alerte allergène page cuisinier (F5.5), allergies fiches enfants Nounou →
  **infra distincte, chantier dédié**. Ce lot n'y touche pas et ne la préfigure pas. **J'ai vu le fil**
  entre `nePasManger` (composition de recette) et ces consignes (sécurité destinataire) — **je ne le tire
  pas** : deux infrastructures, deux value props.

## Changement de comportement à NOMMER (pas découvrir)
Sans le `SYSTEM` hardcodé, **tout foyer sans règle explicite reçoit soudain des recettes avec gluten**.
C'est le comportement **correct** (app généraliste), mais **invisible pour tout foyer existant** qui
recevait du sans-gluten par défaut. À tracer au DEVLOG à T2. **Prérequis PO** (de ton côté avant la
bascule) : « sans gluten » posé en **régime/`nePasManger`** dans les Réglages de ton foyer.

## Questions au GO (3)
1. **Découpage & séquencement** confirmés ? (T1 client stoppe la consommation ; edge PROD renvoie des
   macros ignorées jusqu'à T2 ; `RECIPE_TOOL` réécrit en T2 dans la seule fenêtre token.)
2. **Halal** : reste un **toggle** séparé (reco (a)) ou fond dans le champ unique `nePasManger` (b) ?
3. **`mealBudgets`** : je le **supprime** (reco — code mort, contredit la porte grep) ou tu veux le garder
   malgré le parking ? (S'il reste, la porte grep doit l'exempter nommément — je le déconseille.)

**⏸ STOP read-back — j'attends tes réponses. Aucun code écrit.**
