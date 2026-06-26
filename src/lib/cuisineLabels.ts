// Libellés darija (lettres arabes) partagés par l'espace cuisinière (FC10) et
// la page de menu partagée legacy (#m=/#p=).

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
