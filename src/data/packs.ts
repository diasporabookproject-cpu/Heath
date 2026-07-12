import type { Pack } from '../types';
import fonds from './packs/fonds-de-depart.json';
import marocain from './packs/marocain-quotidien.json';
import leger from './packs/leger-equilibre.json';

// Collections / packs éditoriaux (L3-4). Format versionné `packs/*.json`,
// pensé réutilisable (futurs gabarits de conduites). Le contenu éditorial riche
// est un chantier séparé (hors périmètre).
// F2 (Flow FTUE) : « Fonds de départ » = l'ancien seed (30 recettes, l'Écartée
// sortie — une collection n'embarque que du contenu assumé), désormais INSTALLABLE
// et plus jamais importé d'office. Généré one-shot depuis SEED_RECIPES ; banc
// d'essai du principe de collection en attendant la bibliothèque éditoriale.
// `marocain-quotidien`/`leger-equilibre` CONSERVÉS malgré le recouvrement
// (décision PO) : banc d'essai de la dédup par nom et du rail multi-packs.
export const PACKS: Pack[] = [fonds as Pack, marocain as Pack, leger as Pack];
