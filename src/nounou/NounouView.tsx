import { useEffect, useRef, useState } from 'react';
import { useNounou } from './useNounou';
import JourneeView from './JourneeView';
import ConduitesView from './ConduitesView';
import PartageNounouSheet from './PartageNounouSheet';
import { IconShareUp, IconCheck } from '../cuisine/icons';
import '../cuisine/cuisine.css';
import './nounou.css';

type Segment = 'journee' | 'conduites' | 'urgence';
const SEG_LABEL: Record<Segment, string> = {
  journee: 'Journée',
  conduites: 'Conduites',
  urgence: 'Fiche urgence',
};

interface Props {
  showAccount: boolean;
  connected: boolean;
  onOpenAccount: () => void;
}

export default function NounouView({ showAccount, connected, onOpenAccount }: Props) {
  const ready = useNounou((s) => s.ready);
  const init = useNounou((s) => s.init);

  const [seg, setSeg] = useState<Segment>('journee');
  const [sharing, setSharing] = useState(false);
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

  if (!ready) return <div className="spinner">Chargement…</div>;

  return (
    <div className="cz">
      <header className="cz-head">
        <div className="cz-brandrow">
          <div className="cz-brand">
            <span className="cz-mark nz-mark" />
            Nounou
          </div>
          <div className="cz-headicons">
            <button
              className="cz-headicon"
              onClick={() => setSharing(true)}
              aria-label="Partager la page"
            >
              <IconShareUp size={18} />
            </button>
            {showAccount && (
              <button
                className="cz-headicon"
                onClick={onOpenAccount}
                aria-label="Compte et synchro"
                title={connected ? 'Connecté' : 'Se connecter'}
              >
                ☁︎
              </button>
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
          <Placeholder
            emoji="🚨"
            titre="Fiche urgence — à venir"
            sub="Numéros, contacts, règles et fiches enfants (Lot 3)."
          />
        )}
      </div>

      {sharing && (
        <PartageNounouSheet connected={connected} onClose={() => setSharing(false)} toast={toast} />
      )}

      <div className={'cz-toast' + (toastMsg ? ' show' : '')}>
        {toastMsg && <IconCheck size={16} />}
        {toastMsg}
      </div>
    </div>
  );
}

function Placeholder({ emoji, titre, sub }: { emoji: string; titre: string; sub: string }) {
  return (
    <div className="nz-empty">
      <span className="nz-emoji">{emoji}</span>
      {titre}
      <small>{sub}</small>
    </div>
  );
}
