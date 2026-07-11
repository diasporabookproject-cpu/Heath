// Plateforme (Q-c2) — POINT UNIQUE de détection natif/web. La cible est décidée
// à la COMPILATION (deux builds distincts : `npm run build` = web, `npm run
// build:native` = coquille Capacitor) — pas besoin d'API runtime, et aucun autre
// module n'importe Capacitor directement.

export const isNative = import.meta.env.VITE_BUILD_TARGET === 'native';

// 8ᵉ piège (read-back C0) : en natif, window.location.origin = https://localhost
// → tout lien construit dessus (pages publiées #e=, redirect e-mail) serait MORT
// hors de la WebView. Les URLs destinées au monde extérieur passent par ici.
const WEB_URL_DEFAULT = 'https://diasporabookproject-cpu.github.io/Heath/';

/** Base URL WEB publique de l'app (finit par « / »). */
export function webBaseUrl(): string {
  if (isNative) {
    return (import.meta.env.VITE_WEB_BASE_URL as string | undefined) || WEB_URL_DEFAULT;
  }
  return window.location.origin + window.location.pathname;
}
