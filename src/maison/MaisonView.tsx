import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useNounou } from '../nounou/useNounou';
import { loadDestinataires, loadPublished, loadWeek, type PublishRecord } from '../lib/db';
import { lastEspaceOpen } from '../lib/espace';
import { weekId } from '../cuisine/dates';
import { cleanText } from '../lib/sanitize';
import { DAY_LABELS } from '../lib/rappel';
import { cuisineSig, envoiState, pillKind, type EnvoiState } from './transmission';
import { nounouSig } from '../nounou/partage';
import { personnes, KIND_LABEL, KIND_PICTO, type Personne, type PersonneKind } from './personnes';
import { agendaToday, splitProchain, nowHHMM, type AgendaItem } from './prochain';
import { MzScreen, MzScroll } from '../ui/primitives';
import { dayTitleISO, todayISO } from '../nounou/dates';
import type { Destinataire } from '../types';

/** Date ISO (YYYY-MM-DD) décalée de `n` jours, en heure locale (sûr aux passages de mois). */
function isoPlusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const ROLES: PersonneKind[] = ['nounou', 'cuisine'];

interface Props {
  onOpenPage: (kind: 'cuisine' | 'nounou', person?: Personne, share?: boolean) => void;
  onOpenSecurite: () => void;
  onNewPage: () => void;
  onOpenAccount: () => void;
  showAccount: boolean;
  /** F4 (Flow FTUE) : rôles dont la carte est posée sur le hub (les PERSONNES réelles
   * s'affichent toujours ; seules les cartes de rôle SANS destinataire sont filtrées). */
  rolesActifs: PersonneKind[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'lu à l’instant';
  if (h < 24) return `lu il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'lu hier' : `lu il y a ${d} j`;
}

export default function MaisonView({ onOpenPage, onOpenSecurite, onNewPage, onOpenAccount, showAccount, rolesActifs }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const persons = useStore((s) => s.settings.persons);
  const cuisineReady = useStore((s) => s.ready);

  const navWeek = useStore((s) => s.navWeek);
  const rappels = useStore((s) => s.app.rappels);

  const nReady = useNounou((s) => s.ready);
  const nInit = useNounou((s) => s.init);
  const doc = useNounou((s) => s.doc);

  const [cuisineDests, setCuisineDests] = useState<Destinataire[]>([]);
  const [published, setPublished] = useState<Record<string, PublishRecord>>({});
  const [opens, setOpens] = useState<Record<string, string | null>>({});
  // Signal « Planifier » : la semaine suivante est-elle vide ? null = inconnu (⇒ pas de nudge).
  const [nextWeekEmpty, setNextWeekEmpty] = useState<boolean | null>(null);

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

  // Signal « Briefer » (nounou) : ponctuel à venir dans les 7 jours (page à jour).
  const upcomingPonctuel = useMemo(() => {
    const t = todayISO();
    const max = isoPlusDays(t, 7);
    return [...doc.ponctuels]
      .filter((p) => p.date >= t && p.date <= max)
      .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure))[0];
  }, [doc.ponctuels]);

  // Signal « Planifier » (cuisine) : la semaine suivante est-elle vide ?
  // Précaution : jamais de fausse alerte — on ne conclut « vide » que si la
  // semaine est absente OU chargée sans aucun plat.
  useEffect(() => {
    let alive = true;
    void loadWeek(weekId(1)).then((w) => {
      if (!alive) return;
      if (!w) return setNextWeekEmpty(true);
      const hasAny = Object.values(w.days).some(
        (d) => d && (d.petitdej?.plat || d.dej?.plat || d.diner?.plat),
      );
      setNextWeekEmpty(!hasAny);
    });
    return () => {
      alive = false;
    };
  }, []);

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

  const relDay = (iso: string) => (iso === todayISO() ? 'aujourd’hui' : dayTitleISO(iso).toLowerCase());

  /**
   * Une personne = un état = une action (proto v6.1). Priorité stricte :
   * Envoyer (rien n'est parti / du nouveau) > Briefer (à jour, mais un ponctuel
   * approche) > Planifier (à jour, mais la semaine suivante est vide) > ✓ chevron.
   * Précaution : les nudges Briefer/Planifier ne s'affichent QUE sur un signal
   * réel et sûr — sinon on retombe sur le chevron (jamais de fausse alerte).
   */
  const action = (p: Personne): { pill?: string; onPill: () => void; sub: string; tone: 'w' | 'g' } => {
    const { state, sub } = etat(p);
    const kind = pillKind({
      state,
      kind: p.kind,
      hasUpcomingPonctuel: p.kind === 'nounou' && !!upcomingPonctuel,
      nextWeekEmpty: nextWeekEmpty === true,
    });
    switch (kind) {
      case 'envoyer': {
        // L3-5 (option B, fidèle au prototype) : tant qu'un rappel est réglé et
        // qu'il y a du nouveau, la mention rappelle le rendez-vous d'envoi —
        // PERSISTANTE jusqu'à l'envoi (pastille in-app, aucune notification).
        const r = rappels?.[p.kind];
        const enriched = r ? `● Du nouveau — ton rendez-vous du ${DAY_LABELS[r.day]} ${r.time}` : sub;
        return { pill: 'Envoyer', onPill: () => onOpenPage(p.kind, p, true), sub: enriched, tone: 'w' };
      }
      case 'briefer':
        return {
          pill: 'Briefer',
          onPill: () => onOpenPage('nounou', p),
          sub: `📌 ${cleanText(upcomingPonctuel!.label)} · ${relDay(upcomingPonctuel!.date)}`,
          tone: 'w',
        };
      case 'planifier':
        return {
          pill: 'Planifier',
          onPill: () => {
            void navWeek(1);
            onOpenPage('cuisine', p);
          },
          sub: 'La semaine prochaine t’attend',
          tone: 'w',
        };
      default:
        return { onPill: () => onOpenPage(p.kind, p), sub, tone: 'g' };
    }
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
          const a = action(p);
          return (
            <div className="mz-prow" key={p.key} onClick={() => onOpenPage(p.kind, p)} role="button" tabIndex={0}>
              <span className={'mz-tav ' + (p.kind === 'cuisine' ? 'grn' : 'vio')}>{KIND_PICTO[p.kind]}</span>
              <span style={{ minWidth: 0 }}>
                <h4>
                  {p.prenom} · {KIND_LABEL[p.kind]}
                </h4>
                <div className={'st ' + a.tone}>
                  <b>{a.sub}</b>
                </div>
              </span>
              {a.pill ? (
                <button
                  className="mz-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    a.onPill();
                  }}
                >
                  {a.pill}
                </button>
              ) : (
                <span className="chev">›</span>
              )}
            </div>
          );
        })}
        {/* Pages de rôle sans destinataire : accessibles pour préparer le contenu —
            mais seulement si le rôle est ACTIVÉ (F4 : FTUE ou « ＋ Une page pour… »). */}
        {ROLES.filter((k) => rolesActifs.includes(k) && !list.some((p) => p.kind === k)).map((k) => (
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
