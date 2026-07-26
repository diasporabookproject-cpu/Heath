import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconCheck } from '../cuisine/icons';
import { CONDUITE_LABEL, type Conduite, type ConduiteCateg } from '../types';

// Rédaction / édition d'un protocole (consigne « que faire si… »).
// L'app ne génère AUCUN conseil : le parent rédige (§1.8).

const CATS: ConduiteCateg[] = ['sante', 'securite', 'quotidien'];

export default function ProtocoleFormSheet({
  edit,
  onClose,
  onSaved,
  toast,
}: {
  edit?: Conduite;
  onClose: () => void;
  onSaved: (id: string) => void;
  toast: (m: string) => void;
}) {
  const upsertConduite = useNounou((s) => s.upsertConduite);

  const [titre, setTitre] = useState(edit?.titre ?? '');
  const [categ, setCateg] = useState<ConduiteCateg>(edit?.categ ?? 'sante');
  const [urgent, setUrgent] = useState(!!edit?.urgent);
  const [etapes, setEtapes] = useState(edit?.etapes ?? '');
  const [qui, setQui] = useState(edit?.quiAppeler ?? '');

  const save = () => {
    const t = titre.trim();
    if (!t) return toast('Donnez un titre');
    const id = upsertConduite({
      id: edit?.id,
      titre: t,
      categ,
      urgent,
      etapes: etapes.trim(),
      quiAppeler: qui.trim() || undefined,
      aCompleter: false,
      createdAt: edit?.createdAt,
    });
    toast(edit ? 'Protocole enregistré' : 'Protocole créé');
    onSaved(id);
  };

  return (
    <Sheet
      title={edit ? 'Modifier le protocole' : 'Nouveau protocole'}
      sub="Votre consigne, écrite une fois"
      onClose={onClose}
    >
      <div className="cz-blab" style={{ marginTop: 2 }}>
        Titre
      </div>
      <input
        className="cz-inp"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        placeholder="Ex. Fièvre, Étouffement…"
      />

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Catégorie
      </div>
      <div className="nz-daysel">
        {CATS.map((c) => (
          <button key={c} className="nz-dbtn" aria-pressed={categ === c} onClick={() => setCateg(c)}>
            {CONDUITE_LABEL[c]}
          </button>
        ))}
      </div>

      <button
        className="nz-switch"
        aria-pressed={urgent}
        style={{ marginTop: 16 }}
        onClick={() => setUrgent(!urgent)}
      >
        Urgence (agir d’abord, prévenir ensuite)
        <span className="kn" />
      </button>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Que faire (une étape par ligne)
      </div>
      <textarea
        className="cz-ta"
        rows={5}
        value={etapes}
        onChange={(e) => setEtapes(e.target.value)}
        placeholder={'Prendre la température.\nFaire boire, surveiller.\n…'}
      />

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Qui appeler (optionnel)
      </div>
      <input
        className="cz-inp"
        value={qui}
        onChange={(e) => setQui(e.target.value)}
        placeholder="Ex. Maman → Dr Bennani"
      />

      <button className="cz-cta" onClick={save}>
        <IconCheck size={18} />
        {edit ? 'Enregistrer' : 'Créer'}
      </button>
    </Sheet>
  );
}
