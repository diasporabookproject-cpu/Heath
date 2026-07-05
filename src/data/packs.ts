import type { Pack } from '../types';
import marocain from './packs/marocain-quotidien.json';
import leger from './packs/leger-equilibre.json';

// Collections / packs éditoriaux (L3-4). Format versionné `packs/*.json`,
// pensé réutilisable (futurs gabarits de conduites). Le contenu éditorial riche
// est un chantier séparé (hors périmètre) : ici, un pack « seed » + un pack démo.
export const PACKS: Pack[] = [marocain as Pack, leger as Pack];
