import { useEffect, useRef, useState } from 'react';
import './mz.css';

// Lecteur audio custom (L0-4) aux tokens mz-. Remplace <audio controls> natif
// côté admin : lecture/pause + progression cliquable + durée. Un <audio> caché
// fait le son ; l'UI est entièrement stylée.

function mmss(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MzAudio({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCur(0);
    setDur(0);
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * dur;
    setCur(a.currentTime);
  };

  const pct = dur ? (cur / dur) * 100 : 0;

  return (
    <div className="mz-audio">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
      />
      <button className="mz-audio-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Écouter'}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="mz-audio-track" onClick={seek} role="progressbar" aria-valuenow={Math.round(pct)}>
        <span className="mz-audio-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mz-audio-time mz-mono">{mmss(cur)} / {mmss(dur)}</span>
    </div>
  );
}
