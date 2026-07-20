import { useNounou } from './useNounou';
import Em from '../ui/Em';
import Sheet from './Sheet';
import MomentBrick from './MomentBrick';
import { IconChevron, IconPlusThin } from './icons';
import { rangeLabelISO } from './dates';
import type { Moment } from '../types';

// Hub « Rythme & périodes » : le socle récurrent + les plages qui dérogent.

export default function ManageSheet({
  onAddMoment,
  onEditMoment,
  onAddPeriode,
  onOpenPeriode,
  onClose,
  toast,
}: {
  onAddMoment: () => void;
  onEditMoment: (m: Moment) => void;
  onAddPeriode: () => void;
  onOpenPeriode: (id: string) => void;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const doc = useNounou((s) => s.doc);
  const removeMoment = useNounou((s) => s.removeMoment);

  const moments = [...doc.rythme].sort((a, b) => a.heure.localeCompare(b.heure));

  return (
    <Sheet title="Rythme & périodes" sub="Le socle, et les plages qui dérogent" onClose={onClose}>
      <div className="nz-mgsec">
        Rythme habituel
        <button className="nz-addlink" onClick={onAddMoment}>
          <IconPlusThin size={14} />
          Ajouter
        </button>
      </div>
      <div className="nz-emptyline" style={{ marginBottom: 2 }}>
        Ce qui se répète chaque semaine. La plupart du temps, c’est tout ce qu’il faut.
      </div>
      <div className="nz-cardflush">
        {moments.length ? (
          moments.map((m) => (
            <MomentBrick
              key={m.id}
              m={m}
              onEdit={() => onEditMoment(m)}
              onRemove={() => {
                removeMoment(m.id);
                toast('Moment supprimé');
              }}
            />
          ))
        ) : (
          <div className="nz-emptyline">
            Aucun moment. Ajoute-en un — l’heure de l’école suffit pour commencer.
          </div>
        )}
      </div>

      <div className="nz-mgsec" style={{ marginTop: 24 }}>
        Périodes
        <button className="nz-addlink" onClick={onAddPeriode}>
          <IconPlusThin size={14} />
          Ajouter
        </button>
      </div>
      <div className="nz-emptyline" style={{ marginBottom: 2 }}>
        Un rythme différent sur une plage de dates — vacances, Ramadan, voyage. Il prend le dessus
        pendant la plage, puis on revient au rythme habituel.
      </div>
      <div className="nz-cardflush">
        {doc.periodes.length ? (
          doc.periodes.map((p) => (
            <div key={p.id} className="nz-periodrow">
              <span className="pi"><Em ch={p.emoji} size={20} /></span>
              <button className="pm" onClick={() => onOpenPeriode(p.id)}>
                <div className="pl">{p.nom}</div>
                <div className="ps">
                  {rangeLabelISO(p.debut, p.fin)} · {p.rythme.length} moments
                </div>
              </button>
              <span className="chev">
                <IconChevron size={18} />
              </span>
            </div>
          ))
        ) : (
          <div className="nz-emptyline">
            Aucune période. La plupart du temps, le rythme habituel suffit — ajoute une période
            seulement quand ça change (vacances, voyage…).
          </div>
        )}
      </div>
    </Sheet>
  );
}
