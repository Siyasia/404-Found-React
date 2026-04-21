import { actionPlanList, actionPlanUpdate } from './actionPlans.js'
import {
  BADGE_DEFINITIONS,
  awardBadgesFromStats,
  getEarnedBadges,
  mergeEarnedBadges,
} from './badges.js'
import { getGameProfile, updateGameProfile } from './game.js'

import {
  toLocalISODate,
  isDueOnDate,
  computeCurrentStreak,
  computeBestStreak,
} from '../schedule.js'

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

async function readPlans() {
  const response = await actionPlanList()
  return response?.status_code === 200 && Array.isArray(response?.plans)
    ? response.plans
    : []
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {}
}

function ensureArray(value) {
  return Array.isArray(value) ? [...value] : []
}

function getSchedule(plan) {
  if (plan?.schedule && typeof plan.schedule === 'object') return plan.schedule
  if (plan?.frequency && typeof plan.frequency === 'object') return plan.frequency
  return null
}

function normalizeTaskLike(plan) {
  const schedule = getSchedule(plan)
  const completionLog = ensureObject(plan?.completedDates)

  return {
    schedule,
    completionLog,
    stats: {
      bestStreak: Number(plan?.bestStreak || 0) || 0,
    },
  }
}

function computePlanStats(plan, todayISO = toLocalISODate()) {
  const taskLike = normalizeTaskLike(plan)
  const totalCompletions = Object
    .keys(taskLike.completionLog)
    .filter((dateKey) => taskLike.completionLog[dateKey] === true)
    .length

  if (taskLike.schedule) {
    const current = computeCurrentStreak(taskLike, todayISO)
    const longest = computeBestStreak(taskLike)
    return { current, longest, totalCompletions }
  }

  const completedDates = Object
    .keys(taskLike.completionLog)
    .filter((dateKey) => taskLike.completionLog[dateKey] === true)
    .sort()

  let best = 0
  let rolling = 0
  let previous = null

  completedDates.forEach((iso) => {
    if (!previous) {
      rolling = 1
    } else {
      const previousDate = new Date(`${previous}T00:00:00`)
      const nextDate = new Date(`${iso}T00:00:00`)
      const diffDays = Math.round((nextDate - previousDate) / (24 * 60 * 60 * 1000))
      rolling = diffDays === 1 ? rolling + 1 : 1
    }

    if (rolling > best) best = rolling
    previous = iso
  })

  const current = taskLike.completionLog[todayISO] ? rolling : 0
  return { current, longest: best, totalCompletions }
}

async function readCurrentProfile() {
  const response = await getGameProfile()
  if (!isOk(response)) return null
  return response?.game_profile ?? response?.profile ?? null
}

export async function getCoins() {
  const profile = await readCurrentProfile()
  const total = Number(profile?.coins || 0)

  return {
    status_code: profile ? 200 : 500,
    data: { total },
  }
}

async function setCoins(total) {
  const safeTotal = Math.max(0, Number(total) || 0)

  const response = await updateGameProfile({ coins: safeTotal })
  if (!isOk(response)) {
    throw new Error(response?.error || 'Failed to persist coins to game profile')
  }

  return safeTotal
}

function normalizeMilestones(milestoneRewards = []) {
  return ensureArray(milestoneRewards)
    .map((milestone) => ({
      days: Number(milestone?.days) || 0,
      coins: Math.max(0, Number(milestone?.coins) || 0),
      badge: milestone?.badge || '',
    }))
    .filter((milestone) => milestone.days > 0)
    .sort((a, b) => a.days - b.days)
}

function sumBadgeCoins(badgeIds = []) {
  return ensureArray(badgeIds).reduce((sum, badgeId) => {
    const definition = BADGE_DEFINITIONS.find((badge) => badge.id === badgeId)
    return sum + (Number(definition?.coins) || 0)
  }, 0)
}

