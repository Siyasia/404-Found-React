import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ParentDashboardTabs.css'

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value)
}

function getSortableDate(value) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatDateLabel(value) {
  if (!value) return 'No date'
  try {
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return 'No date'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: parsed.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    }).format(parsed)
  } catch {
    return value
  }
}

function getTypeKey(goal) {
  const raw = String(goal?.goalType || goal?.type || goal?.taskType || '').toLowerCase()
  if (raw.includes('break')) return 'break'
  return 'build'
}

function asTextList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => (typeof item === 'string' ? item : item?.title || item?.label || ''))
    .filter(Boolean)
}

function getPlanSchedule(plan) {
  if (plan?.schedule && typeof plan.schedule === 'object') return plan.schedule
  if (plan?.frequency && typeof plan.frequency === 'object') return plan.frequency
  return null
}

function toLocalISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isDueOnDate(schedule, dateISO) {
  if (!schedule || typeof schedule !== 'object') return true

  const repeat = String(
    schedule.repeat || schedule.type || schedule.frequency || 'DAILY'
  ).toUpperCase()

  const startDate = schedule.startDate || schedule.startsOn || ''
  const endDate = schedule.endDate || schedule.endsOn || ''

  if (startDate && dateISO < startDate) return false
  if (endDate && dateISO > endDate) return false

  const current = new Date(`${dateISO}T00:00:00`)
  const day = current.getDay()

  if (repeat === 'DAILY') return true
  if (repeat === 'WEEKDAYS') return day >= 1 && day <= 5
  if (repeat === 'WEEKENDS') return day === 0 || day === 6

  if (repeat === 'CUSTOM_DOW') {
    const rawDays = Array.isArray(schedule.daysOfWeek)
      ? schedule.daysOfWeek
      : Array.isArray(schedule.days)
        ? schedule.days
        : []

    const normalized = rawDays.map((value) => String(value).toUpperCase())
    const labels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    return normalized.includes(labels[day])
  }

  return true
}

function isPlanDoneToday(plan, todayISO) {
  if (plan?.completedDates?.[todayISO] === true) return true
  if (plan?.completionLog?.[todayISO] === true) return true
  if (typeof plan?.completedToday === 'boolean') return plan.completedToday
  return false
}

function getRewardSummary(goal) {
  const milestoneCount = Array.isArray(goal?.milestoneRewards)
    ? goal.milestoneRewards.length
    : 0

  if (goal?.rewardType === 'shop' || goal?.rewardShopItemId || goal?.meta?.rewardShopItemId) {
    return milestoneCount > 0
      ? `Shop reward linked • ${milestoneCount} milestones`
      : 'Shop reward linked'
  }

  if (goal?.rewardGoalTitle && goal?.rewardGoalCostCoins) {
    return `${goal.rewardGoalTitle} • ${goal.rewardGoalCostCoins} coins`
  }

  if (goal?.rewardGoalTitle) return goal.rewardGoalTitle
  if (goal?.savingFor) return `Saving for ${goal.savingFor}`
  if (milestoneCount > 0) {
    return `${milestoneCount} milestone reward${milestoneCount === 1 ? '' : 's'}`
  }

  return ''
}

function getSupportSummary(goal) {
  const triggers = asTextList(goal?.triggers)
  const easier = asTextList(goal?.makeItEasier)
  const replacements = asTextList(goal?.replacements)

  if (goal?.location && triggers[0]) return `${goal.location} • ${triggers[0]}`
  if (goal?.location) return goal.location
  if (triggers[0]) return triggers[0]
  if (easier[0]) return easier[0]
  if (replacements[0]) return replacements[0]
  return 'No extra supports saved yet'
}

