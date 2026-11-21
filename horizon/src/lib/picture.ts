import { useCallback, useState } from 'react';

/**
 * Which picture the home shows. The moon since 21 November 2026 (owner, on
 * the three concepts built in the lab: "Moon - do it"); the island is the
 * alternative, one tap away in Explore, and what the home falls back to
 * where WebGL is not available. The Lantern was the home from 18 to 21
 * November and is now only the full-screen view of the years (Explore); a
 * device that stored `lantern` gets the moon. A per-device preference, not
 * part of the plan.
 */
export type Picture = 'moon' | 'island';
const KEY = 'someday-picture-v1';

export function readPicture(): Picture {
  try { return localStorage.getItem(KEY) === 'island' ? 'island' : 'moon'; } catch { return 'moon'; }
}

export function usePicture(): [Picture, (p: Picture) => void] {
  const [picture, set] = useState<Picture>(readPicture);
  const choose = useCallback((p: Picture) => { try { localStorage.setItem(KEY, p); } catch { /* the choice lasts the session */ } set(p); }, []);
  return [picture, choose];
}

/** Whether this browser can draw the moon at all. */
export function canDraw3d(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
