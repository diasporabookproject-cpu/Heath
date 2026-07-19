import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useNounou } from '../nounou/useNounou';
import { loadDestinataires, loadPublished, loadSecurite, loadWeek, type PublishRecord } from '../lib/db';
import { lastEspaceOpen } from '../lib/espace';
import { weekId } from '../cuisine/dates';
import { cleanText } from '../lib/sanitize';
import { DAY_LABELS } from '../lib/rappel';
import { cuisineSig, envoiState, pillKind, type EnvoiState } from './transmission';
import { nounouSig } from '../nounou/partage';
import { personnes, KIND_LABEL, type Personne, type PersonneKind } from './personnes';
import { agendaToday, nowHHMM, type AgendaItem } from './prochain';
import { MzScreen, MzScroll } from '../ui/primitives';
import Em from '../ui/Em';
import { dayTitleISO, todayISO } from '../nounou/dates';
import type { Destinataire, SecuriteFiche } from '../types';
import './b1.css';

/** Date ISO (YYYY-MM-DD) décalée de `n` jours, en heure locale (sûr aux passages de mois). */
function isoPlusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Séquence des clés de jour (même convention que cuisine/dates KEYS).
const DAY_KEYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const DAY_FULL: Record<string, string> = {
  lun: 'lundi', mar: 'mardi', mer: 'mercredi', jeu: 'jeudi', ven: 'vendredi', sam: 'samedi', dim: 'dimanche',
};

/** Salutation DA v2 (registre décidé) : Bonjour / Bonsoir selon l'heure. */
function salutation(ref: Date = new Date()): string {
  return ref.getHours() >= 18 ? 'Bonsoir' : 'Bonjour';
}

interface Props {
  onOpenPage: (kind: 'cuisine' | 'nounou', person?: Personne, share?: boolean) => void;
  onOpenSecurite: () => void;
  onNewPage: () => void;
  onOpenAccount: () => void;
  showAccount: boolean;
  /** F4 (Flow FTUE) : rôles dont la carte est posée sur le hub (les PERSONNES réelles
   * s'affichent toujours ; seuls les accès de rôle SANS destinataire sont filtrés). */
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
  const [fiches, setFiches] = useState<SecuriteFiche[]>([]);
  // Signal « Planifier » : la semaine suivante est-elle vide ? null = inconnu (⇒ pas de nudge).
  const [nextWeekEmpty, setNextWeekEmpty] = useState<boolean | null>(null);

  useEffect(() => {
    if (!nReady) void nInit();
  }, [nReady, nInit]);

