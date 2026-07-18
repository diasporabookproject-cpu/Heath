// Mini-lot destinataires F5 — le cache négatif ne doit retenir que « l'objet
// n'existe pas », JAMAIS un raté réseau (sinon une note vocale/photo présente au
// cloud paraît perdue toute la session). storage-js porte le statut tantôt en
// `status` (number), tantôt en `statusCode` (string) selon les versions ; le
// message « Object not found » est le seul signal stable — on prend les trois.
export function isNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { status?: unknown; statusCode?: unknown; message?: unknown };
  if (Number(err.status) === 404 || Number(err.statusCode) === 404) return true;
  return typeof err.message === 'string' && /not[ _-]?found/i.test(err.message);
}
