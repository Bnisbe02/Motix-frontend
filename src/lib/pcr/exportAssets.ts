import { createSignedUrl } from '../pcrApi';
import { AssetResolver } from './pptxGenerator';

/*
  Browser-only helpers for the export step: resolve a storage path to a
  downscaled data: URL (so large logos/screenshots don't exhaust memory when
  embedded), sanitise a download filename, and trigger a client-side download.
  Kept out of the generators, which stay framework/DOM-free and testable.
*/

/** Longest edge, in px, that an embedded image is downscaled to. */
const MAX_IMAGE_DIM = 1000;

function downscaleToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Build an AssetResolver that signs a pcr-assets path, fetches the bytes and
 * returns a downscaled PNG data: URL. Returns null (image omitted) on any
 * failure — never throws.
 */
export function makeAssetResolver(): AssetResolver {
  const cache = new Map<string, string | null>();
  return async (path: string): Promise<string | null> => {
    if (cache.has(path)) return cache.get(path) ?? null;
    let result: string | null = null;
    try {
      const url = await createSignedUrl(path);
      if (url) {
        const res = await fetch(url);
        if (res.ok) {
          result = await downscaleToDataUrl(await res.blob());
        }
      }
    } catch {
      result = null;
    }
    cache.set(path, result);
    return result;
  };
}

export function sanitiseFilename(s: string): string {
  return (s || 'report')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'report';
}

/** Trigger a client-side download of a blob. Nothing is uploaded to a server. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
