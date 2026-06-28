import { useNounou } from './useNounou';
import Sheet from './Sheet';
import ConsigneVocale from '../cuisine/ConsigneVocale';
import { IconPhone } from './icons';
import { IconShareUp } from '../cuisine/icons';
import { CONDUITE_LABEL, type Conduite } from '../types';

// Détail d'un protocole : la voix du parent (jamais synthétisée), les étapes,
// qui appeler. Gabarit « à compléter » → invite à le compléter.

export default function ProtocoleSheet({
  conduite,
  onEdit,
  onClose,
  onVoiceChange,
  toast,
}: {
  conduite: Conduite;
  onEdit: () => void;
  onClose: () => void;
  onVoiceChange: (id: string, has: boolean) => void;
  toast: (m: string) => void;
}) {
  const removeConduite = useNounou((s) => s.removeConduite);
  const steps = conduite.etapes.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <Sheet title={conduite.titre} sub={`${CONDUITE_LABEL[conduite.categ]} · pour le personnel`} onClose={onClose}>
      {conduite.aCompleter ? (
        <>
          <div className="nz-info draft" style={{ marginTop: 2 }}>
            <span>
              Modèle à compléter. Ajoute les étapes, qui appeler, et enregistre ta consigne vocale —
              il sera alors prêt à partager.
            </span>
          </div>
          <button className="cz-cta draft" onClick={onEdit}>
            Compléter ce protocole
          </button>
        </>
      ) : (
        <>
          {conduite.urgent && (
            <div className="nz-info" style={{ marginTop: 2, background: '#f7e7e3', borderColor: '#e8c5bd', color: '#9a4030' }}>
              <span>Urgence : agir d’abord, prévenir ensuite.</span>
            </div>
          )}

          {conduite.quiAppeler && (
            <div className="nz-callrow" style={{ background: 'var(--petrol-tint)', marginTop: 14 }}>
              <span style={{ color: 'var(--petrol)' }}>
                <IconPhone size={18} />
              </span>
              <div>
                <div className="cl" style={{ color: 'var(--petrol)' }}>
                  Qui appeler
                </div>
                <div className="cv" style={{ color: 'var(--petrol-ink)' }}>
                  {conduite.quiAppeler}
                </div>
              </div>
            </div>
          )}

          {steps.length > 0 && (
            <>
              <div className="cz-blab" style={{ marginTop: 16 }}>
                Que faire
              </div>
              <ol className="nz-rsteps">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}

          <div className="cz-blab" style={{ marginTop: 18 }}>
            Consigne vocale
          </div>
          <ConsigneVocale
            recipeId={conduite.id}
            onChange={(has) => onVoiceChange(conduite.id, has)}
            title="Consigne vocale"
            subtitle="Ta voix, diffusée telle quelle"
            idleHint="Ta voix sera partagée avec le personnel — jamais synthétisée"
          />

          <div className="nz-info draft" style={{ marginTop: 14 }}>
            <span>
              <IconShareUp size={12} /> Partagé avec le personnel. La version traduite (darija) sera
              relue par toi avant l’envoi.
            </span>
          </div>

          <button className="cz-cta ghost" onClick={onEdit}>
            Modifier
          </button>
        </>
      )}

      <button
        className="cz-cta ghost nz-danger"
        onClick={() => {
          removeConduite(conduite.id);
          toast('Protocole supprimé');
          onClose();
        }}
      >
        Supprimer
      </button>
    </Sheet>
  );
}
