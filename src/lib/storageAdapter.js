// Centralized localStorage adapter.
// This file is the single place that accesses `localStorage` directly.
// All functions are async to match the common async usage patterns.

export async function getItem(key) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function setItem(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignore storage errors (quota, security)
  }
}

export async function removeItem(key) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    // ignore
  }
}

export default { getItem, setItem, removeItem };
