import seed from './seed.json';
import type { AppConfig, CalciumFlag, Recipe, RecipeRole, RecipeStatus } from '../types';

// Jeu de données de départ. Les recettes du seed v1 (type Déjeuner/Dîner/Coupe-faim)
// sont mappées vers le nouveau RÔLE : Déjeuner/Dîner → plat, Coupe-faim → entrée.
// On enrichit avec des petits-déjeuners et des accompagnements (rôles absents en v1).

const roleFromType = (t: string): RecipeRole => (t === 'Coupe-faim' ? 'entree' : 'plat');

interface SeedRow {
  id: string;
  nom: string;
  type: string;
  statut: RecipeStatus;
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
  calcium: number;
  flag_calcium: CalciumFlag;
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
  kcal: r.kcal,
  prot: r.prot,
  gluc: r.gluc,
  lip: r.lip,
  calcium: r.calcium,
  flag_calcium: r.flag_calcium,
  ingredients: r.ingredients,
  notes: r.notes,
  nom_ar: r.nom_ar,
  ingredients_ar: r.ingredients_ar,
}));

// Petits-déjeuners (macros par portion).
const PETITDEJ: Recipe[] = [
  {
    id: 'PDJ-01', nom: 'Msemmen SG, œufs & fromage', role: 'petitdej', statut: 'Validé',
    kcal: 460, prot: 22, gluc: 38, lip: 24, calcium: 220, flag_calcium: 'Moyen',
    ingredients: 'Msemmen sans gluten 1 · œufs 2 · fromage frais 40g · huile 1 càc',
    nom_ar: 'مسمن بلا غلوتين، بيض وفرماج', ingredients_ar: 'مسمن بلا غلوتين 1 · بيض 2 · فرماج طري 40g · زيت ملعقة صغيرة',
  },
  {
    id: 'PDJ-02', nom: 'Yaourt grec, avoine & fruits', role: 'petitdej', statut: 'Validé',
    kcal: 400, prot: 24, gluc: 45, lip: 10, calcium: 320, flag_calcium: 'Champion',
    ingredients: 'Yaourt grec 200g · flocons d’avoine sans gluten 40g · fruits rouges 80g · amandes 15g',
    nom_ar: 'ياغورت إغريقي، شوفان وفواكه', ingredients_ar: 'ياغورت إغريقي 200g · شوفان بلا غلوتين 40g · فواكه حمرا 80g · لوز 15g',
  },
  {
    id: 'PDJ-03', nom: 'Œufs brouillés & pain SG', role: 'petitdej', statut: 'Validé',
    kcal: 420, prot: 26, gluc: 28, lip: 22, calcium: 120, flag_calcium: 'Faible',
    ingredients: 'Œufs 3 · pain complet sans gluten 50g · beurre 1 càc · ciboulette',
    nom_ar: 'بيض مخلوط وخبز بلا غلوتين', ingredients_ar: 'بيض 3 · خبز كامل بلا غلوتين 50g · زبدة ملعقة صغيرة',
  },
];

// Accompagnements (macros PAR 100 g).
const ACC: Recipe[] = [
  {
    id: 'ACC-01', nom: 'Riz blanc', role: 'acc', statut: 'Validé',
    kcal: 130, prot: 3, gluc: 28, lip: 0, calcium: 10, flag_calcium: 'Faible',
    ingredients: 'Riz blanc cuit', nom_ar: 'روز أبيض', ingredients_ar: 'روز أبيض مطيّب',
  },
  {
    id: 'ACC-02', nom: 'Semoule sans gluten', role: 'acc', statut: 'Validé',
    kcal: 120, prot: 4, gluc: 25, lip: 1, calcium: 12, flag_calcium: 'Faible',
    ingredients: 'Semoule sans gluten cuite', nom_ar: 'سميدة بلا غلوتين', ingredients_ar: 'سميدة بلا غلوتين مطيّبة',
  },
  {
    id: 'ACC-03', nom: 'Pommes de terre rôties', role: 'acc', statut: 'Validé',
    kcal: 150, prot: 3, gluc: 23, lip: 5, calcium: 8, flag_calcium: 'Faible',
    ingredients: 'Pommes de terre · huile d’olive', nom_ar: 'بطاطا مشوية', ingredients_ar: 'بطاطا · زيت الزيتون',
  },
  {
    id: 'ACC-04', nom: 'Légumes vapeur', role: 'acc', statut: 'Validé',
    kcal: 60, prot: 3, gluc: 9, lip: 1, calcium: 50, flag_calcium: 'Faible',
    ingredients: 'Brocoli · carotte · courgette', nom_ar: 'خضرة بالبخار', ingredients_ar: 'بروكلي · خيزو · كورجيت',
  },
];

export const SEED_CONFIG = seed.config as unknown as AppConfig;
export const SEED_RECIPES: Recipe[] = [...fromSeed, ...PETITDEJ, ...ACC];
