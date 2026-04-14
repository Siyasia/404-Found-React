//Updated badges to be sent to backend and stored in game profile meta, with earned dates.

import { getGameProfile, updateGameProfile } from './game.js'

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

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
}

function ensureArray(value) {
  return Array.isArray(value) ? [...value] : []
}

async function readCurrentProfile() {
  const resp = await getGameProfile()

  const ok =
    resp &&
    (resp.status_code === 200 ||
      resp.status === 200 ||
      resp.status_code === '200' ||
      resp.status === '200')

  if (!ok) return null

  return resp?.game_profile ?? resp?.profile ?? null
}

export async function getEarnedBadges(userId) {
  const profile = await readCurrentProfile()
  if (!profile) {
    return { status_code: 500, data: [], earnedDates: {} }
  }

  const meta = ensureObject(profile.meta)

  return {
    status_code: 200,
    data: ensureArray(meta.earnedBadges),
    earnedDates: ensureObject(meta.badgeEarnedDates),
  }
}

export async function mergeEarnedBadges(userId, badgeIds = [], badgeEarnedDates = {}) {
  const profile = await readCurrentProfile()
  if (!profile) {
    return { status_code: 500, error: 'Failed to load game profile for badges' }
  }

  const currentMeta = ensureObject(profile.meta)
  const existingIds = ensureArray(currentMeta.earnedBadges)
  const mergedIds = Array.from(new Set([...existingIds, ...badgeIds.filter(Boolean)]))

  const mergedDates = {
    ...ensureObject(currentMeta.badgeEarnedDates),
  }

  Object.entries(ensureObject(badgeEarnedDates)).forEach(([badgeId, earnedAt]) => {
    if (badgeId && earnedAt && !mergedDates[badgeId]) {
      mergedDates[badgeId] = earnedAt
    }
  })

  const nextMeta = {
    ...currentMeta,
    earnedBadges: mergedIds,
    badgeEarnedDates: mergedDates,
  }

  const updateResp = await updateGameProfile({ meta: nextMeta })

  const ok =
    updateResp &&
    (updateResp.status_code === 200 ||
      updateResp.status === 200 ||
      updateResp.status_code === '200' ||
      updateResp.status === '200')

  if (!ok) {
    return {
      status_code: 500,
      error: updateResp?.error || 'Failed to persist badges to backend',
    }
  }

  return { status_code: 200, data: mergedIds, earnedDates: mergedDates }
}

export default {
  BADGE_DEFINITIONS,
  getEarnedBadges,
  mergeEarnedBadges,
}
