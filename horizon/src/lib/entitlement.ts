/**
 * Entitlement: is this device on Someday Plus?
 *
 * A licence key (sold by Lemon Squeezy) is activated once per device against
 * the public licence API, stored locally, and quietly re-validated every few
 * days. Offline, Plus keeps working for a grace period since the last good
 * check. This is a client-side app, so the gate is a fair gate, not a vault:
 * it keeps honest customers honest and lets a paying customer move devices.
 *
 * Privacy: the ONLY data that leaves the device is the licence key and a
 * short device label ("Safari on iPhone"). Never any planning figures.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PRODUCT } from '../config/product';

export interface Licence {
  key: string;
  instanceId: string;
  instanceName: string;
  status: string;            // 'active' | 'inactive' | 'expired' | 'disabled' | 'invalid'
  expiresAt: string | null;  // ISO, null = lifetime
  activatedAt: number;       // epoch ms
  validatedAt: number;       // epoch ms of the last successful online check
  productName?: string;
  variantName?: string;
  customerEmail?: string;
}

export const LICENCE_KEY = 'someday-licence-v1';
const DAY = 86_400_000;

export function loadLicence(): Licence | null {
  try {
    const s = localStorage.getItem(LICENCE_KEY);
    if (!s) return null;
    const l = JSON.parse(s);
    return l && typeof l.key === 'string' ? l as Licence : null;
  } catch { return null; }
}

export function saveLicence(l: Licence | null) {
  try {
    if (l) localStorage.setItem(LICENCE_KEY, JSON.stringify(l));
    else localStorage.removeItem(LICENCE_KEY);
  } catch { /* private mode: Plus lasts the session */ }
}

/** Pure: does this stored licence entitle the device to Plus right now? */
export function isPlus(l: Licence | null, now = Date.now()): boolean {
  if (!l || !l.key || !l.instanceId) return false;
  if (l.status !== 'active') return false;
  if (l.expiresAt && new Date(l.expiresAt).getTime() < now) return false;
  if (now - l.validatedAt > PRODUCT.licence.graceDays * DAY) return false; // needs an online check
  return true;
}

export function needsRevalidation(l: Licence | null, now = Date.now()): boolean {
  return !!l && now - l.validatedAt > PRODUCT.licence.revalidateDays * DAY;
}

function deviceLabel(): string {
  try {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad|Macintosh.*Mobile/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
      : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device';
    return `${browser} on ${os}`;
  } catch { return 'Someday device'; }
}

interface LsResponse {
  ok: boolean; status: number; network: boolean;
  json: any;
}

