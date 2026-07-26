// Décision pure du CHANGEMENT DE COMPTE sur un appareil (lot Identité & accès,
// correctif device ①). Testable sans réseau ni IndexedDB.

/**
 * Faut-il vider la copie locale avant de laisser entrer ce compte ?
 *
 * OUI seulement si cet appareil appartenait à QUELQU'UN D'AUTRE. Le contenu d'un
 * foyer ne doit jamais s'afficher pour un autre compte — c'est l'exigence PO :
 * « le contenu doit être accessible seulement si on est connecté avec son e-mail ».
 *
 * NON quand c'est le même utilisateur qui revient (déconnexion → reconnexion) :
 * purger là détruirait des modifications hors-ligne non encore poussées, alors que
 * rien n'est exposé à personne. Le mur suffit à protéger l'accès entre les deux.
 *
 * NON non plus au tout premier compte (`dernier === null`) : ses données locales
 * rejoignent le foyer qu'il fonde (option A, cf. `foyerTransition`).
 */
export function doitPurgerPourNouveauCompte(dernierUserId: string | null, userId: string): boolean {
  if (!dernierUserId || !userId) return false;
  return dernierUserId !== userId;
}
