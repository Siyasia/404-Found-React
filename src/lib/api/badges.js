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

function isOk(response) {
  return Boolean(
    response &&
      (
        response.status_code === 200 ||
        response.status === 200 ||
        response.status_code === '200' ||
        response.status === '200'
      )
  )
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {}
}

function ensureArray(value) {
  return Array.isArray(value) ? [...value] : []
}

async function readCurrentProfile() {
  const response = await getGameProfile()
  if (!isOk(response)) return null
  return response?.game_profile ?? response?.profile ?? null
}

function getProfileMeta(profile) {
  return ensureObject(profile?.meta)
}

export function evaluateBadgeIds({ current = 0, longest = 0, totalCompletions = 0 } = {}) {
  return BADGE_DEFINITIONS
    .filter((badge) => {
      try {
        return badge.condition({ current, longest, totalCompletions }) === true
      } catch {
        return false
      }
    })
    .map((badge) => badge.id)
}

export async function getEarnedBadges() {
  const profile = await readCurrentProfile()

  if (!profile) {
    return {
      status_code: 500,
      data: [],
      earnedDates: {},
    }
  }

  const meta = getProfileMeta(profile)

  return {
    status_code: 200,
    data: ensureArray(meta.earnedBadges),
    earnedDates: ensureObject(meta.badgeEarnedDates),
  }
}

export async function mergeEarnedBadges(badgeIds = [], badgeEarnedDates = {}) {
  const profile = await readCurrentProfile()

  if (!profile) {
    return {
      status_code: 500,
      error: 'Failed to load game profile for badges',
    }
  }

  const currentMeta = getProfileMeta(profile)
  const existingIds = ensureArray(currentMeta.earnedBadges)
  const existingDates = ensureObject(currentMeta.badgeEarnedDates)

  const mergedIds = Array.from(
    new Set([
      ...existingIds,
      ...ensureArray(badgeIds).filter(Boolean),
    ])
  )

  const mergedDates = { ...existingDates }

  Object.entries(ensureObject(badgeEarnedDates)).forEach(([badgeId, earnedAt]) => {
    if (!badgeId || !earnedAt) return
    if (!mergedDates[badgeId]) {
      mergedDates[badgeId] = earnedAt
    }
  })

  const nextMeta = {
    ...currentMeta,
    earnedBadges: mergedIds,
    badgeEarnedDates: mergedDates,
  }

  const updateResponse = await updateGameProfile({
    meta: nextMeta,
  })

  if (!isOk(updateResponse)) {
    return {
      status_code: 500,
      error: updateResponse?.error || 'Failed to persist badges to game profile',
    }
  }

  return {
    status_code: 200,
    data: mergedIds,
    earnedDates: mergedDates,
  }
}

export async function awardBadgesFromStats(stats = {}, earnedAt = null) {
  const computedBadgeIds = evaluateBadgeIds(stats)

  if (computedBadgeIds.length === 0) {
    const existing = await getEarnedBadges()
    return {
      status_code: existing.status_code,
      data: existing.data || [],
      earnedDates: existing.earnedDates || {},
      newBadges: [],
    }
  }

  const existing = await getEarnedBadges()
  if (existing.status_code !== 200) {
    return {
      status_code: 500,
      error: 'Failed to read existing badges before award',
    }
  }

  const existingIds = ensureArray(existing.data)
  const newBadges = computedBadgeIds.filter((id) => !existingIds.includes(id))

  if (newBadges.length === 0) {
    return {
      status_code: 200,
      data: existingIds,
      earnedDates: ensureObject(existing.earnedDates),
      newBadges: [],
    }
  }

  const timestamp = earnedAt || new Date().toISOString()
  const newBadgeDates = {}

  newBadges.forEach((badgeId) => {
    newBadgeDates[badgeId] = timestamp
  })

  const merged = await mergeEarnedBadges(newBadges, newBadgeDates)

  return {
    status_code: merged.status_code,
    data: merged.data || existingIds,
    earnedDates: merged.earnedDates || ensureObject(existing.earnedDates),
    newBadges,
  }
}

export default {
  BADGE_DEFINITIONS,
  evaluateBadgeIds,
  getEarnedBadges,
  mergeEarnedBadges,
  awardBadgesFromStats,
}
