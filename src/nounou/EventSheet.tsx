import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { daysSummary, dayTitleISO } from './dates';
import { MOMENT_LABEL, type Moment } from '../types';
import type { DayEntry } from './projection';

// Détail d'une entrée du jour + actions (modifier / supprimer).

export default function EventSheet({
  date,
  entry,
  periodeId,
  periodeNom,
  onEditMoment,
  onClose,
  toast,
}: {
  date: string;
  entry: DayEntry;
  periodeId?: string;
  periodeNom?: string;
  onEditMoment: (m: Moment, periodeId?: string) => void;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const doc = useNounou((s) => s.doc);
  const removeMoment = useNounou((s) => s.removeMoment);
  const removePonctuel = useNounou((s) => s.removePonctuel);

  const isPonctuel = entry.source === 'ponctuel';
  const enfantNames = entry.enfants
    .map((id) => doc.enfants.find((e) => e.id === id)?.prenom)
    .filter(Boolean)
    .join(' & ');

  // Retrouver le moment sous-jacent (pour récurrence + édition).
  const moment: Moment | undefined = isPonctuel
    ? undefined
    : (periodeId ? doc.periodes.find((p) => p.id === periodeId)?.rythme : doc.rythme)?.find(
        (m) => m.id === entry.id,
      );

  const srcLabel = isPonctuel
    ? `Ponctuel · ${dayTitleISO(date)}`
    : entry.source === 'periode'
      ? `Période · ${periodeNom ?? ''}`
      : 'Rythme habituel';

  const remove = () => {
    if (isPonctuel) {
      removePonctuel(entry.id);
      toast('Ponctuel retiré');
    } else {
      removeMoment(entry.id, periodeId);
      toast('Moment supprimé');
    }
    onClose();
  };

  return (
    <Sheet title={entry.label} sub={`${entry.heure} · ${srcLabel}`} onClose={onClose}>
      {isPonctuel ? (
        <div className="nz-info" style={{ marginTop: 2 }}>
          <span>Ajouté pour ce jour seulement. Le rythme ne change pas.</span>
        </div>
      ) : entry.source === 'periode' ? (
        <div className="nz-info" style={{ marginTop: 2 }}>
          <span>Fait partie du rythme « {periodeNom} ».</span>
        </div>
      ) : null}

      <div className="nz-card" style={{ marginTop: 14, padding: '0 15px' }}>
        {enfantNames && (
          <div className="nz-kv" style={{ borderTop: 'none' }}>
            <div className="k">Enfant</div>
            <div className="v">{enfantNames}</div>
          </div>
        )}
        <div className="nz-kv" style={enfantNames ? undefined : { borderTop: 'none' }}>
          <div className="k">Type</div>
          <div className="v">{MOMENT_LABEL[entry.type]}</div>
        </div>
        {moment && (
          <div className="nz-kv">
            <div className="k">Récurrence</div>
            <div className="v">{daysSummary(moment.jours)}</div>
          </div>
        )}
        {entry.lieu && (
          <div className="nz-kv">
            <div className="k">Lieu</div>
            <div className="v">{entry.lieu}</div>
          </div>
        )}
        {entry.qui && (
          <div className="nz-kv">
            <div className="k">S’en occupe</div>
            <div className="v">{entry.qui}</div>
          </div>
        )}
      </div>

      {moment && (
        <button className="cz-cta ghost" onClick={() => onEditMoment(moment, periodeId)}>
          Modifier le moment
        </button>
      )}
      <button className="cz-cta ghost nz-danger" onClick={remove}>
        {isPonctuel ? 'Retirer ce ponctuel' : 'Supprimer le moment'}
      </button>
    </Sheet>
  );
}
