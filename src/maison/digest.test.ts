import { describe, expect, it } from 'vitest';
import { buildCuisineDigest, buildCuisineGreeting, buildNounouDigest, corpsSansLien } from './digest';
import type { NounouDoc, Recipe, WeekMenu } from '../types';

const recipe = (id: string, nom: string): Recipe => ({
  id,
  nom,
  role: 'plat',
  statut: 'Validé',
  ingredients: '',
});

const byId = new Map([recipe('r1', 'Kefta riz légumes'), recipe('r2', 'Saumon patate douce')].map((r) => [r.id, r]));

const emptySlot = () => ({ plat: null as string | null });
const emptyDay = () => ({ petitdej: emptySlot(), dej: emptySlot(), diner: emptySlot() });
const week = (): WeekMenu => {
  const days: WeekMenu['days'] = {};
  for (const k of ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']) days[k] = emptyDay();
  days.lun = { petitdej: emptySlot(), dej: { plat: 'r1' }, diner: { plat: 'r2' } };
  return { id: '2026-W27', days };
};

describe('buildCuisineDigest', () => {
  const base = { prenom: 'Khadija', link: 'manzil.ma/p/k', week: week(), byId };

  it('semaine : liste les jours composés, avec le lien', () => {
    const d = buildCuisineDigest({ ...base, scope: 'semaine' });
    expect(d).toContain('Salam Khadija');
    expect(d).toContain('Lundi — Kefta riz légumes · Saumon patate douce');
    expect(d).toContain('manzil.ma/p/k');
    expect(d).not.toContain('Mardi'); // mardi vide → absent
  });

  it('jour ciblé composé : lignes libellées', () => {
    const d = buildCuisineDigest({ ...base, scope: 'jour', dayKey: 'lun' });
    expect(d).toContain('Déjeuner — Kefta riz légumes');
    expect(d).toContain('Dîner — Saumon patate douce');
  });

  it('jour vide : digest honnête « ta page reste à jour »', () => {
    const d = buildCuisineDigest({ ...base, scope: 'jour', dayKey: 'mar' });
    expect(d).toContain('Rien de prévu');
    expect(d).toContain('ta page reste à jour');
    expect(d).toContain('manzil.ma/p/k');
  });

  it('semaine vide : reste honnête', () => {
    const empty = { id: 'x', days: {} as WeekMenu['days'] };
    for (const k of ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']) empty.days[k] = emptyDay();
    const d = buildCuisineDigest({ ...base, week: empty, scope: 'semaine' });
    expect(d).toContain('Rien de composé cette semaine');
  });
});

const emptyDoc = (): NounouDoc => ({
  enfants: [],
  rythme: [],
  periodes: [],
  ponctuels: [],
  conduites: [],
  urgence: { numeros: [], contacts: [], regles: [] },
  destinataires: [],
});

describe('buildNounouDigest', () => {
  const base = { prenom: 'Fatima', link: 'manzil.ma/p/f', doc: emptyDoc() };

  it('evenement : reprend jour/heure/label du ponctuel + lien', () => {
    const d = buildNounouDigest({
      ...base,
      scope: 'evenement',
      upcoming: {
        id: 'p1',
        date: '2026-07-06',
        heure: '08:30',
        label: 'RDV pédiatre',
        type: 'sante',
        enfants: [],
        qui: 'Dr Alaoui',
        lieu: 'Gauthier',
      },
    });
    expect(d).toContain('08:30');
    expect(d).toContain('RDV pédiatre');
    expect(d).toContain('Dr Alaoui, Gauthier');
    expect(d).toContain('manzil.ma/p/f');
  });

  it('evenement sans ponctuel : honnête', () => {
    const d = buildNounouDigest({ ...base, scope: 'evenement' });
    expect(d).toContain('Aucun événement');
  });

  it('aujourd’hui sans rythme : « rien de particulier »', () => {
    const d = buildNounouDigest({ ...base, scope: 'aujourdhui' });
    expect(d).toContain('Rien de particulier');
    expect(d).toContain('manzil.ma/p/f');
  });
});

describe('buildCuisineGreeting (T1 lot partage — message court maquette)', () => {
  it('fr : bonjour + « il est ici » + lien, sans détail de plats', () => {
    const g = buildCuisineGreeting({ prenom: 'Fatima', link: 'https://x/#e=tok', lang: 'fr' });
    expect(g).toContain('Bonjour Fatima');
    expect(g).toContain('il est ici');
    expect(g).toContain('https://x/#e=tok');
    expect(g).not.toMatch(/Petit-déj|Déjeuner|Dîner/); // le détail vit sur la page
  });
  it('dr : salutation darija + lien (premier jet, à relire)', () => {
    const g = buildCuisineGreeting({ prenom: 'Fatima', link: 'L', lang: 'dr' });
    expect(g).toContain('سلام Fatima');
    expect(g).toContain('L');
  });
});

describe('corpsSansLien — l’écran cache le lien, l’envoi le garde (T1 partage simplifié)', () => {
  const lien = 'https://exemple.github.io/Heath/#e=abc123';

  it('retire le lien de l’AFFICHAGE, garde le reste du mot', () => {
    const envoye = buildCuisineGreeting({ prenom: 'Fatima', link: lien, lang: 'fr' });
    const affiche = corpsSansLien(envoye, lien);
    expect(affiche).toContain('Bonjour Fatima');
    expect(affiche).toContain('il est ici');
    expect(affiche).not.toContain(lien);
  });

  it('🔴 le message ENVOYÉ, lui, garde le lien — sinon la page est inatteignable', () => {
    const envoye = buildCuisineGreeting({ prenom: 'Fatima', link: lien, lang: 'fr' });
    expect(envoye).toContain(lien); // c'est CETTE chaîne qui part sur WhatsApp
    corpsSansLien(envoye, lien); // l'affichage ne mute pas la source (fonction pure)
    expect(envoye).toContain(lien);
  });

  it('vaut aussi en darija', () => {
    const envoye = buildCuisineGreeting({ prenom: 'Fatima', link: lien, lang: 'dr' });
    expect(corpsSansLien(envoye, lien)).toContain('سلام Fatima');
    expect(corpsSansLien(envoye, lien)).not.toContain(lien);
  });

  it('ne coupe rien d’autre : lien absent ou vide → message intact', () => {
    expect(corpsSansLien('Bonjour', '')).toBe('Bonjour');
    expect(corpsSansLien('Bonjour', 'https://autre.test/')).toBe('Bonjour');
  });
});