  useEffect(() => {
    void loadDestinataires().then(setCuisineDests);
    void loadPublished().then(setPublished);
    void loadSecurite().then(setFiches);
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
  // Bande « Aujourd'hui » : l'imminent est CERCLÉ (pas de tag), le passé s'estompe.
  const now = nowHHMM();
  const ringIdx = useMemo(() => agenda.findIndex((i) => i.time >= now), [agenda, now]);

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

  // ── Héros Cuisine : points des jours restants de la semaine + sous-titre réel ──
  const dayHasMeal = (key: string): boolean => {
    const d = week.days[key];
    return !!(d && (d.petitdej?.plat || d.dej?.plat || d.diner?.plat));
  };
  const cuisineHero = useMemo(() => {
    const dow = new Date().getDay(); // 0 = dim
    const remaining = dow === 0 ? 0 : 7 - dow; // jours restants de la semaine courante
    const days: { key: string; label: string; full: boolean }[] = [];
    for (let n = 1; n <= Math.min(4, remaining); n++) {
      const key = DAY_KEYS[(dow + n) % 7];
      days.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), full: dayHasMeal(key) });
    }
    // Sous-titre : « Prêt jusqu'à X » (série pleine depuis demain) · « demain, {plat} ».
    let streakEnd: string | null = null;
    for (const d of days) {
      if (d.full) streakEnd = DAY_FULL[d.key];
      else break;
    }
    let demain: string | null = null;
    if (remaining >= 1) {
      const tk = DAY_KEYS[(dow + 1) % 7];
      const d = week.days[tk];
      const platId = d?.dej?.plat || d?.diner?.plat || d?.petitdej?.plat;
      const r = platId ? recipesById.get(platId) : undefined;
      if (r) demain = cleanText(r.nom);
    }
    let sub: string;
    if (remaining === 0) {
      sub = nextWeekEmpty === true ? 'La semaine prochaine vous attend' : 'Semaine prochaine prête';
    } else if (streakEnd && demain) sub = `Prêt jusqu’à ${streakEnd} · demain, ${demain}`;
    else if (demain) sub = `Demain, ${demain}`;
    else if (streakEnd) sub = `Prêt jusqu’à ${streakEnd}`;
    else sub = 'Rien de prévu pour demain';
    return { days, sub };
  }, [week, recipesById, nextWeekEmpty]);

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
   * Une personne = un état = une action (proto v6.1 — modèle d'action INCHANGÉ à
   * la DA v2 ; « Briefer » unique = hors lot). Priorité stricte :
   * Envoyer (rien n'est parti / du nouveau) > Briefer (à jour, mais un ponctuel
   * approche) > Planifier (à jour, mais la semaine suivante est vide) > ✓ chevron.
   * Précaution : les nudges Briefer/Planifier ne s'affichent QUE sur un signal
   * réel et sûr — sinon on retombe sur le chevron (jamais de fausse alerte).
   */
  const action = (p: Personne): { pill?: string; onPill: () => void; sub: string } => {
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
        const enriched = r ? `● Du nouveau — votre rendez-vous du ${DAY_LABELS[r.day]} ${r.time}` : sub;
        return { pill: 'Envoyer', onPill: () => onOpenPage(p.kind, p, true), sub: enriched };
      }
      case 'briefer':
        return {
          pill: 'Briefer',
          onPill: () => onOpenPage('nounou', p),
          sub: `📌 ${cleanText(upcomingPonctuel!.label)} · ${relDay(upcomingPonctuel!.date)}`,
        };
      case 'planifier':
        return {
          pill: 'Planifier',
          onPill: () => {
            void navWeek(1);
            onOpenPage('cuisine', p);
          },
          sub: 'La semaine prochaine vous attend',
        };
      default:
        return { onPill: () => onOpenPage(p.kind, p), sub };
    }
  };

  // Accès de domaine (doctrine planifier/exécuter du proto B1) : le héros Cuisine
  // et la carte Les enfants portent l'accès aux pages de rôle — y compris sans
  // destinataire (remplace les anciennes lignes de rôle), gatés par F4.
  const cuisineActif = rolesActifs.includes('cuisine') || list.some((p) => p.kind === 'cuisine');
  const nounouActif = rolesActifs.includes('nounou') || list.some((p) => p.kind === 'nounou');
  const nounouCount = useMemo(() => agenda.filter((i) => i.kind === 'nounou').length, [agenda]);
  const titleDate = useMemo(() => {
    const s = dayTitleISO(todayISO());
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);

  return (
    <MzScreen className="b1">
      <MzScroll>
        <div className="mz-hrow" style={{ marginBottom: 0 }}>
          <div>
            <div className="b1-greet">{salutation()}</div>
            <div className="b1-big">{titleDate}</div>
          </div>
          {showAccount && (
            <button className="b1-acc" onClick={onOpenAccount} aria-label="Compte et réglages">
              <Em ch="👤" size={20} />
            </button>
          )}
        </div>

        {/* AUJOURD'HUI — une seule bande, tuiles égales, l'imminent cerclé */}
        <div className="b1-blab" style={{ marginTop: 16 }}>Aujourd’hui</div>
        {agenda.length > 0 ? (
          <div className="b1-band">
            {agenda.map((i, idx) => (
              <button
                key={idx}
                className={
                  'b1-tile ' + (i.kind === 'cuisine' ? 'meal' : 'kid') +
                  (idx === ringIdx ? ' ring' : '') +
                  (ringIdx === -1 || idx < ringIdx ? ' past' : '')
                }
                onClick={() => onOpenPage(i.kind)}
              >
                <span className="b1-toprow">
                  <span className="b1-ec"><Em ch={i.picto} size={28} /></span>
                  <span className="b1-tt">{i.time}</span>
                </span>
                <span className="b1-nm">{i.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="b1-emptycard" style={{ marginTop: 6 }}>Rien de prévu aujourd’hui.</div>
        )}

        {/* VOTRE FOYER — Cuisine en héros, Les enfants + Infos clés en soutien */}
        <div className="b1-blab">Votre foyer</div>
        {cuisineActif && (
          <button className={'b1-cuihero' + (cuisineHero.days.length === 0 ? ' nodots' : '')} onClick={() => onOpenPage('cuisine')}>
            <span className="b1-chead">
              <span className="b1-cchip"><Em ch="🍲" size={38} /></span>
              <span>
                <span className="b1-cn">La Cuisine</span>
                <div className="b1-csub">{cuisineHero.sub}</div>
              </span>
            </span>
            {cuisineHero.days.length > 0 && (
              <span className="b1-dayrow">
                {cuisineHero.days.map((d) => (
                  <span className="b1-dc" key={d.key}>
                    <span className="b1-dd">{d.label}</span>
                    <span className={'b1-dot ' + (d.full ? 'full' : 'empty')} />
                  </span>
                ))}
              </span>
            )}
          </button>
        )}
        <div className={'b1-duo' + (nounouActif ? '' : ' solo')}>
          {nounouActif && (
            <button className="b1-mini" onClick={() => onOpenPage('nounou')}>
              <span className="b1-mchip e"><Em ch="🧸" size={32} /></span>
              <span>
                <div className="b1-mn">Les enfants</div>
                <div className="b1-ms">{nounouCount > 0 ? `${nounouCount} moment${nounouCount > 1 ? 's' : ''} aujourd’hui` : 'Rythme habituel'}</div>
              </span>
            </button>
          )}
          <button className="b1-mini" onClick={onOpenSecurite}>
            <span className="b1-mchip m"><Em ch="🛡️" size={32} /></span>
            <span>
              <div className="b1-mn">Infos clés</div>
              <div className="b1-ms">{fiches.length > 0 ? `${fiches.length} fiche${fiches.length > 1 ? 's' : ''}` : 'À composer'}</div>
            </span>
          </button>
        </div>

        {/* MON ÉQUIPE — le personnel : une ligne par personne, pastille = action */}
        {list.length > 0 && <div className="b1-blab">Mon équipe</div>}
        {list.map((p) => {
          const a = action(p);
          return (
            <div className="b1-prow" key={p.key} onClick={() => onOpenPage(p.kind, p)} role="button" tabIndex={0}>
              <span className={'b1-ini ' + (p.kind === 'cuisine' ? 'grn' : 'vio')}>
                {p.prenom.charAt(0).toUpperCase()}
                {a.pill && <span className="b1-pip" />}
              </span>
              <span className="b1-ptx">
                <h4>
                  {p.prenom} · {KIND_LABEL[p.kind]}
                </h4>
                <div className="st">{a.sub}</div>
              </span>
              {a.pill ? (
                <button
                  className="b1-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    a.onPill();
                  }}
                >
                  {a.pill}
                </button>
              ) : (
                <span className="b1-chev">›</span>
              )}
            </div>
          );
        })}

        <button className="b1-dashed" onClick={onNewPage} style={{ marginTop: 8 }}>
          ＋ Une page pour quelqu’un d’autre
        </button>
        <div style={{ height: 16 }} />
      </MzScroll>
    </MzScreen>
  );
}
