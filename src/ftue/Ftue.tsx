import { useEffect, useRef, useState } from 'react';
import './ftue.css';
import { PACKS } from '../data/packs';
import { buildInstall } from '../lib/packs';
import { importSecuriteSeed } from '../lib/securiteSeed';
import { loadNounou, saveNounou, loadRecipes, saveRecipe, saveDestinataire, saveFtueDone, saveRolesActifs, type RoleActif } from '../lib/db';
import { mergeNounouDoc, missingConduiteModeles, newToken, uid } from '../nounou/defaults';
import { normalizeDestLangue, type NounouLangue } from '../types';
import { isNative, onBackButton, minimizeApp } from '../lib/platform';

// FTUE v4 (F4, Flow FTUE) — les 7 écrans de docs/maquettes/ftue-v4.html.
// RÉEL : pilote le peuplement opt-in (collection F2, gabarits F3, pack sécurité)
// et pose les rôles activés — le tout COMMITTÉ D'UN BLOC au #welcome (un kill en
// plein parcours ne laisse AUCUNE trace, la FTUE se re-présente). Monté par le
// gate `Boot` AVANT App : aucun store n'est initialisé tant qu'elle est active.
// DÉMO (`demo`) : strictement visuel — aucun install/import, #join masqué.

type Screen = 'entry' | 'domain' | 'memory' | 'people' | 'send' | 'welcome';
type Domain = 'cuisine' | 'enfants' | 'securite';

const ORDER: Screen[] = ['entry', 'domain', 'memory', 'people', 'send', 'welcome'];

/** Fiche D : nom + langue donnés à la FTUE (name-sheet de la maquette). */
export interface PersonNaming {
  prenom: string;
  langue: NounouLangue; // fr | dr | ar | en
}
// ⚠️ Catalogue DUPLIQUÉ de `NOUNOU_LANGS` (types.ts) — D5 dit « une liste fermée ».
// La déduplication est au backlog qualité ; ici on aligne au moins le registre :
// les noms de langue s'écrivent en français (décision PO). Le drapeau `ar` (police
// arabe sur la puce) n'a plus lieu d'être : les libellés sont en lettres latines.
const LANGS: { code: NounouLangue; label: string }[] = [
  { code: 'dr', label: 'Darija' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'Arabe' },
  { code: 'en', label: 'Anglais' },
];
const langLabel = (c: NounouLangue) => LANGS.find((l) => l.code === c)?.label ?? c;

/** Peuplement réel (jamais appelé en démo) — ÉCRIT DIRECTEMENT en IndexedDB,
 * sans initialiser les stores (App n'est pas monté pendant la FTUE). Tout est
 * committé ICI, d'un bloc (fiche D comprise) : kill avant le #welcome = zéro trace. */
async function populate(
  domains: Set<Domain>,
  roles: Set<RoleActif>,
  names: Partial<Record<RoleActif, PersonNaming>>,
): Promise<void> {
  if (domains.has('cuisine')) {
    const fonds = PACKS.find((p) => p.id === 'fonds-de-depart');
    if (fonds) {
      const existing = await loadRecipes();
      const toAdd = buildInstall(fonds, existing, new Set(fonds.recettes.map((r) => r.nom)));
      for (const r of toAdd) await saveRecipe(r);
    }
  }
  // Fiche D — Cuisine nommée : destinataire réel (le modèle cuisine ne connaît que
  // fr|dr (T2 : 'dr' = darija, vocabulaire catalogue) — dr/ar → 'dr', en → 'fr' ;
  // 'ar' (arabe classique) n'existe pas encore côté Cuisine : D5 l'apportera (v:2).
  const cook = names.cuisine;
  if (roles.has('cuisine') && cook) {
    await saveDestinataire({
      id: crypto.randomUUID(),
      nom: cook.prenom,
      role: 'Cuisine', // registre neutre (lot partage T1)
      langue: normalizeDestLangue(cook.langue),
      token: newToken(),
      createdAt: Date.now(),
    });
  }
  // Doc nounou : gabarits (F3) et/ou destinataire nommé (fiche D) — une seule écriture.
  const nounouName = roles.has('nounou') ? names.nounou : undefined;
  if (domains.has('enfants') || nounouName) {
    const doc = mergeNounouDoc((await loadNounou()) ?? undefined);
    if (domains.has('enfants')) {
      const missing = missingConduiteModeles(doc.conduites);
      doc.conduites = [
        ...doc.conduites,
        ...missing.map((m, i) => ({
          id: uid(),
          titre: m.titre,
          categ: m.categ,
          urgent: m.urgent,
          aCompleter: true,
          etapes: '',
          createdAt: Date.now() + i,
        })),
      ];
    }
    if (nounouName) {
      doc.destinataires = [
        ...doc.destinataires,
        {
          id: uid(),
          prenom: nounouName.prenom,
          role: 'Nounou',
          langue: nounouName.langue,
          enfants: [],
          token: newToken(),
          createdAt: Date.now(),
        },
      ];
    }
    await saveNounou(doc);
  }
  if (domains.has('securite')) await importSecuriteSeed();
  await saveRolesActifs([...roles]);
  await saveFtueDone();
}

