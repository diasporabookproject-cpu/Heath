import type { Lang } from '../lib/cuisineLabels';
import type { SecuritePublic } from '../lib/espace';

// Rendu des consignes Sécurité dans l'espace d'un destinataire (lecture seule).
// numéros en tête, puis procédures, puis gestes. Multilingue (RTL si darija).

const RANK: Record<string, number> = { numeros: 0, procedure: 1, gestes: 2 };

function fixDuration(e: React.SyntheticEvent<HTMLAudioElement>) {
  const a = e.currentTarget;
  if (a.duration === Infinity || Number.isNaN(a.duration)) {
    const onUpdate = () => {
      a.removeEventListener('timeupdate', onUpdate);
      a.currentTime = 0;
    };
    a.addEventListener('timeupdate', onUpdate);
    a.currentTime = 1e7;
  }
}

function lines(s: string): string[] {
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function SecuriteSection({
  fiches,
  lang,
}: {
  fiches: SecuritePublic[];
  lang: Lang;
}) {
  const ar = lang === 'ar';
  const sorted = [...fiches].sort((a, b) => (RANK[a.type] ?? 9) - (RANK[b.type] ?? 9));

  return (
    <div dir={ar ? 'rtl' : 'ltr'}>
      <div className="lib-section__title" style={{ color: 'var(--rouge)' }}>
        🛡️ {ar ? 'السلامة' : 'Sécurité'}
      </div>
      {sorted.map((f, i) => {
        const titre = (ar ? f.titre_ar : f.titre) || f.titre;
        const contenu = (ar ? f.contenu_ar : f.contenu) || f.contenu;
        const ls = lines(contenu);
        return (
          <div className="card secu" key={i}>
            <div className="secu__titre">{titre}</div>

            {f.type === 'numeros' && (
              <div className="secu__numeros">
                {ls.map((l, j) => {
                  const idx = l.indexOf(':');
                  const label = idx >= 0 ? l.slice(0, idx).trim() : l;
                  const num = idx >= 0 ? l.slice(idx + 1).trim() : '';
                  const tel = num.replace(/[^\d+]/g, '');
                  return (
                    <div className="secu__num" key={j}>
                      <span>{label}</span>
                      {tel ? <a href={`tel:${tel}`}>{num}</a> : <span className="secu__muted">{num}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {f.type === 'procedure' && (
              <ol className="secu__steps">
                {ls.map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
              </ol>
            )}

            {f.type === 'gestes' && (
              <ul className="secu__gestes">
                {ls.map((l, j) => {
                  const interdit = l.startsWith('-');
                  const permis = l.startsWith('+');
                  const txt = interdit || permis ? l.slice(1).trim() : l;
                  return (
                    <li key={j} className={interdit ? 'secu--interdit' : permis ? 'secu--permis' : ''}>
                      <span className="secu__icon">{interdit ? '🚫' : permis ? '✅' : '•'}</span>
                      {txt}
                    </li>
                  );
                })}
              </ul>
            )}

            {f.a && (
              <div className="voice-note__row" style={{ marginTop: 8 }}>
                <span className="voice-note__title">🔊 {ar ? 'ملاحظة صوتية' : 'Note vocale'}</span>
                <audio src={f.a} controls className="voice-note__audio" onLoadedMetadata={fixDuration} preload="metadata" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
