import { create } from 'zustand';
import type {
  Conduite,
  Enfant,
  Moment,
  NounouContact,
  NounouDest,
  NounouDoc,
  NounouLangue,
  NumeroUrgence,
  Periode,
  Ponctuel,
  ReglePerm,
} from '../types';
import { loadNounou, saveNounou } from '../lib/db';
import { emptyNounouDoc, mergeNounouDoc, newToken, seedNounouDoc, uid } from './defaults';

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

  // Moments : rythme habituel, ou rythme d'une période si `periodeId` fourni.
  addMoment: (m: Omit<Moment, 'id'>, periodeId?: string) => string;
  updateMoment: (id: string, patch: Partial<Moment>, periodeId?: string) => void;
  removeMoment: (id: string, periodeId?: string) => void;

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

  // Destinataires (lien durable scopé)
  upsertDest: (d: Partial<NounouDest> & { prenom: string }) => string;
  removeDest: (id: string) => void;

  // Fiche urgence (Lot 3)
  setNumeros: (numeros: NumeroUrgence[]) => void;
  upsertContact: (c: Partial<NounouContact> & { nom: string; tel: string }) => string;
  removeContact: (id: string) => void;
  upsertRegle: (r: Partial<ReglePerm> & { texte: string; permis: boolean }) => string;
  removeRegle: (id: string) => void;

  // Traductions (Lot 4.2)
  mergeTranslations: (langue: NounouLangue, entries: { src: string; tr: string; sensible: boolean }[]) => void;
  validateTranslation: (langue: NounouLangue, src: string) => void;
  rejectTranslation: (langue: NounouLangue, src: string) => void;
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
        const idx = doc.enfants.findIndex((x) => x.id === id);
        const prev = idx >= 0 ? doc.enfants[idx] : undefined;
        const next: Enfant = {
          id,
          prenom: e.prenom,
          initiale: e.initiale ?? prev?.initiale ?? e.prenom.charAt(0).toUpperCase(),
          couleur: e.couleur ?? prev?.couleur ?? '#1e4d45',
          fiche: e.fiche ?? prev?.fiche,
        };
        const enfants =
          idx >= 0 ? doc.enfants.map((x) => (x.id === id ? next : x)) : [...doc.enfants, next];
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

    addMoment(m, periodeId) {
      const id = uid();
      mutate((doc) => {
        if (periodeId) {
          return {
            ...doc,
            periodes: doc.periodes.map((p) =>
              p.id === periodeId ? { ...p, rythme: [...p.rythme, { ...m, id }] } : p,
            ),
          };
        }
        return { ...doc, rythme: [...doc.rythme, { ...m, id }] };
      });
      return id;
    },

    updateMoment(id, patch, periodeId) {
      mutate((doc) => {
        if (periodeId) {
          return {
            ...doc,
            periodes: doc.periodes.map((p) =>
              p.id === periodeId
                ? { ...p, rythme: p.rythme.map((m) => (m.id === id ? { ...m, ...patch } : m)) }
                : p,
            ),
          };
        }
        return { ...doc, rythme: doc.rythme.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
      });
    },

    removeMoment(id, periodeId) {
      mutate((doc) => {
        if (periodeId) {
          return {
            ...doc,
            periodes: doc.periodes.map((p) =>
              p.id === periodeId ? { ...p, rythme: p.rythme.filter((m) => m.id !== id) } : p,
            ),
          };
        }
        return { ...doc, rythme: doc.rythme.filter((m) => m.id !== id) };
      });
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

    upsertDest(d) {
      const id = d.id ?? uid();
      mutate((doc) => {
        const idx = doc.destinataires.findIndex((x) => x.id === id);
        const prev = idx >= 0 ? doc.destinataires[idx] : undefined;
        const next: NounouDest = {
          id,
          prenom: d.prenom,
          role: d.role ?? prev?.role ?? 'Nounou',
          langue: d.langue ?? prev?.langue ?? 'fr',
          enfants: d.enfants ?? prev?.enfants ?? [],
          tel: d.tel ?? prev?.tel,
          token: prev?.token ?? d.token ?? newToken(),
          createdAt: prev?.createdAt ?? nowSeq(),
        };
        const destinataires =
          idx >= 0
            ? doc.destinataires.map((x) => (x.id === id ? next : x))
            : [...doc.destinataires, next];
        return { ...doc, destinataires };
      });
      return id;
    },

    removeDest(id) {
      mutate((doc) => ({ ...doc, destinataires: doc.destinataires.filter((d) => d.id !== id) }));
    },

    setNumeros(numeros) {
      mutate((doc) => ({ ...doc, urgence: { ...doc.urgence, numeros } }));
    },

    upsertContact(c) {
      const id = c.id ?? uid();
      mutate((doc) => {
        const next: NounouContact = { id, nom: c.nom, tel: c.tel, role: c.role };
        const idx = doc.urgence.contacts.findIndex((x) => x.id === id);
        const contacts =
          idx >= 0
            ? doc.urgence.contacts.map((x) => (x.id === id ? next : x))
            : [...doc.urgence.contacts, next];
        return { ...doc, urgence: { ...doc.urgence, contacts } };
      });
      return id;
    },

    removeContact(id) {
      mutate((doc) => ({
        ...doc,
        urgence: { ...doc.urgence, contacts: doc.urgence.contacts.filter((c) => c.id !== id) },
      }));
    },

    upsertRegle(r) {
      const id = r.id ?? uid();
      mutate((doc) => {
        const next: ReglePerm = { id, texte: r.texte, permis: r.permis };
        const idx = doc.urgence.regles.findIndex((x) => x.id === id);
        const regles =
          idx >= 0
            ? doc.urgence.regles.map((x) => (x.id === id ? next : x))
            : [...doc.urgence.regles, next];
        return { ...doc, urgence: { ...doc.urgence, regles } };
      });
      return id;
    },

    removeRegle(id) {
      mutate((doc) => ({
        ...doc,
        urgence: { ...doc.urgence, regles: doc.urgence.regles.filter((r) => r.id !== id) },
      }));
    },

    mergeTranslations(langue, entries) {
      mutate((doc) => {
        const all = { ...(doc.translations ?? {}) };
        const cur = { ...(all[langue] ?? {}) };
        for (const e of entries) {
          const prev = cur[e.src];
          if (prev && prev.status === 'valide') continue; // garder la version relue
          cur[e.src] = { tr: e.tr, sensible: e.sensible, status: e.sensible ? 'aValider' : 'auto' };
        }
        all[langue] = cur;
        return { ...doc, translations: all };
      });
    },

    validateTranslation(langue, src) {
      mutate((doc) => {
        const all = { ...(doc.translations ?? {}) };
        const cur = { ...(all[langue] ?? {}) };
        if (cur[src]) cur[src] = { ...cur[src], status: 'valide' };
        all[langue] = cur;
        return { ...doc, translations: all };
      });
    },

    rejectTranslation(langue, src) {
      mutate((doc) => {
        const all = { ...(doc.translations ?? {}) };
        const cur = { ...(all[langue] ?? {}) };
        delete cur[src];
        all[langue] = cur;
        return { ...doc, translations: all };
      });
    },
  };

  // Date.now() est indisponible dans certains contextes (workflows) mais OK ici
  // (code applicatif navigateur) ; on l'isole pour le tri de création.
  function nowSeq(): number {
    return Date.now();
  }
});
