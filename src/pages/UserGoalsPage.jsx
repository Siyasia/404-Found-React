import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import GoalCard from '../components/GoalCard.jsx'
import HabitWizard from '../components/HabitWizard/HabitWizard.jsx'
import { WIZARD_CONFIG } from '../components/HabitWizard/HabitWizard.utils.js'
import { goalList, goalCreate, goalUpdate, goalDelete } from '../lib/api/goals.js'
import {
  actionPlanList,
  actionPlanCreate,
  actionPlanDelete,
  actionPlanDeleteByGoal,
} from '../lib/api/actionPlans.js'
import { getCoins } from '../lib/api/streaks.js'
import { buildActiveRewardFromPayload, setActiveReward } from '../lib/api/reward.js'
import mapWizardPayload from '../lib/api/mapWizardPayload.js'
import togglePlanCompletion from '../lib/actionPlanCompletion.js'
import { isDueOnDate, toLocalISODate } from '../lib/schedule.js'
import '../dashboardTheme.css'
import './UserGoalsPage.css'

/* =========================================================
   HELPERS
========================================================= */
function getSortableDate(value) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatDateLabel(value, { weekday = false } = {}) {
  if (!value) return 'No date'
  try {
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return 'No date'
    return new Intl.DateTimeFormat('en-US', {
      ...(weekday ? { weekday: 'short' } : {}),
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
  if (raw.includes('build')) return 'build'
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

function isPlanDoneToday(plan, todayISO) {
  if (typeof plan?.completedToday === 'boolean') return plan.completedToday
  if (plan?.completedDates?.[todayISO] === true) return true
  if (plan?.completionLog?.[todayISO] === true) return true
  return false
}

function isPlanDueToday(plan, todayISO) {
  const schedule = getPlanSchedule(plan)
  if (!schedule) return true
  return isDueOnDate(schedule, todayISO)
}

function getRewardSummary(goal) {
  const milestoneCount = Array.isArray(goal?.milestoneRewards) ? goal.milestoneRewards.length : 0

  if (goal?.rewardType === 'shop' || goal?.rewardShopItemId || goal?.meta?.rewardShopItemId) {
    return milestoneCount > 0 ? `Shop reward linked • ${milestoneCount} milestones` : 'Shop reward linked'
  }

  if (goal?.rewardGoalTitle && goal?.rewardGoalCostCoins) {
    return `${goal.rewardGoalTitle} • ${goal.rewardGoalCostCoins} coins`
  }

  if (goal?.rewardGoalTitle) return goal.rewardGoalTitle
  if (goal?.savingFor) return `Saving for ${goal.savingFor}`
  if (milestoneCount > 0) return `${milestoneCount} milestone reward${milestoneCount === 1 ? '' : 's'}`

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
  const dueTodayCount = safePlans.filter((plan) => isPlanDueToday(plan, todayISO)).length
  const doneTodayCount = safePlans.filter((plan) => isPlanDoneToday(plan, todayISO)).length
  const rewardSummary = getRewardSummary(goal)
  const supportSummary = getSupportSummary(goal)

  return {
    planCount: safePlans.length,
    dueTodayCount,
    doneTodayCount,
    hasReward: Boolean(rewardSummary),
    rewardSummary,
    supportSummary,
    endStatus: getEndStatus(goal, todayISO),
    isEndingSoon: Boolean(goal?.endDate) && goal.endDate >= todayISO,
    allDueDone: dueTodayCount > 0 && dueTodayCount === doneTodayCount,
  }
}

function matchesSearch(goal, searchTerm) {
  if (!searchTerm.trim()) return true
  const needle = searchTerm.trim().toLowerCase()

  const haystack = [
    goal?.title,
    goal?.whyItMatters,
    goal?.location,
    goal?.savingFor,
    goal?.rewardGoalTitle,
    goal?.rewardGoalCostCoins,
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
    const aInsights = insightsByGoalId[String(a.id)] || {}
    const bInsights = insightsByGoalId[String(b.id)] || {}

    switch (sortKey) {
      case 'oldest':
        return getSortableDate(a?.createdAt || a?.startDate) - getSortableDate(b?.createdAt || b?.startDate)
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
        return getSortableDate(b?.createdAt || b?.startDate) - getSortableDate(a?.createdAt || a?.startDate)
    }
  })

  return safeGoals
}

function StatTile({ label, value, hint = '' }) {
  return (
    <div className="goals-stat-tile">
      <div className="goals-stat-tile__label app-meta-label">{label}</div>
      <div className="goals-stat-tile__value app-card-title">{value}</div>
      {hint ? <div className="goals-stat-tile__hint app-helper-text">{hint}</div> : null}
    </div>
  )
}

function GoalSummaryStrip({ goal, insights, isEditing }) {
  return (
    <div className="goals-list-item__summary">
      <div className="goals-list-item__summary-main">
        <div className="goals-list-item__chips">
          {isEditing ? <span className="goals-chip goals-chip--editing">Editing</span> : null}
          <span className="goals-chip goals-chip--soft">{insights.planCount} plan{insights.planCount === 1 ? '' : 's'}</span>
          {insights.dueTodayCount > 0 ? (
            <span className="goals-chip goals-chip--due">{insights.dueTodayCount} due today</span>
          ) : (
            <span className="goals-chip goals-chip--soft">Nothing due today</span>
          )}
          {insights.doneTodayCount > 0 ? (
            <span className="goals-chip goals-chip--done">{insights.doneTodayCount} done today</span>
          ) : null}
          <span className="goals-chip goals-chip--soft">{insights.endStatus}</span>
          {insights.rewardSummary ? <span className="goals-chip goals-chip--reward">Reward set</span> : null}
        </div>

        <div className="goals-inline-details">
          <div className="goals-inline-detail">
            <span className="goals-inline-detail__label app-meta-label">Reward</span>
            <span className="goals-inline-detail__value app-helper-text">{insights.rewardSummary || 'No reward added yet'}</span>
          </div>
          <div className="goals-inline-detail">
            <span className="goals-inline-detail__label app-meta-label">Support</span>
            <span className="goals-inline-detail__value app-helper-text">{insights.supportSummary}</span>
          </div>
          {goal?.whyItMatters ? (
            <div className="goals-inline-detail goals-inline-detail--wide">
              <span className="goals-inline-detail__label app-meta-label">Why</span>
              <span className="goals-inline-detail__value app-body-text">{goal.whyItMatters}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function UserGoalsPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const wizardRef = useRef(null)

  const [goals, setGoals] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [wizardKey, setWizardKey] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [rewardMessage, setRewardMessage] = useState('')
  const [coins, setCoins] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('recent')

  const todayISO = useMemo(() => toLocalISODate(), [])

  /* --------------------------------------------------
     Load data
  -------------------------------------------------- */
  const refreshGoalData = useCallback(async () => {
    if (!user?.id) {
      setGoals([])
      setActionPlans([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [goalRes, planRes, coinsRes] = await Promise.all([
        goalList(),
        actionPlanList(),
        getCoins(user.id),
      ])

      setGoals(Array.isArray(goalRes?.goals) ? goalRes.goals : [])
      setActionPlans(Array.isArray(planRes?.plans) ? planRes.plans : [])
      const coinsValue = Number(
        coinsRes?.data?.total ?? coinsRes?.total ?? coinsRes?.coins ?? 0
      )
      setCoins(Number.isNaN(coinsValue) ? 0 : coinsValue)
    } catch (err) {
      console.error('[UserGoalsPage] load error:', err)
      setGoals([])
      setActionPlans([])
      setCoins(0)
      setErrorMessage('Failed to load your goals.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    refreshGoalData()
  }, [refreshGoalData])

  useEffect(() => {
    if (!editingGoal || !wizardRef.current) return
    wizardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editingGoal, wizardKey])

  /* --------------------------------------------------
     Derived data
  -------------------------------------------------- */
  const visibleGoals = useMemo(() => {
    if (!Array.isArray(goals) || !user?.id) return []

    return goals.filter(
      (goal) =>
        String(goal?.assigneeId) === String(user.id) ||
        String(goal?.createdById) === String(user.id)
    )
  }, [goals, user?.id])

  const visibleGoalIds = useMemo(
    () => new Set(visibleGoals.map((goal) => String(goal.id))),
    [visibleGoals]
  )

  const visibleActionPlans = useMemo(
    () =>
      (Array.isArray(actionPlans) ? actionPlans : []).filter((plan) =>
        visibleGoalIds.has(String(plan.goalId))
      ),
    [actionPlans, visibleGoalIds]
  )

  const plansByGoalId = useMemo(() => {
    const next = {}
    visibleActionPlans.forEach((plan) => {
      const key = String(plan.goalId)
      if (!next[key]) next[key] = []
      next[key].push(plan)
    })
    return next
  }, [visibleActionPlans])

  const goalInsightsById = useMemo(() => {
    const next = {}
    visibleGoals.forEach((goal) => {
      next[String(goal.id)] = getGoalInsights(goal, plansByGoalId[String(goal.id)] || [], todayISO)
    })
    return next
  }, [visibleGoals, plansByGoalId, todayISO])

  const filteredGoals = useMemo(() => {
    const matched = visibleGoals.filter((goal) => {
      if (!matchesSearch(goal, searchTerm)) return false

      const insights = goalInsightsById[String(goal.id)] || {}
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
  }, [goalInsightsById, searchTerm, sortKey, statusFilter, todayISO, visibleGoals])

  const filteredGoalIds = useMemo(
    () => new Set(filteredGoals.map((goal) => String(goal.id))),
    [filteredGoals]
  )

  const filteredActionPlans = useMemo(
    () => visibleActionPlans.filter((plan) => filteredGoalIds.has(String(plan.goalId))),
    [visibleActionPlans, filteredGoalIds]
  )

  const { buildGoals, breakGoals } = useMemo(() => {
    const build = []
    const brk = []

    filteredGoals.forEach((goal) => {
      if (getTypeKey(goal) === 'break') brk.push(goal)
      else build.push(goal)
    })

    return { buildGoals: build, breakGoals: brk }
  }, [filteredGoals])

  const totalDueToday = useMemo(
    () => filteredActionPlans.filter((plan) => isPlanDueToday(plan, todayISO)).length,
    [filteredActionPlans, todayISO]
  )

  const totalDoneToday = useMemo(
    () => filteredActionPlans.filter((plan) => isPlanDoneToday(plan, todayISO)).length,
    [filteredActionPlans, todayISO]
  )

  /* --------------------------------------------------
     Handlers
  -------------------------------------------------- */
  const handleRewardFeedback = useCallback((newBadgeIds = [], coinPayload = null, planTitle = '') => {
    if (Array.isArray(newBadgeIds) && newBadgeIds.length > 0) {
      setRewardMessage(`New badge${newBadgeIds.length === 1 ? '' : 's'} earned: ${newBadgeIds.join(', ')}`)
    }

    const delta = Number(coinPayload?.delta || 0)
    if (delta > 0) setSuccessMessage(`Completed ${planTitle || 'habit plan'} • earned ${delta} coins`)
    else if (delta === 0) setSuccessMessage(`Updated ${planTitle || 'habit plan'} for today`)
  }, [])

  const handleToggleActionPlanCompletion = useCallback(
    async (plan) => {
      if (!plan) return null

      const goal = visibleGoals.find((item) => String(item.id) === String(plan.goalId))
      const milestoneRewards = Array.isArray(goal?.milestoneRewards) ? goal.milestoneRewards : []

      try {
        return await togglePlanCompletion({
          plan,
          todayISO,
          milestoneRewards,
          setActionPlans,
          onBadges: (ids) => handleRewardFeedback(ids, null, plan?.title),
          onCoins: ({ delta = 0, total = null }) => {
            if (String(plan?.assigneeId) === String(user?.id)) {
              if (typeof total === 'number' && !Number.isNaN(total)) setCoins(total)
              else if (typeof delta === 'number' && !Number.isNaN(delta)) {
                setCoins((prev) => Math.max(0, prev + delta))
              }
            }
            handleRewardFeedback([], { delta, total }, plan?.title)
          },
        })
      } catch (err) {
        console.error('[UserGoalsPage] toggle error:', err)
        return null
      }
    },
    [handleRewardFeedback, todayISO, user?.id, visibleGoals]
  )

  const handleDeleteGoal = useCallback(
    async (goalId) => {
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm('Delete this goal and all of its action plans?')

      if (!confirmed) return

      try {
        await actionPlanDeleteByGoal(goalId)
        const res = await goalDelete(goalId)

        if (!res || res.status_code !== 200) {
          setErrorMessage('Failed to delete goal.')
          return
        }

        setGoals((prev) => prev.filter((goal) => String(goal.id) !== String(goalId)))
        setActionPlans((prev) => prev.filter((plan) => String(plan.goalId) !== String(goalId)))

        if (editingGoal && String(editingGoal.id) === String(goalId)) {
          setEditingGoal(null)
          setWizardKey((prev) => prev + 1)
        }

        setSuccessMessage('Goal deleted.')
      } catch (err) {
        console.error('[UserGoalsPage] delete error:', err)
        setErrorMessage('Failed to delete goal.')
      }
    },
    [editingGoal]
  )

  const handleStartEdit = useCallback((goal) => {
    setEditingGoal(goal)
    setWizardKey((prev) => prev + 1)
  }, [])

  const handleWizardSubmit = useCallback(
    async (payload) => {
      setSaving(true)
      setErrorMessage('')

      try {
        const mapped = mapWizardPayload(payload)
        const { goal, actionPlans: mappedPlans } = mapped
        const existingPlansForGoal = editingGoal?.id
          ? (actionPlans || []).filter((plan) => String(plan.goalId) === String(editingGoal.id))
          : []

        goal.assigneeId = user?.id || goal.assigneeId || null
        goal.assigneeName = user?.name || goal.assigneeName || ''
        goal.createdById = user?.id || null
        goal.createdByName = user?.name || ''
        goal.createdByRole = user?.role || 'user'

        for (let i = 0; i < mappedPlans.length; i += 1) {
          const plan = mappedPlans[i]
          if (!plan?.schedule?.repeat) {
            setErrorMessage(`Wizard task "${plan?.title || `task #${i + 1}`}" is missing scheduling information.`)
            return { success: false }
          }
        }

        let goalId = null

        if (editingGoal?.id) {
          const res = await goalUpdate(editingGoal.id, goal)
          if (!res || res.status_code !== 200) {
            setErrorMessage(res?.error ? String(res.error) : 'Failed to update goal.')
            return { success: false }
          }

          goalId = res?.id || editingGoal.id
          const deletePlansRes = await actionPlanDeleteByGoal(goalId)
          if (!deletePlansRes || deletePlansRes.status_code !== 200) {
            setErrorMessage('Failed to replace action plans.')
            return { success: false }
          }
        } else {
          const res = await goalCreate(goal)
          if (!res || res.status_code !== 200) {
            setErrorMessage(res?.error ? String(res.error) : 'Failed to create goal.')
            return { success: false }
          }
          goalId = res?.id || null
        }

        if (!goalId) {
          setErrorMessage('Goal saved, but no goal id was returned.')
          return { success: false }
        }

        const createdIds = []
        for (const plan of mappedPlans) {
          const nextPlan = {
            ...plan,
            goalId,
            assigneeId: user?.id || plan.assigneeId || null,
            assigneeName: user?.name || plan.assigneeName || '',
            createdById: user?.id || null,
            createdByName: user?.name || '',
            createdByRole: user?.role || 'user',
          }

          const res = await actionPlanCreate(nextPlan)
          if (!res || res.status_code !== 200) {
            for (const id of createdIds) {
              try {
                await actionPlanDelete(id)
              } catch {
                // rollback best effort
              }
            }

            if (!editingGoal && goalId) {
              try {
                await goalDelete(goalId)
              } catch {
                // rollback best effort
              }
            }

            if (editingGoal && existingPlansForGoal.length > 0) {
              for (const old of existingPlansForGoal) {
                try {
                  const { id, ...restored } = typeof old?.toJSON === 'function' ? old.toJSON() : { ...old }
                  await actionPlanCreate({ ...restored, goalId })
                } catch {
                  // rollback best effort
                }
              }
            }

            setErrorMessage(res?.error ? String(res.error) : 'Failed to create action plan.')
            return { success: false }
          }

          if (res?.id) createdIds.push(res.id)
        }

        const activeReward = buildActiveRewardFromPayload(payload)
        if (activeReward) await setActiveReward(activeReward)

        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(WIZARD_CONFIG.DRAFT_STORAGE_KEY)
          }
        } catch {
          // ignore
        }

        await refreshGoalData()
        setEditingGoal(null)
        setWizardKey((prev) => prev + 1)
        setSuccessMessage(editingGoal ? 'Goal updated successfully.' : 'Goal saved successfully.')
        return { success: true }
      } catch (err) {
        console.error('[UserGoalsPage] submit error:', err)
        setErrorMessage('Unexpected error while saving the goal.')
        return { success: false }
      } finally {
        setSaving(false)
      }
    },
    [actionPlans, editingGoal, refreshGoalData, user?.id, user?.name, user?.role]
  )

  /* --------------------------------------------------
     Guard
  -------------------------------------------------- */
  if (!user) {
    return (
      <section className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1 className="app-page-title">My goals</h1>
        <p className="app-helper-text">You need to log in first.</p>
      </section>
    )
  }

  /* --------------------------------------------------
     Render helpers
  -------------------------------------------------- */
  const renderGoalItem = (goal) => {
    const plansForGoal = plansByGoalId[String(goal.id)] || []
    const insights = goalInsightsById[String(goal.id)] || getGoalInsights(goal, plansForGoal, todayISO)
    const isBeingEdited = editingGoal && String(editingGoal.id) === String(goal.id)

    return (
      <div key={goal.id} className={`goals-list-item ${isBeingEdited ? 'is-editing' : ''}`}>
        <div className="goals-list-item__topbar">
          <GoalSummaryStrip goal={goal} insights={insights} isEditing={isBeingEdited} />

          <div className="goals-list-item__actions">
            <button
              type="button"
              className="goals-action-btn goals-action-btn--edit app-button-label"
              onClick={() => handleStartEdit(goal)}
            >
              {isBeingEdited ? 'Re-open editor' : 'Edit goal'}
            </button>

            <details className="goals-more-menu">
              <summary className="goals-icon-btn" aria-label={`More actions for ${goal.title || 'goal'}`}>
                ⋯
              </summary>
              <div className="goals-more-menu__popover">
                <button
                  type="button"
                  className="goals-more-menu__item goals-more-menu__item--danger app-button-label"
                  onClick={(event) => {
                    event.preventDefault()
                    handleDeleteGoal(goal.id)
                  }}
                >
                  Delete goal
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className="goals-list-item__card">
          <GoalCard
            goal={goal}
            actionPlans={plansForGoal}
            todayISO={todayISO}
            onToggleActionPlanCompletion={handleToggleActionPlanCompletion}
          />
        </div>
      </div>
    )
  }

  const GoalColumn = ({ type, goals: columnGoals }) => {
    const isBuild = type === 'build'
    const typeClass = isBuild ? 'build' : 'break'
    const icon = isBuild ? '🌱' : '🔥'
    const label = isBuild ? 'Build habits' : 'Break habits'

    const emptyMessage = searchTerm || statusFilter !== 'all'
      ? 'No goals match your current search or filters.'
      : isBuild
        ? 'No build habits yet. Create one to start building a good habit.'
        : 'No break habits yet. Add one to start replacing a bad habit.'

    return (
      <div className="goals-column">
        <div className={`goals-column-header goals-column-header--${typeClass}`}>
          <div className="goals-column-header__left">
            <span className="goals-column-header__icon">{icon}</span>
            <span className={`goals-column-header__title goals-column-header__title--${typeClass} app-section-title`}>
              {label}
            </span>
          </div>
          <span className={`goals-column-header__count goals-column-header__count--${typeClass} app-micro-text`}>
            {columnGoals.length} {columnGoals.length === 1 ? 'goal' : 'goals'}
          </span>
        </div>

        <div className="goals-column-scroll">
          {loading ? (
            <p className="goals-loading app-helper-text">Loading…</p>
          ) : columnGoals.length === 0 ? (
            <div className="goals-column-empty">{emptyMessage}</div>
          ) : (
            columnGoals.map(renderGoalItem)
          )}
        </div>
      </div>
    )
  }

  /* ====================================================
     RENDER
  ==================================================== */
  return (
    <div className="goals-page">
      <Toast message={successMessage} type="success" onClose={() => setSuccessMessage('')} />
      <Toast message={errorMessage} type="error" onClose={() => setErrorMessage('')} />
      <Toast message={rewardMessage} type="success" onClose={() => setRewardMessage('')} />

      <div className="goals-canvas">
        <div className="goals-header">
          <div className="goals-header__left">
            <h1 className="app-page-title">My goals</h1>
            <p className="goals-header__subtitle app-helper-text">
              View every goal, skim what matters fast, and edit without leaving the page.
            </p>
          </div>

          <div className="goals-header__actions">
            <button type="button" className="goals-btn goals-btn--ghost app-button-label" onClick={() => navigate('/home')}>
              Back to home
            </button>
            <button type="button" className="goals-btn goals-btn--primary app-button-label" onClick={() => navigate('/habit-wizard')}>
              Create goal
            </button>
          </div>
        </div>

        <div className="goals-toolbar goals-panel">
          <div className="goals-toolbar__group goals-toolbar__group--search">
            <label className="goals-toolbar__label app-field-label" htmlFor="goals-search">Search goals</label>
            <input
              id="goals-search"
              type="text"
              className="goals-toolbar__input app-body-text"
              placeholder="Search title, support, reward, or why it matters"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="goals-toolbar__group">
            <label className="goals-toolbar__label app-field-label" htmlFor="goals-filter">Show</label>
            <select
              id="goals-filter"
              className="goals-toolbar__select app-body-text"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All goals</option>
              <option value="dueToday">Goals with something due today</option>
              <option value="completedToday">Goals completed today</option>
              <option value="rewarded">Goals with rewards</option>
              <option value="endingSoon">Goals with an end date</option>
            </select>
          </div>

          <div className="goals-toolbar__group">
            <label className="goals-toolbar__label app-field-label" htmlFor="goals-sort">Sort</label>
            <select
              id="goals-sort"
              className="goals-toolbar__select app-body-text"
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
              }}
            >
              Reset filters
            </button>
          </div>
        </div>

        {editingGoal ? (
          <div ref={wizardRef} className="goals-edit-shell goals-panel">
            <div className="goals-edit-banner">
              <div className="goals-edit-banner__inner">
                  <div className="goals-edit-banner__dot" />
                  <div>
                    <div className="goals-edit-banner__eyebrow app-meta-label">Now editing</div>
                    <span className="goals-edit-banner__text app-card-title">
                      {editingGoal.title || 'Untitled goal'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="goals-btn goals-btn--ghost goals-btn--sm app-button-label"
                  onClick={() => {
                    setEditingGoal(null)
                    setWizardKey((prev) => prev + 1)
                  }}
                >
                  Cancel edit
                </button>
            </div>

            <div className="goals-wizard-header">
              <div>
                <div className="goals-wizard-header__eyebrow app-meta-label">Edit without leaving the page</div>
                <h2 className="app-section-title">Update goal details and action plans</h2>
                <p className="goals-wizard-header__subtitle app-helper-text">
                  All the saved details for this goal are prefilled here, including support and reward setup.
                </p>
              </div>
            </div>

            <HabitWizard
              key={wizardKey}
              context="self"
              availableChildren={[]}
              parentUser={user}
              embedded={true}
              saving={saving}
              initialValues={{
                type: editingGoal.goalType || editingGoal.type || editingGoal.habitType || null,
                title: editingGoal.title || editingGoal.goalTitle || '',
                whyItMatters: editingGoal.whyItMatters || '',
                startDate: editingGoal.startDate || editingGoal.goalStartDate || '',
                endDate: editingGoal.endDate || editingGoal.goalEndDate || '',
                location: editingGoal.location || '',
                triggers: editingGoal.triggers || [],
                makeItEasier: editingGoal.makeItEasier || [],
                replacements: editingGoal.replacements || [],
                savingFor: editingGoal.savingFor || '',
                rewardGoalTitle: editingGoal.rewardGoalTitle || '',
                rewardGoalCostCoins: editingGoal.rewardGoalCostCoins || '',
                rewardType: editingGoal.rewardType || editingGoal.meta?.rewardType || 'custom',
                rewardShopItemId: editingGoal.rewardShopItemId || editingGoal.meta?.rewardShopItemId || '',
                milestoneRewards: Array.isArray(editingGoal.milestoneRewards)
                  ? editingGoal.milestoneRewards.map((item) => ({ ...item }))
                  : undefined,
                assignees: [String(editingGoal.assigneeId || user?.id || '')].filter(Boolean),
                tasks: (actionPlans || []).filter((plan) => String(plan.goalId) === String(editingGoal.id)),
              }}
              onSubmit={handleWizardSubmit}
            />
          </div>
        ) : null}

        <div className="goals-columns-body">
          <GoalColumn type="build" goals={buildGoals} />
          <GoalColumn type="break" goals={breakGoals} />
        </div>
      </div>
    </div>
  )
}
