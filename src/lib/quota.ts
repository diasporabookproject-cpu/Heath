// Quota IA mensuel (L3-2/S5). Le plafond AUTHORITATIF est désormais CÔTÉ SERVEUR
// (edge function + table `ai_usage`, couture premium ① — cf. G3 : ne transite pas
// par la sync). Ici = **cache d'affichage** aligné sur le plafond serveur (Q4 = 100),
// jamais un péage (la saisie manuelle reste illimitée). Reset au changement de mois.

export const AI_MONTHLY_LIMIT = 100;

export interface AiQuota {
  /** Mois de référence, format 'YYYY-MM'. */
  month: string;
  /** Générations IA consommées ce mois. */
  used: number;
}

/** Mois courant 'YYYY-MM' (heure locale). */
export function currentMonth(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
}

/** Quota normalisé pour `month` : remet à zéro si le mois a changé (ou absent). */
export function normalizeQuota(q: AiQuota | undefined, month: string): AiQuota {
  return q && q.month === month ? q : { month, used: 0 };
}

/** Générations IA restantes ce mois. */
export function remaining(q: AiQuota): number {
  return Math.max(0, AI_MONTHLY_LIMIT - q.used);
}

/** Consomme une génération (borné à la limite). */
export function consume(q: AiQuota): AiQuota {
  return { month: q.month, used: Math.min(AI_MONTHLY_LIMIT, q.used + 1) };
}
