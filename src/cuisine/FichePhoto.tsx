import { useEffect, useRef, useState } from 'react';
import { loadImage, saveImage } from '../lib/db';
import { backupImage, restoreImage, retryImageBackup } from '../lib/sync/images';
import { prepareImage } from '../lib/image';
import { isNative, pickPhoto as pickPhotoNative } from '../lib/platform';

/**
 * F5.3 — photo du PLAT (illustration de la fiche). UNE seule entrée « Ajouter
 * une photo » → sélecteur natif (appareil OU galerie via le prompt Capacitor en
 * natif — leçon T4b — ; chooser web sinon). Distinction stricte avec « en
 * photo » de l'import (F4.3) qui transcrit une recette ÉCRITE : ici c'est le
 * plat fini. Local-first (IDB `images`), sauvegarde privée best-effort
 * (`foyer-images`, 0010), restauration paresseuse.
 */
export default function FichePhoto({ recipeId, toast }: { recipeId: string; toast: (m: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<string | null>(null);

  const show = (blob: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    setUrl(urlRef.current);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      const local = await loadImage(recipeId);
      if (local && alive) {
        show(local.blob);
        // F4 : sauvegarde non confirmée (`backedUp` faux) → UNE retentative
        // silencieuse ici — d'après l'état, jamais aveugle.
        void retryImageBackup(recipeId);
        return;
      }
      const restored = await restoreImage(recipeId); // paresseux, best-effort
      if (restored && alive) show(restored);
    })();
    return () => {
      alive = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const apply = async (source: Blob) => {
    setBusy(true);
    try {
      const img = await prepareImage(source); // ≤1280px, JPEG, EXIF/GPS retirés
      await saveImage(recipeId, img.blob, img.mediaType);
      void backupImage(recipeId, img.blob, img.mediaType); // fire-and-forget
      show(img.blob);
      toast('Photo enregistrée');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pickNative = async () => {
    const blob = await pickPhotoNative();
    if (blob) await apply(blob);
  };

  const inner = url ? (
    <>
      <img className="cz-photoimg" src={url} alt="" />
      <span className="cz-photochange">{busy ? 'Enregistrement…' : 'Changer la photo'}</span>
    </>
  ) : (
    <span className="cz-photoempty">{busy ? 'Enregistrement…' : '📷 Ajouter une photo du plat'}</span>
  );

  return isNative ? (
    <button type="button" className={'cz-fichephoto' + (url ? ' has' : '')} onClick={() => void pickNative()} disabled={busy}>
      {inner}
    </button>
  ) : (
    <label className={'cz-fichephoto' + (url ? ' has' : '')}>
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void apply(f);
          e.target.value = '';
        }}
      />
      {inner}
    </label>
  );
}
