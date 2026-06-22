/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
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
