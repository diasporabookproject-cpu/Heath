import * as Sentry from '@sentry/react';

// Crash-reporting (S0). Désactivé tant qu'il n'y a pas de DSN — l'app reste
// parfaitement fonctionnelle sans Sentry. Le DSN est une clé d'ingestion publique
// (injectée au build via VITE_SENTRY_DSN), sans secret.
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const sentryEnabled = !!DSN;

export function initSentry(): void {
  if (!DSN) return; // pas de DSN => aucun réseau, aucun bruit
  Sentry.init({
    dsn: DSN,
    // Contexte minimal ; JAMAIS de données de contenu (D7 : rien sur les données d'enfants).
    tracesSampleRate: 0, // pas de tracing perf en v1
    sendDefaultPii: false,
    // Coupe les breadcrumbs qui pourraient capter du contenu saisi.
    beforeBreadcrumb: (b) => (b.category === 'ui.input' ? null : b),
  });
}
