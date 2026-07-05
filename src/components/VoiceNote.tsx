import { useEffect, useRef, useState } from 'react';
import fixWebmDuration from 'fix-webm-duration';
import { deleteAudio, loadAudio, saveAudio } from '../lib/db';
import MzAudio from '../ui/MzAudio';

// Note vocale par recette : enregistrement micro (offline, IndexedDB),
// réécoute, et partage (WhatsApp via l'API Web Share, sinon téléchargement).
// Pensé pour pouvoir se synchroniser plus tard via Supabase.

type Lang = 'fr' | 'ar';

const STR = {
  fr: {
    title: 'Note vocale',
    rec: '🎙️ Enregistrer',
    stop: '⏹️ Arrêter',
    share: '📤 Envoyer',
    again: '↻ Refaire',
    del: '🗑️',
    none: 'Aucune note. Enregistre une explication pour la cuisinière.',
    denied: "Micro refusé ou indisponible. Autorise l'accès au micro.",
    unsupported: "L'enregistrement n'est pas supporté par ce navigateur.",
  },
  ar: {
    title: 'ملاحظة صوتية',
    rec: '🎙️ سجّل',
    stop: '⏹️ وقّف',
    share: '📤 صيفط',
    again: '↻ عاود',
    del: '🗑️',
    none: 'ما كاينة حتى ملاحظة. سجّل شرح للطبّاخة.',
    denied: 'الميكرو مرفوض أو ماكاينش. خصك تسمح بالميكرو.',
    unsupported: 'هاد المتصفّح ما كايسمحش بالتسجيل.',
  },
};

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  const MR = window.MediaRecorder;
  if (MR && MR.isTypeSupported) {
    for (const m of candidates) if (MR.isTypeSupported(m)) return m;
  }
  return '';
}

function extFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('aac')) return 'm4a';
  return 'audio';
}

export default function VoiceNote({ recipeId, recipeName, lang }: { recipeId: string; recipeName: string; lang: Lang }) {
  const t = STR[lang];
  const [url, setUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const blobRef = useRef<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  useEffect(() => {
    let revoked: string | null = null;
    loadAudio(recipeId).then((blob) => {
      if (blob) {
        blobRef.current = blob;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // MediaRecorder n'écrit pas la durée dans l'en-tête WebM → lecture
        // coupée/vide quand le fichier est servi. On la répare avant sauvegarde,
        // avec un garde-fou (timeout) pour ne jamais bloquer l'enregistrement.
        if (type.includes('webm')) {
          const durationMs = Date.now() - startTimeRef.current;
          blob = await Promise.race([
            fixWebmDuration(blob, durationMs).catch(() => blob),
            new Promise<Blob>((resolve) => setTimeout(() => resolve(blob), 4000)),
          ]);
        }
        blobRef.current = blob;
        await saveAudio(recipeId, blob, blob.type || type);
        if (url) URL.revokeObjectURL(url);
        setUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((tr) => tr.stop());
      };
      recorderRef.current = rec;
      startTimeRef.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError(t.denied);
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const share = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], `note-${recipeId}.${extFor(blob.type)}`, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: recipeName, text: recipeName });
        return;
      }
    } catch {
      /* annulé ou non supporté → on retombe sur le téléchargement */
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const remove = async () => {
    await deleteAudio(recipeId);
    if (url) URL.revokeObjectURL(url);
    blobRef.current = null;
    setUrl(null);
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="voice-note" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="voice-note__title">🔊 {t.title}</div>

      {!supported && <div className="voice-note__hint">{t.unsupported}</div>}
      {error && <div className="voice-note__err">{error}</div>}

      {supported && (
        <div className="voice-note__row">
          {!recording && !url && (
            <button className="btn btn--small" onClick={start}>
              {t.rec}
            </button>
          )}
          {recording && (
            <button className="btn btn--small btn--rec" onClick={stop}>
              {t.stop} <span className="voice-note__dot" /> {mmss}
            </button>
          )}
          {url && !recording && (
            <>
              <MzAudio src={url} />
              <button className="btn btn--small" onClick={share}>
                {t.share}
              </button>
              <button className="btn btn--small btn--ghost" onClick={start}>
                {t.again}
              </button>
              <button className="lib-toggle" onClick={remove} aria-label="Supprimer">
                {t.del}
              </button>
            </>
          )}
        </div>
      )}

      {supported && !url && !recording && <div className="voice-note__hint">{t.none}</div>}
    </div>
  );
}
