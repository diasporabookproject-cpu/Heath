// Découpe et mise à l'échelle des ingrédients (best-effort, càc/càs préservés).
// Partagé par la fiche recette (FC7) et l'espace cuisinière (FC10).

export interface IngRow {
  name: string;
  qty: string;
}

/** Découpe un texte d'ingrédients en lignes nom / quantité. */
export function splitIngredients(text: string): IngRow[] {
  return text
    .split(/·|\n|\++/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(
        /^(.*?)(\s+\d[\d.,]*\s*(?:kg|g|غ|ml|cl|l|càc|càs|c\.?\s?à\.?\s?[sc]\.?|ملاعق|ملعقة|pièces?|unités?)?\.?)$/i,
      );
      if (m && m[1].trim()) return { name: m[1].trim(), qty: m[2].trim() };
      return { name: seg, qty: '' };
    });
}

/** Découpe une préparation en étapes (retire la numérotation éventuelle). */
export function splitSteps(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

/** Multiplie la 1re quantité numérique d'un texte par un facteur (≥1). */
export function scaleQty(qty: string, factor: number): string {
  if (factor === 1 || !qty) return qty;
  return qty.replace(/\d+(?:[.,]\d+)?/, (n) => {
    const val = parseFloat(n.replace(',', '.')) * factor;
    const rounded = Math.round(val * 10) / 10;
    return String(Number.isInteger(rounded) ? rounded : rounded).replace('.', ',');
  });
}

/** Ingrédients (1 portion) mis à l'échelle pour `persons` personnes. */
export function scaledRows(text: string, persons: number): IngRow[] {
  const f = Math.max(1, persons);
  return splitIngredients(text).map((r) => ({ name: r.name, qty: scaleQty(r.qty, f) }));
}
