import { useEffect, useRef, useState } from 'react';
import fixWebmDuration from 'fix-webm-duration';
import { deleteAudio, loadAudio, saveAudio } from '../lib/db';
import { backupAudio, restoreAudio } from '../lib/sync/audio';
import MzAudio from '../ui/MzAudio';
import { IconMic, IconShareUp } from './icons';

// FC7 — « Consigne vocale pour la cuisinière » : la VOIX de l'employeur (jamais
// synthétisée), partagée dans le brief. Réutilise la mécanique éprouvée de
// VoiceNote (MediaRecorder + IndexedDB + fix-webm-duration), au style maquette.

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  const MR = window.MediaRecorder;
  if (MR && MR.isTypeSupported) for (const m of candidates) if (MR.isTypeSupported(m)) return m;
  return '';
}

export default function ConsigneVocale({
  recipeId,
  onChange,
  title = 'Consigne vocale pour la cuisinière',
  subtitle = 'Ta voix, dans sa langue',
  idleHint = 'Ta voix sera partagée avec la cuisinière dans le brief',
}: {
  recipeId: string;
  onChange?: (has: boolean) => void;
  /** Libellés (la page Nounou réutilise ce composant avec un autre contexte). */
  title?: string;
  subtitle?: string;
  idleHint?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false; // la restauration réseau peut résoudre APRÈS un changement de recette
    void loadAudio(recipeId).then(async (local) => {
      const blob = local ?? (await restoreAudio(recipeId)) ?? undefined;
      if (cancelled || !blob) return;
      const u = URL.createObjectURL(blob);
      revoked = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recipeId]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const type = rec.mimeType || mime || 'audio/webm';
        let blob = new Blob(chunksRef.current, { type });
        if (type.includes('webm')) {
          const durationMs = Date.now() - startRef.current;
          blob = await Promise.race([
            fixWebmDuration(blob, durationMs).catch(() => blob),
            new Promise<Blob>((resolve) => setTimeout(() => resolve(blob), 4000)),
          ]);
        }
        await saveAudio(recipeId, blob, blob.type || type);
        void backupAudio(recipeId, blob, blob.type || type); // sauvegarde cloud (best-effort)
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        onChange?.(true);
        stream.getTracks().forEach((tr) => tr.stop());
      };
      recorderRef.current = rec;
      startRef.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError("Micro refusé ou indisponible. Autorise l'accès au micro.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const remove = async () => {
    await deleteAudio(recipeId);
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onChange?.(false);
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  if (!supported) {
    return (
      <div className="cz-voicecard">
        <div className="cz-voiceerr">L’enregistrement n’est pas supporté par ce navigateur.</div>
      </div>
    );
  }

  // État : a un enregistrement
  if (url && !recording) {
    return (
      <div className="cz-voicecard">
        <div className="vh">
          <div className="vl">
            {title}
            <small>{subtitle}</small>
          </div>
          <span className="cz-vshare">
            <IconShareUp size={11} />
            partagée
          </span>
        </div>
        <div className="cz-voiceplay">
          <MzAudio src={url} />
        </div>
        <button className="cz-relink" onClick={start}>
          Réenregistrer la consigne
        </button>
        {' · '}
        <button className="cz-relink" onClick={remove}>
          Supprimer
        </button>
      </div>
    );
  }

  // État : enregistrement en cours
  if (recording) {
    return (
      <div className="cz-voicecard">
        <button className="cz-recbtn rec" onClick={stop}>
          <span className="mic">
            <IconMic size={18} />
          </span>
          <span className="rt">
            Arrêter l’enregistrement
            <small>{mmss}</small>
          </span>
        </button>
      </div>
    );
  }

  // État : aucune consigne
  return (
    <div className="cz-voicecard">
      <button className="cz-recbtn" onClick={start}>
        <span className="mic">
          <IconMic size={18} />
        </span>
        <span className="rt">
          Enregistrer une consigne vocale
          <small>{idleHint}</small>
        </span>
      </button>
      {error && <div className="cz-voiceerr">{error}</div>}
    </div>
  );
}
