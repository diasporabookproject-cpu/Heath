import type { CapacitorConfig } from '@capacitor/cli';

// Coquille Capacitor (C0′, coquille-v2). appId = domaine inversé de l'ENTITÉ
// (elysia.studio), jamais le nom produit (Q-c1 tranché, GO_COQUILLE_DECISIONS) —
// il peut survivre au naming. GEL DÉFINITIF au premier upload store.
// webDir = dist-native : le build natif (`npm run build:native`, base './', SW off)
// a SON répertoire — il ne s'écrase plus avec le build web (dette v1 soldée).
const config: CapacitorConfig = {
  appId: 'studio.elysia.foyer',
  appName: 'Manzil',
  webDir: 'dist-native',
};

export default config;
