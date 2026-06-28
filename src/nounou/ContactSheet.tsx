import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconCheck } from '../cuisine/icons';
import type { NounouContact } from '../types';

// Contact d'urgence (appel au tap côté reçu).

export default function ContactSheet({
  edit,
  onClose,
  toast,
}: {
  edit?: NounouContact;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const upsertContact = useNounou((s) => s.upsertContact);
  const removeContact = useNounou((s) => s.removeContact);

  const [nom, setNom] = useState(edit?.nom ?? '');
  const [tel, setTel] = useState(edit?.tel ?? '');
  const [role, setRole] = useState(edit?.role ?? '');

  const save = () => {
    if (!nom.trim()) return toast('Donne un nom');
    if (!tel.trim()) return toast('Donne un numéro');
    upsertContact({ id: edit?.id, nom: nom.trim(), tel: tel.trim(), role: role.trim() || undefined });
    toast(edit ? 'Contact enregistré' : 'Contact ajouté');
    onClose();
  };

  return (
    <Sheet title={edit ? 'Modifier le contact' : 'Nouveau contact'} onClose={onClose}>
      <div className="cz-blab" style={{ marginTop: 2 }}>
        Nom
      </div>
      <input className="cz-inp" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Maman, Dr Bennani" />

      <div className="cz-blab" style={{ marginTop: 14 }}>
        Téléphone
      </div>
      <input className="cz-inp" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+212 6 …" inputMode="tel" />

      <div className="cz-blab" style={{ marginTop: 14 }}>
        Rôle (optionnel)
      </div>
      <input className="cz-inp" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex. Pédiatre, voisine…" />

      <button className="cz-cta" onClick={save}>
        <IconCheck size={18} />
        {edit ? 'Enregistrer' : 'Ajouter'}
      </button>
      {edit && (
        <button
          className="cz-cta ghost nz-danger"
          onClick={() => {
            removeContact(edit.id);
            toast('Contact retiré');
            onClose();
          }}
        >
          Retirer
        </button>
      )}
    </Sheet>
  );
}
