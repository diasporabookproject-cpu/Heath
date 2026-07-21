import type { NounouDoc, Ponctuel, Recipe, WeekMenu } from '../types';
import { SEED_CONFIG } from '../data';
import { cleanText } from '../lib/sanitize';
import { todayKey } from '../cuisine/dates';
import { projectDay } from '../nounou/projection';
import { todayISO, addDaysISO, dayTitleISO } from '../nounou/dates';

// Composeur de digest WhatsApp (L3-1b) — PARTAGÉ entre les deux rôles.
// RÈGLE CENTRALE : la portée ne change QUE le message. L'envoi publie toujours
// la page complète et à jour ; le digest est un résumé « une page vivante ».
// Fidèle au gabarit du prototype v6.1 (objet `WA`), mais en texte brut (WhatsApp)
// et composé depuis les données réelles. Jamais de markdown/emoji parasite (cleanText).

export type CuisineScope = 'semaine' | 'aujourdhui' | 'demain' | 'jour';
export type NounouScope = 'semaine' | 'aujourdhui' | 'demain' | 'evenement';

const JOURS = SEED_CONFIG.jours;

/** Clé de jour suivante dans l'ordre lun→dim (même semaine — cf. limite « demain » un dimanche). */
function nextDayKey(key: string): string {
  const i = JOURS.findIndex((j) => j.key === key);
  return JOURS[(i + 1) % JOURS.length]?.key ?? key;
}

const platName = (id: string | null | undefined, byId: Map<string, Recipe>): string => {
  if (!id) return '';
  const r = byId.get(id);
  return r ? cleanText(r.nom) : '';
};

/** Plats composés d'un jour (petit-déj/déj/dîner), noms nettoyés, dans l'ordre. */
function dayPlats(day: WeekMenu['days'][string] | undefined, byId: Map<string, Recipe>): string[] {
  if (!day) return [];
  return [
    platName(day.petitdej?.plat, byId),
    platName(day.dej?.plat, byId),
    platName(day.gouter?.plat, byId),
    platName(day.diner?.plat, byId),
  ].filter(Boolean);
}

/** Lignes libellées d'un jour (« Déjeuner — X »). */
function dayLabeledLines(day: WeekMenu['days'][string] | undefined, byId: Map<string, Recipe>): string[] {
  if (!day) return [];
  const out: string[] = [];
  const pdj = platName(day.petitdej?.plat, byId);
  const dej = platName(day.dej?.plat, byId);
  const gou = platName(day.gouter?.plat, byId);
  const din = platName(day.diner?.plat, byId);
  if (pdj) out.push(`Petit-déj — ${pdj}`);
  if (dej) out.push(`Déjeuner — ${dej}`);
  if (gou) out.push(`Goûter — ${gou}`);
  if (din) out.push(`Dîner — ${din}`);
  return out;
}

/**
 * T1 (lot partage) — le MESSAGE de la maquette : un mot COURT et chaleureux +
 * le lien ; le détail vit sur la PAGE (« il est ici 👇 »). Bilingue : le fr est
 * définitif ; la darija est un PREMIER JET (brouillon, cf. maquette + parking
 * §7.4) — à faire relire. La portée disparaît : un bonjour ne dépend pas du jour.
 */
export function buildCuisineGreeting(opts: { prenom: string; link: string; lang: 'fr' | 'dr' }): string {
  const { prenom, link, lang } = opts;
  if (lang === 'dr') {
    return `سلام ${prenom} 👋\nالمنيو ديالك واجد، شوفيه هنا 👇\n${link}`;
  }
  return `Bonjour ${prenom} 👋\nLe menu est prêt, il est ici 👇\n${link}`;
}

export function buildCuisineDigest(opts: {
  prenom: string;
  scope: CuisineScope;
  link: string;
  week: WeekMenu;
  byId: Map<string, Recipe>;
  /** Jour ciblé pour la portée « jour » (clé lun…dim). Défaut : aujourd'hui. */
  dayKey?: string;
}): string {
  const { prenom, scope, link, week, byId } = opts;
  const salut = `Salam ${prenom}`;

  if (scope === 'semaine') {
    const rows = JOURS.map((j) => ({ nom: j.nom, plats: dayPlats(week.days[j.key], byId) }))
      .filter((x) => x.plats.length > 0)
      .map((x) => `${x.nom} — ${x.plats.join(' · ')}`);
    if (rows.length === 0) {
      return `${salut} 🌙\nRien de composé cette semaine pour l'instant — ta page reste à jour :\n${link}`;
    }
    return `${salut} 🌙 Les menus de la semaine sont prêts :\n${rows.join('\n')}\n📄 Quantités, préparation et courses — tout est sur ta page :\n${link}`;
  }

  const key = scope === 'demain' ? nextDayKey(todayKey()) : (opts.dayKey ?? todayKey());
  const when =
    scope === 'aujourdhui'
      ? "pour aujourd'hui"
      : scope === 'demain'
        ? 'pour demain'
        : (JOURS.find((j) => j.key === key)?.nom ?? '').toLowerCase();
  const lines = dayLabeledLines(week.days[key], byId);
  if (lines.length === 0) {
    return `${salut} — ${when} :\nRien de prévu — ta page reste à jour :\n${link}`;
  }
  return `${salut} — ${when} :\n${lines.join('\n')}\n📄 Détails et quantités sur ta page :\n${link}`;
}

/** Entrées projetées d'un jour → « Label HH:MM », nettoyées. */
function nounouDayLines(doc: NounouDoc, iso: string): string[] {
  return projectDay(doc, iso).map((e) => `${cleanText(e.label)} ${e.heure}`);
}

export function buildNounouDigest(opts: {
  prenom: string;
  scope: NounouScope;
  link: string;
  doc: NounouDoc;
  /** Ponctuel ciblé pour la portée « evenement ». */
  upcoming?: Ponctuel;
}): string {
  const { prenom, scope, link, doc, upcoming } = opts;
  const salut = `Salam ${prenom}`;

  if (scope === 'evenement') {
    if (!upcoming) {
      return `${salut} 🧸\nAucun événement particulier à venir — ta page reste à jour :\n${link}`;
    }
    const who = [upcoming.qui, upcoming.lieu].filter(Boolean).join(', ');
    return `${salut} — ${dayTitleISO(upcoming.date)} ${upcoming.heure} : ${cleanText(upcoming.label)}${
      who ? ` (${cleanText(who)})` : ''
    }.\n📄 Ma consigne et l'adresse sont sur ta page :\n${link}`;
  }

  if (scope === 'semaine') {
    const line = nounouDayLines(doc, todayISO()).slice(0, 3).join(' · ');
    return `${salut} 🧸 La semaine des enfants est prête.${line ? '\n' + line : ''}\n📄 Le planning jour par jour, mes consignes et les numéros — tout est sur ta page :\n${link}`;
  }

  const iso = scope === 'demain' ? addDaysISO(todayISO(), 1) : todayISO();
  const when = scope === 'demain' ? 'demain' : "aujourd'hui";
  const lines = nounouDayLines(doc, iso).slice(0, 4);
  if (lines.length === 0) {
    return `${salut} — ${when} :\nRien de particulier — ta page reste à jour :\n${link}`;
  }
  return `${salut} — ${when} :\n${lines.join(' · ')}\n📄 Ta page :\n${link}`;
}