function getEndStatus(goal, todayISO) {
  if (!goal?.endDate) return 'No end date'

  const today = new Date(`${todayISO}T00:00:00`)
  const end = new Date(`${goal.endDate}T00:00:00`)
  const diffDays = Math.round((end - today) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `Ended ${formatDateLabel(goal.endDate)}`
  if (diffDays === 0) return 'Ends today'
  if (diffDays === 1) return 'Ends tomorrow'
  if (diffDays <= 7) return `Ends in ${diffDays} days`
  return `Ends ${formatDateLabel(goal.endDate)}`
}

function getGoalInsights(goal, plans, todayISO) {
  const safePlans = Array.isArray(plans) ? plans : []

  const dueTodayCount = safePlans.filter((plan) => {
    const schedule = getPlanSchedule(plan)
    if (!schedule) return true
    return isDueOnDate(schedule, todayISO)
  }).length

  const doneTodayCount = safePlans.filter((plan) => isPlanDoneToday(plan, todayISO)).length
  const rewardSummary = getRewardSummary(goal)
  const supportSummary = getSupportSummary(goal)

  return {
    planCount: safePlans.length,
    dueTodayCount,
    doneTodayCount,
    rewardSummary,
    supportSummary,
    hasReward: Boolean(rewardSummary),
    endStatus: getEndStatus(goal, todayISO),
  }
}

function matchesSearch(goal, searchTerm, assigneeLabel = '') {
  if (!searchTerm.trim()) return true

  const needle = searchTerm.trim().toLowerCase()
  const haystack = [
    goal?.title,
    goal?.whyItMatters,
    goal?.location,
    goal?.savingFor,
    goal?.rewardGoalTitle,
    goal?.rewardGoalCostCoins,
    goal?.assigneeName,
    assigneeLabel,
    ...asTextList(goal?.triggers),
    ...asTextList(goal?.makeItEasier),
    ...asTextList(goal?.replacements),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(needle)
}

function sortGoals(goals, sortKey, insightsByGoalId) {
  const safeGoals = Array.isArray(goals) ? [...goals] : []

  safeGoals.sort((a, b) => {
    const aInsights = insightsByGoalId[normalizeId(a.id)] || {}
    const bInsights = insightsByGoalId[normalizeId(b.id)] || {}

    switch (sortKey) {
      case 'oldest':
        return (
          getSortableDate(a?.createdAt || a?.startDate) -
          getSortableDate(b?.createdAt || b?.startDate)
        )

      case 'title':
        return String(a?.title || '').localeCompare(String(b?.title || ''))

      case 'dueToday':
        return (bInsights.dueTodayCount || 0) - (aInsights.dueTodayCount || 0)

      case 'endSoon': {
        const aDate = a?.endDate ? getSortableDate(a.endDate) : Number.MAX_SAFE_INTEGER
        const bDate = b?.endDate ? getSortableDate(b.endDate) : Number.MAX_SAFE_INTEGER
        return aDate - bDate
      }

      case 'recent':
      default:
        return (
          getSortableDate(b?.createdAt || b?.startDate) -
          getSortableDate(a?.createdAt || a?.startDate)
        )
    }
  })

  return safeGoals
}

function GoalColumn({
  type,
  goals,
  plansByGoalId,
  insightsByGoalId,
  assigneeLookup,
  onEdit,
}) {
  const isBuild = type === 'build'
  const icon = isBuild ? '🌱' : '🛡️'
  const title = isBuild ? 'Build goals' : 'Break goals'

  return (
    <section className="goals-column">
      <div
        className={`goals-column-header ${
          isBuild ? 'goals-column-header--build' : 'goals-column-header--break'
        }`}
      >
        <div className="goals-column-header__left">
          <div className="goals-column-header__icon" aria-hidden="true">
            {icon}
          </div>
          <div
            className={`goals-column-header__title ${
              isBuild
                ? 'goals-column-header__title--build'
                : 'goals-column-header__title--break'
            }`}
          >
            {title}
          </div>
        </div>

        <div
          className={`goals-column-header__count ${
            isBuild
              ? 'goals-column-header__count--build'
              : 'goals-column-header__count--break'
          }`}
        >
          {goals.length}
        </div>
      </div>

      <div className="goals-column-scroll">
        {goals.length === 0 ? (
          <div className="goals-column-empty">
            No {isBuild ? 'build' : 'break'} goals match this view yet.
          </div>
        ) : null}

        {goals.map((goal) => {
          const goalId = normalizeId(goal.id)
          const insights = insightsByGoalId[goalId] || {}
          const linkedPlans = plansByGoalId[goalId] || []
          const assigneeName =
            assigneeLookup[normalizeId(goal.assigneeId)] ||
            goal?.assigneeName ||
            'Unassigned'

          return (
            <article key={goalId} className="goals-list-item">
              <div className="goals-list-item__header">
                <div className="goals-list-item__summary">
                  <h3 className="goals-list-item__title app-card-title">{goal?.title || 'Untitled goal'}</h3>
                  {goal?.whyItMatters ? (
                    <p className="goals-list-item__blurb">{goal.whyItMatters}</p>
                  ) : null}
                </div>

                <div className="goals-list-item__actions">
                  <button
                    type="button"
                    className="goals-action-btn goals-action-btn--edit"
                    onClick={() => onEdit(goal)}
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="goals-list-item__chips">
                <span className="goals-chip goals-chip--soft">
                  {linkedPlans.length} plan{linkedPlans.length === 1 ? '' : 's'}
                </span>
                <span className="goals-chip goals-chip--soft">{assigneeName}</span>
                {insights.dueTodayCount > 0 ? (
                  <span className="goals-chip goals-chip--soft">
                    {insights.dueTodayCount} due today
                  </span>
                ) : (
                  <span className="goals-chip goals-chip--soft">Nothing due today</span>
                )}
                {insights.doneTodayCount > 0 ? (
                  <span className="goals-chip goals-chip--soft">
                    {insights.doneTodayCount} done today
                  </span>
                ) : null}
                {insights.rewardSummary ? (
                  <span className="goals-chip goals-chip--reward">Reward set</span>
                ) : null}
              </div>

              <div className="goals-inline-details">
                <div className="goals-inline-detail">
                  <div className="goals-inline-detail__label">For</div>
                  <div className="goals-inline-detail__value">{assigneeName}</div>
                </div>

                <div className="goals-inline-detail">
                  <div className="goals-inline-detail__label">Ends</div>
                  <div className="goals-inline-detail__value">
                    {insights.endStatus || 'No end date'}
                  </div>
                </div>

                <div className="goals-inline-detail">
                  <div className="goals-inline-detail__label">Reward</div>
                  <div className="goals-inline-detail__value">
                    {insights.rewardSummary || 'No reward added yet'}
                  </div>
                </div>

                <div className="goals-inline-detail">
                  <div className="goals-inline-detail__label">Support</div>
                  <div className="goals-inline-detail__value">
                    {insights.supportSummary || 'No extra supports saved yet'}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function GoalsTab({
  data,
  user,
  onRefresh: _onRefresh,
  showSuccess: _showSuccess,
}) {
  const navigate = useNavigate()

  const children = useMemo(
    () => (Array.isArray(data?.children) ? data.children : []),
    [data?.children]
  )

  const goals = useMemo(
    () => (Array.isArray(data?.goals) ? data.goals : []),
    [data?.goals]
  )

  const actionPlans = useMemo(
    () => (Array.isArray(data?.actionPlans) ? data.actionPlans : []),
    [data?.actionPlans]
  )

  const userId = normalizeId(user?.id)
  const userName = user?.name || 'You'

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('recent')
  const [assigneeFilter, setAssigneeFilter] = useState('all')

  const todayISO = useMemo(() => toLocalISODate(), [])

  const assigneeLookup = useMemo(() => {
    const next = {}

    if (userId) {
      next[userId] = userName
    }

    children.forEach((child) => {
      next[normalizeId(child.id)] = child?.name || 'Child'
    })

    return next
  }, [children, userId, userName])

  const familyAssigneeIds = useMemo(() => {
    const ids = new Set()

    if (userId) {
      ids.add(userId)
    }

    children.forEach((child) => {
      const id = normalizeId(child.id)
      if (id) ids.add(id)
    })

    return ids
  }, [children, userId])

  const visibleGoals = useMemo(() => {
    return goals.filter((goal) => {
      const assigneeId = normalizeId(goal?.assigneeId)
      const createdById = normalizeId(goal?.createdById)
      return familyAssigneeIds.has(assigneeId) || createdById === userId
    })
  }, [familyAssigneeIds, goals, userId])

  const visibleGoalIds = useMemo(
    () => new Set(visibleGoals.map((goal) => normalizeId(goal.id)).filter(Boolean)),
    [visibleGoals]
  )

  const visibleActionPlans = useMemo(() => {
    return actionPlans.filter((plan) => visibleGoalIds.has(normalizeId(plan.goalId)))
  }, [actionPlans, visibleGoalIds])

  const plansByGoalId = useMemo(() => {
    const next = {}

    visibleActionPlans.forEach((plan) => {
      const key = normalizeId(plan.goalId)
      if (!next[key]) next[key] = []
      next[key].push(plan)
    })

    return next
  }, [visibleActionPlans])

  const goalInsightsById = useMemo(() => {
    const next = {}

    visibleGoals.forEach((goal) => {
      next[normalizeId(goal.id)] = getGoalInsights(
        goal,
        plansByGoalId[normalizeId(goal.id)] || [],
        todayISO
      )
    })

    return next
  }, [plansByGoalId, todayISO, visibleGoals])

  const filteredGoals = useMemo(() => {
    const matched = visibleGoals.filter((goal) => {
      const goalId = normalizeId(goal.id)
      const insights = goalInsightsById[goalId] || {}
      const assigneeId = normalizeId(goal?.assigneeId)
      const assigneeName = assigneeLookup[assigneeId] || goal?.assigneeName || ''

      if (assigneeFilter !== 'all' && assigneeId !== assigneeFilter) return false
      if (!matchesSearch(goal, searchTerm, assigneeName)) return false

      switch (statusFilter) {
        case 'dueToday':
          return (insights.dueTodayCount || 0) > 0
        case 'completedToday':
          return (insights.doneTodayCount || 0) > 0
        case 'rewarded':
          return Boolean(insights.hasReward)
        case 'endingSoon':
          return Boolean(goal?.endDate) && goal.endDate >= todayISO
        default:
          return true
      }
    })

    return sortGoals(matched, sortKey, goalInsightsById)
  }, [
    assigneeFilter,
    assigneeLookup,
    goalInsightsById,
    searchTerm,
    sortKey,
    statusFilter,
    todayISO,
    visibleGoals,
  ])

  const filteredGoalIds = useMemo(
    () => new Set(filteredGoals.map((goal) => normalizeId(goal.id))),
    [filteredGoals]
  )

  const filteredActionPlans = useMemo(
    () => visibleActionPlans.filter((plan) => filteredGoalIds.has(normalizeId(plan.goalId))),
    [filteredGoalIds, visibleActionPlans]
  )

  const buildGoals = useMemo(
    () => filteredGoals.filter((goal) => getTypeKey(goal) !== 'break'),
    [filteredGoals]
  )

  const breakGoals = useMemo(
    () => filteredGoals.filter((goal) => getTypeKey(goal) === 'break'),
    [filteredGoals]
  )

  const totalDueToday = useMemo(
    () =>
      filteredActionPlans.filter((plan) => {
        const schedule = getPlanSchedule(plan)
        if (!schedule) return true
        return isDueOnDate(schedule, todayISO)
      }).length,
    [filteredActionPlans, todayISO]
  )

  const totalDoneToday = useMemo(
    () => filteredActionPlans.filter((plan) => isPlanDoneToday(plan, todayISO)).length,
    [filteredActionPlans, todayISO]
  )

  const familyOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All family goals' }]

    if (userId) {
      options.push({ value: userId, label: 'My goals' })
    }

    children.forEach((child) => {
      options.push({
        value: normalizeId(child.id),
        label: child?.name || 'Child',
      })
    })

    return options
  }, [children, userId])

  return (
    <div className="parent-tab-shell">
      <section className="parent-tab-card">
        <div className="parent-tab-pill-row" style={{ marginBottom: '1rem' }}>
          <span className="parent-tab-pill parent-tab-pill--accent">
            {filteredGoals.length} visible goals
          </span>
          <span className="parent-tab-pill">
            {filteredActionPlans.length} linked plans
          </span>
          <span className="parent-tab-pill">
            {totalDueToday} due today
          </span>
          <span className="parent-tab-pill parent-tab-pill--warm">
            {totalDoneToday} done today
          </span>
        </div>

        <div className="goals-toolbar goals-panel" style={{ marginBottom: '1rem' }}>
          <div className="goals-toolbar__group goals-toolbar__group--search">
            <label className="goals-toolbar__label app-field-label" htmlFor="parent-goals-search">
              Search goals
            </label>
            <input
              id="parent-goals-search"
              type="text"
              className="goals-toolbar__input"
              placeholder="Search title, support, reward, or why it matters"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="goals-toolbar__group">
            <label className="goals-toolbar__label app-field-label" htmlFor="parent-goals-family">
              Family member
            </label>
            <select
              id="parent-goals-family"
              className="goals-toolbar__select"
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
            >
              {familyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="goals-toolbar__group">
            <label className="goals-toolbar__label app-field-label" htmlFor="parent-goals-filter">
              Show
            </label>
            <select
              id="parent-goals-filter"
              className="goals-toolbar__select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All goals</option>
              <option value="dueToday">Due today</option>
              <option value="completedToday">Completed today</option>
              <option value="rewarded">Has reward</option>
              <option value="endingSoon">Has end date</option>
            </select>
          </div>

          <div className="goals-toolbar__group">
            <label className="goals-toolbar__label app-field-label" htmlFor="parent-goals-sort">
              Sort
            </label>
            <select
              id="parent-goals-sort"
              className="goals-toolbar__select"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value)}
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A–Z</option>
              <option value="dueToday">Most due today</option>
              <option value="endSoon">End date soonest</option>
            </select>
          </div>

          <div className="goals-toolbar__group goals-toolbar__group--actions">
            <button
              type="button"
              className="goals-btn goals-btn--ghost goals-btn--sm app-button-label"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setSortKey('recent')
                setAssigneeFilter('all')
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="goals-columns-body">
          <GoalColumn
            type="build"
            goals={buildGoals}
            plansByGoalId={plansByGoalId}
            insightsByGoalId={goalInsightsById}
            assigneeLookup={assigneeLookup}
            onEdit={(goal) => navigate(`/parent/habit-wizard?goalId=${goal.id}`)}
          />

          <GoalColumn
            type="break"
            goals={breakGoals}
            plansByGoalId={plansByGoalId}
            insightsByGoalId={goalInsightsById}
            assigneeLookup={assigneeLookup}
            onEdit={(goal) => navigate(`/parent/habit-wizard?goalId=${goal.id}`)}
          />
        </div>
      </section>
    </div>
  )
}