export async function markComplete(actionPlanId, dateISO = toLocalISODate(), milestoneRewards = []) {
  try {
    const plans = await readPlans()
    const index = plans.findIndex((plan) => String(plan.id) === String(actionPlanId))

    if (index === -1) {
      return { status_code: 500, error: 'Action plan not found' }
    }

    const todayISO = toLocalISODate()
    if (dateISO > todayISO) {
      return { status_code: 400, error: 'Cannot mark future dates as complete' }
    }

    const plan = { ...plans[index] }
    const schedule = getSchedule(plan)

    if (schedule && !isDueOnDate(schedule, dateISO)) {
      return { status_code: 400, error: 'This action plan is not due on that date' }
    }

    const completedDates = ensureObject(plan.completedDates)

    if (completedDates[dateISO] === true) {
      const stats = computePlanStats(plan, dateISO)
      const coinsResponse = await getCoins()
      const badgeResponse = await getEarnedBadges()

      return {
        status_code: 200,
        data: {
          ...stats,
          earnedBadges: badgeResponse?.data || [],
          newBadges: [],
          coinsEarned: 0,
          milestoneCoinsEarned: 0,
          badgeCoinsEarned: 0,
          totalCoins: Number(coinsResponse?.data?.total || 0),
          awardedMilestones: ensureArray(plan.awardedMilestones),
          badgeEarnedDates: badgeResponse?.earnedDates || {},
        },
      }
    }

    completedDates[dateISO] = true
    plan.completedDates = completedDates

    const stats = computePlanStats(plan, dateISO)

    const milestones = normalizeMilestones(milestoneRewards)
    const existingAwardedMilestones = ensureArray(plan.awardedMilestones)
    const hitMilestones = milestones.filter((milestone) => stats.longest >= milestone.days)
    const newMilestones = hitMilestones.filter(
      (milestone) => !existingAwardedMilestones.includes(milestone.days)
    )

    const rewardedCompletionDates = ensureObject(plan.rewardedCompletionDates)
    let coinsEarned = 0

    if (!rewardedCompletionDates[dateISO]) {
      rewardedCompletionDates[dateISO] = true
      coinsEarned = COINS_PER_COMPLETION
    }

    const badgeAwardResponse = await awardBadgesFromStats(stats, dateISO)
    if (badgeAwardResponse.status_code !== 200) {
      return {
        status_code: 500,
        error: badgeAwardResponse?.error || 'Failed to persist earned badges',
      }
    }

    const statBadges = ensureArray(badgeAwardResponse.newBadges)
    const earnedBadgesFromStats = ensureArray(badgeAwardResponse.data)
    const badgeEarnedDates = ensureObject(badgeAwardResponse.earnedDates)

    const milestoneBadges = newMilestones
      .map((milestone) => milestone?.badge)
      .filter(Boolean)

    const existingEarnedSet = new Set(earnedBadgesFromStats)
    const newlyEarnedMilestoneBadges = []

    milestoneBadges.forEach((badgeId) => {
      if (!existingEarnedSet.has(badgeId)) {
        existingEarnedSet.add(badgeId)
        newlyEarnedMilestoneBadges.push(badgeId)

        if (!badgeEarnedDates[badgeId]) {
          badgeEarnedDates[badgeId] = dateISO
        }
      }
    })

    let earnedBadges = Array.from(existingEarnedSet)

    if (newlyEarnedMilestoneBadges.length > 0) {
      const mergeResponse = await mergeEarnedBadges(newlyEarnedMilestoneBadges, badgeEarnedDates)

      if (mergeResponse.status_code !== 200) {
        return {
          status_code: 500,
          error: mergeResponse?.error || 'Failed to persist milestone badges',
        }
      }

      earnedBadges = ensureArray(mergeResponse.data)
      Object.assign(badgeEarnedDates, ensureObject(mergeResponse.earnedDates))
    }

    const newBadges = Array.from(new Set([
      ...statBadges,
      ...newlyEarnedMilestoneBadges,
    ]))

    const badgeCoinsEarned = sumBadgeCoins(newBadges)
    const milestoneCoinsEarned = newMilestones.reduce(
      (sum, milestone) => sum + (Number(milestone.coins) || 0),
      0
    )

    const totalDelta = coinsEarned + badgeCoinsEarned + milestoneCoinsEarned

    const previousCoinsResponse = await getCoins()
    const previousCoins = Number(previousCoinsResponse?.data?.total || 0)
    const totalCoins = await setCoins(previousCoins + totalDelta)

    plan.currentStreak = stats.current
    plan.bestStreak = stats.longest
    plan.totalCompletions = stats.totalCompletions
    plan.awardedMilestones = Array.from(
      new Set([
        ...existingAwardedMilestones,
        ...hitMilestones.map((milestone) => milestone.days),
      ])
    )
    plan.rewardedCompletionDates = rewardedCompletionDates

    const updateResponse = await actionPlanUpdate(plan.id, {
      completedDates: plan.completedDates,
      streak: stats.current,
      meta: {
        ...(plan.meta || {}),
        currentStreak: stats.current,
        bestStreak: stats.longest,
        totalCompletions: stats.totalCompletions,
        awardedMilestones: plan.awardedMilestones,
        rewardedCompletionDates,
        earnedBadges,
        badgeEarnedDates,
      },
    })

    if (!updateResponse || updateResponse.status_code !== 200) {
      return {
        status_code: 500,
        error: updateResponse?.error || 'Failed to persist action plan update',
      }
    }

    return {
      status_code: 200,
      data: {
        current: stats.current,
        longest: stats.longest,
        totalCompletions: stats.totalCompletions,
        earnedBadges,
        newBadges,
        coinsEarned,
        badgeCoinsEarned,
        milestoneCoinsEarned,
        totalCoins,
        awardedMilestones: plan.awardedMilestones,
        newMilestones,
        badgeEarnedDates,
      },
    }
  } catch (error) {
    return { status_code: 500, error: error?.message || String(error) }
  }
}

