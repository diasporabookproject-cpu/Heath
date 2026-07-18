// Normalisation des textes AVANT affichage (L0-3). Les productions IA laissent
// des artefacts (markdown « **gras** », emojis parasites, « Protéine : g »,
// espaces multiples) ; on les nettoie au rendu SANS muter les données stockées.

const MARKDOWN = /(\*\*|__|\*|_|`|#{1,6}\s?|>\s?)/g;
// Pictogrammes (emojis) — n'affecte pas les lettres arabes/latines.
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu;

/** Nettoie un texte affiché : markdown, emojis parasites, espaces, séparateurs vides. */
export function cleanText(input: string | undefined | null): string {
  if (!input) return '';
  let s = String(input);
  s = s.replace(MARKDOWN, '');
  s = s.replace(EMOJI, '');
  // « quantité : g » / « : » orphelins laissés par une extraction IA ratée.
  s = s.replace(/\b\w+\s*:\s*(?=g\b|$)/gi, '');
  s = s.replace(/\s{2,}/g, ' ');
  // séparateurs « · », « + », « - » en tête/queue ou en double.
  s = s.replace(/\s*([·+])\s*([·+])\s*/g, ' $1 ');
  s = s.replace(/^[\s·+\-–—:]+|[\s·+\-–—:]+$/g, '');
  return s.trim();
}

/** Insère une espace insécable entre un nombre et son unité (« 800 g »). */
export function cleanQty(input: string | undefined | null): string {
  if (!input) return '';
  let s = cleanText(input);
  // colle nombre + unité avec une espace insécable ; « 800g » ou « 800  g » → « 800 g ».
  s = s.replace(
    /(\d[\d.,]*)\s*(kg|g|mg|ml|cl|l|càs|càc|c\.?\s?à\.?\s?[sc]\.?|pièces?|pcs?|tranches?|gousses?|cuil\.?)\b/gi,
    (_m, n, u) => `${n} ${u}`,
  );
  return s;
}

/** Rend un numéro de téléphone insécable (ne casse pas en fin de ligne). */
export function phoneNbsp(input: string | undefined | null): string {
  if (!input) return '';
  return String(input).trim().replace(/\s+/g, ' ');
}
