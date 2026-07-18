// F5.5 (lot Cuisine T5) — correspondance allergènes du FOYER (règles T3, champ
// libre) ↔ texte d'une recette (nom + ingrédients). Normalisée (casse, accents),
// volontairement SIMPLE et lisible : un terme du foyer présent dans le texte =
// alerte. Faux positifs possibles (« sans arachide » dans un nom) — assumé v1 :
// mieux vaut une alerte de trop qu'une allergie servie (G3 : rien en silence).

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Les termes du foyer (allergies) présents dans le texte de la recette. */
export function matchAllergenes(allergies: string[], texte: string): string[] {
  const t = norm(texte);
  return allergies.filter((a) => {
    const n = norm(a.trim());
    return n.length >= 3 && t.includes(n);
  });
}
