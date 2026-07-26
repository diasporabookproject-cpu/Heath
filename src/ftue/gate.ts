// Décision du GATE PRÉ-BOOT (lot Identité & accès, T1) — logique PURE, testable
// sans monter React. L'IO (lecture des méta IndexedDB) reste dans `Boot.tsx`.

export interface GateInput {
  /** Un jeton d'espace est présent dans l'URL (`#e=…`) : c'est un DESTINATAIRE. */
  espaceToken: boolean;
  /** Vitrine dev `#mz-demo`. */
  demo: boolean;
  /** Un compte a-t-il été lié sur CET appareil (drapeau local `compteLie`) ? */
  compteLie: boolean;
  /** La FTUE a-t-elle déjà été jouée (ou posée rétroactivement) ? */
  ftueDone: boolean;
  /** Appareil qui avait déjà booté avant la FTUE (migration one-shot). */
  bootedBefore: boolean;
}

export type GateMode = 'app' | 'entrer' | 'ftue' | 'migrer';

/**
 * L'ordre du gate. Deux invariants s'y lisent :
 *
 * ① Un DESTINATAIRE qui ouvre son lien ne voit JAMAIS le mur — le personnel n'a pas
 *    de compte, c'est la thèse du produit. Le test du jeton passe donc AVANT tout.
 *
 * ② Le mur teste `compteLie` (drapeau LOCAL), **jamais la session vivante**. Une
 *    session Supabase expirée hors-ligne rend `getSession() === null` alors que le
 *    compte existe et que le jeton de rafraîchissement est intact : gater dessus
 *    mettrait l'utilisateur dehors dans le métro, avec ses données sur son
 *    téléphone, et se reconnecter exige le réseau. Le réseau ne conditionne que les
 *    opérations réseau.
 */
export function gateMode(i: GateInput): GateMode {
  if (i.espaceToken || i.demo) return 'app';
  if (!i.compteLie) return 'entrer';
  if (i.ftueDone) return 'app';
  if (i.bootedBefore) return 'migrer';
  return 'ftue';
}
