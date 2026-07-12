import { useEffect, useRef, useState } from 'react';
import './ftue.css';
import { PACKS } from '../data/packs';
import { buildInstall } from '../lib/packs';
import { importSecuriteSeed } from '../lib/securiteSeed';
import { loadNounou, saveNounou, loadRecipes, saveRecipe, saveFtueDone, saveRolesActifs, type RoleActif } from '../lib/db';
import { mergeNounouDoc, missingConduiteModeles, uid } from '../nounou/defaults';
import { sendOtp, verifyOtp, acceptInvite } from '../lib/auth';
import { isValidEmail, isValidOtp, normalizeOtp } from '../lib/otp';
import { isNative, onBackButton, minimizeApp } from '../lib/platform';

// FTUE v4 (F4, Flow FTUE) — les 7 écrans de docs/maquettes/ftue-v4.html.
// RÉEL : pilote le peuplement opt-in (collection F2, gabarits F3, pack sécurité)
// et pose les rôles activés — le tout COMMITTÉ D'UN BLOC au #welcome (un kill en
// plein parcours ne laisse AUCUNE trace, la FTUE se re-présente). Monté par le
// gate `Boot` AVANT App : aucun store n'est initialisé tant qu'elle est active.
// DÉMO (`demo`) : strictement visuel — aucun install/import, #join masqué.

type Screen = 'entry' | 'join' | 'domain' | 'memory' | 'people' | 'send' | 'welcome';
type Domain = 'cuisine' | 'enfants' | 'securite';

const ORDER: Screen[] = ['entry', 'domain', 'memory', 'people', 'send', 'welcome'];

/** Peuplement réel (jamais appelé en démo) — ÉCRIT DIRECTEMENT en IndexedDB,
 * sans initialiser les stores (App n'est pas monté pendant la FTUE). */
