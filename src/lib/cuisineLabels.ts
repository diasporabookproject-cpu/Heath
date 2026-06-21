// Libellés darija (lettres arabes) partagés entre la vue Cuisinière et la
// page de menu partagée.

export const DAY_AR: Record<string, string> = {
  lun: 'الإثنين',
  mar: 'الثلاثاء',
  mer: 'الأربعاء',
  jeu: 'الخميس',
  ven: 'الجمعة',
  sam: 'السبت',
  dim: 'الأحد',
};

export const TYPE_AR: Record<string, string> = {
  Repos: 'راحة',
  Muscu: 'تمرين القوة',
  Cardio: 'كارديو',
};

export const LABELS = {
  fr: { dej: 'Déjeuner', din: 'Dîner', extra: 'Extra' },
  ar: { dej: 'الغدا', din: 'العشا', extra: 'زيادة' },
};

export type Lang = 'fr' | 'ar';