async function lsPost(path: 'activate' | 'validate' | 'deactivate', body: Record<string, string>): Promise<LsResponse> {
  try {
    const res = await fetch(`${PRODUCT.lemonSqueezy.apiBase}/${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, network: true, json };
  } catch {
    return { ok: false, status: 0, network: false, json: {} };
  }
}

/** Reject keys from another store/product when the operator has pinned them. */
function issuedByUs(meta: any): boolean {
  const { storeId, productIds } = PRODUCT.lemonSqueezy;
  if (storeId && Number(meta?.store_id) !== storeId) return false;
  if (productIds.length && !productIds.includes(Number(meta?.product_id))) return false;
  return true;
}

export type ActivateResult = { ok: true; licence: Licence } | { ok: false; message: string };

export function normaliseKey(raw: string): string {
  return (raw || '').trim().replace(/\s+/g, '');
}

export async function activateKey(raw: string): Promise<ActivateResult> {
  const key = normaliseKey(raw);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return { ok: false, message: 'That doesn’t look like a licence key. It’s the long code in your receipt email, like 1a2b3c4d-....' };
  }
  const r = await lsPost('activate', { license_key: key, instance_name: deviceLabel() });
  if (!r.network) return { ok: false, message: 'Couldn’t reach the licence service. Check your connection and try again — nothing else is needed.' };
  const j = r.json || {};
  if (!j.activated) {
    const err = String(j.error || '').toLowerCase();
    if (err.includes('activation limit')) {
      return { ok: false, message: 'This key is already active on its maximum number of devices. Remove it from one of them (Plus → Remove from this device), then try again.' };
    }
    if (err.includes('not found')) return { ok: false, message: 'That key wasn’t recognised. Check for typos, or copy it again from your receipt email.' };
    if (err.includes('expired')) return { ok: false, message: 'This key has expired. Renew from your Lemon Squeezy receipt, or buy a new plan.' };
    if (err.includes('disabled')) return { ok: false, message: 'This key has been disabled — usually after a refund. Contact ' + PRODUCT.supportEmail + ' if that’s a surprise.' };
    return { ok: false, message: j.error ? String(j.error) : 'The key couldn’t be activated. Please try again.' };
  }
  if (!issuedByUs(j.meta)) {
    // Undo the activation we just used up on a foreign key.
    if (j.instance?.id) void lsPost('deactivate', { license_key: key, instance_id: String(j.instance.id) });
    return { ok: false, message: 'That key was issued for a different product.' };
  }
  const now = Date.now();
  const licence: Licence = {
    key,
    instanceId: String(j.instance?.id || ''),
    instanceName: String(j.instance?.name || deviceLabel()),
    status: String(j.license_key?.status || 'active'),
    expiresAt: j.license_key?.expires_at || null,
    activatedAt: now,
    validatedAt: now,
    productName: j.meta?.product_name,
    variantName: j.meta?.variant_name,
    customerEmail: j.meta?.customer_email,
  };
  saveLicence(licence);
  return { ok: true, licence };
}

/**
 * Re-check an activated key. Returns the refreshed licence, or the same one
 * when the service can't be reached (grace applies), or a revoked record when
 * the service says the key no longer stands (refund, lapse, deactivation).
 */
export async function revalidate(l: Licence): Promise<Licence> {
  const r = await lsPost('validate', { license_key: l.key, instance_id: l.instanceId });
  if (!r.network) return l;
  const j = r.json || {};
  if (j.valid && issuedByUs(j.meta)) {
    return {
      ...l,
      status: String(j.license_key?.status || 'active'),
      expiresAt: j.license_key?.expires_at ?? l.expiresAt,
      validatedAt: Date.now(),
      productName: j.meta?.product_name ?? l.productName,
      variantName: j.meta?.variant_name ?? l.variantName,
    };
  }
  // Only a definite "no" about THIS key revokes: a licence status, or
  // valid:false from a normal response. Rate limits, outages and gateway
  // pages are "unknown", so the grace period keeps Plus working.
  if (r.status === 429 || r.status >= 500 || (j.valid !== false && !j.license_key)) return l;
  const status = String(j.license_key?.status || 'invalid');
  return { ...l, status: status === 'active' ? 'invalid' : status, validatedAt: Date.now() };
}

export async function deactivate(l: Licence): Promise<void> {
  await lsPost('deactivate', { license_key: l.key, instance_id: l.instanceId });
  saveLicence(null);
}

// ── React surface ─────────────────────────────────────────────────────
export interface Entitlement {
  plus: boolean;
  licence: Licence | null;
  busy: boolean;
  error: string | null;
  activate: (key: string) => Promise<boolean>;
  remove: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useEntitlementState(): Entitlement {
  const [licence, setLicence] = useState<Licence | null>(loadLicence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const cur = loadLicence();
    if (!cur) return;
    const next = await revalidate(cur);
    // A newer activation may have landed meanwhile (e.g. a receipt link):
    // never let a stale re-check overwrite a different key.
    const now = loadLicence();
    if (!now || now.key !== cur.key) return;
    saveLicence(next);
    setLicence(next);
  }, []);

  // Quiet background re-check when due; also whenever the device comes online.
  // Skipped on a visit that carries a new key to activate.
  useEffect(() => {
    const pendingLink = (() => { try { const u = new URL(window.location.href); return !!(u.searchParams.get('licence') || u.searchParams.get('license')); } catch { return false; } })();
    const check = () => { if (!pendingLink && needsRevalidation(loadLicence())) void refresh(); };
    check();
    window.addEventListener('online', check);
    return () => window.removeEventListener('online', check);
  }, [refresh]);

  // A `?licence=KEY` link (e.g. from the receipt) activates on arrival.
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const k = u.searchParams.get('licence') || u.searchParams.get('license');
      if (k && !isPlus(loadLicence())) {
        void activateKey(k).then(r => {
          if (r.ok) setLicence(r.licence); else setError(r.message);
          u.searchParams.delete('licence'); u.searchParams.delete('license');
          window.history.replaceState({}, '', u.pathname + u.search + u.hash);
        });
      }
    } catch { /* ignore */ }
  }, []);

  const activate = useCallback(async (key: string) => {
    setBusy(true); setError(null);
    const r = await activateKey(key);
    setBusy(false);
    if (r.ok) { setLicence(r.licence); return true; }
    setError(r.message); return false;
  }, []);

  const remove = useCallback(async () => {
    const cur = loadLicence();
    setBusy(true);
    if (cur) await deactivate(cur); else saveLicence(null);
    setBusy(false);
    setLicence(null);
  }, []);

  const plus = useMemo(() => isPlus(licence), [licence]);
  return { plus, licence, busy, error, activate, remove, refresh, clearError: () => setError(null) };
}

export const EntitlementContext = createContext<Entitlement>({
  plus: false, licence: null, busy: false, error: null,
  activate: async () => false, remove: async () => {}, refresh: async () => {}, clearError: () => {},
});

export const useEntitlement = () => useContext(EntitlementContext);
