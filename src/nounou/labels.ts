import type { NounouLangue } from '../types';

// Libellés FIXES de la page reçue (chrome de l'UI), traduits une fois ici.
// Distinct du contenu rédigé par le parent (traduit via l'edge function).

export interface RLabels {
  sharedBy: string;
  offline: string;
  today: string;
  nothing: string;
  tConduites: string;
  tConduitesSub: string;
  tAppeler: string;
  tAppelerSub: string;
  tEnfants: string;
  tEnfantsSub: string;
  updatedBy: string;
  autoUpdate: string;
  back: string;
  conduitesSub: string;
  conduitesEmpty: string;
  urgent: string;
  voix: string;
  urgenceNote: string;
  quiAppeler: string;
  enUrgence: string;
  aVerifier: string;
  contacts: string;
  contactsEmpty: string;
  regles: string;
  ficheTodo: string;
  traitement: string;
  medecin: string;
  groupe: string;
  habitudes: string;
  cat: { sante: string; securite: string; quotidien: string };
  // dates
  jours: string[]; // 0 = lundi
  mois: string[]; // 0 = janvier
  // « il y a … »
  now: string;
  hAgo: (h: number) => string;
  yesterday: string;
  dAgo: (d: number) => string;
}

export const RLABELS: Record<NounouLangue, RLabels> = {
  fr: {
    sharedBy: 'Page partagée par Maman',
    offline: 'Hors-ligne',
    today: 'Aujourd’hui',
    nothing: 'Rien de prévu ce jour.',
    tConduites: 'Que faire si…',
    tConduitesSub: 'Fièvre, blessure, étouffement…',
    tAppeler: 'Qui appeler',
    tAppelerSub: 'Urgences et contacts',
    tEnfants: 'Les enfants',
    tEnfantsSub: 'Allergies, habitudes, médecin',
    updatedBy: 'Mis à jour par Maman',
    autoUpdate: 'Cette page reste à jour toute seule.',
    back: 'Retour',
    conduitesSub: 'Les consignes de Maman. Sa voix est en haut de chaque consigne.',
    conduitesEmpty: 'Aucune consigne partagée pour l’instant.',
    urgent: 'Urgent',
    voix: 'Voix de Maman',
    urgenceNote: 'Urgence : agir d’abord, prévenir ensuite.',
    quiAppeler: 'Qui appeler',
    enUrgence: 'En cas d’urgence',
    aVerifier: 'À vérifier',
    contacts: 'Contacts',
    contactsEmpty: 'Pas encore de contact ajouté.',
    regles: 'Règles & autorisations',
    ficheTodo: 'Fiche à compléter par le parent.',
    traitement: 'Traitement',
    medecin: 'Médecin',
    groupe: 'Groupe',
    habitudes: 'Habitudes',
    cat: { sante: 'Santé', securite: 'Sécurité', quotidien: 'Quotidien' },
    jours: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
    mois: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    now: 'à l’instant',
    hAgo: (h) => `il y a ${h} h`,
    yesterday: 'hier',
    dAgo: (d) => `il y a ${d} j`,
  },
  dr: {
    sharedBy: 'صفحة مشاركة من ماما',
    offline: 'بلا أنترنت',
    today: 'اليوم',
    nothing: 'ما كاين والو محدد اليوم.',
    tConduites: 'أش ندير إلا…',
    tConduitesSub: 'السخانة، جرح، اختناق…',
    tAppeler: 'لمن نعيّط',
    tAppelerSub: 'الطوارئ والكونطاكتات',
    tEnfants: 'الدراري',
    tEnfantsSub: 'الحساسية، العادات، الطبيب',
    updatedBy: 'تحدّثات من ماما',
    autoUpdate: 'هاد الصفحة كتبقى محيّنة بوحدها.',
    back: 'رجوع',
    conduitesSub: 'توصيات ماما. الصوت ديالها فوق كل توصية.',
    conduitesEmpty: 'ما كاين حتى توصية مشاركة دابا.',
    urgent: 'مستعجل',
    voix: 'صوت ماما',
    urgenceNote: 'طوارئ: دير الإجراء الأول، من بعد عيّط.',
    quiAppeler: 'لمن نعيّط',
    enUrgence: 'فحالة الطوارئ',
    aVerifier: 'خاص التّأكّد',
    contacts: 'الكونطاكتات',
    contactsEmpty: 'ما تزاد حتى كونطاكت.',
    regles: 'القواعد والرّخص',
    ficheTodo: 'البطاقة خاصها تتكمّل من الوالدين.',
    traitement: 'الدّوا',
    medecin: 'الطبيب',
    groupe: 'الفصيلة',
    habitudes: 'العادات',
    cat: { sante: 'الصحة', securite: 'السلامة', quotidien: 'اليومي' },
    jours: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    mois: ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'],
    now: 'دابا',
    hAgo: (h) => `من ${h} سوايع`,
    yesterday: 'البارح',
    dAgo: (d) => `من ${d} أيام`,
  },
  ar: {
    sharedBy: 'صفحة مشتركة من الأم',
    offline: 'غير متصل',
    today: 'اليوم',
    nothing: 'لا شيء مقرَّر اليوم.',
    tConduites: 'ماذا أفعل إذا…',
    tConduitesSub: 'الحُمّى، إصابة، اختناق…',
    tAppeler: 'بمن أتصل',
    tAppelerSub: 'الطوارئ وجهات الاتصال',
    tEnfants: 'الأطفال',
    tEnfantsSub: 'الحساسية، العادات، الطبيب',
    updatedBy: 'حُدِّثت من الأم',
    autoUpdate: 'تبقى هذه الصفحة محدَّثة تلقائيًا.',
    back: 'رجوع',
    conduitesSub: 'تعليمات الأم. صوتها أعلى كل تعليمة.',
    conduitesEmpty: 'لا توجد تعليمات مشتركة بعد.',
    urgent: 'عاجل',
    voix: 'صوت الأم',
    urgenceNote: 'طوارئ: تصرَّف أولًا ثم أبلِغ.',
    quiAppeler: 'بمن أتصل',
    enUrgence: 'في حالة الطوارئ',
    aVerifier: 'للتحقق',
    contacts: 'جهات الاتصال',
    contactsEmpty: 'لم تُضَف جهة اتصال بعد.',
    regles: 'القواعد والأذونات',
    ficheTodo: 'بطاقة يجب أن يكملها الوالد.',
    traitement: 'العلاج',
    medecin: 'الطبيب',
    groupe: 'فصيلة الدم',
    habitudes: 'العادات',
    cat: { sante: 'الصحة', securite: 'الأمان', quotidien: 'اليومي' },
    jours: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    mois: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    now: 'الآن',
    hAgo: (h) => `منذ ${h} ساعة`,
    yesterday: 'أمس',
    dAgo: (d) => `منذ ${d} يوم`,
  },
  en: {
    sharedBy: 'Shared by Mom',
    offline: 'Offline',
    today: 'Today',
    nothing: 'Nothing planned today.',
    tConduites: 'What to do if…',
    tConduitesSub: 'Fever, injury, choking…',
    tAppeler: 'Who to call',
    tAppelerSub: 'Emergencies and contacts',
    tEnfants: 'The children',
    tEnfantsSub: 'Allergies, habits, doctor',
    updatedBy: 'Updated by Mom',
    autoUpdate: 'This page stays up to date on its own.',
    back: 'Back',
    conduitesSub: 'Mom’s instructions. Her voice is at the top of each one.',
    conduitesEmpty: 'No instructions shared yet.',
    urgent: 'Urgent',
    voix: 'Mom’s voice',
    urgenceNote: 'Emergency: act first, tell afterwards.',
    quiAppeler: 'Who to call',
    enUrgence: 'In an emergency',
    aVerifier: 'To verify',
    contacts: 'Contacts',
    contactsEmpty: 'No contact added yet.',
    regles: 'Rules & permissions',
    ficheTodo: 'Card to be completed by the parent.',
    traitement: 'Treatment',
    medecin: 'Doctor',
    groupe: 'Blood type',
    habitudes: 'Habits',
    cat: { sante: 'Health', securite: 'Safety', quotidien: 'Daily' },
    jours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    mois: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    now: 'just now',
    hAgo: (h) => `${h} h ago`,
    yesterday: 'yesterday',
    dAgo: (d) => `${d} d ago`,
  },
};

/** Titre du jour localisé : « Lundi 29 juin » / « الاثنين 29 يونيو » / « Monday 29 June ». */
export function localizedDayTitle(iso: string, L: RLabels): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = (dt.getDay() + 6) % 7;
  return `${L.jours[wd]} ${d} ${L.mois[m - 1]}`;
}

/** « il y a … » localisé. */
export function localizedTimeAgo(iso: string, L: RLabels): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return L.now;
  if (h < 24) return L.hAgo(h);
  const d = Math.floor(h / 24);
  return d === 1 ? L.yesterday : L.dAgo(d);
}
