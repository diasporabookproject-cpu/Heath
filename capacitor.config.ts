import type { CapacitorConfig } from '@capacitor/cli';

// Coquille Capacitor (C1). appId = domaine inversé de l'ENTITÉ (elysia.studio),
// jamais le nom produit (Q-c1 tranché, GO_COQUILLE_DECISIONS) — il peut survivre
// au naming. GEL DÉFINITIF au premier upload store (deadline naming, cf. DEVLOG).
// webDir = dist du build NATIF (`npm run build:native` : base './', SW off).
const config: CapacitorConfig = {
  appId: 'studio.elysia.foyer',
  appName: 'Manzil',
  webDir: 'dist',
};

export default config;
