import { useCallback, useState } from 'react';

/**
 * Which picture the home shows. The Lantern since 18 November 2026 (owner:
 * "move the candle to the main screen"); the island stays one tap away in
 * Explore for a release, and is what the home falls back to where WebGL is
 * not available. A per-device preference, not part of the plan.
 */
export type Picture = 'lantern' | 'island';
const KEY = 'someday-picture-v1';

export function readPicture(): Picture {
  try { return localStorage.getItem(KEY) === 'island' ? 'island' : 'lantern'; } catch { return 'lantern'; }
}

export function usePicture(): [Picture, (p: Picture) => void] {
  const [picture, set] = useState<Picture>(readPicture);
  const choose = useCallback((p: Picture) => { try { localStorage.setItem(KEY, p); } catch { /* the choice lasts the session */ } set(p); }, []);
  return [picture, choose];
}

/** Whether this browser can draw the Lantern at all. */
export function canDraw3d(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
