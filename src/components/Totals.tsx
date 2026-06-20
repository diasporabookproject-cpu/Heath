import type { Feu, Macros } from '../types';

interface Props {
  totals: Macros;
  cibleKcal: number;
  feux: { kcal: Feu; proteines: Feu; calcium: Feu };
}

/** Les 3 feux d'une journée : kcal (vs cible), protéines, calcium (mis en avant). */
export default function Totals({ totals, cibleKcal, feux }: Props) {
  return (
    <div className="totals">
      <div className={'stat stat--' + feux.kcal}>
        <div className="stat__val">{totals.kcal}</div>
        <div className="stat__label">kcal</div>
        <div className="stat__sub">cible {cibleKcal}</div>
      </div>
      <div className={'stat stat--' + feux.proteines}>
        <div className="stat__val">{totals.prot}</div>
        <div className="stat__label">prot.</div>
        <div className="stat__sub">g</div>
      </div>
      <div className={'stat stat--calcium stat--' + feux.calcium}>
        <div className="stat__val">{totals.calcium}</div>
        <div className="stat__label">calcium</div>
        <div className="stat__sub">mg</div>
      </div>
    </div>
  );
}
