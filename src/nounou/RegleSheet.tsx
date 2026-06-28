import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconCheck } from '../cuisine/icons';
import type { ReglePerm } from '../types';

// Règle / autorisation (autorisé vs interdit).

export default function RegleSheet({
  edit,
  onClose,
  toast,
}: {
  edit?: ReglePerm;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const upsertRegle = useNounou((s) => s.upsertRegle);
  const removeRegle = useNounou((s) => s.removeRegle);

  const [texte, setTexte] = useState(edit?.texte ?? '');
  const [permis, setPermis] = useState(edit?.permis ?? true);

  const save = () => {
    if (!texte.trim()) return toast('Écris la règle');
    upsertRegle({ id: edit?.id, texte: texte.trim(), permis });
    toast(edit ? 'Règle enregistrée' : 'Règle ajoutée');
    onClose();
  };

  return (
    <Sheet title={edit ? 'Modifier la règle' : 'Nouvelle règle'} onClose={onClose}>
      <div className="cz-blab" style={{ marginTop: 2 }}>
        Type
      </div>
      <div className="nz-daysel">
        <button className="nz-dbtn" aria-pressed={permis} onClick={() => setPermis(true)}>
          Autorisé
        </button>
        <button className="nz-dbtn" aria-pressed={!permis} onClick={() => setPermis(false)}>
          Interdit
        </button>
      </div>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Règle
      </div>
      <textarea
        className="cz-ta"
        rows={3}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Ex. Récupération : seulement Maman, Papa ou la nounou."
      />

      <button className="cz-cta" onClick={save}>
        <IconCheck size={18} />
        {edit ? 'Enregistrer' : 'Ajouter'}
      </button>
      {edit && (
        <button
          className="cz-cta ghost nz-danger"
          onClick={() => {
            removeRegle(edit.id);
            toast('Règle retirée');
            onClose();
          }}
        >
          Retirer
        </button>
      )}
    </Sheet>
  );
}
