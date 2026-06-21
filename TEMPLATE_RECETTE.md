# Template d'ajout de recettes (JSON)

Pour générer de nouvelles recettes (ex. avec Claude chat) et les **importer** dans l'app :
Bibliothèque → **⇪ Importer (JSON)** → coller le tableau → **Importer**.

## Format d'une recette

```json
{
  "nom": "Nom du plat en français",
  "type": "Déjeuner",
  "statut": "Validé",
  "jour": "Tous",
  "kcal": 750,
  "prot": 77,
  "gluc": 51,
  "lip": 23,
  "calcium": 480,
  "flag_calcium": "Champion",
  "ingredients": "Ingrédient 200g · autre 110g (repos)/130g (sport) · sauce 1 càc huile+citron · feta 40g (séparé)",
  "notes": "Remarque libre (optionnel)",
  "nom_ar": "اسم الطبق بالدارجة",
  "ingredients_ar": "المكونات بالدارجة بنفس الترتيب"
}
```

On importe **un tableau** `[ {...}, {...} ]` (ou une seule recette `{...}`).

## Champs

| Champ | Obligatoire | Valeurs / règles |
|---|---|---|
| `nom` | ✅ | Texte (français). |
| `type` | ✅ | `Déjeuner` · `Dîner` · `Coupe-faim`. |
| `statut` | non (déf. `Validé`) | `Validé` (utilisable) · `Écarté` (archivé) · `Test`. |
| `jour` | non (déf. `Tous`) | `Tous` · `Repos` · `Sport` (indicatif). |
| `kcal` `prot` `gluc` `lip` | recommandé | Nombres, **par portion**. |
| `calcium` | recommandé | Nombre, en **mg** par portion (enjeu n°1). |
| `flag_calcium` | non (déduit) | `Champion` · `Moyen` · `Faible`. Si absent : déduit (≥350 Champion, ≥215 Moyen, sinon Faible). |
| `ingredients` | recommandé | Texte structuré, **1 portion** (voir règles ci-dessous). |
| `notes` | non | Texte libre. |
| `nom_ar` | non | Nom en **darija, lettres arabes**. |
| `ingredients_ar` | non | Ingrédients en darija, **même ordre** que `ingredients`. |

> `id` est généré automatiquement (DEJ-xx / DIN-xx / CF-xx). Inutile de le fournir.

## Règles importantes pour les ingrédients

- **100 % sans gluten** : ne jamais proposer d'ingrédient contenant du gluten (préciser « GF » / « بلا غلوتين » si pertinent).
- **Mesures à la cuillère conservées** : écrire `1 càc` / `1 càs` (ne pas convertir en grammes).
- **Séparateurs** : `·` entre les composants ; ` + ` (avec espaces) pour des items distincts d'un même groupe ; les assaisonnements groupés sans espaces (`huile+citron+ail`) restent ensemble. *(C'est ce qui permet une bonne liste de courses.)*
- **Variantes d'effort** : format `110g (repos)/130g (sport)`.
- **Qualificatifs** : `(séparé)`, `(option)`, etc.
- **Calcium visible** : privilégier/ signaler les sources de calcium.
- `ingredients_ar` : garder le **même ordre** et les mêmes quantités (chiffres + `g` inchangés), qualificatifs en darija (`بوحدو`, `اختياري`, `راحة`/`رياضة`).

---

## Prompt prêt à coller dans Claude chat

```
Tu génères des recettes pour une app de menus, à fournir en JSON strict (un
tableau d'objets), prêtes à importer. Contraintes : 100 % sans gluten,
calcium élevé valorisé, glucides maîtrisés. Tout est PAR PORTION.

Pour chaque recette, renvoie EXACTEMENT ces champs :
nom, type ("Déjeuner"|"Dîner"|"Coupe-faim"), statut ("Validé"),
jour ("Tous"|"Repos"|"Sport"), kcal, prot, gluc, lip, calcium (mg),
flag_calcium ("Champion"|"Moyen"|"Faible"),
ingredients, nom_ar, ingredients_ar.

Règles ingredients :
- texte 1 portion ; séparateur "·" entre composants ;
- " + " (avec espaces) pour des items distincts ; assaisonnements groupés
  sans espaces (ex. "huile+citron+ail") ;
- garder "1 càc"/"1 càs" (ne pas convertir en grammes) ;
- variantes d'effort sous la forme "110g (repos)/130g (sport)".
- nom_ar et ingredients_ar = darija marocaine EN LETTRES ARABES, même
  ordre/quantités que la version française (chiffres et "g" inchangés).

Renvoie UNIQUEMENT le JSON, sans texte autour. Commence par :
[
  {
    "nom": "...",
    ...
  }
]

Recettes à créer : <décris ici ce que tu veux, ex. "3 dîners de poisson
riches en calcium, ~700 kcal, 70g+ de protéines">
```
