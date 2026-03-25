// Minimal badge storage API for the new action-plan reward system.
// This stays local-storage based for now so later backend swap is isolated to this file.

import { getItem, setItem, KEYS } from './storageAdapter.js'

export const BADGE_DEFINITIONS = [
  {
    id: 'first_completion',
    label: 'First Step',
    icon: '⭐',
    description: 'Complete your first habit plan.',
    coins: 0,
    condition: ({ totalCompletions = 0 }) => totalCompletions >= 1,
  },
  {
    id: 'completions_5',
    label: 'Getting Started',
    icon: '🔥',
    description: 'Complete 5 habit-plan checkoffs.',
    coins: 0,
    condition: ({ totalCompletions = 0 }) => totalCompletions >= 5,
  },
  {
    id: 'streak_3',
    label: '3-Day Streak',
    icon: '✨',
    description: 'Keep a 3-day streak.',
    coins: 0,
    condition: ({ current = 0 }) => current >= 3,
  },
  {
    id: 'streak_7',
    label: 'Week Warrior',
    icon: '🌟',
    description: 'Keep a 7-day streak.',
    coins: 50,
    condition: ({ current = 0 }) => current >= 7,
  },
  {
    id: 'longest_streak_30',
    label: 'Month Master',
    icon: '🏆',
    description: 'Reach a longest streak of 30 days.',
    coins: 150,
    condition: ({ longest = 0 }) => longest >= 30,
  },
]

async function readBadgeStore() {
  const store = await getItem(KEYS.BADGES)
  return store && typeof store === 'object' && !Array.isArray(store) ? store : {}
}

export async function getEarnedBadges(userId) {
  if (userId == null) return { status_code: 200, data: [] }
  const store = await readBadgeStore()
  const bucket = store[String(userId)]
  if (!bucket || typeof bucket !== 'object') return { status_code: 200, data: [] }
  return {
    status_code: 200,
    data: Array.isArray(bucket.badges) ? bucket.badges : [],
    earnedDates: bucket.earnedDates && typeof bucket.earnedDates === 'object' ? bucket.earnedDates : {},
  }
}

export async function mergeEarnedBadges(userId, badgeIds = [], badgeEarnedDates = {}) {
  if (userId == null) return { status_code: 200, data: [] }

  const store = await readBadgeStore()
  const key = String(userId)
  const current = store[key] && typeof store[key] === 'object' ? store[key] : {}
  const existingIds = Array.isArray(current.badges) ? current.badges : []
  const mergedIds = Array.from(new Set([...existingIds, ...badgeIds.filter(Boolean)]))
  const mergedDates = {
    ...(current.earnedDates && typeof current.earnedDates === 'object' ? current.earnedDates : {}),
  }

  Object.entries(badgeEarnedDates || {}).forEach(([badgeId, earnedAt]) => {
    if (badgeId && earnedAt && !mergedDates[badgeId]) {
      mergedDates[badgeId] = earnedAt
    }
  })

  store[key] = {
    badges: mergedIds,
    earnedDates: mergedDates,
  }

  await setItem(KEYS.BADGES, store)
  return { status_code: 200, data: mergedIds, earnedDates: mergedDates }
}

export default {
  BADGE_DEFINITIONS,
  getEarnedBadges,
  mergeEarnedBadges,
}
