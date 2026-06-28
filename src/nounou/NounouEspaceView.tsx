import { useState } from 'react';
import type { NounouEspace } from './partage';
import { projectDay, activePeriode, type DayEntry } from './projection';
import {
  todayISO,
  dayTitleISO,
  weekDaysISO,
  dayNumberISO,
  addDaysISO,
  SHORT,
} from './dates';
import { MomentIcon, IconChevronLeft } from './icons';
import type { Enfant } from '../types';
import '../cuisine/cuisine.css';
import './nounou.css';

// Page reçue (lecture seule) — version Journée. Ouverte via #e=<token>.
// La voix, les 3 accès (conduites / qui appeler / enfants) et le RTL/traduction
// arrivent aux lots suivants (5 + 4.2).

export default function NounouEspaceView({ espace }: { espace: NounouEspace }) {
  const doc = espace.doc;
  const [date, setDate] = useState<string>(() => todayISO());

  const week = weekDaysISO(date);
  const entries = projectDay(doc, date);
  const per = activePeriode(doc, date);
  const enfantById = new Map(doc.enfants.map((e) => [e.id, e]));
  const isToday = date === todayISO();
  const enfantsLabel = doc.enfants.map((e) => e.prenom).join(' & ');

  const tagsFor = (e: DayEntry): Enfant[] => {
    if (e.enfants.length === 0 || e.enfants.length >= doc.enfants.length) return [];
    return e.enfants.map((id) => enfantById.get(id)).filter((k): k is Enfant => !!k);
  };

  return (
    <div className="cz">
      <header className="cz-head">
        <div className="cz-brandrow">
          <div className="cz-brand">
            <span className="cz-mark nz-mark" />
            <span>
              {enfantsLabel || 'La page'}
              <span className="nz-recsub">Page partagée par Maman</span>
            </span>
          </div>
          <span className="nz-offbadge">
            <span className="od" /> Hors-ligne
          </span>
        </div>
      </header>

      <div className="cz-content">
        <div className="nz-daystrip">
          <button className="nz-dsnav" onClick={() => setDate(addDaysISO(date, -7))} aria-label="Semaine précédente">
            <IconChevronLeft size={16} />
          </button>
          <div className="nz-dschips">
            {week.map((iso, i) => {
              const inper = !!activePeriode(doc, iso);
              return (
                <button
                  key={iso}
                  className={'nz-dchip' + (inper ? ' inper' : '')}
                  aria-pressed={iso === date}
                  onClick={() => setDate(iso)}
                >
                  <div className="dn">{SHORT[i]}</div>
                  <div className="dd">{dayNumberISO(iso)}</div>
                  {inper && <div className="nz-pdot" />}
                </button>
              );
            })}
          </div>
          <button className="nz-dsnav" onClick={() => setDate(addDaysISO(date, 7))} aria-label="Semaine suivante">
            <span style={{ transform: 'rotate(180deg)', display: 'grid' }}>
              <IconChevronLeft size={16} />
            </span>
          </button>
        </div>

        <div className="nz-daytitle">
          {isToday ? 'Aujourd’hui' : dayTitleISO(date)}
          <small>{isToday ? dayTitleISO(date) : ''}</small>
        </div>

        {per && (
          <div className="nz-perbanner">
            <span className="pe">{per.emoji}</span>
            <div>
              <div className="pt">{per.nom}</div>
              {per.note && <div className="pd">{per.note}</div>}
            </div>
          </div>
        )}

        <div className="nz-sheetlist">
          {entries.length === 0 ? (
            <div className="nz-dayempty">Rien de prévu ce jour.</div>
          ) : (
            <div className="nz-shcard">
              {entries.map((e) => {
                const kids = tagsFor(e);
                const sub = [e.lieu, e.qui ? `avec ${e.qui}` : ''].filter(Boolean).join(' · ');
                return (
                  <div key={e.id} className="nz-item" style={{ cursor: 'default' }}>
                    <span className="tm">{e.heure}</span>
                    <span className={'ic' + (e.source === 'ponctuel' ? ' exc' : '')}>
                      <MomentIcon type={e.type} />
                    </span>
                    <span className="mm">
                      <span className="nn">
                        {e.label}
                        {kids.map((k) => (
                          <span key={k.id} className="nz-kidtag" style={{ background: k.couleur }}>
                            {k.initiale}
                          </span>
                        ))}
                        {e.source === 'ponctuel' && <span className="nz-ponct">Ponctuel</span>}
                      </span>
                      {sub && <span className="ss">{sub}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="nz-recfoot">Cette page reste à jour toute seule.</div>
      </div>
    </div>
  );
}
