import { actionPlanComplete, actionPlanIncomplete } from './actionPlans.js'
import { getGameProfile } from './game.js'
import { toLocalISODate } from '../schedule.js'

export const COINS_PER_COMPLETION = 20

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

async function readCurrentProfile(userId = null) {
  const response = await getGameProfile(userId)
  if (!isOk(response)) return null
  return response?.game_profile ?? response?.profile ?? null
}

export async function getCoins(userId = null) {
  const profile = await readCurrentProfile(userId)
  const total = Number(profile?.coins || 0)

  return {
    status_code: profile ? 200 : 500,
    data: { total },
  }
}

export async function markComplete(actionPlanId, dateISO = toLocalISODate()) {
  try {
    const response = await actionPlanComplete(actionPlanId, dateISO)

    if (!response || !isOk(response)) {
      return {
        status_code: response?.status_code || 500,
        error: response?.error || 'Failed to complete action plan',
      }
    }

    const payload = response?.data ?? {}

    return {
      status_code: 200,
      data: {
        current: Number(payload.current ?? payload.currentStreak ?? 0),
        longest: Number(payload.longest ?? payload.bestStreak ?? 0),
        totalCompletions: Number(payload.totalCompletions ?? 0),
        earnedBadges: Array.isArray(payload.earnedBadges) ? payload.earnedBadges : [],
        newBadges: Array.isArray(payload.newBadges) ? payload.newBadges : [],
        coinsEarned: Number(payload.coinsEarned || 0),
        badgeCoinsEarned: Number(payload.badgeCoinsEarned || 0),
        milestoneCoinsEarned: Number(payload.milestoneCoinsEarned || 0),
        totalCoins: Number(payload.totalCoins || 0),
        awardedMilestones: Array.isArray(payload.awardedMilestones) ? payload.awardedMilestones : [],
        badgeEarnedDates: payload.badgeEarnedDates && typeof payload.badgeEarnedDates === 'object'
          ? payload.badgeEarnedDates
          : {},
        assigneeId: payload.assigneeId ?? null,
        assigneeName: payload.assigneeName ?? '',
        plan: payload.plan ?? null,
        profile: payload.profile ?? null,
      },
    }
  } catch (error) {
    return { status_code: 500, error: error?.message || String(error) }
  }
}

export async function markIncomplete(actionPlanId, dateISO = toLocalISODate()) {
  try {
    const response = await actionPlanIncomplete(actionPlanId, dateISO)

    if (!response || !isOk(response)) {
      return {
        status_code: response?.status_code || 500,
        error: response?.error || 'Failed to uncomplete action plan',
      }
    }

    const payload = response?.data ?? {}

    return {
      status_code: 200,
      data: {
        current: Number(payload.current ?? payload.currentStreak ?? 0),
        longest: Number(payload.longest ?? payload.bestStreak ?? 0),
        totalCompletions: Number(payload.totalCompletions ?? 0),
        earnedBadges: Array.isArray(payload.earnedBadges) ? payload.earnedBadges : [],
        newBadges: Array.isArray(payload.newBadges) ? payload.newBadges : [],
        coinsEarned: Number(payload.coinsEarned || 0),
        badgeCoinsEarned: Number(payload.badgeCoinsEarned || 0),
        milestoneCoinsEarned: Number(payload.milestoneCoinsEarned || 0),
        totalCoins: Number(payload.totalCoins || 0),
        awardedMilestones: Array.isArray(payload.awardedMilestones) ? payload.awardedMilestones : [],
        badgeEarnedDates: payload.badgeEarnedDates && typeof payload.badgeEarnedDates === 'object'
          ? payload.badgeEarnedDates
          : {},
        assigneeId: payload.assigneeId ?? null,
        assigneeName: payload.assigneeName ?? '',
        plan: payload.plan ?? null,
        profile: payload.profile ?? null,
      },
    }
  } catch (error) {
    return { status_code: 500, error: error?.message || String(error) }
  }
}
