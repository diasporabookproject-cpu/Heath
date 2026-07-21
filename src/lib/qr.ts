import QRCode from 'qrcode';

// Génération QR locale (hors-ligne) — rendu en SVG, sans service externe.

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    width: 196,
    color: { dark: '#1e1a16', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}
