import type { AppConfig, MealKey, MealSlot, Recipe, WeekMenu } from '../types';
import { matchAllergenes } from './allergenes';

// Payload du menu envoyé dans l'espace cuisinière (FC10/FC19, modèle v2).
// 3 repas par jour, chacun pouvant être structuré (plat / entrée / accompagnement).
// Les anciens liens encodés (#m=) et publiés (#p=) ont été retirés : le canal
// est l'espace permanent par destinataire (#e=).

export interface SharedComp {
  n: string; // nom FR
  i: string; // ingrédients FR (1 portion ; accompagnement = pour `g` grammes de référence)
  e?: string; // étapes FR
  na?: string; // nom darija
  ia?: string; // ingrédients darija
  ea?: string; // étapes darija
  a?: string; // URL publique de la note vocale
  g?: number; // quantité en grammes (accompagnement)
  /** F5.5 — allergènes du FOYER touchés par cette recette (calculés à la
   * PUBLICATION : page vivante = se met à jour au prochain envoi ; G3 = l'alerte
   * voyage DANS le payload, visible hors-ligne, jamais silencieuse). */
  w?: string[];
}

export interface SharedMealV2 {
  plat?: SharedComp;
  entree?: SharedComp;
  acc?: SharedComp;
}

export interface SharedDay {
  k: string;
  nom: string;
  petitdej?: SharedMealV2;
  dej?: SharedMealV2;
  diner?: SharedMealV2;
}

export interface SharedMenu {
  v: 2;
  days: SharedDay[];
}

/** Ids de toutes les recettes utilisées dans la semaine (pour téléverser les audios). */
export function usedRecipeIds(config: AppConfig, week: WeekMenu): string[] {
  const ids = new Set<string>();
  for (const j of config.jours) {
    const day = week.days[j.key];
    if (!day) continue;
    for (const key of ['petitdej', 'dej', 'diner'] as MealKey[]) {
      const m = day[key];
      if (m.plat) ids.add(m.plat);
      if (key !== 'petitdej') {
        if (m.entree) ids.add(m.entree);
        if (m.acc) ids.add(m.acc.id);
      }
    }
  }
  return [...ids];
}

function comp(r: Recipe, audioUrls?: Map<string, string>, g?: number, allergies?: string[]): SharedComp {
  const c: SharedComp = { n: r.nom, i: r.ingredients };
  if (r.etapes) c.e = r.etapes;
  if (r.nom_ar) c.na = r.nom_ar;
  if (r.ingredients_ar) c.ia = r.ingredients_ar;
  if (r.etapes_ar) c.ea = r.etapes_ar;
  const u = audioUrls?.get(r.id);
  if (u) c.a = u;
  if (g != null) c.g = g;
  // F5.5 : alerte allergène calculée ici — foyer sans règle → jamais de champ.
  if (allergies?.length) {
    const hits = matchAllergenes(allergies, `${r.nom} ${r.ingredients}`);
    if (hits.length) c.w = hits;
  }
  return c;
}

function buildMeal(
  slot: MealSlot,
  key: MealKey,
  byId: Map<string, Recipe>,
  audioUrls?: Map<string, string>,
  allergies?: string[],
): SharedMealV2 | undefined {
  const out: SharedMealV2 = {};
  const plat = slot.plat ? byId.get(slot.plat) : undefined;
  if (plat) out.plat = comp(plat, audioUrls, undefined, allergies);
  if (key !== 'petitdej') {
    const e = slot.entree ? byId.get(slot.entree) : undefined;
    if (e) out.entree = comp(e, audioUrls, undefined, allergies);
    if (slot.acc) {
      const a = byId.get(slot.acc.id);
      if (a) out.acc = comp(a, audioUrls, slot.acc.g, allergies);
    }
  }
  return out.plat || out.entree || out.acc ? out : undefined;
}

/** Construit le menu de l'espace à partir de la semaine (jours non vides). */
export function buildEspaceMenu(
  config: AppConfig,
  week: WeekMenu,
  byId: Map<string, Recipe>,
  audioUrls?: Map<string, string>,
  allergies?: string[],
): SharedMenu {
  const days: SharedDay[] = [];
  for (const j of config.jours) {
    const day = week.days[j.key];
    if (!day) continue;
    const sd: SharedDay = { k: j.key, nom: j.nom };
    const pd = buildMeal(day.petitdej, 'petitdej', byId, audioUrls, allergies);
    const dj = buildMeal(day.dej, 'dej', byId, audioUrls, allergies);
    const dn = buildMeal(day.diner, 'diner', byId, audioUrls, allergies);
    if (pd) sd.petitdej = pd;
    if (dj) sd.dej = dj;
    if (dn) sd.diner = dn;
    if (sd.petitdej || sd.dej || sd.diner) days.push(sd);
  }
  return { v: 2, days };
}