async function populate(domains: Set<Domain>, roles: Set<RoleActif>): Promise<void> {
  if (domains.has('cuisine')) {
    const fonds = PACKS.find((p) => p.id === 'fonds-de-depart');
    if (fonds) {
      const existing = await loadRecipes();
      const toAdd = buildInstall(fonds, existing, new Set(fonds.recettes.map((r) => r.nom)));
      for (const r of toAdd) await saveRecipe(r);
    }
  }
  if (domains.has('enfants')) {
    const doc = mergeNounouDoc((await loadNounou()) ?? undefined);
    const missing = missingConduiteModeles(doc.conduites);
    if (missing.length > 0) {
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
  const [busy, setBusy] = useState(false);
  const [soonMsg, setSoonMsg] = useState<string | null>(null);

  // #join (réel seulement) : code → e-mail → code 6 chiffres → accept_invite.
  const [joinCode, setJoinCode] = useState('');
  const [joinStep, setJoinStep] = useState<'code' | 'email' | 'otp'>('code');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');

  const toastSoon = (m: string) => {
    setSoonMsg(m);
    setTimeout(() => setSoonMsg((c) => (c === m ? null : c)), 2200);
  };

  const back = () => {
    if (screen === 'join') return setScreen('entry');
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
  const toggleRole = (r: RoleActif) =>
    setRoles((prev) => {
      const n = new Set(prev);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });

  // #welcome → « Entrer » : COMMIT unique du peuplement, puis l'app.
  const finish = async () => {
    if (busy) return;
    if (demo) return onDone();
    setBusy(true);
    try {
      await populate(domains, roles);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  // #join : rejoint un foyer réel via les briques EXISTANTES (OTP → RPC accept_invite).
  // Succès → ftueDone + RELOAD : au reboot, useSync fait l'adoption/pull standard
  // (fenêtre d'adoption = push interdit — F5a-①). Aucun peuplement local.
  const joinSubmitCode = () => {
    if (!joinCode.trim()) return;
    setErr('');
    setJoinStep('email');
  };
  const joinSendOtp = async () => {
    if (!isValidEmail(email)) return setErr('E-mail invalide.');
    setBusy(true);
    setErr('');
    const { error } = await sendOtp(email);
    setBusy(false);
    if (error) return setErr(error);
    setJoinStep('otp');
  };
  const joinVerify = async () => {
    if (!isValidOtp(otp)) return setErr('Entre le code à 6 chiffres reçu par e-mail.');
    setBusy(true);
    setErr('');
    const v = await verifyOtp(email, otp);
    if (v.error) {
      setBusy(false);
      return setErr('Code incorrect ou expiré.');
    }
    const { error } = await acceptInvite(joinCode.trim());
    if (error) {
      setBusy(false);
      return setErr(error);
    }
    await saveFtueDone();
    window.location.reload(); // le contenu vient du foyer rejoint (adoption au boot)
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
            {!demo && (
              <button className="btn line" style={{ marginTop: 10 }} onClick={() => setScreen('join')}>
                Rejoindre un foyer existant
              </button>
            )}
            {/* Liens inertes tant que les URL n'existent pas (signalé au read-back). */}
            <p className="fineprint">
              En continuant, vous acceptez les conditions d’utilisation et la politique de confidentialité.
            </p>
          </div>
        </section>
      )}

      {screen === 'join' && (
        <section className="ftue-screen">
          <span className="eyebrow">Rejoindre</span>
          {joinStep === 'code' && (
            <>
              <h1 style={{ marginTop: 14 }}>
                Entrez le code
                <br />
                du foyer.
              </h1>
              <p className="sub">Demandez-le à la personne qui gère déjà le foyer.</p>
              <input
                className="tf"
                type="text"
                autoCapitalize="characters"
                placeholder="Ex. RIAD4821XZ"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              {err && <p className="errnote">{err}</p>}
              <div className="foot">
                <button className="btn olive" onClick={joinSubmitCode} disabled={busy || !joinCode.trim()}>
                  Rejoindre le foyer
                </button>
                <button className="skip" onClick={() => setScreen('entry')}>
                  Retour
                </button>
              </div>
            </>
          )}
          {joinStep === 'email' && (
            <>
              <h1 style={{ marginTop: 14 }}>Votre e-mail.</h1>
              <p className="sub">
                Pour vous reconnaître dans le foyer. On vous envoie un code à 6 chiffres — pas de mot de passe.
              </p>
              <input
                className="tf"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {err && <p className="errnote">{err}</p>}
              <div className="foot">
                <button className="btn olive" onClick={() => void joinSendOtp()} disabled={busy || !email.trim()}>
                  {busy ? 'Envoi…' : 'Recevoir mon code'}
                </button>
                <button className="skip" onClick={() => setJoinStep('code')}>
                  Retour
                </button>
              </div>
            </>
          )}
          {joinStep === 'otp' && (
            <>
              <h1 style={{ marginTop: 14 }}>Le code reçu.</h1>
              <p className="sub">On a envoyé un code à 6 chiffres à {email}.</p>
              <input
                className="tf"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(normalizeOtp(e.target.value))}
              />
              {err && <p className="errnote">{err}</p>}
              <div className="foot">
                <button className="btn olive" onClick={() => void joinVerify()} disabled={busy || !isValidOtp(otp)}>
                  {busy ? 'Vérification…' : 'Rejoindre le foyer'}
                </button>
                <button className="skip" onClick={() => setJoinStep('email')}>
                  Changer d’e-mail
                </button>
              </div>
            </>
          )}
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
            Briefez chaque personne via sa page, dans sa langue, sur WhatsApp. Un tap pour poser sa page —
            son prénom viendra au premier envoi.
          </p>

          <DomainOpt
            sel={roles.has('cuisine')}
            onTap={() => toggleRole('cuisine')}
            bg="var(--olive-bg)"
            icon={<IconCuisine />}
            t="Cuisine"
            s="Menus de la semaine, quantités, liste de courses"
            plus
          />
          <DomainOpt
            sel={roles.has('nounou')}
            onTap={() => toggleRole('nounou')}
            bg="var(--majorelle-bg)"
            icon={<IconEnfants />}
            t="Nounou"
            s="Planning des enfants, consignes, qui les récupère"
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
}: {
  sel?: boolean;
  soon?: boolean;
  plus?: boolean;
  onTap: () => void;
  bg: string;
  icon: React.ReactNode;
  t: string;
  s: string;
}) {
  return (
    <button className={'opt' + (sel ? ' sel' : '') + (soon ? ' soon' : '')} onClick={onTap} aria-pressed={sel} aria-disabled={soon}>
      <span className="ic" style={{ background: bg }}>{icon}</span>
      <span className="lab">
        <span className="t" style={{ display: 'block' }}>{t}</span>
        <span className="s" style={{ display: 'block' }}>{s}</span>
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
