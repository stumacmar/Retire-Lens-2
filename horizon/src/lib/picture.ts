import { useCallback, useState } from 'react';

/**
 * What the home shows. A plain chart since 24 November 2026: the owner asked
 * whether the moon, the island and the Lantern were "too gimmicky", a council
 * of twelve fresh seats said they were (six of six consumers trusted a plain
 * chart most; shown that, six of six professionals changed their vote), and
 * the owner said "Build it". The moon (the home from 21 to 24 November) and
 * the island are the alternatives, one tap away in Explore; the moon falls
 * back to the island where WebGL is not available. The Lantern is only the
 * full-screen view of the years (Explore); a device that stored `lantern`
 * gets the chart. A per-device preference, not part of the plan.
 */
export type Picture = 'chart' | 'moon' | 'island';
const KEY = 'someday-picture-v1';

export function readPicture(): Picture {
  try { const v = localStorage.getItem(KEY); return v === 'island' || v === 'moon' ? v : 'chart'; } catch { return 'chart'; }
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
