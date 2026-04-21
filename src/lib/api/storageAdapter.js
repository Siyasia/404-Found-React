/* eslint-disable no-unused-vars */
// LOCAL STORAGE ADAPTER — temporary implementation only.
// Focus-session keys removed. A new task-assignment system will replace them later.

export const KEYS = {
  GOALS: 'ns.goals.v1',
  ACTION_PLANS: 'ns.actionPlans.v1',
  STREAKS: 'ns.streaks.v1',
  BADGES: 'ns.badges.v1',
  COINS: 'ns.coins.v1',
  TASK_ASSIGNMENTS: 'ns.taskAssignments.v1',
}

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
    // ignore storage errors
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

export async function safeSetItem(key, value) {
  return setItem(key, value)
}