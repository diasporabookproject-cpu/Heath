import { useEffect, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import type { MealKey } from '../types';
import Em from '../ui/Em';

// T4 (SPEC 5, proto) — le geste RADIAL « Ajouter un repas » : fond assombri,
// créneau source visible et surligné, TROIS pétales en arc (jamais 4), fermer.
// C'est une COUCHE D'ENTRÉE : il précède le composeur/sélecteur existants,
// il ne les contourne pas (le multi-composant reste dans MealComposerSheet).

export type RadialWay = 'biblio' | 'ecrire' | 'photo' | 'collection';

const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Petit déjeuner', dej: 'Déjeuner', gouter: 'Goûter', diner: 'Dîner' };
const MEAL_PHRASE: Record<MealKey, string> = { petitdej: 'Le petit déjeuner', dej: 'Le déjeuner', gouter: 'Le goûter', diner: 'Le dîner' };

interface Props {
  mealKey: MealKey;
  dayNom: string;
  /** Bibliothèque vide → pas de pétale « Ma bibliothèque » (le sélecteur serait sans objet). */
  libEmpty: boolean;
  onWay: (w: RadialWay) => void;
  onClose: () => void;
}

export default function RadialSheet({ mealKey, dayNom, libEmpty, onWay, onClose }: Props) {
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme le radial en priorité
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // TOUJOURS 3 pétales. Bibliothèque remplie : « Ma bibliothèque » À GAUCHE
  // (Q5 tranchée — côté pouce) ; vide : la collection prend le 3ᵉ pétale.
  const petals: { way: RadialWay; ch: string; label: string }[] = libEmpty
    ? [
        { way: 'ecrire', ch: '✏️', label: 'L’écrire' },
        { way: 'photo', ch: '📸', label: 'Photo ou lien' },
        { way: 'collection', ch: '📚', label: 'Depuis une collection' },
      ]
    : [
        { way: 'biblio', ch: '📖', label: 'Ma bibliothèque' },
        { way: 'ecrire', ch: '✏️', label: 'L’écrire' },
        { way: 'photo', ch: '📸', label: 'Photo ou lien' },
      ];

  return (
    <div className={'cz-radial' + (shown ? ' show' : '')} role="dialog" aria-modal="true" aria-label="Ajouter un repas">
      <div className="dim" onClick={onClose} />
      <div className="cz-petals">
        {petals.map((p) => (
          <button key={p.way} className="cz-petal" onClick={() => onWay(p.way)}>
            <span className="pb">
              <Em ch={p.ch} size={30} />
            </span>
            <span className="pl">{p.label}</span>
          </button>
        ))}
      </div>
      {/* Le créneau SOURCE, visible et surligné — on sait toujours ce qu'on remplit. */}
      <div className={'cz-srcrow s-' + mealKey}>
        <span className="ml2">{MEAL_LABEL[mealKey]}</span>
        <span className="mchip">
          <span className="plus">＋</span>
        </span>
        <span className="mn">
          {MEAL_PHRASE[mealKey]}
          <small> · {dayNom}</small>
        </span>
      </div>
      <button className="cz-radclose" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
    </div>
  );
}
