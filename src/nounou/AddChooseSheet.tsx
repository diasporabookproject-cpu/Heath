import Sheet from './Sheet';
import { dayTitleISO } from './dates';

// Choix : ajouter un moment (récurrent) ou un ponctuel (un jour).

export default function AddChooseSheet({
  date,
  inPeriode,
  periodeNom,
  onMoment,
  onPonctuel,
  onClose,
}: {
  date: string;
  inPeriode: boolean;
  periodeNom?: string;
  onMoment: () => void;
  onPonctuel: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Ajouter" sub={dayTitleISO(date)} onClose={onClose}>
      <button className="cz-opt2" onClick={onMoment}>
        <span className="ic pen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
        </span>
        <span className="ot">
          <span className="h">Un moment</span>
          <span className="d">
            {inPeriode
              ? `Un moment pendant « ${periodeNom ?? 'cette période'} ».`
              : 'Il revient chaque semaine — école, sieste, coucher…'}
          </span>
        </span>
      </button>
      <button className="cz-opt2" onClick={onPonctuel}>
        <span className="ic day">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <circle cx="12" cy="15" r="2" />
          </svg>
        </span>
        <span className="ot">
          <span className="h">Un ponctuel</span>
          <span className="d">Pour ce jour seulement — dentiste, anniversaire…</span>
        </span>
      </button>
    </Sheet>
  );
}
