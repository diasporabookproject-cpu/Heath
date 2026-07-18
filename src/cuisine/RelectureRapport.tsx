import type { Recipe } from '../types';
import { IconClock } from './icons';

// Bandeau de relecture v2 (lot simplification T2) — TOLÉRANT à l'ancien edge :
//  - `adaptations` présent (edge v2) → RAPPORT vérifiable, ligne à ligne ;
//    règles posées MAIS `adaptations` vide → « aucune adaptation signalée » (honnête).
//  - `adaptations` absent (ancien edge) → fallback sur `adapteSelon` (la DEMANDE, G3).
//  - `quantites_incertaines` → invite à compléter.
//  - `alerte_regles` (garde G3 lexical serveur) → bandeau ROUGE.
// Partagé par RecipeDetailSheet (fiche) et RelectureSheet (file de relecture).

export default function RelectureRapport({ recipe }: { recipe: Pick<Recipe, 'adaptations' | 'adapteSelon' | 'quantites_incertaines' | 'alerte_regles'> }) {
  const adaptations = recipe.adaptations ?? [];
  const incertaines = recipe.quantites_incertaines ?? [];
  const alertes = recipe.alerte_regles ?? [];
  const demande = recipe.adapteSelon ?? [];
  const hasV2 = adaptations.length > 0 || incertaines.length > 0 || alertes.length > 0;

  // Rien à dire : ni rapport v2, ni demande d'adaptation → pas de bandeau.
  if (!hasV2 && demande.length === 0) return null;

  return (
    <>
      {/* Garde G3 lexical serveur : contradiction entre le rapport et le contenu. */}
      {alertes.map((a, i) => (
        <div className="cz-relwarn" key={`al-${i}`}>⚠ {a}</div>
      ))}

      {adaptations.length > 0 &&
        adaptations.map((a, i) => (
          <div className="cz-estnote" key={`ad-${i}`}>
            <IconClock size={13} />
            <span>
              <b>Adapté — {a.regle} :</b> {a.action}
            </span>
          </div>
        ))}

      {/* Cas « rien signalé » honnête : règles posées mais aucune adaptation rapportée. */}
      {adaptations.length === 0 && demande.length > 0 && (
        <div className="cz-estnote">
          <IconClock size={13} />
          {hasV2
            ? `Aucune adaptation signalée pour : ${demande.join(' · ')} — vérifie les ingrédients.`
            : `On a demandé d’adapter selon : ${demande.join(' · ')} — vérifie que c’est bien le cas.`}
        </div>
      )}

      {incertaines.length > 0 && (
        <div className="cz-estnote">
          <IconClock size={13} />⚠ {incertaines.length} quantité{incertaines.length > 1 ? 's' : ''} peu
          lisible{incertaines.length > 1 ? 's' : ''} : {incertaines.join(', ')} — complète-la
          {incertaines.length > 1 ? 's' : ''}.
        </div>
      )}
    </>
  );
}
