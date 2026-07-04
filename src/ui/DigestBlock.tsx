// Bloc d'envoi PARTAGÉ (L3-1b) : portées (chips, une active) + digest WhatsApp
// éditable. Réutilisé par les feuilles d'envoi Cuisine (vert) et Nounou (violet).
// La portée ne change QUE le message — l'appelant recompose le digest à chaque
// changement de portée ; l'édition manuelle prime pour l'envoi.

export interface ScopeOption {
  key: string;
  label: string;
}

export function DigestBlock({
  role,
  scopes,
  active,
  onScope,
  value,
  onChange,
}: {
  role: 'cuisine' | 'nounou';
  scopes: ScopeOption[];
  active: string;
  onScope: (key: string) => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={'mz-digest ' + (role === 'cuisine' ? 'grn' : 'vio')}>
      <div className="mz-dg-lab">Quoi envoyer</div>
      <div className="mz-scope">
        {scopes.map((s) => (
          <button
            key={s.key}
            className={'mz-sc' + (active === s.key ? ' on' : '')}
            aria-pressed={active === s.key}
            onClick={() => onScope(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mz-dg-lab">Son message — modifiable avant envoi</div>
      <textarea
        className="mz-wa"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        aria-label="Message WhatsApp à envoyer"
      />
    </div>
  );
}
