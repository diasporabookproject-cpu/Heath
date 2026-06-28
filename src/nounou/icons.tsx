import type { MomentType } from '../types';

// Icônes des moments — tracés portés fidèlement de la maquette admin.

const PATHS: Record<MomentType, string> = {
  reveil:
    'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19',
  ecole: 'M3 21h18M5 21V9l7-4 7 4v12M9 21v-5h6v5',
  repas: 'M5 3v7a2 2 0 0 0 2 2V3M7 3v18M18 3c-1.4 0-2.4 1.6-2.4 4s1 4 2.4 4M18 11v10',
  sieste: 'M21 12.8A8 8 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z',
  gouter: 'M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5zM16 9h2a2 2 0 1 1 0 4h-2',
  bain: 'M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z',
  sortie: 'M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z',
  sante: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z',
  coucher: 'M3 18v-6a2 2 0 0 1 2-2h8a4 4 0 0 1 4 4v4M3 14h18M3 18v2M21 18v2',
  activite: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0 M12 4a8 8 0 0 0 0 16M4 12h16',
  autre: 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
};

export function MomentIcon({ type, size = 16 }: { type: MomentType; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[type] ?? PATHS.activite} />
    </svg>
  );
}

export function IconChevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconChevronLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconPlusThin({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconTrash({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
