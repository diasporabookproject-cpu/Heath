// Icônes inline reprises de maquette-cuisine.html (stroke currentColor).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconGear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
);

export const IconChevL = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <polyline points="15 18 9 12 15 6" />
  </Svg>
);

export const IconChevR = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const IconSpark = (p: P) => (
  <Svg {...p}>
    <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
  </Svg>
);

export const IconStar = (p: P) => (
  <Svg {...p}>
    <path d="M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
  </Svg>
);

export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
);

export const IconLockOpen = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </Svg>
);

export const IconShuffle = (p: P) => (
  <Svg {...p}>
    <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M21 16v5h-5M16 14l5 5M3 8V3h5M10 10 3 3" />
  </Svg>
);

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);

export const IconChevRight = (p: P) => (
  <Svg {...p}>
    <polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg strokeWidth={2.4} {...p}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const IconPlay = ({ size = 18, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l3 2" />
  </Svg>
);

export const IconBack = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <polyline points="15 18 9 12 15 6" />
  </Svg>
);

export const IconShareUp = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
  </Svg>
);

export const IconLoader = (p: P) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
  </Svg>
);
