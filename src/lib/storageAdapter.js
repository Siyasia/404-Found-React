// LOCAL STORAGE ADAPTER — temporary implementation only.
// When backend is ready , will delete this file entirely.
// All api/ modules will replace their getItem/setItem calls with fetch() directly.

export const KEYS = {
  GOALS: 'ns.goals.v1',
  ACTION_PLANS: 'ns.actionPlans.v1',
  STREAKS: 'ns.streaks.v1',
  BADGES: 'ns.badges.v1',
}

// Helper to read goals with safety checks
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

// Helper to write goals with safety checks
export async function setItem(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignore storage errors (quota, security)
  }
}

// Helper to remove an item from storage
export async function removeItem(key) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    // ignore
  }
}

export default { getItem, setItem, removeItem };
