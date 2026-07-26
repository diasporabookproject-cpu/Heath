import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconPlusThin } from './icons';
import { periodesOverlap } from './projection';

// Création d'une période. Démarre comme copie du rythme habituel (côté store).
// Chevauchement avec une période existante interdit (décision produit).

export default function AddPeriodeSheet({
  onClose,
  onCreated,
  toast,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  toast: (m: string) => void;
}) {
  const periodes = useNounou((s) => s.doc.periodes);
  const addPeriode = useNounou((s) => s.addPeriode);

  const [nom, setNom] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');

  const save = () => {
    const n = nom.trim();
    if (!n) return toast('Donnez un nom à la période');
    if (!debut || !fin) return toast('Choisissez les dates');
    if (fin < debut) return toast('La fin doit être après le début');
    const clash = periodes.find((p) => periodesOverlap({ debut, fin }, p));
    if (clash) return toast(`Chevauche « ${clash.nom} »`);
    const id = addPeriode({
      nom: n,
      emoji: '🗓️',
      debut,
      fin,
      note: 'Rythme spécifique sur cette plage — ajuste les moments.',
    });
    toast('Période créée — ajuste son rythme');
    onCreated(id);
  };

  return (
    <Sheet title="Nouvelle période" sub="Un rythme alternatif sur une plage" onClose={onClose}>
      <div className="cz-blab" style={{ marginTop: 2 }}>
        Nom
      </div>
      <input
        className="cz-inp"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Ex. Vacances d’été, Ramadan, Voyage"
      />
      <div className="nz-row2" style={{ marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Du
          </div>
          <input className="cz-inp" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Au
          </div>
          <input className="cz-inp" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
      <div className="nz-info" style={{ marginTop: 14 }}>
        <span>
          On part d’une copie du rythme habituel, que vous ajustez ensuite (retirer l’école, décaler le
          réveil…). Pendant ces dates, c’est ce rythme qui s’affiche.
        </span>
      </div>
      <button className="cz-cta" onClick={save}>
        <IconPlusThin size={18} />
        Créer la période
      </button>
    </Sheet>
  );
}