export async function markIncomplete(actionPlanId, dateISO = toLocalISODate()) {
  try {
    const plans = await readPlans()
    const index = plans.findIndex((plan) => String(plan.id) === String(actionPlanId))

    if (index === -1) {
      return { status_code: 500, error: 'Action plan not found' }
    }

    const plan = { ...plans[index] }
    const completedDates = ensureObject(plan.completedDates)
    delete completedDates[dateISO]
    plan.completedDates = completedDates

    const stats = computePlanStats(plan, dateISO)
    plan.currentStreak = stats.current
    plan.bestStreak = stats.longest
    plan.totalCompletions = stats.totalCompletions

    const updateResponse = await actionPlanUpdate(plan.id, {
      completedDates: plan.completedDates,
      streak: stats.current,
      meta: {
        ...(plan.meta || {}),
        currentStreak: stats.current,
        bestStreak: stats.longest,
        totalCompletions: stats.totalCompletions,
        awardedMilestones: ensureArray(plan.awardedMilestones),
        rewardedCompletionDates: ensureObject(plan.rewardedCompletionDates),
      },
    })

    if (!updateResponse || updateResponse.status_code !== 200) {
      return {
        status_code: 500,
        error: updateResponse?.error || 'Failed to persist action plan update',
      }
    }

    const coinsResponse = await getCoins()
    const badgeResponse = await getEarnedBadges()

    return {
      status_code: 200,
      data: {
        current: stats.current,
        longest: stats.longest,
        totalCompletions: stats.totalCompletions,
        earnedBadges: badgeResponse?.data || [],
        newBadges: [],
        coinsEarned: 0,
        badgeCoinsEarned: 0,
        milestoneCoinsEarned: 0,
        totalCoins: Number(coinsResponse?.data?.total || 0),
        awardedMilestones: ensureArray(plan.awardedMilestones),
        badgeEarnedDates: badgeResponse?.earnedDates || {},
      },
    }
  } catch (error) {
    return { status_code: 500, error: error?.message || String(error) }
  }
}