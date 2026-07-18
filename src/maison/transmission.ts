import { wireLangue, type Destinataire, type WeekMenu } from '../types';
import { hashStr } from '../lib/hash';
import type { PublishRecord } from '../lib/db';

// État de transmission (L1-4) : une signature stable du contenu partageable par
// destinataire, comparée à la dernière signature enregistrée à l'envoi. Sans réseau.
// (La signature Nounou vit dans nounou/partage.ts — nounouSig — pour éviter un cycle.)

/** Signature du contenu Cuisine partagé (menu + langue + personnes + sécurité).
 * T2 : la langue signée est celle du FIL (`wireLangue`) — la migration locale
 * `'ar'`→`'dr'` ne change PAS la page publiée, elle ne doit pas faire basculer
 * toutes les cartes darija en « modifié — à envoyer ». */
export function cuisineSig(week: WeekMenu, persons: number, dest: Destinataire): string {
  return hashStr(JSON.stringify({ d: week.days, l: wireLangue(dest.langue), p: persons, s: dest.securiteIds ?? [] }));
}

export type EnvoiState = 'uptodate' | 'modified' | 'never';

/** Compare la signature courante à la dernière envoyée. */
export function envoiState(currentSig: string, rec?: PublishRecord): EnvoiState {
  if (!rec) return 'never';
  return rec.sig === currentSig ? 'uptodate' : 'modified';
}

/** Pastille unique d'une carte-personne (proto v6.1). null = chevron (rien à signaler). */
export type PillKind = 'envoyer' | 'briefer' | 'planifier' | null;

/**
 * Décision « une personne = un état = une action », priorité stricte
 * Envoyer > Briefer > Planifier > (chevron). Fonction pure (testable, QA) :
 * les nudges Briefer/Planifier ne sortent que sur un signal réel — sinon chevron.
 */
export function pillKind(opts: {
  state: EnvoiState;
  kind: 'cuisine' | 'nounou';
  hasUpcomingPonctuel: boolean;
  nextWeekEmpty: boolean;
}): PillKind {
  if (opts.state !== 'uptodate') return 'envoyer';
  if (opts.kind === 'nounou' && opts.hasUpcomingPonctuel) return 'briefer';
  if (opts.kind === 'cuisine' && opts.nextWeekEmpty) return 'planifier';
  return null;
}
