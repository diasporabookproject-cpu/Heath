import { useEffect, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { DAY_LABELS, DAY_SHORT, RAPPEL_TIMES } from '../lib/rappel';

// L3-5 — Réglage du rappel d'envoi d'un rôle. v1 : mention in-app à l'ouverture,
// AUCUNE notification système (microcopy honnête). Ouvert depuis la feuille d'envoi.

interface Props {
  kind: 'cuisine' | 'nounou';
  onClose: () => void;
  toast: (m: string) => void;
}

export default function RappelSheet({ kind, onClose, toast }: Props) {
  const app = useStore((s) => s.app);
  const setRappel = useStore((s) => s.setRappel);
  const cur = app.rappels?.[kind];
  const [day, setDay] = useState<number>(cur?.day ?? 5); // samedi par défaut
  const [time, setTime] = useState<string>(cur?.time ?? '9:00');
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const save = () => {
    setRappel(kind, { day, time });
    toast(`Noté — on vous le rappelle chaque ${DAY_LABELS[day]} à ${time}, à l’ouverture de l’app`);
    onClose();
  };
  const off = () => {
    setRappel(kind, null);
    toast('Rappel désactivé');
    onClose();
  };

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} style={{ zIndex: 50 }} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} style={{ zIndex: 51 }} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Rappel d’envoi
            <small>On vous le rappelle à l’ouverture de l’app — pas de notification.</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-blab">Chaque</div>
          <div className="cz-rappeldays">
            {DAY_SHORT.map((d, i) => (
              <button key={i} className={'cz-rd' + (day === i ? ' on' : '')} aria-pressed={day === i} onClick={() => setDay(i)}>
                {d}
              </button>
            ))}
          </div>
          <div className="cz-blab" style={{ marginTop: 14 }}>À</div>
          <div className="cz-rappeltimes">
            {RAPPEL_TIMES.map((t) => (
              <button key={t} className={'cz-rt' + (time === t ? ' on' : '')} aria-pressed={time === t} onClick={() => setTime(t)}>
                {t}
              </button>
            ))}
          </div>
          <button className="cz-cta" style={{ marginTop: 18 }} onClick={save}>Enregistrer</button>
          <button className="cz-cta ghost" onClick={off}>Pas de rappel</button>
        </div>
      </div>
    </>
  );
}
