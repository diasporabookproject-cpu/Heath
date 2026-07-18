# MAQUETTE VALIDÉE — Lot Cuisine (référence unique)
**14 juillet 2026 · chantier UX passe 1**
**Destination repo :** `docs/maquettes/cuisine/`

> **Une seule maquette fait foi pour tout le lot.** Les itérations intermédiaires ne font **pas** partie de
> la référence : elles montrent des options **rejetées** ou **dépassées** (et l'overlap de la fiche, corrigé
> seulement dans le proto). Les inclure induirait en erreur la Q&A et Claude Code.

---

## ✅ La référence
| Fichier | Ce que c'est |
|---|---|
| **`proto-cuisine-cliquable.html`** | **Prototype complet et cliquable du lot Cuisine** — source de vérité comportementale **et** visuelle. Contient les 5 écrans finaux : **Menu · Bibliothèque · Créer (2 capacités) · Écrire / Importer & adapter · Fiche recette**. Overlap de la fiche corrigé. |

C'est le **seul** fichier à ouvrir pour valider les décisions, et le seul à committer comme maquette.

---

## Ce que le proto verrouille (rappel)
- **Menu** : horizon Demain par défaut, Matin/Midi/Soir, nutrition opt-in, « Partager la journée ». Pas de « Générer ».
- **Bibliothèque** : cartes emoji sans macros, collections repliées, FAB « Nouvelle recette » toujours visible, footer visible (actif = pastille foncée).
- **Créer** : deux capacités — L'écrire (texte) · À partir d'instructions (lien/photo/description → mis en forme, relu) — + Depuis une collection. « IA » jamais nommée.
- **Importer & adapter** : règles du foyer appliquées, à vérifier, cliquables ; relecture obligatoire.
- **Fiche** : Partager dominant, favori discret, une entrée photo, tags enrichis, consigne vocale, ingrédients, étapes.

---

## Notes pour le commit
- **À côté :** `JOURNAL_DES_PARCOURS__UX_passe1.md`, `RECAP_CUISINE_POUR_QA.md`.
- **Technique :** charge Fraunces / Plus Jakarta via Google Fonts (repli serif/sans hors-ligne) ; photo = **placeholder** (le lot visuel réel viendra à part).
- **Historique des itérations** (~25 fichiers) : à archiver hors de la référence si jamais la Q&A veut la provenance des arbitrages — **pas** dans `docs/maquettes/cuisine/`.
