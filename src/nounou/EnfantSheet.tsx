import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { IconCheck } from '../cuisine/icons';
import { ENFANT_COULEURS } from './defaults';
import type { Enfant } from '../types';

// Fiche enfant (Lot 3) — rédigée/confirmée par le parent.

export default function EnfantSheet({
  edit,
  onClose,
  toast,
}: {
  edit?: Enfant;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const upsertEnfant = useNounou((s) => s.upsertEnfant);
  const removeEnfant = useNounou((s) => s.removeEnfant);

  const [prenom, setPrenom] = useState(edit?.prenom ?? '');
  const [couleur, setCouleur] = useState(edit?.couleur ?? ENFANT_COULEURS[0]);
  const f = edit?.fiche;
  const [allergies, setAllergies] = useState(f?.allergies ?? '');
  const [traitement, setTraitement] = useState(f?.traitement ?? '');
  const [medecin, setMedecin] = useState(f?.medecin ?? '');
  const [groupe, setGroupe] = useState(f?.groupe ?? '');
  const [habitudes, setHabitudes] = useState(f?.habitudes ?? '');

  const save = () => {
    const p = prenom.trim();
    if (!p) return toast('Donnez un prénom');
    const fiche = { allergies, traitement, medecin, groupe, habitudes };
    const clean = Object.fromEntries(Object.entries(fiche).filter(([, v]) => v.trim()));
    upsertEnfant({
      id: edit?.id,
      prenom: p,
      initiale: p.charAt(0).toUpperCase(),
      couleur,
      fiche: Object.keys(clean).length ? clean : undefined,
    });
    toast(edit ? 'Fiche enregistrée' : 'Enfant ajouté');
    onClose();
  };

  return (
    <Sheet title={edit ? 'Fiche enfant' : 'Nouvel enfant'} onClose={onClose}>
      <div className="cz-blab" style={{ marginTop: 2 }}>
        Prénom
      </div>
      <input className="cz-inp" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" />

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Couleur
      </div>
      <div className="nz-coulsel">
        {ENFANT_COULEURS.map((c) => (
          <button
            key={c}
            className={'nz-coul' + (couleur === c ? ' on' : '')}
            style={{ background: c }}
            onClick={() => setCouleur(c)}
            aria-label={`Couleur ${c}`}
          />
        ))}
      </div>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Allergie (mise en évidence)
      </div>
      <textarea
        className="cz-ta"
        rows={2}
        value={allergies}
        onChange={(e) => setAllergies(e.target.value)}
        placeholder="Ex. Arachides — gonflement, gêne à respirer. Auto-injecteur…"
      />

      <div className="cz-blab" style={{ marginTop: 14 }}>
        Traitement
      </div>
      <input className="cz-inp" value={traitement} onChange={(e) => setTraitement(e.target.value)} placeholder="Optionnel" />

      <div className="nz-row2" style={{ marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <div className="cz-blab" style={{ marginTop: 0 }}>
            Médecin
          </div>
          <input className="cz-inp" value={medecin} onChange={(e) => setMedecin(e.target.value)} placeholder="Optionnel" />
        </div>
        <div style={{ width: 110 }}>
          <div className="cz-blab" style={{ marginTop: 0 }}>
            Groupe
          </div>
          <input className="cz-inp" value={groupe} onChange={(e) => setGroupe(e.target.value)} placeholder="O+" />
        </div>
      </div>

      <div className="cz-blab" style={{ marginTop: 14 }}>
        Habitudes
      </div>
      <textarea
        className="cz-ta"
        rows={2}
        value={habitudes}
        onChange={(e) => setHabitudes(e.target.value)}
        placeholder="Doudou pour dormir, peurs, rituels…"
      />

      <button className="cz-cta" onClick={save}>
        <IconCheck size={18} />
        {edit ? 'Enregistrer' : 'Ajouter'}
      </button>
      {edit && (
        <button
          className="cz-cta ghost nz-danger"
          onClick={() => {
            removeEnfant(edit.id);
            toast('Enfant retiré');
            onClose();
          }}
        >
          Retirer cet enfant
        </button>
      )}
    </Sheet>
  );
}
