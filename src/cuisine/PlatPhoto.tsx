import { useEffect, useRef, useState } from 'react';
import { loadImage } from '../lib/db';
import { restoreImage } from '../lib/sync/images';
import Em from '../ui/Em';

/**
 * T1 (refonte mise en page Cuisine) — visuel de la carte-repas HÉROS : la photo
 * du plat quand elle existe, sinon le dégradé + emoji Fluent. Le dégradé-emoji
 * n'est PAS un placeholder (décision PO) : c'est un état de première classe, ce
 * que verront la plupart des cartes ; la photo est un bonus, jamais une
 * condition.
 *
 * Chargement = miroir EXACT de `FichePhoto` (cohérence : une seule photo, un
 * seul comportement) — IDB local (`loadImage`) d'abord, restauration réseau
 * paresseuse best-effort (`restoreImage`) pour un appareil réinstallé. Aucune
 * casse hors-ligne : pas de photo locale + réseau muet → dégradé-emoji.
 */
export default function PlatPhoto({ recipeId, emoji }: { recipeId: string; emoji: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const show = (blob: Blob) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setUrl(urlRef.current);
    };
    void (async () => {
      const local = await loadImage(recipeId);
      if (!alive) return;
      if (local) {
        show(local.blob);
        return;
      }
      const restored = await restoreImage(recipeId); // paresseux, best-effort
      if (alive && restored) show(restored);
    })();
    return () => {
      alive = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [recipeId]);

  if (url) return <img className="cz-heroimg" src={url} alt="" />;
  return (
    <span className="emj">
      <Em ch={emoji} size={44} />
    </span>
  );
}
