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

// ── C2 — les APIs natives passent TOUTES par ici (imports DYNAMIQUES : le build
// web les met dans des chunks jamais chargés ; la WebView les charge à la demande).

/** B2 : écrit un fichier texte en cache et ouvre la feuille de PARTAGE système.
 * Remplace le `<a download>` (no-op en WebView) — le filet d'export vit aussi sur l'APK. */
export async function saveAndShareFile(filename: string, content: string): Promise<void> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const res = await Filesystem.writeFile({
    path: filename,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: filename, url: res.uri, dialogTitle: 'Enregistrer ta sauvegarde' });
}

/** B3 : branche le bouton retour Android (natif seulement). Renvoie le désabonnement.
 * ⚠️ Dès qu'un listener existe, Capacitor NE ferme PLUS l'app tout seul — le handler
 * décide (fermer une feuille / revenir à Maison / minimiser). */
export function onBackButton(handler: () => void): () => void {
  let remove: () => void = () => {};
  void import('@capacitor/app').then(({ App }) =>
    App.addListener('backButton', handler).then((h) => {
      remove = () => void h.remove();
    }),
  );
  return () => remove();
}

/** B3 : minimise l'app (retour depuis Maison = on passe en arrière-plan, jamais de kill). */
export async function minimizeApp(): Promise<void> {
  const { App } = await import('@capacitor/app');
  await App.minimizeApp();
}

/** F4-bis fiche C : ouvre la FEUILLE DE PARTAGE système avec un texte (natif).
 * Les chemins d'envoi étaient 100 % web (wa.me / presse-papiers) — en natif,
 * sans numéro connu, c'est la feuille qui laisse choisir le canal. */
export async function shareText(text: string, title?: string): Promise<void> {
  const { Share } = await import('@capacitor/share');
  await Share.share({ text, dialogTitle: title ?? 'Envoyer la page' });
}

/**
 * T4b — sélection d'une photo en NATIF (retour device : l'`<input type=file>` de
 * la WebView Android n'ouvre que la galerie, jamais l'appareil ; repli Q5 acté).
 * `CameraSource.Prompt` = dialogue natif « Prendre une photo » OU « Depuis les
 * photos » : les DEUX chemins que le web ne pouvait pas offrir. Renvoie le Blob
 * (via le webPath éphémère), ou null si l'utilisateur annule. Le web garde son
 * `<input>` — cette fonction n'est jamais appelée hors natif (DCE : zéro octet
 * `@capacitor/camera` dans le bundle web). L'image passe ensuite par
 * `prepareImage` (≤1280px, EXIF/GPS retirés) comme toute photo. */
export async function pickPhoto(): Promise<Blob | null> {
  try {
    const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt, // ← appareil OU galerie (le prompt laisse choisir)
      resultType: CameraResultType.Uri,
      quality: 90,
      // pas d'édition imposée : on redimensionne nous-mêmes (prepareImage).
      allowEditing: false,
      promptLabelHeader: 'Ajouter une photo',
      promptLabelPhoto: 'Depuis la galerie',
      promptLabelPicture: 'Prendre une photo',
    });
    if (!photo.webPath) return null;
    const res = await fetch(photo.webPath);
    return await res.blob();
  } catch {
    // getPhoto lève si l'utilisateur annule le prompt — ce n'est pas une erreur.
    return null;
  }
}
