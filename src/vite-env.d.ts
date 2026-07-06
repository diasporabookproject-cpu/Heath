/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  /** 'native' (coquille Capacitor) ou 'web' — posé au build (vite.config define). */
  readonly VITE_BUILD_TARGET?: string;
  /** URL web publique de l'app, consommée en natif (liens publiés, redirects). */
  readonly VITE_WEB_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'fix-webm-duration' {
  /** Injecte la durée (ms) dans l'en-tête d'un WebM produit par MediaRecorder. */
  export default function fixWebmDuration(
    blob: Blob,
    durationMs: number,
    options?: { logger?: boolean },
  ): Promise<Blob>;
}
