import { FLUENT, type FluentIcon } from '../assets/fluent-emoji';

// DA v2 (lot UI, T1) — repère emoji EMBARQUÉ : caractère → SVG Fluent Emoji 3D
// bundlé (rendu identique Android/iOS, zéro requête réseau — invariant offline).
// Repli doux : caractère système si le repère n'est pas dans la carte.
// Le choix du caractère reste au dictionnaire déterministe (lib/emoji.ts).

/** Index tolérant au sélecteur de variante U+FE0F (les données mêlent les deux formes). */
const BY_CHAR = new Map<string, FluentIcon>();
for (const [ch, icon] of Object.entries(FLUENT)) {
  BY_CHAR.set(ch, icon);
  BY_CHAR.set(ch.replace(/\uFE0F/g, ''), icon);
}

export default function Em({ ch, size = 24, className, style }: {
  ch: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const icon = BY_CHAR.get(ch) ?? BY_CHAR.get(ch.replace(/\uFE0F/g, ''));
  if (!icon) {
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }} aria-hidden>
        {ch}
      </span>
    );
  }
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox={`0 0 ${icon.w} ${icon.h}`}
      aria-hidden
      // Corps SVG statique issu du module généré (bundle, pas d'entrée utilisateur).
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
