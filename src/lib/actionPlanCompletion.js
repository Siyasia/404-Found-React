// PHASE 5: Shared action-plan completion toggle.
// Keeps Home / GoalCard / HabitPlanList thin by centralizing the completion update flow.

import { markComplete, markIncomplete } from './api/streaks.js'

export async function togglePlanCompletion({
  plan,
  todayISO,
  milestoneRewards = [],
  setActionPlans,
  onBadges,
  onCoins,
  onAfterToggle,
}) {
  if (!plan?.id || !todayISO) return null

  const completedToday =
    plan?.completedToday === true || plan?.completedDates?.[todayISO] === true

  const response = completedToday
    ? await markIncomplete(plan.id, todayISO)
    : await markComplete(plan.id, todayISO, milestoneRewards)

  const ok =
    response &&
    (response.status_code === 200 ||
      response.status === 200 ||
      response.status_code === '200' ||
      response.status === '200')

  if (!ok) return null

  const data = response.data || {}
  const nextCompletedDates = { ...(plan.completedDates || {}) }
  if (completedToday) delete nextCompletedDates[todayISO]
  else nextCompletedDates[todayISO] = true

  const updatedPlan = {
    ...plan,
    completedToday: !completedToday,
    completedDates: nextCompletedDates,
    currentStreak: Number(data.current ?? data.currentStreak ?? plan.currentStreak ?? 0) || 0,
    bestStreak: Number(data.longest ?? data.bestStreak ?? plan.bestStreak ?? 0) || 0,
    totalCompletions: Number(data.totalCompletions ?? plan.totalCompletions ?? 0) || 0,
    earnedBadges: Array.isArray(data.earnedBadges) ? data.earnedBadges : (Array.isArray(plan.earnedBadges) ? plan.earnedBadges : []),
    awardedMilestones: Array.isArray(data.awardedMilestones) ? data.awardedMilestones : (Array.isArray(plan.awardedMilestones) ? plan.awardedMilestones : []),
    badgeEarnedDates: data.badgeEarnedDates || plan.badgeEarnedDates || {},
    streakData: {
      current: Number(data.current ?? data.currentStreak ?? plan.currentStreak ?? 0) || 0,
      longest: Number(data.longest ?? data.bestStreak ?? plan.bestStreak ?? 0) || 0,
      earnedBadges: Array.isArray(data.earnedBadges) ? data.earnedBadges : (Array.isArray(plan.earnedBadges) ? plan.earnedBadges : []),
    },
  }

  if (typeof setActionPlans === 'function') {
    setActionPlans((prev) =>
      (Array.isArray(prev) ? prev : []).map((existing) =>
        String(existing.id) === String(plan.id) ? updatedPlan : existing
      )
    )
  }

  if (Array.isArray(data.newBadges) && data.newBadges.length > 0 && typeof onBadges === 'function') {
    onBadges(data.newBadges)
  }

  if (typeof onCoins === 'function') {
    onCoins({
      delta:
        Number(data.coinsEarned || 0) +
        Number(data.badgeCoinsEarned || 0) +
        Number(data.milestoneCoinsEarned || 0),
      total: data.totalCoins != null ? Number(data.totalCoins) : null,
    })
  }

  const result = { updatedPlan, data }
  if (typeof onAfterToggle === 'function') onAfterToggle(result)
  return result
}

export default togglePlanCompletion
