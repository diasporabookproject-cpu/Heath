import { useState } from 'react';
import { useNounou } from './useNounou';
import { projectDay, activePeriode, type DayEntry } from './projection';
import {
  todayISO,
  dayTitleISO,
  weekDaysISO,
  dayNumberISO,
  addDaysISO,
  SHORT,
} from './dates';
import { MomentIcon, IconChevron, IconChevronLeft, IconPlusThin } from './icons';
import type { Enfant, Moment } from '../types';
import AddChooseSheet from './AddChooseSheet';
import MomentSheet from './MomentSheet';
import PonctuelSheet from './PonctuelSheet';
import EventSheet from './EventSheet';
import ManageSheet from './ManageSheet';
import PeriodeSheet from './PeriodeSheet';
import AddPeriodeSheet from './AddPeriodeSheet';

type SheetState =
  | { k: 'choose' }
  | { k: 'moment'; periodeId?: string; periodeNom?: string; edit?: Moment }
  | { k: 'ponctuel' }
  | { k: 'event'; entry: DayEntry }
  | { k: 'manage' }
  | { k: 'periode'; id: string }
  | { k: 'addperiode' }
  | null;

export default function JourneeView({ toast }: { toast: (m: string) => void }) {
  const doc = useNounou((s) => s.doc);
  const [date, setDate] = useState<string>(() => todayISO());
  const [sheet, setSheet] = useState<SheetState>(null);

  const week = weekDaysISO(date);
  const entries = projectDay(doc, date);
  const per = activePeriode(doc, date);
  const enfantById = new Map(doc.enfants.map((e) => [e.id, e]));
  const isToday = date === todayISO();

  /** Initiales à afficher : seulement si la ligne concerne un sous-ensemble strict. */
  const tagsFor = (e: DayEntry): Enfant[] => {
    if (e.enfants.length === 0 || e.enfants.length >= doc.enfants.length) return [];
    return e.enfants.map((id) => enfantById.get(id)).filter((k): k is Enfant => !!k);
  };

  return (
    <>
      {/* Bande de jours + navigation semaine */}
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
          <div className="nz-dayempty">
            Rien de prévu ce jour.
            <br />
            Ajoute un moment au rythme, ou un ponctuel.
          </div>
        ) : (
          <div className="nz-shcard">
            {entries.map((e) => {
              const kids = tagsFor(e);
              const sub = [e.lieu, e.qui ? `avec ${e.qui}` : ''].filter(Boolean).join(' · ');
              return (
                <button key={e.id} className="nz-item" onClick={() => setSheet({ k: 'event', entry: e })}>
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
                  <span className="chev">
                    <IconChevron size={18} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="nz-addbar">
        <button className="nz-add1" onClick={() => setSheet({ k: 'choose' })}>
          <IconPlusThin size={17} />
          Ajouter
        </button>
        <button className="nz-add2" onClick={() => setSheet({ k: 'manage' })}>
          Rythme &amp; périodes
        </button>
      </div>

      {/* ── Sheets ── */}
      {sheet?.k === 'choose' && (
        <AddChooseSheet
          date={date}
          inPeriode={!!per}
          periodeNom={per?.nom}
          onMoment={() => setSheet({ k: 'moment', periodeId: per?.id, periodeNom: per?.nom })}
          onPonctuel={() => setSheet({ k: 'ponctuel' })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.k === 'moment' && (
        <MomentSheet
          periodeId={sheet.periodeId}
          periodeNom={sheet.periodeNom}
          edit={sheet.edit}
          onClose={() => setSheet(null)}
          toast={toast}
        />
      )}

      {sheet?.k === 'ponctuel' && (
        <PonctuelSheet date={date} onClose={() => setSheet(null)} toast={toast} />
      )}

      {sheet?.k === 'event' && (
        <EventSheet
          date={date}
          entry={sheet.entry}
          periodeId={sheet.entry.source === 'periode' ? per?.id : undefined}
          periodeNom={per?.nom}
          onEditMoment={(m, periodeId) =>
            setSheet({ k: 'moment', edit: m, periodeId, periodeNom: per?.nom })
          }
          onClose={() => setSheet(null)}
          toast={toast}
        />
      )}

      {sheet?.k === 'manage' && (
        <ManageSheet
          onAddMoment={() => setSheet({ k: 'moment' })}
          onEditMoment={(m) => setSheet({ k: 'moment', edit: m })}
          onAddPeriode={() => setSheet({ k: 'addperiode' })}
          onOpenPeriode={(id) => setSheet({ k: 'periode', id })}
          onClose={() => setSheet(null)}
          toast={toast}
        />
      )}

      {sheet?.k === 'periode' && (
        <PeriodeSheet
          id={sheet.id}
          onAddMoment={(periodeId) => {
            const p = doc.periodes.find((x) => x.id === periodeId);
            setSheet({ k: 'moment', periodeId, periodeNom: p?.nom });
          }}
          onEditMoment={(m, periodeId) => {
            const p = doc.periodes.find((x) => x.id === periodeId);
            setSheet({ k: 'moment', edit: m, periodeId, periodeNom: p?.nom });
          }}
          onClose={() => setSheet(null)}
          toast={toast}
        />
      )}

      {sheet?.k === 'addperiode' && (
        <AddPeriodeSheet
          onClose={() => setSheet(null)}
          onCreated={(id) => setSheet({ k: 'periode', id })}
          toast={toast}
        />
      )}
    </>
  );
}
