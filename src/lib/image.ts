// T4b (lot Cuisine) — préparation d'image UNIQUE pour les deux usages :
// l'import photo (vision, F4.3) et la photo du plat (Storage, F5.3).
// Côté long ≤ 1280 px, ré-encodage JPEG q0.8 (~150-400 Ko). Le passage par le
// canvas SUPPRIME les métadonnées EXIF — dont le GPS : la photo brute du
// téléphone ne quitte jamais l'appareil (protection du foyer, tracée DEVLOG).

export interface PreparedImage {
  blob: Blob;
  /** Base64 SANS préfixe data-URL (prêt pour l'API vision). */
  base64: string;
  mediaType: 'image/jpeg';
  width: number;
  height: number;
}

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* certains formats (HEIC partiel) échouent ici → repli <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Image illisible sur cet appareil.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function prepareImage(file: Blob, maxSide = MAX_SIDE): Promise<PreparedImage> {
  const src = await decode(file);
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
  if (!sw || !sh) throw new Error('Image vide.');
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible.');
  // Fond blanc : un PNG transparent ré-encodé en JPEG deviendrait noir.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  if ('close' in src) src.close();
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Ré-encodage impossible.'))), 'image/jpeg', JPEG_QUALITY),
  );
  const base64 = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(new Error('Lecture impossible.'));
    r.readAsDataURL(blob);
  });
  if (!base64) throw new Error('Image vide après ré-encodage.');
  return { blob, base64, mediaType: 'image/jpeg', width: w, height: h };
}
