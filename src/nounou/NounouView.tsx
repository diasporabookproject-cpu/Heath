import { useEffect, useRef, useState } from 'react';
import { useNounou } from './useNounou';
import { projectDay, activePeriode, type DayEntry } from './projection';
import { todayISO, dayTitleISO } from './dates';
import type { Enfant, MomentType } from '../types';
import { IconShareUp, IconCheck } from '../cuisine/icons';
import '../cuisine/cuisine.css';
import './nounou.css';

type Segment = 'journee' | 'conduites' | 'urgence';
const SEG_LABEL: Record<Segment, string> = {
  journee: 'Journée',
  conduites: 'Conduites',
  urgence: 'Fiche urgence',
};

const TYPE_EMOJI: Record<MomentType, string> = {
  ecole: '🎒',
  sieste: '😴',
  repas: '🍽️',
  gouter: '🍎',
  coucher: '🌙',
  activite: '⚽',
  sante: '💊',
  autre: '•',
};

interface Props {
  showAccount: boolean;
  connected: boolean;
  onOpenAccount: () => void;
}

export default function NounouView({ showAccount, connected, onOpenAccount }: Props) {
  const ready = useNounou((s) => s.ready);
  const init = useNounou((s) => s.init);
  const doc = useNounou((s) => s.doc);

  const [seg, setSeg] = useState<Segment>('journee');
  const [date] = useState<string>(() => todayISO());

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

  const entries = projectDay(doc, date);
  const per = activePeriode(doc, date);
  const enfantById = new Map(doc.enfants.map((e) => [e.id, e]));

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
              onClick={() => toast('Partage : à venir (Lot 4)')}
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

      <div className="cz-content" style={{ padding: '14px 16px' }}>
        {seg === 'journee' ? (
          <JourneeDay date={date} entries={entries} periodeNom={per?.nom} periodeEmoji={per?.emoji} enfantById={enfantById} />
        ) : seg === 'conduites' ? (
          <Placeholder emoji="🧭" titre="Conduites — à venir" sub="« Que faire si… » : protocoles, voix et qui appeler (Lot 2)." />
        ) : (
          <Placeholder emoji="🚨" titre="Fiche urgence — à venir" sub="Numéros, contacts, règles et fiches enfants (Lot 3)." />
        )}
      </div>

      <div className={'cz-toast' + (toastMsg ? ' show' : '')}>
        {toastMsg && <IconCheck size={16} />}
        {toastMsg}
      </div>
    </div>
  );
}

function JourneeDay({
  date,
  entries,
  periodeNom,
  periodeEmoji,
  enfantById,
}: {
  date: string;
  entries: DayEntry[];
  periodeNom?: string;
  periodeEmoji?: string;
  enfantById: Map<string, Enfant>;
}) {
  return (
    <>
      <div className="nz-dayhead">
        <span className="nz-daytitle">{dayTitleISO(date)}</span>
        <small>aujourd’hui</small>
      </div>

      {periodeNom && (
        <div className="nz-periodbar">
          <span>{periodeEmoji ?? '📅'}</span>
          {periodeNom}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="nz-empty">
          <span className="nz-emoji">🌤️</span>
          Rien de prévu ce jour.
          <small>Ajoute un moment ou un ponctuel (Lot 1).</small>
        </div>
      ) : (
        entries.map((e) => {
          const kids = e.enfants.map((id) => enfantById.get(id)).filter((k): k is Enfant => !!k);
          return (
            <div key={e.id} className={'nz-line' + (e.source === 'ponctuel' ? ' ponctuel' : '')}>
              <span className="nz-h">{e.heure}</span>
              <span className="nz-icon">{TYPE_EMOJI[e.type]}</span>
              <div className="nz-body">
                <div className="nz-lab">{e.label}</div>
                {(e.lieu || e.qui) && (
                  <div className="nz-sub">{[e.lieu, e.qui].filter(Boolean).join(' · ')}</div>
                )}
              </div>
              {kids.length > 0 && (
                <span className="nz-kids">
                  {kids.map((k) => (
                    <span key={k.id} className="nz-kid" style={{ background: k.couleur }}>
                      {k.initiale}
                    </span>
                  ))}
                </span>
              )}
              {e.source === 'ponctuel' && <span className="nz-tag ponctuel">Ponctuel</span>}
            </div>
          );
        })
      )}
    </>
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
