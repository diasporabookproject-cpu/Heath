import seed from './seed.json';
import type { AppConfig, Recipe } from '../types';

// Le jeu de données de départ (BRIEF_PRODUIT.md §9). Importé tel quel ;
// l'app permet ensuite d'ajouter / écarter des recettes (stockées localement).
export const SEED_CONFIG = seed.config as AppConfig;
export const SEED_RECIPES = seed.recettes as Recipe[];
