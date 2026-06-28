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
import { MomentIcon, IconChevron, IconChevronLeft, IconPhone, IconAlert } from './icons';
import { CONDUITE_LABEL, type Conduite, type Enfant, type NounouContact, type NumeroUrgence, type ReglePerm } from '../types';
import { NOUNOU_LANGS } from '../types';
import '../cuisine/cuisine.css';
import './nounou.css';

// Page reçue (lecture seule) — maquette vue-nounou-v2.
// Atterrit sur aujourd'hui ; bande de jours ; fiche du jour + bandeau période ;
// 3 accès d'un seul niveau (Que faire si… / Qui appeler / Les enfants).
// Hors-ligne (cache PWA). RTL + Naskh si langue arabe.
// La voix « Mot de Maman » et le contenu Conduites/Contacts se remplissent aux
// lots 2-3 (le payload les porte dès qu'ils existent).

type Screen = 'home' | 'conduites' | 'appeler' | 'enfants';

export default function NounouEspaceView({ espace }: { espace: NounouEspace }) {
  const doc = espace.doc;
  const [date, setDate] = useState<string>(() => todayISO());
  const [screen, setScreen] = useState<Screen>('home');

  const rtl = NOUNOU_LANGS.find((l) => l.code === espace.langue)?.rtl ?? false;
  const enfantsLabel = doc.enfants.map((e) => e.prenom).join(' & ');

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={'cz' + (rtl ? ' nz-rtl' : '')}>
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
        {screen === 'home' && (
          <HomeScreen doc={doc} date={date} setDate={setDate} go={go} publishedAt={espace.publishedAt} />
        )}
        {screen === 'conduites' && <ConduitesScreen conduites={doc.conduites} onBack={() => go('home')} />}
        {screen === 'appeler' && (
          <AppelerScreen
            numeros={doc.urgence.numeros}
            contacts={doc.urgence.contacts}
            regles={doc.urgence.regles}
            onBack={() => go('home')}
          />
        )}
        {screen === 'enfants' && <EnfantsScreen enfants={doc.enfants} onBack={() => go('home')} />}
      </div>
    </div>
  );
}

function Back({ onBack }: { onBack: () => void }) {
  return (
    <button className="nz-rsback" onClick={onBack}>
      <IconChevronLeft size={20} />
      Retour
    </button>
  );
}

function HomeScreen({
  doc,
  date,
  setDate,
  go,
  publishedAt,
}: {
  doc: NounouEspace['doc'];
  date: string;
  setDate: (d: string) => void;
  go: (s: Screen) => void;
  publishedAt: string;
}) {
  const week = weekDaysISO(date);
  const entries = projectDay(doc, date);
  const per = activePeriode(doc, date);
  const enfantById = new Map(doc.enfants.map((e) => [e.id, e]));
  const isToday = date === todayISO();

  const tagsFor = (e: DayEntry): Enfant[] => {
    if (e.enfants.length === 0 || e.enfants.length >= doc.enfants.length) return [];
    return e.enfants.map((id) => enfantById.get(id)).filter((k): k is Enfant => !!k);
  };

  return (
    <>
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

      {/* 3 accès d'un seul niveau */}
      <div className="nz-rentries">
        <button className="nz-rentry" onClick={() => go('conduites')}>
          <span className="rei c1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <span className="rew">
            <span className="reh">Que faire si…</span>
            <span className="resub">Fièvre, blessure, étouffement…</span>
          </span>
          <span className="rec">
            <IconChevron size={20} />
          </span>
        </button>

        <button className="nz-rentry" onClick={() => go('appeler')}>
          <span className="rei c2">
            <IconPhone size={22} />
          </span>
          <span className="rew">
            <span className="reh">Qui appeler</span>
            <span className="resub">Urgences et contacts</span>
          </span>
          <span className="rec">
            <IconChevron size={20} />
          </span>
        </button>

        <button className="nz-rentry" onClick={() => go('enfants')}>
          <span className="rei c3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.2" />
              <circle cx="17" cy="9" r="2.6" />
              <path d="M3.5 20a5.5 5.5 0 0 1 11 0M15 20a4.5 4.5 0 0 1 5.5-4.4" />
            </svg>
          </span>
          <span className="rew">
            <span className="reh">Les enfants</span>
            <span className="resub">Allergies, habitudes, médecin</span>
          </span>
          <span className="rec">
            <IconChevron size={20} />
          </span>
        </button>
      </div>

      <div className="nz-recfoot">
        <span className="upd">
          <span className="fdot" />
          Mis à jour par Maman {timeAgo(publishedAt)}
        </span>
        <span>Cette page reste à jour toute seule.</span>
      </div>
    </>
  );
}

