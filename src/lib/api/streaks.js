// Local streak + rewards API for the new action-plan system.
// This file owns completion persistence, streak recomputation, badge awarding, and coin totals.

import { getItem, setItem, KEYS } from './storageAdapter.js'
import { BADGE_DEFINITIONS, mergeEarnedBadges } from './badges.js'
import {
  toLocalISODate,
  isDueOnDate,
  computeCurrentStreak,
  computeBestStreak,
} from '../schedule.js'

export const COINS_PER_COMPLETION = 20

async function readPlans() {
  const list = await getItem(KEYS.ACTION_PLANS)
  return Array.isArray(list) ? list : []
}

async function persistPlans(list) {
  await setItem(KEYS.ACTION_PLANS, list)
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
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

// This is the main function for computing streaks, badges, and coins for a given plan on a given date.
function computePlanStats(plan, todayISO = toLocalISODate()) {
  const taskLike = normalizeTaskLike(plan)
  const totalCompletions = Object.keys(taskLike.completionLog).filter((d) => taskLike.completionLog[d] === true).length

  // If there's a schedule, we compute streaks based on due dates. If not, we compute based on consecutive completion days.
  if (taskLike.schedule) {
    const current = computeCurrentStreak(taskLike, todayISO)
    const longest = computeBestStreak(taskLike)
    return { current, longest, totalCompletions }
  }

  // For unscheduled plans, we treat any day with a completion as "streaky" and compute the longest run of consecutive completion days.
  const completedDates = Object.keys(taskLike.completionLog).filter((d) => taskLike.completionLog[d] === true).sort()
  let best = 0
  let current = 0
  let prev = null

  // Iterate through the sorted completion dates and count consecutive runs.
  completedDates.forEach((iso) => {
    if (!prev) {
      current = 1
    } else {
      const a = new Date(`${prev}T00:00:00`)
      const b = new Date(`${iso}T00:00:00`)
      const diff = Math.round((b - a) / (24 * 60 * 60 * 1000))
      current = diff === 1 ? current + 1 : 1
    }
    if (current > best) best = current
    prev = iso
  })

  const todayCurrent = taskLike.completionLog[todayISO] ? current : 0
  return { current: todayCurrent, longest: best, totalCompletions }
}

// This function evaluates which badges should be awarded based on the current stats of the plan.
function evaluateBadges({ current, longest, totalCompletions }) {
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

// Main API functions for marking completions and incompletions, which handle all the logic around updating streaks, awarding badges, and adjusting coin totals.
async function readCoinStore() {
  const store = await getItem(KEYS.COINS)
  return store && typeof store === 'object' && !Array.isArray(store) ? store : {}
}

// For testing and debugging: a function to reset all streak and reward data.
export async function getCoins(userId) {
  const store = await readCoinStore()
  const total = userId == null ? 0 : Number(store[String(userId)] || 0)
  return { status_code: 200, data: { total } }
}

async function setCoins(userId, total) {
  if (userId == null) return 0
  const store = await readCoinStore()
  store[String(userId)] = Math.max(0, Number(total) || 0)
  await setItem(KEYS.COINS, store)
  return store[String(userId)]
}

function normalizeMilestones(milestoneRewards = []) {
  return (Array.isArray(milestoneRewards) ? milestoneRewards : [])
    .map((m) => ({
      days: Number(m?.days) || 0,
      coins: Math.max(0, Number(m?.coins) || 0),
      badge: m?.badge || '',
    }))
    .filter((m) => m.days > 0)
    .sort((a, b) => a.days - b.days)
}

export async function markComplete(actionPlanId, dateISO = toLocalISODate(), milestoneRewards = []) {
  try {
    const list = await readPlans()
    const idx = list.findIndex((p) => String(p.id) === String(actionPlanId))
    if (idx === -1) return { status_code: 500, error: 'Action plan not found' }

    // Prevent marking future dates as complete.
    const todayISO = toLocalISODate()
    if (dateISO > todayISO) {
      return { status_code: 400, error: 'Cannot mark future dates as complete' }
    }

    // First we check if the plan is due on the given date. If not, we return an error without modifying anything.
    const plan = { ...list[idx] }
    const schedule = getSchedule(plan)
    if (schedule && !isDueOnDate(schedule, dateISO)) {
      return { status_code: 400, error: 'This action plan is not due on that date' }
    }

    // If the plan is already marked complete for that date, we simply return the current stats without modifying anything.
    const completedDates = ensureObject(plan.completedDates)
    if (completedDates[dateISO] === true) {
      const stats = computePlanStats(plan, dateISO)
      const coinsResp = await getCoins(plan.assigneeId)
      return {
        status_code: 200,
        data: {
          ...stats,
          earnedBadges: Array.isArray(plan.earnedBadges) ? plan.earnedBadges : [],
          newBadges: [],
          coinsEarned: 0,
          milestoneCoinsEarned: 0,
          badgeCoinsEarned: 0,
          totalCoins: Number(coinsResp?.data?.total || 0),
          awardedMilestones: Array.isArray(plan.awardedMilestones) ? plan.awardedMilestones : [],
          badgeEarnedDates: ensureObject(plan.badgeEarnedDates),
        },
      }
    }

    completedDates[dateISO] = true
    plan.completedDates = completedDates

    const stats = computePlanStats(plan, dateISO)
    const existingBadges = Array.isArray(plan.earnedBadges) ? plan.earnedBadges : []
    const computedBadges = evaluateBadges(stats)

    const milestones = normalizeMilestones(milestoneRewards)
    const existingAwardedMilestones = Array.isArray(plan.awardedMilestones) ? plan.awardedMilestones : []
    const hitMilestones = milestones.filter((m) => stats.longest >= m.days)
    const newMilestones = hitMilestones.filter((m) => !existingAwardedMilestones.includes(m.days))
    const milestoneBadgeIds = newMilestones.map((m) => m.badge).filter(Boolean)

    const allEarnedBadges = Array.from(new Set([...existingBadges, ...computedBadges, ...milestoneBadgeIds]))
    const newBadges = [
      ...computedBadges.filter((id) => !existingBadges.includes(id)),
      ...milestoneBadgeIds.filter((id) => !existingBadges.includes(id) && !computedBadges.includes(id)),
    ]

    const rewardedCompletionDates = ensureObject(plan.rewardedCompletionDates)
    let coinsEarned = 0
    if (!rewardedCompletionDates[dateISO]) {
      rewardedCompletionDates[dateISO] = true
      coinsEarned = COINS_PER_COMPLETION
    }
    plan.rewardedCompletionDates = rewardedCompletionDates

    let badgeCoinsEarned = 0
    const badgeEarnedDates = ensureObject(plan.badgeEarnedDates)
    newBadges.forEach((badgeId) => {
      const def = BADGE_DEFINITIONS.find((b) => b.id === badgeId)
      if (def?.coins) badgeCoinsEarned += Number(def.coins) || 0
      if (!badgeEarnedDates[badgeId]) badgeEarnedDates[badgeId] = dateISO
    })

    const milestoneCoinsEarned = newMilestones.reduce((sum, milestone) => sum + (Number(milestone.coins) || 0), 0)
    const totalDelta = coinsEarned + badgeCoinsEarned + milestoneCoinsEarned

    // Finally, we persist all the updated data and return the new stats, badges, and coin totals.
    let totalCoins = null
    if (plan.assigneeId != null) {
      const prevCoinsResp = await getCoins(plan.assigneeId)
      const prevCoins = Number(prevCoinsResp?.data?.total || 0)
      totalCoins = await setCoins(plan.assigneeId, prevCoins + totalDelta)
      await mergeEarnedBadges(plan.assigneeId, newBadges, badgeEarnedDates)
    }

    plan.earnedBadges = allEarnedBadges
    plan.badgeEarnedDates = badgeEarnedDates
    plan.currentStreak = stats.current
    plan.bestStreak = stats.longest
    plan.totalCompletions = stats.totalCompletions
    plan.awardedMilestones = Array.from(new Set([...existingAwardedMilestones, ...hitMilestones.map((m) => m.days)]))

    list[idx] = plan
    await persistPlans(list)

    return {
      status_code: 200,
      data: {
        current: stats.current,
        longest: stats.longest,
        totalCompletions: stats.totalCompletions,
        earnedBadges: allEarnedBadges,
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
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function markIncomplete(actionPlanId, dateISO = toLocalISODate()) {
  try {
    const list = await readPlans()
    const idx = list.findIndex((p) => String(p.id) === String(actionPlanId))
    if (idx === -1) return { status_code: 500, error: 'Action plan not found' }

    const plan = { ...list[idx] }
    const completedDates = ensureObject(plan.completedDates)
    delete completedDates[dateISO]
    plan.completedDates = completedDates

    const stats = computePlanStats(plan, dateISO)
    plan.currentStreak = stats.current
    plan.bestStreak = stats.longest
    plan.totalCompletions = stats.totalCompletions

    list[idx] = plan
    await persistPlans(list)

    const coinsResp = await getCoins(plan.assigneeId)

    return {
      status_code: 200,
      data: {
        current: stats.current,
        longest: stats.longest,
        totalCompletions: stats.totalCompletions,
        earnedBadges: Array.isArray(plan.earnedBadges) ? plan.earnedBadges : [],
        newBadges: [],
        coinsEarned: 0,
        badgeCoinsEarned: 0,
        milestoneCoinsEarned: 0,
        totalCoins: Number(coinsResp?.data?.total || 0),
        awardedMilestones: Array.isArray(plan.awardedMilestones) ? plan.awardedMilestones : [],
        badgeEarnedDates: ensureObject(plan.badgeEarnedDates),
      },
    }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export default {
  getCoins,
  markComplete,
  markIncomplete,
}
