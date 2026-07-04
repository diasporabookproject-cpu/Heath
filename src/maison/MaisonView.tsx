import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useNounou } from '../nounou/useNounou';
import { loadDestinataires, loadPublished, type PublishRecord } from '../lib/db';
import { lastEspaceOpen } from '../lib/espace';
import { cuisineSig, envoiState, type EnvoiState } from './transmission';
import { nounouSig } from '../nounou/partage';
import { personnes, KIND_LABEL, KIND_PICTO, type Personne, type PersonneKind } from './personnes';
import { agendaToday, splitProchain, nowHHMM, type AgendaItem } from './prochain';
import { MzScreen, MzScroll } from '../ui/primitives';
import { dayTitleISO, todayISO } from '../nounou/dates';
import type { Destinataire } from '../types';

const ROLES: PersonneKind[] = ['nounou', 'cuisine'];

interface Props {
  onOpenPage: (kind: 'cuisine' | 'nounou', person?: Personne, share?: boolean) => void;
  onOpenSecurite: () => void;
  onNewPage: () => void;
  onOpenAccount: () => void;
  showAccount: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'lu à l’instant';
  if (h < 24) return `lu il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'lu hier' : `lu il y a ${d} j`;
}

export default function MaisonView({ onOpenPage, onOpenSecurite, onNewPage, onOpenAccount, showAccount }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const persons = useStore((s) => s.settings.persons);
  const cuisineReady = useStore((s) => s.ready);

  const nReady = useNounou((s) => s.ready);
  const nInit = useNounou((s) => s.init);
  const doc = useNounou((s) => s.doc);

  const [cuisineDests, setCuisineDests] = useState<Destinataire[]>([]);
  const [published, setPublished] = useState<Record<string, PublishRecord>>({});
  const [opens, setOpens] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!nReady) void nInit();
  }, [nReady, nInit]);

  useEffect(() => {
    void loadDestinataires().then(setCuisineDests);
    void loadPublished().then(setPublished);
  }, []);

  const list = useMemo(() => personnes(cuisineDests, doc.destinataires), [cuisineDests, doc.destinataires]);

  // Accusés de lecture (best-effort, réseau) — chargés une fois la liste connue.
  useEffect(() => {
    let alive = true;
    Promise.all(list.map((p) => lastEspaceOpen(p.token).then((v) => [p.token, v] as const))).then((pairs) => {
      if (alive) setOpens(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [list]);

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const agenda: AgendaItem[] = useMemo(
    () => (cuisineReady && nReady ? agendaToday(doc, week, recipesById) : []),
    [doc, week, recipesById, cuisineReady, nReady],
  );
  const { prochain, timeline, done } = useMemo(() => splitProchain(agenda, nowHHMM()), [agenda]);

  /** État de transmission d'une personne (signature courante vs dernier envoi). */
  const etat = (p: Personne): { state: EnvoiState; sub: string } => {
    let sig = '';
    if (p.kind === 'cuisine') {
      const d = cuisineDests.find((x) => x.token === p.token);
      sig = d ? cuisineSig(week, persons, d) : '';
    } else {
      const d = doc.destinataires.find((x) => x.token === p.token);
      sig = d ? nounouSig(doc, d) : '';
    }
    const state = envoiState(sig, published[p.token]);
    const ago = timeAgo(opens[p.token] ?? null);
    const sub =
      state === 'uptodate'
        ? `✓ Tout est transmis${ago ? ' · ' + ago : ''}`
        : state === 'never'
          ? '● Pas encore envoyé'
          : '● Du nouveau à envoyer';
    return { state, sub };
  };

  return (
    <MzScreen>
      <MzScroll>
        <div className="mz-hrow" style={{ marginBottom: 12 }}>
          <div>
            <div className="mz-greet">Salam 👋</div>
            <div className="mz-big">{dayTitleISO(todayISO())}</div>
          </div>
          {showAccount && (
            <button className="mz-av" onClick={onOpenAccount} aria-label="Compte et réglages">
              ☁︎
            </button>
          )}
        </div>

        {/* AUJOURD'HUI */}
        <div className="mz-lab" style={{ marginTop: 2 }}>Aujourd’hui</div>
        {prochain ? (
          <button
            className={'mz-hero ' + (prochain.kind === 'cuisine' ? 'grn' : 'vio')}
            onClick={() => onOpenPage(prochain.kind)}
          >
            <span className="halo" />
            <span className="g">{prochain.picto}</span>
            <span>
              <span className="lab">PROCHAIN · {prochain.kind === 'cuisine' ? 'CUISINE' : 'NOUNOU'}</span>
              <h3>{prochain.label}</h3>
            </span>
            <span className="t">{prochain.time}</span>
          </button>
        ) : done ? (
          <div className="mz-card" style={{ textAlign: 'center', color: 'var(--mz-mut)', fontWeight: 700, fontSize: 14 }}>
            Journée terminée 🌙
          </div>
        ) : (
          <div className="mz-card" style={{ textAlign: 'center', color: 'var(--mz-mut)', fontWeight: 600, fontSize: 13 }}>
            Rien de prévu aujourd’hui.
          </div>
        )}
        {timeline.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {timeline.map((i, k) => (
              <button
                key={k}
                className={'mz-tlr' + (i.past ? ' past' : '')}
                onClick={() => onOpenPage(i.kind)}
              >
                <span className="t">{i.time}</span>
                <span className="e" style={{ background: i.kind === 'cuisine' ? 'var(--mz-grnT)' : 'var(--mz-vioT)' }}>
                  {i.picto}
                </span>
                <h4>{i.label}</h4>
              </button>
            ))}
          </div>
        )}

        {/* TON ÉQUIPE — personnes réelles + accès aux pages de rôle sans destinataire */}
        <div className="mz-lab">Ton équipe</div>
        {list.map((p) => {
          const { state, sub } = etat(p);
          const alert = state !== 'uptodate';
          return (
            <div className="mz-prow" key={p.key} onClick={() => onOpenPage(p.kind, p)} role="button" tabIndex={0}>
              <span className={'mz-tav ' + (p.kind === 'cuisine' ? 'grn' : 'vio')}>{KIND_PICTO[p.kind]}</span>
              <span style={{ minWidth: 0 }}>
                <h4>
                  {p.prenom} · {KIND_LABEL[p.kind]}
                </h4>
                <div className={'st' + (alert ? ' w' : ' g')}>
                  <b>{sub}</b>
                </div>
              </span>
              {alert ? (
                <button
                  className="mz-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPage(p.kind, p, true);
                  }}
                >
                  Envoyer
                </button>
              ) : (
                <span className="chev">›</span>
              )}
            </div>
          );
        })}
        {/* Pages de rôle sans destinataire encore : rester accessibles pour préparer le contenu. */}
        {ROLES.filter((k) => !list.some((p) => p.kind === k)).map((k) => (
          <div
            className="mz-prow"
            key={'role:' + k}
            onClick={() => onOpenPage(k)}
            role="button"
            tabIndex={0}
          >
            <span className={'mz-tav ' + (k === 'cuisine' ? 'grn' : 'vio')}>{KIND_PICTO[k]}</span>
            <span style={{ minWidth: 0 }}>
              <h4>{KIND_LABEL[k]}</h4>
              <div className="st">Prépare la page — personne à qui l’envoyer pour l’instant</div>
            </span>
            <span className="chev">›</span>
          </div>
        ))}

        {/* La maison (référentiel Sécurité, décision A) */}
        <button className="mz-prow" onClick={onOpenSecurite} style={{ marginTop: 2 }}>
          <span className="mz-tav" style={{ background: '#F1EFE8', fontSize: 22 }}>🛡️</span>
          <span>
            <h4>La maison</h4>
            <div className="st">Numéros, procédures, gestes — à assigner à qui tu veux</div>
          </span>
          <span className="chev">›</span>
        </button>

        <button className="mz-dashed" onClick={onNewPage} style={{ marginTop: 8 }}>
          ＋ Une page pour quelqu’un d’autre
        </button>
        <div style={{ height: 16 }} />
      </MzScroll>
    </MzScreen>
  );
}
