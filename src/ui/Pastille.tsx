/**
 * LA PASTILLE D'INITIALE — l'unique accès au compte (lot Identité & accès, T4).
 *
 * Ce qu'elle remplace : « ☁︎ Connexion » / « ☁︎ » / 👤, trois dessins et un libellé
 * VARIABLE selon l'état de connexion. Derrière le mur (T1), cet état n'existe plus —
 * il y a toujours un compte lié. Un seul dessin, un seul libellé, quatre emplacements
 * (Maison · Cuisine · Nounou · Sécurité). Maquette : `identite-ecrans-compiles.html`
 * (détail « Le bouton compte — 4 emplacements »).
 *
 * La classe de l'hôte donne la TAILLE et la POSITION (elles diffèrent par en-tête) ;
 * `mz-past` donne l'apparence, identique partout.
 */
export default function Pastille({
  initiale,
  onClick,
  hostClass,
}: {
  initiale: string;
  onClick: () => void;
  /** Classe de l'en-tête d'accueil (`b1-acc`, `cz-headicon`, …) — taille et position. */
  hostClass: string;
}) {
  return (
    <button className={`${hostClass} mz-past`} onClick={onClick} aria-label="Compte">
      {initiale}
    </button>
  );
}

/** L'initiale affichée : le prénom s'il est connu, sinon l'e-mail du compte lié. */
export function initialeDe(prenom: string | null | undefined, email: string | null | undefined): string {
  return ((prenom || email || '?').trim().slice(0, 1) || '?').toUpperCase();
}
