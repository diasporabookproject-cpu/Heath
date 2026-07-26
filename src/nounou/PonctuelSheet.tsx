import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconPlusThin } from './icons';
import { dayTitleISO } from './dates';

// Ajout d'un événement ponctuel (un seul jour). Ne modifie pas le rythme.

export default function PonctuelSheet({
  date,
  onClose,
  toast,
}: {
  date: string;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const enfants = useNounou((s) => s.doc.enfants);
  const addPonctuel = useNounou((s) => s.addPonctuel);

  const [label, setLabel] = useState('');
  const [time, setTime] = useState('15:00');
  const [kids, setKids] = useState<Set<string>>(new Set(enfants[0] ? [enfants[0].id] : []));
  const [lieu, setLieu] = useState('');
  const [who, setWho] = useState('');

  const toggleKid = (id: string) => {
    const n = new Set(kids);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setKids(n);
  };

  const save = () => {
    const l = label.trim();
    if (!l) return toast('Donnez un intitulé');
    addPonctuel({
      date,
      label: l,
      heure: time || '15:00',
      type: 'activite',
      enfants: [...kids],
      lieu: lieu.trim() || undefined,
      qui: who.trim() || undefined,
    });
    toast('Événement ajouté');
    onClose();
  };

  return (
    <Sheet title="Événement ponctuel" sub={dayTitleISO(date)} onClose={onClose}>
      <div className="nz-info" style={{ marginTop: 2 }}>
        <span>Ajouté seulement pour ce jour. Le rythme ne change pas.</span>
      </div>

      <div className="nz-row2" style={{ marginTop: 12 }}>
        <div style={{ width: 120 }}>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Heure
          </div>
          <input className="cz-inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Intitulé
          </div>
          <input className="cz-inp" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Anniversaire" />
        </div>
      </div>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Enfant(s)
      </div>
      <div className="nz-kidsel">
        {enfants.map((e) => (
          <button key={e.id} className="nz-kbtn" aria-pressed={kids.has(e.id)} onClick={() => toggleKid(e.id)}>
            <span className="kd" style={{ background: e.couleur }}>
              {e.initiale}
            </span>
            {e.prenom}
          </button>
        ))}
      </div>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Lieu (optionnel)
      </div>
      <input className="cz-inp" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Adresse / lieu" />

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Qui s’en occupe (optionnel)
      </div>
      <input className="cz-inp" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Optionnel" />

      <button className="cz-cta" onClick={save}>
        <IconPlusThin size={18} />
        Ajouter
      </button>
    </Sheet>
  );
}