export default function Ftue({ demo = false, onDone }: { demo?: boolean; onDone: () => void }) {
  const [screen, setScreen] = useState<Screen>('entry');
  const [domains, setDomains] = useState<Set<Domain>>(new Set());
  const [roles, setRoles] = useState<Set<RoleActif>>(new Set());
  // Fiche D : prénom + langue par rôle (name-sheet). Absent = carte SANS nom.
  const [names, setNames] = useState<Partial<Record<RoleActif, PersonNaming>>>({});
  const [nameSheet, setNameSheet] = useState<RoleActif | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [nameLang, setNameLang] = useState<NounouLangue>('dr');
  const [busy, setBusy] = useState(false);
  const [soonMsg, setSoonMsg] = useState<string | null>(null);

  // T3 (Identité & accès) : le parcours « rejoindre » a QUITTÉ la FTUE — il vit
  // sur l'écran 2 (`Foyer.tsx`), après le compte. Son OTP faisait double emploi
  // avec l'Écran 1, et celui qui rejoint ne joue plus la FTUE du tout.

  const toastSoon = (m: string) => {
    setSoonMsg(m);
    setTimeout(() => setSoonMsg((c) => (c === m ? null : c)), 2200);
  };

  const back = () => {
    if (nameSheet) return setNameSheet(null); // la feuille d'abord (retour Android compris)
    const i = ORDER.indexOf(screen);
    if (i > 0) return setScreen(ORDER[i - 1]);
    // #entry : en démo on ferme ; en natif on minimise (jamais de kill en plein parcours).
    if (demo) return onDone();
    if (isNative) void minimizeApp();
  };
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    // B3 : App (et son handler retour) n'est PAS monté pendant la FTUE → elle
    // branche son PROPRE listener (registre feuilles sans objet ici).
    if (!isNative) return;
    return onBackButton(() => backRef.current());
  }, []);

  const toggleDomain = (d: Domain) =>
    setDomains((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  // Fiche D : tap sur un rôle NON posé → name-sheet (prénom + langue) ; tap sur un
  // rôle déjà posé → on le retire (nom compris). « Annuler » sur la feuille = carte
  // SANS nom (le cas turnover reste premier — nommage au premier partage).
  const tapRole = (r: RoleActif) => {
    if (roles.has(r)) {
      setRoles((prev) => {
        const n = new Set(prev);
        n.delete(r);
        return n;
      });
      setNames((prev) => ({ ...prev, [r]: undefined }));
      return;
    }
    setNameInput('');
    setNameLang('dr');
    setNameSheet(r);
  };
  const activateRole = (r: RoleActif, naming?: PersonNaming) => {
    setRoles((prev) => new Set(prev).add(r));
    if (naming) setNames((prev) => ({ ...prev, [r]: naming }));
    setNameSheet(null);
  };

  // #welcome → « Entrer » : COMMIT unique du peuplement, puis l'app.
  const finish = async () => {
    if (busy) return;
    if (demo) return onDone();
    setBusy(true);
    try {
      await populate(domains, roles, names);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ftue">
      {screen === 'entry' && (
        <section className="ftue-screen">
          <p className="brand-m">
            Manzil · <span className="ar">منزل</span>
          </p>
          <div className="center">
            <BrandStar />
            <h1 style={{ textAlign: 'center', fontSize: 24 }}>
              Manzil vous aide à organiser votre foyer et à briefer chacun dans sa langue.
            </h1>
          </div>
          <div className="foot">
            <button className="btn" onClick={() => setScreen('domain')}>
              Entrer
            </button>
            {/* Liens inertes tant que les URL n'existent pas (signalé au read-back). */}
            <p className="fineprint">
              En continuant, vous acceptez les conditions d’utilisation et la politique de confidentialité.
            </p>
          </div>
        </section>
      )}

      {screen === 'domain' && (
        <section className="ftue-screen">
          <span className="eyebrow">Étape 1</span>
          <div className="prog">
            <i className="on" />
            <i />
          </div>
          <h1>Par quoi voulez-vous commencer&nbsp;?</h1>
          <p className="sub">Un ou plusieurs sujets. On pré-remplit ce qu’il faut.</p>

          <DomainOpt
            sel={domains.has('cuisine')}
            onTap={() => toggleDomain('cuisine')}
            bg="var(--olive-bg)"
            icon={<IconCuisine />}
            t="La cuisine"
            s="Repas de la semaine, liste de courses par magasins"
          />
          <DomainOpt
            sel={domains.has('enfants')}
            onTap={() => toggleDomain('enfants')}
            bg="var(--majorelle-bg)"
            icon={<IconEnfants />}
            t="Les enfants"
            s="Sorties d’école, activités, qui les récupère"
          />
          <DomainOpt
            soon
            onTap={() => toastSoon('L’entretien arrive bientôt')}
            bg="var(--ochre-bg)"
            icon={<IconEntretien />}
            t="L’entretien"
            s="Ménage quotidien, grand ménage ponctuel"
          />
          <DomainOpt
            sel={domains.has('securite')}
            onTap={() => toggleDomain('securite')}
            bg="var(--rust-bg)"
            icon={<IconSecurite />}
            t="La sécurité"
            s="Numéros d’urgence, allergies à connaître"
          />
          <DomainOpt
            soon
            onTap={() => toastSoon('La vie pratique arrive bientôt')}
            bg="var(--petrol-bg)"
            icon={<IconPratique />}
            t="La vie pratique"
            s="Codes wifi, où trouver les choses"
          />
          {soonMsg && <p className="errnote" style={{ color: 'var(--muted)' }}>{soonMsg}</p>}

          <div className="foot">
            <button className="btn olive" onClick={() => setScreen('memory')}>
              Continuer
            </button>
          </div>
        </section>
      )}

      {screen === 'memory' && (
        <section className="ftue-screen planche olive">
          <Zellige />
          <span className="eyebrow dim" style={{ position: 'relative', zIndex: 2 }}>
            La mémoire de votre maison
          </span>
          <div className="pl-h" style={{ marginTop: 12 }}>
            Pour que vous n’ayez plus à répéter les choses 10 fois.
          </div>
          <div className="memfield">
            {MEM_CHIPS.map((c, i) => (
              <span key={c} className="mchip" style={{ animationDelay: `${i * 0.05}s` }}>
                {c}
              </span>
            ))}
          </div>
          <div className="foot">
            <button className="btn light" onClick={() => setScreen('people')}>
              Continuer
            </button>
          </div>
        </section>
      )}

      {screen === 'people' && (
        <section className="ftue-screen">
          <span className="eyebrow">Étape 2</span>
          <div className="prog">
            <i className="on" />
            <i className="on" />
          </div>
          <h1>Qui vous aide au quotidien&nbsp;?</h1>
          <p className="sub">
            Briefez chaque personne via sa page, dans sa langue, sur WhatsApp. Un tap pour l’ajouter.
          </p>

          <DomainOpt
            sel={roles.has('cuisine')}
            onTap={() => tapRole('cuisine')}
            bg="var(--olive-bg)"
            icon={<IconCuisine />}
            t="Cuisine"
            s="Menus de la semaine, quantités, liste de courses"
            named={names.cuisine && `✓ ${names.cuisine.prenom} · ${langLabel(names.cuisine.langue)}`}
            plus
          />
          <DomainOpt
            sel={roles.has('nounou')}
            onTap={() => tapRole('nounou')}
            bg="var(--majorelle-bg)"
            icon={<IconEnfants />}
            t="Nounou"
            s="Planning des enfants, consignes, qui les récupère"
            named={names.nounou && `✓ ${names.nounou.prenom} · ${langLabel(names.nounou.langue)}`}
            plus
          />
          <DomainOpt soon onTap={() => toastSoon('Le chauffeur arrive bientôt')} bg="var(--ochre-bg)" icon={<IconChauffeur />} t="Chauffeur" s="Trajets, horaires, adresses de rendez-vous" plus />
          <DomainOpt soon onTap={() => toastSoon('Le ménage arrive bientôt')} bg="var(--petrol-bg)" icon={<IconMenage />} t="Ménage" s="Ce qu’il faut faire chaque jour, chaque semaine" plus />
          <DomainOpt soon onTap={() => toastSoon('La page maison arrive bientôt')} bg="var(--sand-2)" icon={<IconMaison />} t="Toute la maison" s="La page que chacun consulte : wifi, sécurité, contacts" plus />
          {soonMsg && <p className="errnote" style={{ color: 'var(--muted)' }}>{soonMsg}</p>}

          <div className="foot">
            <button className="btn olive" onClick={() => setScreen('send')}>
              Continuer
            </button>
          </div>
        </section>
      )}

      {screen === 'send' && (
        <section className="ftue-screen planche ink">
          <Zellige />
          <span className="eyebrow dim" style={{ position: 'relative', zIndex: 2 }}>
            La transmission
          </span>
          <div className="send-intro">Manzil envoie à chacun un brief personnalisé, dans la langue de son choix.</div>
          <div className="steps">
            <Step n="1">Vous écrivez une fois — menus, planning, consignes — en français.</Step>
            <Step n="2">Vous envoyez sa page à chacun par WhatsApp. Rien à installer de son côté.</Step>
            <Step n="3">Chacun la consulte dans sa langue — darija, arabe, anglais.</Step>
            <Step n="4">Quelqu’un part&nbsp;? La page reste. La personne suivante en hérite.</Step>
            <Step n="+">Affichez un QR dans la maison&nbsp;: chacun accède à l’essentiel, à tout moment.</Step>
          </div>
          <div className="foot">
            <button className="btn light" onClick={() => setScreen('welcome')}>
              Terminer
            </button>
          </div>
        </section>
      )}

      {/* Fiche D — name-sheet (#people) : prénom + langue, port de la maquette.
          « Annuler » = carte SANS nom (nommage au premier partage — turnover). */}
      {nameSheet && (
        <div className="nsheet-ovl" onClick={(e) => e.target === e.currentTarget && setNameSheet(null)}>
          <div className="nsheet">
            <h2>Comment s’appelle {nameSheet === 'cuisine' ? 'votre cuisinière' : 'votre nounou'}&nbsp;?</h2>
            <div className="flabel">Son prénom</div>
            <input
              className="tf"
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ex. Fatima"
            />
            <div className="flabel">Sa langue</div>
            <div className="langrow">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  className={'lchip' + (nameLang === l.code ? ' sel' : '')}
                  onClick={() => setNameLang(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              className="btn olive"
              disabled={!nameInput.trim()}
              onClick={() => activateRole(nameSheet, { prenom: nameInput.trim(), langue: nameLang })}
            >
              Ajouter
            </button>
            <button className="skip" onClick={() => activateRole(nameSheet)}>
              Plus tard — poser la page sans nom
            </button>
          </div>
        </div>
      )}

      {screen === 'welcome' && (
        <section className="ftue-screen">
          <div className="center">
            <BrandStar />
            <h1 style={{ textAlign: 'center', fontSize: 29 }}>
              Bienvenue
              <br />à la maison.
            </h1>
            <button
              className="btn"
              style={{ width: 'auto', paddingLeft: 44, paddingRight: 44, marginTop: 24 }}
              onClick={() => void finish()}
              disabled={busy}
            >
              {busy ? 'Préparation…' : 'Entrer'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

const MEM_CHIPS = [
  'Menus de la semaine',
  'Liste de courses par magasin',
  'Qui récupère les enfants',
  'Les sorties d’école',
  'Le grand ménage du samedi',
  'Les allergies à connaître',
  'Les numéros d’urgence',
  'Le code du wifi',
  'Où trouver les choses',
];

function DomainOpt({
  sel = false,
  soon = false,
  plus = false,
  onTap,
  bg,
  icon,
  t,
  s,
  named,
}: {
  sel?: boolean;
  soon?: boolean;
  plus?: boolean;
  onTap: () => void;
  bg: string;
  icon: React.ReactNode;
  t: string;
  s: string;
  /** Fiche D : « ✓ prénom · langue » une fois la personne nommée. */
  named?: string | false;
}) {
  return (
    <button className={'opt' + (sel ? ' sel' : '') + (soon ? ' soon' : '')} onClick={onTap} aria-pressed={sel} aria-disabled={soon}>
      <span className="ic" style={{ background: bg }}>{icon}</span>
      <span className="lab">
        <span className="t" style={{ display: 'block' }}>{t}</span>
        <span className="s" style={{ display: 'block' }}>{s}</span>
        {named && <span className="named">{named}</span>}
      </span>
      {soon ? <span className="soonbadge">Bientôt</span> : <span className="mark">{sel ? '✓' : plus ? '+' : '✓'}</span>}
    </button>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="step">
      <span className={'num' + (n === '+' ? ' plus' : '')}>{n}</span>
      <p>{children}</p>
    </div>
  );
}

function BrandStar() {
  return (
    <svg className="brandstar" viewBox="0 0 100 100">
      <rect x="22" y="22" width="56" height="56" fill="none" stroke="var(--olive)" strokeWidth="3.5" />
      <rect x="22" y="22" width="56" height="56" fill="none" stroke="var(--saffron)" strokeWidth="3.5" transform="rotate(45 50 50)" />
    </svg>
  );
}

function Zellige() {
  return (
    <svg className="zellige" viewBox="0 0 100 100">
      <rect x="16" y="16" width="68" height="68" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="16" y="16" width="68" height="68" fill="none" stroke="#fff" strokeWidth="2" transform="rotate(45 50 50)" />
    </svg>
  );
}

// ── Icônes (tracés de la maquette) ─────────────────────────────────────────────
function IconCuisine() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 13h14M6 13c0-4 2.7-6 6-6s6 2 6 6M12 4v1.5" stroke="#3C5A1E" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconEnfants() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4.2" stroke="#3A34B4" strokeWidth="1.6" />
      <path d="M11 20.5l1-4M13 20.5l-1-4" stroke="#3A34B4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconEntretien() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 20l9-9-3-3-9 9v3zM13 8l3 3" stroke="#B07314" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function IconSecurite() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 4v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V7z" stroke="#9E3B2C" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 12l1.8 1.8L15 10" stroke="#9E3B2C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconPratique() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5a7 7 0 0 1 14 0M8 15a4 4 0 0 1 8 0" stroke="#1F5E5B" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.3" fill="#1F5E5B" />
    </svg>
  );
}
function IconChauffeur() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="6" rx="2" stroke="#B07314" strokeWidth="1.6" />
      <circle cx="8" cy="17" r="1.4" stroke="#B07314" strokeWidth="1.3" />
      <circle cx="16" cy="17" r="1.4" stroke="#B07314" strokeWidth="1.3" />
    </svg>
  );
}
function IconMenage() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3v9M8 12h8l-1 8H9z" stroke="#1F5E5B" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function IconMaison() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 11l8-6 8 6M6 10v9h12v-9" stroke="#8a7d5f" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
