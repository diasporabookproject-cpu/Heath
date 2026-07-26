import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconCheck } from '../cuisine/icons';

// Numéro d'urgence (label + numéro + « à vérifier »). Édition par index.

export default function NumeroSheet({
  index,
  onClose,
  toast,
}: {
  /** Index dans le tableau, ou null pour ajouter. */
  index: number | null;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const numeros = useNounou((s) => s.doc.urgence.numeros);
  const setNumeros = useNounou((s) => s.setNumeros);
  const existing = index != null ? numeros[index] : undefined;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [numero, setNumero] = useState(existing?.numero ?? '');
  const [aVerifier, setAVerifier] = useState(existing?.aVerifier ?? true);

  const save = () => {
    if (!label.trim()) return toast('Donnez un libellé');
    if (!numero.trim()) return toast('Donnez un numéro');
    const item = { label: label.trim(), numero: numero.trim(), aVerifier };
    const next = [...numeros];
    if (index != null) next[index] = item;
    else next.push(item);
    setNumeros(next);
    toast('Numéro enregistré');
    onClose();
  };

  const remove = () => {
    if (index == null) return;
    setNumeros(numeros.filter((_, i) => i !== index));
    toast('Numéro retiré');
    onClose();
  };

  return (
    <Sheet title={existing ? 'Modifier le numéro' : 'Nouveau numéro'} onClose={onClose}>
      <div className="cz-blab" style={{ marginTop: 2 }}>
        Libellé
      </div>
      <input className="cz-inp" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Police, Clinique…" />

      <div className="cz-blab" style={{ marginTop: 14 }}>
        Numéro
      </div>
      <input className="cz-inp" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex. 19" inputMode="tel" />

      <button className="nz-switch" aria-pressed={aVerifier} style={{ marginTop: 16 }} onClick={() => setAVerifier(!aVerifier)}>
        Mention « à vérifier »
        <span className="kn" />
      </button>

      <button className="cz-cta" onClick={save}>
        <IconCheck size={18} />
        Enregistrer
      </button>
      {existing && (
        <button className="cz-cta ghost nz-danger" onClick={remove}>
          Retirer
        </button>
      )}
    </Sheet>
  );
}
