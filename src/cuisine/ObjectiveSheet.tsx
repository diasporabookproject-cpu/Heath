import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { IconClock } from './icons';

/** FC13 — Objectif calorique individuel + nombre de personnes au foyer. */
export default function ObjectiveSheet({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setObjective = useStore((s) => s.setObjective);
  const setPersons = useStore((s) => s.setPersons);
  const [shown, setShown] = useState(false);

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
            Objectif calorique
            <small>Individuel · par jour</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-blab" style={{ marginTop: 6 }}>
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
            L’objectif est <b>individuel</b>. Les quantités des recettes sont ajustées au nombre de
            personnes et à cet objectif — l’IA génère et analyse chaque journée sur cette base.
          </div>

          <button className="cz-cta" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </>
  );
}
