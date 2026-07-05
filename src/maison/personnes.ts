import type { Destinataire, NounouDest } from '../types';

// Adaptateur « Personne » (L1-1) : couche de lecture unifiant les destinataires
// Cuisine (store `destinataires`) et Nounou (`doc.destinataires`) SANS fusionner
// les stores ni créer de 3e notion. Une page = un contenu ; une personne = un
// contexte (langue, cible d'envoi) qui ouvre la page de son rôle.

export type PersonneKind = 'cuisine' | 'nounou';

export interface Personne {
  key: string; // identifiant d'affichage stable (kind + token)
  kind: PersonneKind;
  prenom: string;
  token: string;
  langue: string; // code langue du destinataire (fr / ar / dr / en)
  tel?: string;
}

export function personnes(cuisine: Destinataire[], nounou: NounouDest[]): Personne[] {
  return [
    ...nounou.map((d) => ({
      key: 'n:' + d.token,
      kind: 'nounou' as const,
      prenom: d.prenom,
      token: d.token,
      langue: d.langue,
      tel: d.tel,
    })),
    ...cuisine.map((d) => ({
      key: 'c:' + d.token,
      kind: 'cuisine' as const,
      prenom: d.nom,
      token: d.token,
      langue: d.langue,
      tel: d.tel,
    })),
  ];
}

export const KIND_LABEL: Record<PersonneKind, string> = { cuisine: 'Cuisine', nounou: 'Nounou' };
export const KIND_PICTO: Record<PersonneKind, string> = { cuisine: '🥘', nounou: '🧸' };
