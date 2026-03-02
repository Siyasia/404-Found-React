// SWAP : Mapper between the Habit Wizard and local models.
//
// This pure, side-effect-free module converts the raw Habit Wizard output
// into the local `goal` and `actionPlans` shapes the UI expects. Keep this
// mapping stable so ParentHomepage/ChildHomepage and other views can remain
// unchanged. When the backend provides canonical shapes, either update this
// mapper to adapt server output or remove it entirely.

export function mapWizardPayload(raw) {
  if (!raw || typeof raw !== 'object') return { goal: null, actionPlans: [] }

  const now = new Date().toISOString()

  // Map top-level goal fields
  const goal = {
    id: null,
    title: raw.title || raw.goalTitle || raw.goalName || '',
    goalType: (raw.type === 'build' ? 'build' : raw.type === 'break' ? 'break' : raw.type || null),
    whyItMatters: raw.whyItMatters || '',
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    assigneeId: raw.assignee || null,
    assigneeName: raw.assigneeName || '',
    triggers: Array.isArray(raw.triggers) ? raw.triggers.slice() : [],
    replacements: Array.isArray(raw.replacements)
      ? raw.replacements.map((r) => (typeof r === 'string' ? r : r.title || ''))
      : [],
    location: raw.location || '',
    makeItEasier: Array.isArray(raw.makeItEasier) ? raw.makeItEasier.slice() : [],
    milestoneRewards: Array.isArray(raw.milestoneRewards) ? raw.milestoneRewards.slice() : [],
    rewardGoalTitle: raw.rewardGoalTitle || '',
    rewardGoalCostCoins: raw.rewardGoalCostCoins || '',
    createdAt: now,
  }

  // Helper: normalize schedule -> frequency string used by the UI
  function scheduleToFrequency(schedule) {
    if (!schedule || typeof schedule !== 'object') return 'daily'
    const repeat = (schedule.repeat || '').toString().toLowerCase()
    if (repeat === 'daily' || repeat === 'day' || repeat === 'daily') return 'daily'
    // daysOfWeek: 0=Sun..6=Sat
    const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.slice() : []
    if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return 'weekdays'
    if (days.length === 2 && ((days.includes(0) && days.includes(6)) || (days.includes(6) && days.includes(0)))) return 'weekends'
    if (repeat === 'weekly') return 'weekly'
    if (repeat === 'monthly') return 'monthly'
    return 'daily'
  }

  // Map tasks to action plans, inferring taskType and frequency from goalType and schedule
  const tasks = Array.isArray(raw.tasks) ? raw.tasks.slice() : []

  // For build goals, tasks become build-habit action plans with steps. For break goals, tasks become break-habit action plans with replacements.
  const actionPlans = tasks.map((t) => {
    const taskType = goal.goalType === 'build' ? 'build-habit' : goal.goalType === 'break' ? 'break-habit' : 'simple'
    const frequency = scheduleToFrequency(t.schedule || t.schedule || {})

    // Base action plan fields common to all types
    const base = {
      id: null,
      goalId: null,
      title: t.title || '',
      taskType,
      assigneeId: goal.assigneeId || null,
      assigneeName: goal.assigneeName || '',
      frequency,
      completedDates: {},
      streak: 0,
      status: 'pending',
      createdAt: now,
      createdById: null,
      createdByName: '',
      createdByRole: 'parent',
    }

    if (taskType === 'build-habit') {
      // place the actionable title into steps so existing UI shows it
      return { ...base, steps: t.steps || (t.title ? [t.title] : []), replacements: [] }
    }

    // break-habit
    return { ...base, steps: [], replacements: Array.isArray(goal.replacements) ? goal.replacements.slice() : [] }
  })

  return { goal, actionPlans }
}

export default mapWizardPayload
