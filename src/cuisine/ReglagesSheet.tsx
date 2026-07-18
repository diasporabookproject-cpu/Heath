import { useEffect, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { reglesActives, reglesList } from '../types';
import { IconClock } from './icons';

/** Une entrée par ligne à la saisie ↔ liste propre dans le modèle. */
const parseLines = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Réglages Cuisine — la maison des réglages ⚙. (Lot simplification : le « Suivi
 * de l'équilibre » et l'objectif calorique ont été RETIRÉS — l'app devient
 * généraliste ; ne reste que le nombre de personnes, valeur de tout foyer.)
 *
 * « Restrictions du foyer » vit ICI et SEULEMENT ici (D2 verrouillé) :
 * `halal` (toggle, concept fermé/composé) + un champ libre « ce que le foyer ne
 * mange pas » (une entrée par ligne). G1 : ce qui est posé est toujours affiché,
 * confirmable et modifiable. Retirer une restriction n'altère pas les recettes
 * passées — elle vaut pour les prochains imports (F4.4).
 */
export default function ReglagesSheet({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const regles = useStore((s) => s.regles);
  const setRegles = useStore((s) => s.setRegles);
  const setPersons = useStore((s) => s.setPersons);
  const [shown, setShown] = useState(false);
  // Saisie libre locale ; persistée à la sortie du champ et au OK (jamais de
  // doc créé si rien n'a changé — un foyer sans restrictions ne synchronise rien).
  const [nePasMangerText, setNePasMangerText] = useState(regles.nePasManger.join('\n'));
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité

  const commitNePasManger = () => {
    const next = parseLines(nePasMangerText);
    if (next.join('\n') !== regles.nePasManger.join('\n')) setRegles({ ...regles, nePasManger: next });
  };
  const close = () => {
    commitNePasManger();
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
          <div className="cz-blab" style={{ marginTop: 6 }}>
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
            Les quantités des recettes et la liste de courses s’ajustent au nombre de personnes.
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
          <div className="cz-block" style={{ marginTop: 10 }}>
            <div className="cz-blab">Ce que le foyer ne mange pas (une par ligne)</div>
            <textarea
              className="cz-ta"
              rows={3}
              value={nePasMangerText}
              onChange={(e) => setNePasMangerText(e.target.value)}
              onBlur={commitNePasManger}
              placeholder={'gluten\narachide\nporc\nvégétarien'}
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
