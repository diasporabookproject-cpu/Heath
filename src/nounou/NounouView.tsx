import { useEffect, useRef, useState } from 'react';
import { useNounou } from './useNounou';
import JourneeView from './JourneeView';
import ConduitesView from './ConduitesView';
import FicheUrgenceView from './FicheUrgenceView';
import PartageNounouSheet from './PartageNounouSheet';
import TraductionSheet from './TraductionSheet';
import type { NounouLangue } from '../types';
import { IconShareUp, IconCheck } from '../cuisine/icons';
import '../cuisine/cuisine.css';
import './nounou.css';
import Pastille from '../ui/Pastille';

type Segment = 'journee' | 'conduites' | 'urgence';
const SEG_LABEL: Record<Segment, string> = {
  journee: 'Journée',
  conduites: 'Conduites',
  urgence: 'Fiche urgence',
};

interface Props {
  showAccount: boolean;
  /** T4 : initiale de la pastille de compte (la même aux 4 emplacements). */
  initiale: string;
  onOpenAccount: () => void;
  onBack?: () => void;
  /** Jeton d'un destinataire à cibler à l'ouverture (depuis « Envoyer » de Maison). */
  initialShareToken?: string;
  onConsumeShare?: () => void;
}

export default function NounouView({ showAccount, initiale, onOpenAccount, onBack, initialShareToken, onConsumeShare }: Props) {
  const ready = useNounou((s) => s.ready);
  const init = useNounou((s) => s.init);

  const [seg, setSeg] = useState<Segment>('journee');
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | undefined>(undefined);
  const [traduire, setTraduire] = useState<NounouLangue | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = (msg: string) => {
    setToastMsg(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(''), 2200);
  };

  useEffect(() => {
    if (!ready) void init();
  }, [ready, init]);

  // Ouverture ciblée depuis Maison (« Envoyer ») : ouvre le partage pré-sélectionné.
  useEffect(() => {
    if (initialShareToken) {
      setShareToken(initialShareToken);
      setSharing(true);
      onConsumeShare?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShareToken]);

  if (!ready) return <div className="spinner">Chargement…</div>;

  return (
    <div className="cz cz-nounou">
      <header className="cz-head">
        <div className="cz-brandrow">
          <div className="cz-brand">
            {onBack && (
              <button className="cz-back" onClick={onBack} aria-label="Retour à Maison">
                ‹
              </button>
            )}
            <span className="cz-mark nz-mark" />
            Nounou
          </div>
          <div className="cz-headicons">
            <button
              className="cz-headicon"
              onClick={() => {
                setShareToken(undefined);
                setSharing(true);
              }}
              aria-label="Partager la page"
            >
              <IconShareUp size={18} />
            </button>
            {showAccount && (
              <Pastille initiale={initiale} onClick={onOpenAccount} hostClass="cz-headicon" />
            )}
          </div>
        </div>
        <div className="cz-segmented" role="tablist">
          {(['journee', 'conduites', 'urgence'] as Segment[]).map((s) => (
            <button
              key={s}
              className="cz-seg"
              role="tab"
              aria-selected={seg === s}
              onClick={() => {
                setSeg(s);
                window.scrollTo({ top: 0 });
              }}
            >
              {SEG_LABEL[s]}
            </button>
          ))}
        </div>
      </header>

      <div className="cz-content">
        {seg === 'journee' ? (
          <JourneeView toast={toast} />
        ) : seg === 'conduites' ? (
          <ConduitesView toast={toast} />
        ) : (
          <FicheUrgenceView toast={toast} />
        )}
      </div>

      {sharing && (
        <PartageNounouSheet
          initialToken={shareToken}
          onClose={() => setSharing(false)}
          onTraduire={(l) => {
            setSharing(false);
            setTraduire(l);
          }}
          toast={toast}
        />
      )}

      {traduire && (
        <TraductionSheet langue={traduire} onClose={() => setTraduire(null)} toast={toast} />
      )}

      <div className={'cz-toast' + (toastMsg ? ' show' : '')}>
        {toastMsg && <IconCheck size={16} />}
        {toastMsg}
      </div>
    </div>
  );
}
