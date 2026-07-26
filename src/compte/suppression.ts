import type { FoyerInfo } from '../lib/auth';

/**
 * QUELLE confirmation de suppression montrer (lot Identité & accès, T4).
 *
 * Décision pure, isolée ici parce qu'elle porte la seule chose irréversible du lot :
 * ADR 33 — le foyer est adossé à son TITULAIRE et ne lui survit pas. Le fondateur
 * qui part emporte le foyer, ses membres et ses pages partagées ; un membre qui part
 * ne retire que son propre accès.
 *
 * Règle de dessin (maquette `identite-derniers-ecrans.html`) : **on ne brandit pas
 * des conséquences qui n'existent pas**. Fondateur seul, sans page partagée → pas de
 * bloc rouge, pas de liste vide.
 */
export type VarianteSuppression =
  /** Titulaire AVEC des dépendants : on nomme ce qui est coupé. */
  | 'fondateur'
  /** Titulaire sans personne autour : rien à couper, juste ses données. */
  | 'seul'
  /** Membre : le foyer survit, rien n'y est effacé. */
  | 'membre'
  /** Le foyer n'a pas pu être lu (hors-ligne) : on n'invente aucune conséquence. */
  | 'inconnu';

export function varianteSuppression(info: FoyerInfo | null): VarianteSuppression {
  if (!info) return 'inconnu';
  if (!info.jeSuisFondateur) return 'membre';
  const autres = info.membres.filter((m) => !m.moi).length;
  return autres > 0 || info.nbEspaces > 0 ? 'fondateur' : 'seul';
}

/** Les dépendants à nommer, dans l'ordre de la maquette (jamais de ligne à zéro). */
export function dependants(info: FoyerInfo | null): string[] {
  if (!info) return [];
  const out: string[] = [];
  const autres = info.membres.filter((m) => !m.moi);
  for (const m of autres) {
    out.push(`${m.prenom ?? 'Un autre membre'} perd l’accès au foyer`);
  }
  if (info.nbEspaces > 0) {
    out.push(
      info.nbEspaces === 1
        ? '1 page partagée cesse de fonctionner'
        : `${info.nbEspaces} pages partagées cessent de fonctionner`,
    );
  }
  return out;
}
