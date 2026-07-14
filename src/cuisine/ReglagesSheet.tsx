import { useEffect, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { reglesActives, reglesList } from '../types';
import { IconClock } from './icons';

/** Une allergie par ligne à la saisie ↔ liste propre dans le modèle. */
const parseAllergies = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Réglages Cuisine (ex-ObjectiveSheet, FC13) — la maison des réglages ⚙.
 * F2.1 (lot Cuisine) : « Suivi de l'équilibre » OFF par défaut gouverne TOUT
 * l'affichage nutrition (F2.2). Cas limite gravé : OFF cache la pastille
 * d'en-tête ET la section objectif ici-même ; le nombre de personnes, valeur
 * du foyer (courses ×personnes), reste toujours accessible.
 *
 * F3.2 (T3) — « Restrictions du foyer » vit ICI et SEULEMENT ici (D2 verrouillé) :
 * allergies en champ libre (une par ligne — on ne peut pas énumérer toutes les
 * restrictions, décision Volet C) + bascules courantes (halal, végétarien).
 * G1 : ce qui est posé est toujours affiché ici, confirmable et modifiable.
 * Retirer une restriction n'altère pas les recettes passées (pas de
 * rétro-réécriture) — elle vaut pour les prochains imports (F4.4).
 */
export default function ReglagesSheet({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const suivi = useStore((s) => s.suivi);
  const regles = useStore((s) => s.regles);
  const setSuivi = useStore((s) => s.setSuivi);
  const setRegles = useStore((s) => s.setRegles);
  const setObjective = useStore((s) => s.setObjective);
  const setPersons = useStore((s) => s.setPersons);
  const [shown, setShown] = useState(false);
  // Saisie libre locale ; persistée à la sortie du champ et au OK (jamais de
  // doc créé si rien n'a changé — un foyer sans restrictions ne synchronise rien).
  const [allergiesText, setAllergiesText] = useState(regles.allergies.join('\n'));
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité

  const commitAllergies = () => {
    const next = parseAllergies(allergiesText);
    if (next.join('\n') !== regles.allergies.join('\n')) setRegles({ ...regles, allergies: next });
  };
  const close = () => {
    commitAllergies();
    onClose();
  };

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={close} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Réglages
            <small>Cuisine</small>
          </div>
          <button className="cz-x" onClick={close} aria-label="Fermer">
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

          {/* F3.2 — Restrictions du foyer : LE seul endroit (D2). */}
          <div className="cz-blab" style={{ marginTop: 22 }}>
            Restrictions du foyer
          </div>
          <p className="cz-sethint" style={{ margin: '0 2px 10px' }}>
            Ce que ta maison ne mange pas — posé une fois, pour tout le monde. Les prochaines
            recettes importées s’y adapteront, et rien ne s’appliquera sans te l’afficher.
          </p>
          <div className="cz-setrow">
            <div className="cz-settxt">
              <div className="cz-blab" style={{ margin: 0 }}>
                Halal
              </div>
            </div>
            <button
              className={'cz-switch' + (regles.halal ? ' on' : '')}
              role="switch"
              aria-checked={regles.halal}
              aria-label="Halal"
              onClick={() => setRegles({ ...regles, halal: !regles.halal })}
            />
          </div>
          <div className="cz-setrow" style={{ marginTop: 8 }}>
            <div className="cz-settxt">
              <div className="cz-blab" style={{ margin: 0 }}>
                Végétarien
              </div>
            </div>
            <button
              className={'cz-switch' + (regles.regime === 'végétarien' ? ' on' : '')}
              role="switch"
              aria-checked={regles.regime === 'végétarien'}
              aria-label="Végétarien"
              onClick={() =>
                setRegles({ ...regles, regime: regles.regime === 'végétarien' ? null : 'végétarien' })
              }
            />
          </div>
          <div className="cz-block" style={{ marginTop: 10 }}>
            <div className="cz-blab">Allergies et interdits (une par ligne)</div>
            <textarea
              className="cz-ta"
              rows={3}
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              onBlur={commitAllergies}
              placeholder={'arachide\nfruits de mer'}
            />
          </div>
          {reglesActives(regles) && (
            <div className="cz-estnote" style={{ marginTop: 2 }}>
              <IconClock size={13} />
              Règles actives : {reglesList(regles).join(' · ')}
            </div>
          )}

          <button className="cz-cta" onClick={close}>
            OK
          </button>
        </div>
      </div>
    </>
  );
}
