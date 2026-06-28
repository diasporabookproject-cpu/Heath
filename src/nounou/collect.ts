import type { NounouDoc } from '../types';

// Collecte des chaînes traduisibles d'un document, avec leur sensibilité.
// Sensible (santé/urgences/conduites/allergies) → relecture parent (§1.6).
// Non-sensible (planning) → traduction auto, active.

export interface StrItem {
  text: string;
  sensible: boolean;
}

export function collectStrings(doc: NounouDoc): StrItem[] {
  const map = new Map<string, boolean>(); // text -> sensible (true l'emporte)
  const add = (text: string | undefined, sensible: boolean) => {
    const t = (text ?? '').trim();
    if (!t) return;
    map.set(t, (map.get(t) ?? false) || sensible);
  };

  // Planning (non-sensible)
  const addMoment = (m: { label?: string; lieu?: string; qui?: string }) => {
    add(m.label, false);
    add(m.lieu, false);
    add(m.qui, false);
  };
  doc.rythme.forEach(addMoment);
  doc.ponctuels.forEach(addMoment);
  doc.periodes.forEach((p) => {
    add(p.nom, false);
    add(p.note, false);
    p.rythme.forEach(addMoment);
  });

  // Conduites (sensible)
  doc.conduites
    .filter((c) => !c.aCompleter)
    .forEach((c) => {
      add(c.titre, true);
      add(c.quiAppeler, true);
      c.etapes
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => add(s, true));
    });

  // Fiche urgence (sensible)
  doc.urgence.numeros.forEach((n) => add(n.label, true));
  doc.urgence.contacts.forEach((c) => add(c.role, true));
  doc.urgence.regles.forEach((r) => add(r.texte, true));

  // Fiches enfants (sensible)
  doc.enfants.forEach((e) => {
    const f = e.fiche;
    if (!f) return;
    add(f.allergies, true);
    add(f.traitement, true);
    add(f.medecin, true);
    add(f.groupe, true);
    add(f.habitudes, true);
  });

  return [...map.entries()].map(([text, sensible]) => ({ text, sensible }));
}
