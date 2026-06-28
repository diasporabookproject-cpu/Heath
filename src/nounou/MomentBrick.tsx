import { useNounou } from './useNounou';
import { MomentIcon, IconTrash } from './icons';
import { daysSummary } from './dates';
import type { Moment } from '../types';

// Ligne « brique » d'un moment dans le hub Rythme & périodes.

export default function MomentBrick({
  m,
  onEdit,
  onRemove,
}: {
  m: Moment;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const enfants = useNounou((s) => s.doc.enfants);
  const total = enfants.length;
  const subset = m.enfants.length > 0 && m.enfants.length < total;
  const tags = subset
    ? m.enfants
        .map((id) => enfants.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => !!e)
    : [];

  return (
    <div className="nz-brick">
      <span className="bi">
        <MomentIcon type={m.type} />
      </span>
      <button className="bm" onClick={onEdit}>
        <span className="bl">
          {m.label}
          {tags.map((e) => (
            <span key={e.id} className="nz-kidtag" style={{ background: e.couleur }}>
              {e.initiale}
            </span>
          ))}
        </span>
        <span className="bs">
          {daysSummary(m.jours)} · {m.heure}
          {m.qui ? ` · ${m.qui}` : ''}
        </span>
      </button>
      <button className="brm" onClick={onRemove} aria-label="Supprimer">
        <IconTrash size={17} />
      </button>
    </div>
  );
}
