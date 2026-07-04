import type { Destinataire, WeekMenu } from '../types';
import { hashStr } from '../lib/hash';
import type { PublishRecord } from '../lib/db';

// État de transmission (L1-4) : une signature stable du contenu partageable par
// destinataire, comparée à la dernière signature enregistrée à l'envoi. Sans réseau.
// (La signature Nounou vit dans nounou/partage.ts — nounouSig — pour éviter un cycle.)

/** Signature du contenu Cuisine partagé (menu + langue + personnes + sécurité). */
export function cuisineSig(week: WeekMenu, persons: number, dest: Destinataire): string {
  return hashStr(JSON.stringify({ d: week.days, l: dest.langue, p: persons, s: dest.securiteIds ?? [] }));
}

export type EnvoiState = 'uptodate' | 'modified' | 'never';

/** Compare la signature courante à la dernière envoyée. */
export function envoiState(currentSig: string, rec?: PublishRecord): EnvoiState {
  if (!rec) return 'never';
  return rec.sig === currentSig ? 'uptodate' : 'modified';
}
