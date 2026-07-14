import { useEffect, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { IconClock } from './icons';

/**
 * Réglages Cuisine (ex-ObjectiveSheet, FC13) — la maison des réglages ⚙.
 * F2.1 (lot Cuisine) : « Suivi de l'équilibre » OFF par défaut gouverne TOUT
 * l'affichage nutrition (F2.2). Cas limite gravé : OFF cache la pastille
 * d'en-tête ET la section objectif ici-même ; le nombre de personnes, valeur
 * du foyer (courses ×personnes), reste toujours accessible.
 * (F3.2, T3, ajoutera « Restrictions du foyer » dans cette même feuille.)
 */
export default function ReglagesSheet({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const suivi = useStore((s) => s.suivi);
  const setSuivi = useStore((s) => s.setSuivi);
  const setObjective = useStore((s) => s.setObjective);
  const setPersons = useStore((s) => s.setPersons);
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Réglages
            <small>Cuisine</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-setrow" style={{ marginTop: 6 }}>
            <div className="cz-settxt">
              <div className="cz-blab" style={{ margin: 0 }}>
                Suivi de l’équilibre
              </div>
              <p className="cz-sethint">
                Affiche les calories et l’équilibre des menus — pour toi seulement, jamais sur la
                page de ta cuisinière.
              </p>
            </div>
            <button
              className={'cz-switch' + (suivi ? ' on' : '')}
              role="switch"
              aria-checked={suivi}
              aria-label="Suivi de l’équilibre"
              onClick={() => setSuivi(!suivi)}
            />
          </div>

          {suivi && (
            <>
              <div className="cz-blab" style={{ marginTop: 18 }}>
                Objectif par personne
              </div>
              <div className="cz-objset">
                <button onClick={() => setObjective(settings.objective - 50)} aria-label="Moins">
                  −
                </button>
                <div className="cz-objval">
                  <span>{settings.objective.toLocaleString('fr-FR')}</span>
                  <small>kcal / personne / jour</small>
                </div>
                <button onClick={() => setObjective(settings.objective + 50)} aria-label="Plus">
                  +
                </button>
              </div>
            </>
          )}

          <div className="cz-blab" style={{ marginTop: 18 }}>
            Nombre de personnes
          </div>
          <div className="cz-objset">
            <button onClick={() => setPersons(settings.persons - 1)} aria-label="Moins">
              −
            </button>
            <div className="cz-objval">
              <span>{settings.persons}</span>
              <small>au foyer</small>
            </div>
            <button onClick={() => setPersons(settings.persons + 1)} aria-label="Plus">
              +
            </button>
          </div>

          <div className="cz-composernote" style={{ marginTop: 16 }}>
            <IconClock size={14} />
            {suivi ? (
              <>
                L’objectif est <b>individuel</b>. Les quantités des recettes et la liste de courses
                s’ajustent au nombre de personnes.
              </>
            ) : (
              <>Les quantités des recettes et la liste de courses s’ajustent au nombre de personnes.</>
            )}
          </div>

          <button className="cz-cta" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </>
  );
}
