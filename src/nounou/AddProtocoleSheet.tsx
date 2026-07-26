import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { CONDUITE_MODELES } from './defaults';
import { CONDUITE_LABEL } from '../types';

// Ajout d'un protocole : rédiger librement, ou partir d'un modèle « à compléter ».
// Les modèles ne sont que des gabarits vides — l'app ne génère aucun conseil (§1.8).

export default function AddProtocoleSheet({
  onRediger,
  onModele,
  onClose,
}: {
  onRediger: () => void;
  /** Crée un gabarit depuis un modèle et l'ouvre pour le compléter. */
  onModele: (id: string) => void;
  onClose: () => void;
}) {
  const upsertConduite = useNounou((s) => s.upsertConduite);
  const [pickModel, setPickModel] = useState(false);

  const fromModele = (m: (typeof CONDUITE_MODELES)[number]) => {
    const id = upsertConduite({
      titre: m.titre,
      categ: m.categ,
      urgent: m.urgent,
      aCompleter: true,
      etapes: '',
    });
    onModele(id);
  };

  return (
    <Sheet title="Nouveau protocole" sub="Une consigne « que faire si… »" onClose={onClose}>
      {!pickModel ? (
        <>
          <button className="cz-opt2" onClick={onRediger}>
            <span className="ic pen">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </span>
            <span className="ot">
              <span className="h">Rédiger</span>
              <span className="d">Titre, étapes, qui appeler, et votre consigne vocale.</span>
            </span>
          </button>
          <button className="cz-opt2" onClick={() => setPickModel(true)}>
            <span className="ic day">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </span>
            <span className="ot">
              <span className="h">Partir d’un modèle</span>
              <span className="d">Fièvre, blessure, allergie… à compléter.</span>
            </span>
          </button>
        </>
      ) : (
        <>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Choisis un modèle à compléter
          </div>
          {CONDUITE_MODELES.map((m) => (
            <button key={m.titre} className="cz-opt2" onClick={() => fromModele(m)}>
              <span className="ot">
                <span className="h">{m.titre}</span>
                <span className="d">
                  {CONDUITE_LABEL[m.categ]}
                  {m.urgent ? ' · Urgent' : ''}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
    </Sheet>
  );
}
