// SWAP: Mapper between the Habit Wizard and local models.
// This file is intentionally pure and side-effect free.

import { formatScheduleLabel, REPEAT } from './schedule.js'

// The main export takes the raw form data from the Habit Wizard and maps it into the normalized shape expected by our local models and API.
function normalizeSchedule(schedule) {
  const repeatRaw = schedule?.repeat || schedule?.frequency || ''
  const up = String(repeatRaw).toUpperCase()

  const repeat = Object.values(REPEAT).includes(up)
    ? up
    : (() => {
        const lower = String(repeatRaw).toLowerCase()
        if (lower === 'daily') return REPEAT.DAILY
        if (lower === 'weekdays') return REPEAT.WEEKDAYS
        if (lower === 'weekends') return REPEAT.WEEKENDS
        if (lower === 'custom' || lower === 'custom_dow') return REPEAT.CUSTOM_DOW
        if (lower === 'interval' || lower === 'interval_days') return REPEAT.INTERVAL_DAYS
        return REPEAT.DAILY
      })()

  const daysOfWeek = Array.isArray(schedule?.daysOfWeek)
    ? schedule.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : []

  const intervalDays = Number(schedule?.intervalDays) > 0 ? Number(schedule.intervalDays) : 1

  return {
    repeat,
    daysOfWeek,
    intervalDays,
    startDate: schedule?.startDate || null,
    endDate: schedule?.endDate || null,
  }
}

// Main mapping function
export function mapWizardPayload(raw) {
  if (!raw || typeof raw !== 'object') return { goal: null, actionPlans: [] }

  const now = new Date().toISOString()

  const goal = {
    id: null,
    title: raw.title || raw.goalTitle || raw.goalName || '',
    goalType: raw.type === 'build' ? 'build' : raw.type === 'break' ? 'break' : raw.type || null,
    whyItMatters: raw.whyItMatters || raw.reason || '',
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    assigneeId: raw.assignee || raw.assigneeId || null,
    assigneeName: raw.assigneeName ?? null,
    createdAt: now,
    createdById: raw.createdById ?? null,
    createdByName: raw.createdByName ?? null,
    createdByRole: raw.createdByRole ?? null,
    triggers: Array.isArray(raw.triggers) ? raw.triggers.slice() : [],
    replacements: Array.isArray(raw.replacements)
      ? raw.replacements.map((r) => (typeof r === 'string' ? r : r.title || ''))
      : [],
    location: raw.location || '',
    makeItEasier: Array.isArray(raw.makeItEasier) ? raw.makeItEasier.slice() : [],
    milestoneRewards: Array.isArray(raw.milestoneRewards) ? raw.milestoneRewards.slice() : [],
    rewardGoalTitle: raw.rewardGoalTitle || '',
    rewardGoalCostCoins: Number(raw.rewardGoalCostCoins || 0),
  }

  const tasks = Array.isArray(raw.tasks) ? raw.tasks.slice() : []

  // Infer task types based on goal type and presence of certain fields, but allow explicit override from the raw data.
  const actionPlans = tasks.map((t) => {
    const inferredType =
      goal.goalType === 'build'
        ? 'build-habit'
        : goal.goalType === 'break'
          ? 'break-habit'
          : 'simple'

    const taskType = t.taskType || inferredType
    const schedule = t?.schedule ? normalizeSchedule(t.schedule) : null
    const frequencyLabel = schedule ? formatScheduleLabel(schedule) : ''

    // Base shape for all task types
    const base = {
      id: null,
      goalId: null,
      title: t.title || t.name || '',
      taskType,
      assigneeId: t.assigneeId ?? t.assignee ?? goal.assigneeId ?? null,
      assigneeName: t.assigneeName ?? goal.assigneeName ?? null,
      schedule,
      frequency: schedule,
      frequencyLabel,
      startDate: schedule?.startDate || null,
      endDate: schedule?.endDate || null,
      completedDates:
        t.completedDates && typeof t.completedDates === 'object' && !Array.isArray(t.completedDates)
          ? { ...t.completedDates }
          : {},
      earnedBadges: Array.isArray(t.earnedBadges) ? t.earnedBadges.slice() : [],
      currentStreak: Number(t.currentStreak ?? t.streak ?? 0),
      bestStreak: Number(t.bestStreak ?? t.longest ?? 0),
      totalCompletions: Number(t.totalCompletions ?? t.total ?? 0),
      awardedMilestones: Array.isArray(t.awardedMilestones) ? t.awardedMilestones.slice() : [],
      status: t.status || 'pending',
      createdAt: now,
      createdById: t.createdById ?? raw.createdById ?? null,
      createdByName: t.createdByName ?? raw.createdByName ?? null,
      createdByRole: t.createdByRole ?? raw.createdByRole ?? 'parent',
      needsApproval: !!t.needsApproval,
      approvedByParentId: t.approvedByParentId ?? null,
      approvedAt: t.approvedAt ?? null,
      meta: t.meta && typeof t.meta === 'object' && !Array.isArray(t.meta) ? { ...t.meta } : {},
    }

    if (taskType === 'build-habit') {
      return {
        ...base,
        steps: Array.isArray(t.steps) ? t.steps.slice() : t.title ? [t.title] : [],
        replacements: Array.isArray(t.replacements) ? t.replacements.slice() : [],
      }
    }

    if (taskType === 'break-habit') {
      return {
        ...base,
        steps: Array.isArray(t.steps) ? t.steps.slice() : [],
        replacements: Array.isArray(t.replacements)
          ? t.replacements.slice()
          : Array.isArray(goal.replacements)
            ? goal.replacements.slice()
            : [],
      }
    }

    return {
      ...base,
      steps: Array.isArray(t.steps) ? t.steps.slice() : [],
    }
  })

  return { goal, actionPlans }
}

export default mapWizardPayload