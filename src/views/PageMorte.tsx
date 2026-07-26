import './pagemorte.css';

/**
 * LA PAGE MORTE (lot Identité & accès, T5) — la dernière chose que le personnel voit.
 * Maquette : `docs/maquettes/identite-page-morte-chargements.html`.
 *
 * 🔴 OPTION A (décision PO), et pourquoi : l'option B affichait UNE phrase, dans la
 * langue de la personne — mais elle exigeait une « pierre tombale », une ligne
 * résiduelle survivant à la révocation. Or les deux policies de `0011` portent
 * `exists (select 1 from public.espaces …)` : une ligne résiduelle rendrait la
 * jointure VRAIE, donc un lien révoqué redeviendrait lisible ET inscriptible sur les
 * coches. B était un recul de sécurité — A ne suppose rien et ne garde rien.
 *
 * Deux langues, pas quatre : ce sont exactement celles que le produit publie
 * (`Espace.langue: 'fr' | 'ar'`, la darija voyageant en `'ar'` — contrat de fil v:1).
 * Ajouter l'anglais ou l'arabe standard serait s'adresser à quelqu'un que l'app
 * n'a jamais pu servir.
 *
 * UN écran pour DEUX causes (compte supprimé · lien révoqué) : de son côté c'est
 * indistinguable, et tant mieux — on ne lui explique pas les affaires du foyer.
 * « Hors-ligne » reste DISTINCT : là, le lien est vivant et le geste utile existe
 * (revenir avec du réseau) ; le confondre avec la mort ferait abandonner pour rien.
 *
 * Sans action, volontairement : depuis ce lien elle ne peut rien faire, et un bouton
 * mort serait pire que pas de bouton.
 */

const IconTombe = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
    <path d="M2 21h18" />
    <circle cx="13" cy="12" r="1" />
  </svg>
);

const IconNuageBarre = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.5 19H7a4 4 0 0 1-.6-7.96" />
    <path d="M9 6.2A5 5 0 0 1 17.9 9.3" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
);

/** Les deux lignes, par cause et par langue. Le darija est un BROUILLON (réserve UI). */
const TEXTES = {
  morte: {
    ar: { m1: 'هاد الصفحة ما بقاتش خدامة', m2: 'طلبي لينك جديد من الدار' },
    fr: { m1: 'Cette page n’est plus disponible', m2: 'Demandez un nouveau lien' },
  },
  horsligne: {
    ar: { m1: 'ما كاينش الأنترنت', m2: 'حاولي من بعد، فاش يرجع الريزو' },
    fr: { m1: 'Pas de connexion', m2: 'Réessayez dès que le réseau revient' },
  },
} as const;

export default function PageMorte({ cause }: { cause: 'morte' | 'horsligne' }) {
  const t = TEXTES[cause];
  return (
    <div className="pm">
      <div className="dead">
        <div className="dmark">{cause === 'morte' ? <IconTombe /> : <IconNuageBarre />}</div>
        {/* La darija d'abord : c'est la langue de la majorité du personnel. */}
        <div className="dl rtl" lang="ar" dir="rtl">
          <div className="m1">{t.ar.m1}</div>
          <div className="m2">{t.ar.m2}</div>
        </div>
        <div className="dl" lang="fr">
          <div className="m1">{t.fr.m1}</div>
          <div className="m2">{t.fr.m2}</div>
        </div>
      </div>
      <div className="grow" />
      <div className="brandfoot">Manzil</div>
    </div>
  );
}