function ConduitesScreen({ conduites, onBack }: { conduites: Conduite[]; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const ready = conduites.filter((c) => !c.aCompleter);

  return (
    <div className="nz-rscreen">
      <Back onBack={onBack} />
      <div className="nz-rstitle">Que faire si…</div>
      <div className="nz-rssub">Les consignes de Maman. Sa voix est en haut de chaque consigne.</div>
      {ready.length === 0 ? (
        <div className="nz-dayempty">Aucune consigne partagée pour l’instant.</div>
      ) : (
        <div className="nz-acc">
          {ready.map((c) => {
            const steps = c.etapes.split('\n').map((s) => s.trim()).filter(Boolean);
            const isOpen = open === c.id;
            return (
              <div key={c.id} className={'nz-accitem' + (isOpen ? ' open' : '')}>
                <button className="nz-acchead" onClick={() => setOpen(isOpen ? null : c.id)}>
                  <span className={'ai' + (c.urgent ? ' urg' : '')}>
                    <IconAlert size={18} />
                  </span>
                  <span className="aw">
                    <span className="an">{c.titre}</span>
                    <span className="asub">
                      <span>{CONDUITE_LABEL[c.categ]}</span>
                      {c.urgent && <span className="urgtag">Urgent</span>}
                      {c.voix && <span className="voicetag">Voix de Maman</span>}
                    </span>
                  </span>
                  <span className="achev">
                    <IconChevron size={20} />
                  </span>
                </button>
                <div className="nz-accbody">
                  {c.urgent && <div className="nz-urgnote">Urgence : agir d’abord, prévenir ensuite.</div>}
                  {c.voix && (
                    <div className="nz-accvoice">
                      <audio src={c.voix} controls style={{ width: '100%' }} />
                    </div>
                  )}
                  {c.quiAppeler && (
                    <div className="nz-callrow">
                      <IconPhone size={18} />
                      <div>
                        <div className="cl">Qui appeler</div>
                        <div className="cv">{c.quiAppeler}</div>
                      </div>
                    </div>
                  )}
                  {steps.length > 0 && (
                    <ol className="nz-rsteps">
                      {steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AppelerScreen({
  numeros,
  contacts,
  regles,
  onBack,
}: {
  numeros: NumeroUrgence[];
  contacts: NounouContact[];
  regles: ReglePerm[];
  onBack: () => void;
}) {
  return (
    <div className="nz-rscreen">
      <Back onBack={onBack} />
      <div className="nz-rstitle">Qui appeler</div>

      {numeros.length > 0 && (
        <>
          <div className="nz-callsec">En cas d’urgence</div>
          <div className="nz-ccard">
            {numeros.map((n) => (
              <a key={n.numero} className="nz-crow" href={`tel:${n.numero}`}>
                <span className="nz-cav num">{n.numero}</span>
                <span className="nz-cw">
                  <span className="nz-cnm">{n.label}</span>
                  <span className="nz-ccr">{n.aVerifier ? 'À vérifier' : ''}</span>
                </span>
                <span className="nz-cbtn urg">
                  <IconPhone size={18} />
                </span>
              </a>
            ))}
          </div>
        </>
      )}

      <div className="nz-callsec">Contacts</div>
      {contacts.length === 0 ? (
        <div className="nz-dayempty">Pas encore de contact ajouté.</div>
      ) : (
        <div className="nz-ccard">
          {contacts.map((c) => (
            <a key={c.id} className="nz-crow" href={`tel:${c.tel}`}>
              <span className="nz-cav">{c.nom.charAt(0).toUpperCase()}</span>
              <span className="nz-cw">
                <span className="nz-cnm">{c.nom}</span>
                {c.role && <span className="nz-ccr">{c.role}</span>}
              </span>
              <span className="nz-cbtn">
                <IconPhone size={16} />
              </span>
            </a>
          ))}
        </div>
      )}

      {regles.length > 0 && (
        <>
          <div className="nz-callsec">Règles &amp; autorisations</div>
          <div className="nz-card" style={{ padding: '4px 15px' }}>
            {regles.map((r) => (
              <div key={r.id} className="nz-permrow">
                <span className={'pm ' + (r.permis ? 'ok' : 'no')}>{r.permis ? '✓' : '✗'}</span>
                <span>{r.texte}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EnfantsScreen({ enfants, onBack }: { enfants: Enfant[]; onBack: () => void }) {
  return (
    <div className="nz-rscreen">
      <Back onBack={onBack} />
      <div className="nz-rstitle">Les enfants</div>
      {enfants.map((e) => {
        const f = e.fiche;
        return (
          <div key={e.id} className="nz-kidblock">
            <div className="nz-kidhd">
              <div className="nz-kidav" style={{ background: e.couleur }}>
                {e.initiale}
              </div>
              <div className="nz-kidnm">{e.prenom}</div>
            </div>
            {f?.allergies && (
              <div className="nz-kidalert">
                <span className="ka">
                  <IconAlert size={19} />
                </span>
                <span className="kt">
                  <span className="nz-allerg">{f.allergies}</span>
                </span>
              </div>
            )}
            {f?.traitement && (
              <div className="nz-kidkv">
                <div className="kk">Traitement</div>
                <div className="kvv">{f.traitement}</div>
              </div>
            )}
            {f?.medecin && (
              <div className="nz-kidkv">
                <div className="kk">Médecin</div>
                <div className="kvv">{f.medecin}</div>
              </div>
            )}
            {f?.groupe && (
              <div className="nz-kidkv">
                <div className="kk">Groupe</div>
                <div className="kvv">{f.groupe}</div>
              </div>
            )}
            {f?.habitudes && (
              <div className="nz-kidkv">
                <div className="kk">Habitudes</div>
                <div className="kvv">{f.habitudes}</div>
              </div>
            )}
            {!f && <div className="nz-emptyline">Fiche à compléter par le parent.</div>}
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'à l’instant';
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}
