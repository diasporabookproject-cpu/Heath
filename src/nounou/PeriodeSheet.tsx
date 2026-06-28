import { useNounou } from './useNounou';
import Sheet from './Sheet';
import MomentBrick from './MomentBrick';
import { IconPlusThin } from './icons';
import { rangeLabelISO } from './dates';
import type { Moment } from '../types';

// Détail d'une période : son rythme propre (ajustable), sans toucher au rythme habituel.

export default function PeriodeSheet({
  id,
  onAddMoment,
  onEditMoment,
  onClose,
  toast,
}: {
  id: string;
  onAddMoment: (periodeId: string) => void;
  onEditMoment: (m: Moment, periodeId: string) => void;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const periode = useNounou((s) => s.doc.periodes.find((p) => p.id === id));
  const removeMoment = useNounou((s) => s.removeMoment);
  const removePeriode = useNounou((s) => s.removePeriode);

  if (!periode) {
    onClose();
    return null;
  }

  const moments = [...periode.rythme].sort((a, b) => a.heure.localeCompare(b.heure));

  return (
    <Sheet title={`${periode.emoji} ${periode.nom}`} sub={rangeLabelISO(periode.debut, periode.fin)} onClose={onClose}>
      {periode.note && (
        <div className="nz-info" style={{ marginTop: 2 }}>
          <span>{periode.note}</span>
        </div>
      )}

      <div className="nz-mgsec" style={{ marginTop: 18 }}>
        Rythme de cette période
        <button className="nz-addlink" onClick={() => onAddMoment(periode.id)}>
          <IconPlusThin size={14} />
          Ajouter
        </button>
      </div>
      <div className="nz-cardflush">
        {moments.length ? (
          moments.map((m) => (
            <MomentBrick
              key={m.id}
              m={m}
              onEdit={() => onEditMoment(m, periode.id)}
              onRemove={() => {
                removeMoment(m.id, periode.id);
                toast('Moment supprimé');
              }}
            />
          ))
        ) : (
          <div className="nz-emptyline">Vide pour l’instant.</div>
        )}
      </div>

      <button
        className="cz-cta ghost nz-danger"
        style={{ marginTop: 18 }}
        onClick={() => {
          removePeriode(periode.id);
          toast('Période supprimée');
          onClose();
        }}
      >
        Supprimer la période
      </button>
    </Sheet>
  );
}
