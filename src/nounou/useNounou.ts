import { create } from 'zustand';
import type { Conduite, Enfant, Moment, NounouDoc, Periode, Ponctuel } from '../types';
import { loadNounou, saveNounou } from '../lib/db';
import { emptyNounouDoc, mergeNounouDoc, seedNounouDoc, uid } from './defaults';

// Store de la page Nounou — document unique en local-first (IndexedDB = vérité).
// Précédence du modèle : ponctuel > période > rythme habituel (cf. projection.ts).
// Conflit de synchro : last-write-wins (documenté, MVP).

interface NounouState {
  ready: boolean;
  doc: NounouDoc;
  init: () => Promise<void>;

  // Enfants
  upsertEnfant: (e: Partial<Enfant> & { prenom: string }) => string;
  removeEnfant: (id: string) => void;

  // Rythme habituel (moments)
  addMoment: (m: Omit<Moment, 'id'>) => string;
  updateMoment: (id: string, patch: Partial<Moment>) => void;
  removeMoment: (id: string) => void;

  // Périodes
  addPeriode: (p: Omit<Periode, 'id' | 'rythme'> & { rythme?: Moment[] }) => string;
  updatePeriode: (id: string, patch: Partial<Periode>) => void;
  removePeriode: (id: string) => void;

  // Ponctuels
  addPonctuel: (p: Omit<Ponctuel, 'id'>) => string;
  removePonctuel: (id: string) => void;

  // Conduites (Lot 2 — actions prêtes côté data)
  upsertConduite: (c: Partial<Conduite> & { titre: string; categ: Conduite['categ'] }) => string;
  removeConduite: (id: string) => void;
}

export const useNounou = create<NounouState>((set) => {
  /** Applique une transformation au document et le persiste. */
  const mutate = (fn: (doc: NounouDoc) => NounouDoc) => {
    set((s) => {
      const doc = fn(s.doc);
      void saveNounou(doc);
      return { doc };
    });
  };

  return {
    ready: false,
    doc: emptyNounouDoc(),

    async init() {
      const loaded = await loadNounou();
      if (loaded) {
        set({ doc: mergeNounouDoc(loaded), ready: true });
      } else {
        // Premier lancement : amorcer la page (anti-page-blanche) et persister.
        const doc = seedNounouDoc();
        await saveNounou(doc);
        set({ doc, ready: true });
      }
    },

    upsertEnfant(e) {
      const id = e.id ?? uid();
      mutate((doc) => {
        const initiale = e.initiale ?? e.prenom.charAt(0).toUpperCase();
        const idx = doc.enfants.findIndex((x) => x.id === id);
        const next: Enfant = {
          id,
          prenom: e.prenom,
          initiale,
          couleur: e.couleur ?? '#1e4d45',
          fiche: e.fiche,
        };
        const enfants =
          idx >= 0 ? doc.enfants.map((x) => (x.id === id ? { ...x, ...next } : x)) : [...doc.enfants, next];
        return { ...doc, enfants };
      });
      return id;
    },

    removeEnfant(id) {
      mutate((doc) => ({
        ...doc,
        enfants: doc.enfants.filter((e) => e.id !== id),
        // Détacher l'enfant des moments/ponctuels qui le ciblaient.
        rythme: doc.rythme.map((m) => ({ ...m, enfants: m.enfants.filter((x) => x !== id) })),
        ponctuels: doc.ponctuels.map((p) => ({ ...p, enfants: p.enfants.filter((x) => x !== id) })),
        periodes: doc.periodes.map((per) => ({
          ...per,
          rythme: per.rythme.map((m) => ({ ...m, enfants: m.enfants.filter((x) => x !== id) })),
        })),
      }));
    },

    addMoment(m) {
      const id = uid();
      mutate((doc) => ({ ...doc, rythme: [...doc.rythme, { ...m, id }] }));
      return id;
    },

    updateMoment(id, patch) {
      mutate((doc) => ({
        ...doc,
        rythme: doc.rythme.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    },

    removeMoment(id) {
      mutate((doc) => ({ ...doc, rythme: doc.rythme.filter((m) => m.id !== id) }));
    },

    addPeriode(p) {
      const id = uid();
      mutate((doc) => {
        // Démarre comme copie du rythme habituel (ids neufs), ajustable ensuite.
        const rythme = p.rythme ?? doc.rythme.map((m) => ({ ...m, id: uid() }));
        return { ...doc, periodes: [...doc.periodes, { ...p, id, rythme }] };
      });
      return id;
    },

    updatePeriode(id, patch) {
      mutate((doc) => ({
        ...doc,
        periodes: doc.periodes.map((per) => (per.id === id ? { ...per, ...patch } : per)),
      }));
    },

    removePeriode(id) {
      mutate((doc) => ({ ...doc, periodes: doc.periodes.filter((p) => p.id !== id) }));
    },

    addPonctuel(p) {
      const id = uid();
      mutate((doc) => ({ ...doc, ponctuels: [...doc.ponctuels, { ...p, id }] }));
      return id;
    },

    removePonctuel(id) {
      mutate((doc) => ({ ...doc, ponctuels: doc.ponctuels.filter((p) => p.id !== id) }));
    },

    upsertConduite(c) {
      const id = c.id ?? uid();
      mutate((doc) => {
        const idx = doc.conduites.findIndex((x) => x.id === id);
        const next: Conduite = {
          id,
          titre: c.titre,
          categ: c.categ,
          urgent: c.urgent,
          aCompleter: c.aCompleter,
          etapes: c.etapes ?? '',
          quiAppeler: c.quiAppeler,
          createdAt: c.createdAt ?? (idx >= 0 ? doc.conduites[idx].createdAt : nowSeq()),
        };
        const conduites =
          idx >= 0 ? doc.conduites.map((x) => (x.id === id ? next : x)) : [...doc.conduites, next];
        return { ...doc, conduites };
      });
      return id;
    },

    removeConduite(id) {
      mutate((doc) => ({ ...doc, conduites: doc.conduites.filter((c) => c.id !== id) }));
    },
  };

  // Date.now() est indisponible dans certains contextes (workflows) mais OK ici
  // (code applicatif navigateur) ; on l'isole pour le tri de création.
  function nowSeq(): number {
    return Date.now();
  }
});
