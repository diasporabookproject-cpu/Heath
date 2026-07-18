import seed from './seed.json';
import type { AppConfig, Recipe, RecipeRole, RecipeStatus } from '../types';

// Jeu de données de départ. Les recettes du seed v1 (type Déjeuner/Dîner/Coupe-faim)
// sont mappées vers le nouveau RÔLE : Déjeuner/Dîner → plat, Coupe-faim → entrée.
// On enrichit avec des petits-déjeuners et des accompagnements (rôles absents en v1).
// (Lot simplification : macros/calcium retirées — un menu, pas un tableur nutritionnel.)

const roleFromType = (t: string): RecipeRole => (t === 'Coupe-faim' ? 'entree' : 'plat');

interface SeedRow {
  id: string;
  nom: string;
  type: string;
  statut: RecipeStatus;
  ingredients: string;
  notes?: string;
  nom_ar?: string;
  ingredients_ar?: string;
}

const fromSeed: Recipe[] = (seed.recettes as SeedRow[]).map((r) => ({
  id: r.id,
  nom: r.nom,
  role: roleFromType(r.type),
  statut: r.statut,
  ingredients: r.ingredients,
  notes: r.notes,
  nom_ar: r.nom_ar,
  ingredients_ar: r.ingredients_ar,
}));

const PETITDEJ: Recipe[] = [
  {
    id: 'PDJ-01', nom: 'Msemmen SG, œufs & fromage', role: 'petitdej', statut: 'Validé',
    ingredients: 'Msemmen sans gluten 1 · œufs 2 · fromage frais 40g · huile 1 càc',
    nom_ar: 'مسمن بلا غلوتين، بيض وفرماج', ingredients_ar: 'مسمن بلا غلوتين 1 · بيض 2 · فرماج طري 40g · زيت ملعقة صغيرة',
  },
  {
    id: 'PDJ-02', nom: 'Yaourt grec, avoine & fruits', role: 'petitdej', statut: 'Validé',
    ingredients: 'Yaourt grec 200g · flocons d’avoine sans gluten 40g · fruits rouges 80g · amandes 15g',
    nom_ar: 'ياغورت إغريقي، شوفان وفواكه', ingredients_ar: 'ياغورت إغريقي 200g · شوفان بلا غلوتين 40g · فواكه حمرا 80g · لوز 15g',
  },
  {
    id: 'PDJ-03', nom: 'Œufs brouillés & pain SG', role: 'petitdej', statut: 'Validé',
    ingredients: 'Œufs 3 · pain complet sans gluten 50g · beurre 1 càc · ciboulette',
    nom_ar: 'بيض مخلوط وخبز بلا غلوتين', ingredients_ar: 'بيض 3 · خبز كامل بلا غلوتين 50g · زبدة ملعقة صغيرة',
  },
];

// Accompagnements (quantités PAR 100 g pour la mise à l'échelle des courses).
const ACC: Recipe[] = [
  {
    id: 'ACC-01', nom: 'Riz blanc', role: 'acc', statut: 'Validé',
    ingredients: 'Riz blanc cuit', nom_ar: 'روز أبيض', ingredients_ar: 'روز أبيض مطيّب',
  },
  {
    id: 'ACC-02', nom: 'Semoule sans gluten', role: 'acc', statut: 'Validé',
    ingredients: 'Semoule sans gluten cuite', nom_ar: 'سميدة بلا غلوتين', ingredients_ar: 'سميدة بلا غلوتين مطيّبة',
  },
  {
    id: 'ACC-03', nom: 'Pommes de terre rôties', role: 'acc', statut: 'Validé',
    ingredients: 'Pommes de terre · huile d’olive', nom_ar: 'بطاطا مشوية', ingredients_ar: 'بطاطا · زيت الزيتون',
  },
  {
    id: 'ACC-04', nom: 'Légumes vapeur', role: 'acc', statut: 'Validé',
    ingredients: 'Brocoli · carotte · courgette', nom_ar: 'خضرة بالبخار', ingredients_ar: 'بروكلي · خيزو · كورجيت',
  },
];

export const SEED_CONFIG = seed.config as unknown as AppConfig;
export const SEED_RECIPES: Recipe[] = [...fromSeed, ...PETITDEJ, ...ACC];
