import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import { ROLE } from '../Roles/roles.js'
import Toast from '../components/Toast.jsx'
import WeekStrip from '../components/WeekStrip.jsx'
import CuePlanCard from '../components/CuePlanCard.jsx'
import MissionsBoard from '../components/MissionsBoard.jsx'
import TaskAssignmentPanel from '../components/TaskAssignmentPanel.jsx'
import FocusMissionPanel from '../components/FocusMissionPanel.jsx'
import './ParentHomepage.css'

import { childList } from '../lib/api/children.js'
import {
  taskList,
  taskStart,
  taskComplete,
  taskToggleChecklistItem,
  taskDelete,
  taskListPending,
} from '../lib/api/tasks.js'
import { goalList } from '../lib/api/goals.js'
import { actionPlanList } from '../lib/api/actionPlans.js'
import { getCoins } from '../lib/api/streaks.js'
import { getActiveReward, redeemActiveReward } from '../lib/api/reward.js'
import togglePlanCompletion from '../lib/actionPlanCompletion.js'
import { isDueOnDate, toLocalISODate } from '../lib/schedule.js'
import { getCueLabel } from '../lib/cuePresets.js'
import {
  buildActionPlanSpeech,
  speakText,
  supportsSpeechSynthesis,
} from '../lib/speech.js'
import { Task, Goal, ActionPlan } from '../models'

function formatShortDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatClock(date = new Date()) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sanitizeTitle(title) {
  if (!title || String(title).trim() === '') return 'Untitled'
  const trimmed = String(title).trim()
  if (/^[a-z0-9]{4,}$/i.test(trimmed)) return 'Untitled item'
  return trimmed
}

function extractGoals(response) {
  if (Array.isArray(response?.goals)) return response.goals
  if (Array.isArray(response?.data?.goals)) return response.data.goals
  if (Array.isArray(response?.data)) return response.data
  return []
}

function extractPlans(response) {
  if (Array.isArray(response?.plans)) return response.plans
  if (Array.isArray(response?.data?.plans)) return response.data.plans
  if (Array.isArray(response?.data)) return response.data
  return []
}

function extractTasks(response) {
  if (Array.isArray(response?.tasks)) return response.tasks
  if (Array.isArray(response?.data?.tasks)) return response.data.tasks
  if (Array.isArray(response?.data)) return response.data
  return []
}

function extractCoins(response) {
  return Number(response?.data?.total ?? response?.total ?? 0) || 0
}

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value)
}

function getGoalTitle(goal) {
  return sanitizeTitle(goal?.title || goal?.goal || goal?.name || 'Untitled goal')
}

function getTaskType(task) {
  return task?.taskType || task?.type || 'simple'
}

function isTaskComplete(task) {
  const status = String(task?.status || '').toLowerCase()
  return status === 'completed' || status === 'done'
}

function getPlanSchedule(plan) {
  if (plan?.schedule && typeof plan.schedule === 'object') return plan.schedule
  if (plan?.frequency && typeof plan.frequency === 'object') return plan.frequency
  return null
}

function getPlanCueKey(plan) {
  return plan?.cuePreset || plan?.meta?.cuePreset || ''
}

function getPlanCueLabel(plan) {
  const cueKey = getPlanCueKey(plan)
  return plan?.cueLabel || plan?.meta?.cueLabel || getCueLabel(cueKey) || ''
}

function getPlanCueDetail(plan) {
  const cueLabel = getPlanCueLabel(plan)
  const cueDetail = plan?.cueDetail || plan?.meta?.cueDetail || ''
  const rawCue = typeof plan?.cue === 'string' ? plan.cue.trim() : ''

  if (cueDetail) return cueDetail
  if (rawCue && rawCue !== cueLabel) return rawCue
  return ''
}

function EmptyState({ title, description }) {
  return (
    <div className="parent-empty-state">
      <div className="parent-empty-state__title app-card-title">{title}</div>
      <div className="parent-empty-state__description app-helper-text">{description}</div>
    </div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`parent-filter-chip app-button-label ${active ? 'is-active' : ''}`}
    >
      {label}
    </button>
  )
}

export default function ParentHomepage() {
  const navigate = useNavigate()
  const { user } = useUser()

  const [children, setChildren] = useState([])
  const [tasks, setTasks] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [taskView, setTaskView] = useState('board')
  const [focusedTaskId, setFocusedTaskId] = useState(null)
  const [goals, setGoals] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [coins, setCoins] = useState(0)
  const [activeReward, setActiveReward] = useState(null)

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [redeemingReward, setRedeemingReward] = useState(false)
  const [clockTime, setClockTime] = useState(formatClock())
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState('all')

  const supportsTTS = supportsSpeechSynthesis()

  const today = useMemo(() => new Date(), [])
  const todayISO = useMemo(() => toLocalISODate(new Date()), [])

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTime(formatClock(new Date()))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const loadParentHome = useCallback(async () => {
    if (!user?.id) {
      setChildren([])
      setTasks([])
      setPendingTasks([])
      setGoals([])
      setActionPlans([])
      setCoins(0)
      setActiveReward(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [childResp, taskResp, pendingResp, goalResp, planResp, coinsResp] = await Promise.all([
        childList(),
        taskList(),
        taskListPending(),
        goalList(),
        actionPlanList(),
        getCoins(user.id),
      ])

      const rawChildren =
        childResp?.status_code === 200 && Array.isArray(childResp.children)
          ? childResp.children
          : []

      const rawTasks =
        taskResp?.status_code === 200
          ? extractTasks(taskResp).map(Task.from)
          : []

      const rawPending =
        pendingResp?.status_code === 200
          ? extractTasks(pendingResp).map(Task.from)
          : []

      const rawGoals = extractGoals(goalResp).map(Goal.from)
      const rawPlans = extractPlans(planResp).map(ActionPlan.from)

      setChildren(rawChildren)
      setTasks(rawTasks)
      setPendingTasks(rawPending)
      setGoals(rawGoals)
      setActionPlans(rawPlans)
      setCoins(extractCoins(coinsResp))

      const ownGoalList = rawGoals.filter((goal) => {
        const id = normalizeId(user.id)
        return [goal?.assigneeId, goal?.createdById, goal?.userId].some((v) => normalizeId(v) === id)
      })

      const activeRewardResponse = await getActiveReward({
        userId: user.id,
        goals: ownGoalList,
      })

      setActiveReward(activeRewardResponse)
    } catch (err) {
      console.error('[ParentHomepage] load error', err)
      setError('Failed to load homepage data.')
      setChildren([])
      setTasks([])
      setPendingTasks([])
      setGoals([])
      setActionPlans([])
      setCoins(0)
      setActiveReward(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadParentHome()
  }, [loadParentHome])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 5) return 'Good early morning'
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const userId = normalizeId(user?.id)

  const familyViewOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All' }]
    if (userId) options.push({ value: userId, label: 'Me' })
    children.forEach((child) => {
      options.push({
        value: normalizeId(child.id),
        label: child.name || 'Child',
      })
    })
    return options
  }, [children, userId])

  const activeFamilyMemberId = selectedFamilyMemberId !== 'all' ? selectedFamilyMemberId : ''

  const activeFamilyMemberLabel = useMemo(() => {
    if (!activeFamilyMemberId) return 'Family'
    if (activeFamilyMemberId === userId) return user?.name || 'Me'
    return children.find((child) => normalizeId(child.id) === activeFamilyMemberId)?.name || 'Child'
  }, [activeFamilyMemberId, children, user?.name, userId])

  const childIds = useMemo(
    () => new Set(children.map((child) => normalizeId(child.id)).filter(Boolean)),
    [children]
  )

  const visibleAssigneeIds = useMemo(() => {
    const ids = new Set()
    if (userId) ids.add(userId)
    children.forEach((child) => {
      const id = normalizeId(child.id)
      if (id) ids.add(id)
    })
    return ids
  }, [children, userId])

  const ownGoals = useMemo(() => {
    return goals.filter((goal) => {
      const assignedToUser = normalizeId(goal?.assigneeId) === userId
      const createdByUser = normalizeId(goal?.createdById) === userId
      const ownedByUser = normalizeId(goal?.userId) === userId
      return assignedToUser || createdByUser || ownedByUser
    })
  }, [goals, userId])

  const visibleGoals = useMemo(() => {
    return goals.filter((goal) => {
      const assigneeId = normalizeId(goal.assigneeId)
      const createdById = normalizeId(goal.createdById)
      return visibleAssigneeIds.has(assigneeId) || createdById === userId
    })
  }, [goals, visibleAssigneeIds, userId])

  const visibleGoalIds = useMemo(
    () => new Set(visibleGoals.map((goal) => normalizeId(goal.id)).filter(Boolean)),
    [visibleGoals]
  )

  const visiblePlans = useMemo(() => {
    return actionPlans.filter((plan) => {
      const goalId = normalizeId(plan.goalId)
      const assigneeId = normalizeId(plan.assigneeId)
      return visibleGoalIds.has(goalId) || visibleAssigneeIds.has(assigneeId)
    })
  }, [actionPlans, visibleGoalIds, visibleAssigneeIds])

  const goalsById = useMemo(() => {
    const map = {}
    visibleGoals.forEach((goal) => {
      map[normalizeId(goal.id)] = goal
    })
    return map
  }, [visibleGoals])

  const todaysPlans = useMemo(() => {
    return visiblePlans.filter((plan) => {
      const schedule = getPlanSchedule(plan)
      if (!schedule || !isDueOnDate(schedule, todayISO)) return false
      if (!activeFamilyMemberId) return true
      return normalizeId(plan.assigneeId) === activeFamilyMemberId
    })
  }, [visiblePlans, todayISO, activeFamilyMemberId])

  const completedTodayCount = useMemo(() => {
    return todaysPlans.filter((plan) => plan?.completedDates?.[todayISO] === true).length
  }, [todaysPlans, todayISO])

  const dailyProgress = useMemo(() => {
    if (!todaysPlans.length) return 0
    return Math.round((completedTodayCount / todaysPlans.length) * 100)
  }, [completedTodayCount, todaysPlans.length])

  const actionCueSections = useMemo(() => {
    const sectionMap = new Map()

    todaysPlans.forEach((plan) => {
      const cueKey = getPlanCueKey(plan) || 'uncategorized'
      const cueLabel = getPlanCueLabel(plan) || 'No cue'
      const cueDetail = getPlanCueDetail(plan)
      const goal = goalsById[normalizeId(plan.goalId)]
      const isComplete = plan?.completedDates?.[todayISO] === true
      const assigneeLabel =
        normalizeId(plan.assigneeId) === userId
          ? `${plan.assigneeName || user?.name || 'You'}`
          : plan.assigneeName || 'Child'

      if (!sectionMap.has(cueKey)) {
        sectionMap.set(cueKey, {
          key: cueKey,
          label: cueLabel,
          items: [],
        })
      }

      sectionMap.get(cueKey).items.push({
        id: plan.id,
        title: sanitizeTitle(plan?.title || 'Untitled plan'),
        subLabel: `${assigneeLabel} • ${getGoalTitle(goal)}`,
        detail: cueDetail || 'No extra cue detail',
        isComplete,
        habitType: plan?.taskType || plan?.type || goal?.taskType || goal?.type || goal?.goalType || 'build-habit',
        raw: plan,
      })
    })

    return Array.from(sectionMap.values())
  }, [todaysPlans, goalsById, todayISO, userId, user?.name])

  const speakActionPlans = useCallback(() => {
    if (!supportsTTS) return

    const ownerLabel =
      activeFamilyMemberId === userId
        ? 'You'
        : activeFamilyMemberId
          ? activeFamilyMemberLabel
          : 'Your family'

    speakText(buildActionPlanSpeech({
      name: user?.name?.split(' ').filter(Boolean)[0] || 'there',
      ownerLabel,
      sections: actionCueSections,
    }))
  }, [
    actionCueSections,
    activeFamilyMemberId,
    activeFamilyMemberLabel,
    supportsTTS,
    user?.name,
    userId,
  ])

  const taskActionPlanOptions = useMemo(() => {
    return visiblePlans
      .filter((plan) => plan?.completedDates?.[todayISO] !== true)
      .map((plan) => {
        const goal = goalsById[normalizeId(plan.goalId)]
        const goalLabel = goal ? getGoalTitle(goal) : ''
        const cueLabel =
          plan?.cueDetail ||
          plan?.cueLabel ||
          plan?.meta?.cueDetail ||
          plan?.meta?.cueLabel ||
          plan?.cue ||
          ''
        const title = sanitizeTitle(plan.title || 'Untitled plan')

        return {
          id: normalizeId(plan.id),
          title,
          cueLabel,
          label: `${title}${cueLabel ? ` • ${cueLabel}` : ''}${goalLabel ? ` — ${goalLabel}` : ''}`,
          goalId: normalizeId(plan.goalId),
          notes: plan.notes || '',
        }
      })
  }, [visiblePlans, goalsById, todayISO])

  const assigneeOptions = useMemo(() => {
    const options = []
    if (userId) {
      options.push({
        value: userId,
        name: user?.name || 'Me (parent)',
        type: 'parent',
      })
    }

    children.forEach((child) => {
      options.push({
        value: normalizeId(child.id),
        name: child.name,
        type: 'child',
      })
    })

    return options
  }, [children, user?.name, userId])

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      const assigneeId = normalizeId(task.assigneeId || task.childId)
      const createdById = normalizeId(task.createdById)
      const status = String(task.status || '').toLowerCase()
      if (status === 'rejected') return false
      return visibleAssigneeIds.has(assigneeId) || createdById === userId
    })
  }, [tasks, visibleAssigneeIds, userId])

  const displayTasks = useMemo(() => {
    return visibleTasks.map((task) => ({
      ...task,
      title: sanitizeTitle(task?.title || task?.name || task?.label || 'Untitled task'),
    }))
  }, [visibleTasks])

  const boardTasks = useMemo(() => {
    return displayTasks.filter((task) => !task?.needsApproval)
  }, [displayTasks])

  const boardActiveTasks = useMemo(
    () => boardTasks.filter((task) => String(task?.status || '').toLowerCase() === 'active'),
    [boardTasks]
  )

  const boardPendingTasks = useMemo(
    () => boardTasks.filter((task) => String(task?.status || '').toLowerCase() === 'pending'),
    [boardTasks]
  )

  const boardCompletedTasks = useMemo(
    () => boardTasks.filter((task) => isTaskComplete(task)).slice(0, 4),
    [boardTasks]
  )

  const focusedTask = useMemo(
    () => displayTasks.find((task) => normalizeId(task.id) === normalizeId(focusedTaskId)) || null,
    [displayTasks, focusedTaskId]
  )

  const openTaskBuilder = useCallback(() => {
    setFocusedTaskId(null)
    setTaskView('builder')
  }, [])

  const openTaskFocus = useCallback((taskId) => {
    setFocusedTaskId(taskId)
    setTaskView('focus')
  }, [])

  const goBackToTaskBoard = useCallback(() => {
    setFocusedTaskId(null)
    setTaskView('board')
  }, [])

  const syncLinkedPlanFromTask = useCallback(
    async (task) => {
      if (!task?.linkedActionPlanId) return

      const linkedPlan = visiblePlans.find(
        (plan) => normalizeId(plan?.id) === normalizeId(task.linkedActionPlanId)
      )

      if (!linkedPlan) return
      if (linkedPlan?.completedDates?.[todayISO] === true) return

      try {
        await togglePlanCompletion({
          plan: linkedPlan,
          todayISO,
          setActionPlans,
        })
      } catch (err) {
        console.error('[ParentHomepage] sync linked plan from task error', err)
      }
    },
    [visiblePlans, todayISO]
  )

  const handleStartTask = useCallback(
    async (taskId) => {
      try {
        const response = await taskStart(taskId)

        if (response?.status_code >= 400) {
          throw new Error(response?.error || 'Could not start task.')
        }

        setToast('Timed task started.')
        await loadParentHome()
      } catch (err) {
        console.error('Failed to start task:', err)
        setError('Failed to start task.')
      }
    },
    [loadParentHome]
  )

  const handleCompleteTask = useCallback(
    async (taskId, title = 'task', source = 'manual') => {
      try {
        const currentTask =
          displayTasks.find((task) => normalizeId(task.id) === normalizeId(taskId)) || null

        const response = await taskComplete(taskId, source)

        if (response?.status_code >= 400) {
          throw new Error(response?.error || 'Could not complete task.')
        }

        const updatedTask = response?.data?.task || currentTask
        await syncLinkedPlanFromTask(updatedTask)

        setToast(
          source === 'timer'
            ? `${title} finished automatically.`
            : `Completed ${title}`
        )
        await loadParentHome()
      } catch (err) {
        console.error('Failed to complete task:', err)
        setError('Failed to complete task.')
      }
    },
    [displayTasks, syncLinkedPlanFromTask, loadParentHome]
  )

  const handleToggleTaskChecklistItem = useCallback(
    async (taskId, itemId) => {
      try {
        const previousTask =
          displayTasks.find((task) => normalizeId(task.id) === normalizeId(taskId)) || null

        const response = await taskToggleChecklistItem(taskId, itemId)

        if (response?.status_code >= 400) {
          throw new Error(response?.error || 'Could not update checklist.')
        }

        const updatedTask = response?.data?.task || null

        if (updatedTask?.status === 'completed' && previousTask?.status !== 'completed') {
          await syncLinkedPlanFromTask(updatedTask)
        }

        await loadParentHome()
      } catch (err) {
        console.error('Failed to toggle checklist item:', err)
        setError('Failed to update checklist.')
      }
    },
    [displayTasks, syncLinkedPlanFromTask, loadParentHome]
  )

  const handleDeleteTask = useCallback(
    async (taskId) => {
      try {
        const response = await taskDelete(taskId)

        if (response?.status_code >= 400) {
          throw new Error(response?.error || 'Could not delete task.')
        }

        setToast('Task deleted.')
        await loadParentHome()
      } catch (err) {
        console.error('Failed to delete task:', err)
        setError('Failed to delete task.')
      }
    },
    [loadParentHome]
  )

  const simpleTasks = useMemo(() => {
    return displayTasks.filter(
      (task) => getTaskType(task) === 'simple' && !task.needsApproval
    )
  }, [displayTasks])

  const mySimpleTasks = useMemo(
    () => simpleTasks.filter((task) => normalizeId(task.assigneeId) === userId),
    [simpleTasks, userId]
  )

  const childSimpleTasks = useMemo(
    () => simpleTasks.filter((task) => childIds.has(normalizeId(task.assigneeId))),
    [simpleTasks, childIds]
  )

  const pendingMyTasks = useMemo(
    () => mySimpleTasks.filter((task) => !isTaskComplete(task)),
    [mySimpleTasks]
  )

  const pendingChildTasks = useMemo(
    () => childSimpleTasks.filter((task) => !isTaskComplete(task)),
    [childSimpleTasks]
  )

  const providerPendingApprovals = useMemo(
    () => pendingTasks.filter((task) => task.needsApproval && task.createdByRole === 'provider'),
    [pendingTasks]
  )

  const myDuePlans = useMemo(() => {
    return visiblePlans.filter((plan) => {
      if (normalizeId(plan.assigneeId) !== userId) return false
      const schedule = getPlanSchedule(plan)
      if (!schedule) return false
      return isDueOnDate(schedule, todayISO) && plan?.completedDates?.[todayISO] !== true
    })
  }, [visiblePlans, userId, todayISO])

  const childDuePlans = useMemo(() => {
    return visiblePlans.filter((plan) => {
      if (!childIds.has(normalizeId(plan.assigneeId))) return false
      const schedule = getPlanSchedule(plan)
      if (!schedule) return false
      return isDueOnDate(schedule, todayISO) && plan?.completedDates?.[todayISO] !== true
    })
  }, [visiblePlans, childIds, todayISO])

  const kidsNeedingAttention = useMemo(() => {
    return children
      .map((child) => {
        const childId = normalizeId(child.id)

        const taskCount = pendingChildTasks.filter(
          (task) => normalizeId(task.assigneeId) === childId
        ).length

        const planCount = childDuePlans.filter(
          (plan) => normalizeId(plan.assigneeId) === childId
        ).length

        return {
          child,
          taskCount,
          planCount,
          total: taskCount + planCount,
        }
      })
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [children, pendingChildTasks, childDuePlans])

  const childOverviewRows = useMemo(() => {
    return children.map((child) => {
      const childId = normalizeId(child.id)

      const goalCount = visibleGoals.filter(
        (goal) => normalizeId(goal.assigneeId) === childId
      ).length

      const duePlanCount = childDuePlans.filter(
        (plan) => normalizeId(plan.assigneeId) === childId
      ).length

      const pendingTaskCount = pendingChildTasks.filter(
        (task) => normalizeId(task.assigneeId) === childId
      ).length

      const approvalCount = providerPendingApprovals.filter(
        (task) => normalizeId(task.assigneeId || task.childId) === childId
      ).length

      return {
        child,
        goalCount,
        duePlanCount,
        pendingTaskCount,
        approvalCount,
        total: goalCount + duePlanCount + pendingTaskCount + approvalCount,
      }
    })
  }, [children, visibleGoals, childDuePlans, pendingChildTasks, providerPendingApprovals])

  const rewardProgress = useMemo(() => {
    if (!activeReward?.costCoins || activeReward.costCoins <= 0) return 0
    return Math.min(100, Math.round((coins / activeReward.costCoins) * 100))
  }, [activeReward, coins])

  const plansById = useMemo(() => {
    return (actionPlans || []).reduce((acc, plan) => {
      acc[String(plan.id)] = plan
      return acc
    }, {})
  }, [actionPlans])

  const familyWeekSummary = useMemo(() => {
    return [
      {
        key: 'mine',
        icon: '🧠',
        value: myDuePlans.length,
        label: 'My due',
        tone: 'is-blue',
      },
      {
        key: 'kids',
        icon: '👨‍👩‍👧',
        value: childDuePlans.length,
        label: 'Child due',
        tone: 'is-gold',
      },
      {
        key: 'tasks',
        icon: '📝',
        value: pendingChildTasks.length,
        label: 'Pending tasks',
        tone: 'is-orange',
      },
      {
        key: 'approvals',
        icon: '✅',
        value: providerPendingApprovals.length,
        label: 'Approvals',
        tone: 'is-green',
      },
      {
        key: 'attention',
        icon: '👀',
        value: kidsNeedingAttention.length,
        label: 'Need help',
        tone: 'is-purple',
      },
    ]
  }, [
    myDuePlans.length,
    childDuePlans.length,
    pendingChildTasks.length,
    providerPendingApprovals.length,
    kidsNeedingAttention.length,
  ])

  const handleTaskCreated = async () => {
    await loadParentHome()
    setToast('Assignment sent.')
    setTimeout(() => setToast(''), 2500)
  }

  const handleTogglePlan = useCallback(
    async (plan) => {
      if (!plan) return

      try {
        await togglePlanCompletion({
          plan,
          todayISO,
          setActionPlans,
        })

        await loadParentHome()
        setToast(`Updated ${sanitizeTitle(plan?.title || 'plan')} for today.`)
        setTimeout(() => setToast(''), 2500)
      } catch (err) {
        console.error('[ParentHomepage] toggle plan error', err)
        setError('Failed to update plan.')
      }
    },
    [todayISO, loadParentHome]
  )

  const handleRedeemReward = useCallback(async () => {
    if (!activeReward || redeemingReward) return

    try {
      setRedeemingReward(true)

      const result = await redeemActiveReward({
        reward: activeReward,
        userId: user?.id,
        goals: ownGoals,
      })

      setCoins(Number(result?.remainingCoins || 0))
      setActiveReward(null)

      setToast(
        result?.purchasedItem?.name
          ? `Redeemed reward and bought ${result.purchasedItem.name}!`
          : `Redeemed ${sanitizeTitle(result?.reward?.title || 'your reward')}!`
      )
      setTimeout(() => setToast(''), 2500)
    } catch (err) {
      console.error('[ParentHomepage] redeem reward error', err)
      setError(err?.message || 'Could not redeem reward.')
    } finally {
      setRedeemingReward(false)
    }
  }, [activeReward, redeemingReward, user?.id, ownGoals])

  if (!user) {
    return (
      <section className="container" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          You need to log in first.
        </div>
      </section>
    )
  }

  if (user?.role !== ROLE.PARENT) {
    return (
      <section className="container" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          Only parents can view this page.
        </div>
      </section>
    )
  }

  return (
    <div className="dashboard-shell">
      <section className="home-page">
        <Toast message={toast} type="success" onClose={() => setToast('')} />
        <Toast message={error} type="error" onClose={() => setError('')} />

        <div className="home-canvas">
          <div className="home-topbar-grid">
            <div className="home-panel home-panel--greeting">
              <p className="home-quote parent-home-greeting app-page-title">
                {greeting}, {user?.name || 'Parent'}
              </p>
            </div>

            <div className="home-panel home-panel--datetime">
              <div className="home-mini-line app-micro-text">🗓 {formatShortDate(today)}</div>
              <div className="home-mini-line app-micro-text">🕒 {clockTime}</div>
            </div>

            <div className="home-panel home-panel--reward">
              <div className="home-reward-header">
                <div className="home-panel__title app-panel-title">
                  {activeReward?.title ? sanitizeTitle(activeReward.title) : 'Active reward'}
                </div>
                <div className="home-reward-meta app-micro-text">
                  {activeReward
                    ? coins < activeReward.costCoins
                      ? `${(activeReward.costCoins - coins).toLocaleString()} left`
                      : activeReward?.sourceType === 'goal'
                        ? 'Goal reward'
                        : 'Ready to claim'
                    : 'No active reward'}
                </div>
              </div>

              <div className="home-reward-row">
                <div className="home-reward-track-wrap">
                  <div className="home-progress-track">
                    <div
                      className="home-progress-fill"
                      style={{ width: `${rewardProgress}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="home-redeem-btn btn-success app-button-label"
                  onClick={handleRedeemReward}
                  disabled={!activeReward || redeemingReward || coins < (activeReward?.costCoins || 0)}
                  aria-label="Redeem reward"
                  title="Redeem reward"
                >
                  <span className="home-redeem-btn__check" aria-hidden="true">✓</span>
                </button>
              </div>
            </div>

            <div className="home-panel home-panel--coins">
              <span className="home-coin-icon">🪙</span>
              <span className="home-coin-number app-section-title">{coins.toLocaleString()}</span>
            </div>

            <button
              type="button"
              className="home-primary-btn parent-dashboard-cta app-button-label"
              onClick={() => navigate('/parent/dashboard?tab=children')}
            >
              Open children
            </button>
          </div>

          <div className="home-main-grid">
            <section className="home-panel home-panel--action parent-action-shell">
              <div className="parent-action-shell__header">
                <div className="home-panel__title app-panel-title" style={{ marginBottom: 0 }}>
                  {activeFamilyMemberId
                    ? `${activeFamilyMemberLabel.toLowerCase()} action plan`
                    : 'family action plan'}
                </div>

                <p className="parent-action-shell__subtitle app-helper-text">
                  Flip between your own view and each child.
                </p>

                <div className="parent-filter-chip-row">
                  {familyViewOptions.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      active={selectedFamilyMemberId === option.value}
                      onClick={() => setSelectedFamilyMemberId(option.value)}
                    />
                  ))}
                </div>
              </div>

              <CuePlanCard
                title=""
                headerAction={(
                  <button
                    type="button"
                    className="cueCard__readButton app-button-label"
                    onClick={speakActionPlans}
                    disabled={!supportsTTS}
                    aria-label="Read action plans aloud"
                    title={supportsTTS ? 'Read action plans aloud' : 'Text-to-speech not supported'}
                  >
                    <span aria-hidden="true">🔊</span>
                    <span>Read</span>
                  </button>
                )}
                progressLabel={activeFamilyMemberId ? `${activeFamilyMemberLabel} progress` : 'Family progress'}
                progressValue={dailyProgress}
                progressValueText={`${dailyProgress}%`}
                sections={actionCueSections}
                loading={loading}
                loadingText="Loading family plans…"
                emptyTitle={
                  activeFamilyMemberId
                    ? `Nothing due today for ${activeFamilyMemberLabel}`
                    : 'Nothing due today'
                }
                emptyDescription={
                  activeFamilyMemberId
                    ? `${activeFamilyMemberLabel}'s due plans will show here.`
                    : 'Your due plans and your family’s due plans will show here.'
                }
                onItemClick={handleTogglePlan}
              />
            </section>

            <section className="home-panel home-panel--workspace">
              {taskView === 'board' && (
                <MissionsBoard
                  title="Family missions"
                  primaryActionLabel="Assign task"
                  onPrimaryAction={openTaskBuilder}
                  activeTasks={boardActiveTasks}
                  pendingTasks={boardPendingTasks}
                  completedTasks={boardCompletedTasks}
                  onOpenTask={openTaskFocus}
                  onStartTask={async (taskId) => {
                    await handleStartTask(taskId)
                    openTaskFocus(taskId)
                  }}
                  onCompleteTask={handleCompleteTask}
                  onDeleteTask={handleDeleteTask}
                  showAssignee
                  emptyReadyText={loading ? 'Loading family missions…' : 'No family missions are waiting right now.'}
                  emptyFinishedText={loading ? 'Loading family missions…' : 'No finished family missions yet.'}
                />
              )}

              {taskView === 'builder' && (
                <TaskAssignmentPanel
                  mode="parent"
                  currentUser={user}
                  actionPlanOptions={taskActionPlanOptions}
                  assigneeOptions={assigneeOptions}
                  onCreated={async () => {
                    await handleTaskCreated()
                    goBackToTaskBoard()
                  }}
                  onCancel={goBackToTaskBoard}
                />
              )}

              {taskView === 'focus' && (
                <FocusMissionPanel
                  task={focusedTask}
                  plansById={plansById}
                  goalsById={goalsById}
                  onBack={goBackToTaskBoard}
                  onStartTask={handleStartTask}
                  onCompleteTask={handleCompleteTask}
                  onToggleChecklistItem={handleToggleTaskChecklistItem}
                  onDeleteTask={async (taskId) => {
                    await handleDeleteTask(taskId)
                    goBackToTaskBoard()
                  }}
                />
              )}
            </section>

            <section className="home-panel home-panel--goals">
              <div className="parent-panel-header">
                <div className="home-panel__title app-panel-title">Family attention</div>
                <button
                  type="button"
                  className="home-secondary-btn app-button-label"
                  onClick={() => navigate('/parent/dashboard?tab=children')}
                >
                  Open children
                </button>
              </div>

              <div className="parent-section-stack">
                <div>
                  <div className="parent-section-label app-meta-label">Needs attention</div>

                  {kidsNeedingAttention.length === 0 ? (
                    <EmptyState
                      title="No one needs attention right now"
                      description="Due plans and pending child tasks will show here."
                    />
                  ) : (
                    <div className="parent-compact-list">
                      {kidsNeedingAttention.slice(0, 3).map((entry) => {
                        const approvalCount = providerPendingApprovals.filter(
                          (task) => normalizeId(task.assigneeId || task.childId) === normalizeId(entry.child.id)
                        ).length

                        return (
                          <button
                            key={entry.child.id}
                            type="button"
                            className="parent-compact-row"
                            onClick={() => setSelectedFamilyMemberId(normalizeId(entry.child.id))}
                          >
                            <div className="parent-compact-row__avatar">
                              {entry.child.name?.[0]?.toUpperCase() ?? '?'}
                            </div>

                            <div className="parent-compact-row__body">
                              <div className="parent-compact-row__name app-card-title">{entry.child.name}</div>
                              <div className="parent-compact-row__meta app-helper-text">
                                {entry.taskCount} tasks pending • {entry.planCount} due plans • {approvalCount} approvals
                              </div>
                            </div>

                            <div className="parent-compact-row__badge app-micro-text">{entry.total}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="parent-section-label app-meta-label">Children overview</div>

                  {childOverviewRows.length === 0 ? (
                    <EmptyState
                      title="No children connected yet"
                      description="Child summaries will appear here."
                    />
                  ) : (
                    <div className="parent-compact-list">
                      {childOverviewRows.map((entry) => (
                        <button
                          key={entry.child.id}
                          type="button"
                          className="parent-compact-row parent-compact-row--stacked"
                          onClick={() => setSelectedFamilyMemberId(normalizeId(entry.child.id))}
                        >
                          <div className="parent-compact-row__avatar">
                            {entry.child.name?.[0]?.toUpperCase() ?? '?'}
                          </div>

                          <div className="parent-compact-row__body">
                            <div className="parent-compact-row__name app-card-title">{entry.child.name}</div>
                            <div className="parent-compact-row__meta app-helper-text">
                              Tap to switch the page to this child.
                            </div>

                            <div className="parent-pill-row">
                              <span className="parent-pill app-micro-text">{entry.goalCount} goals</span>
                              <span className="parent-pill app-micro-text">{entry.duePlanCount} due today</span>
                              <span className="parent-pill app-micro-text">{entry.pendingTaskCount} pending tasks</span>
                              <span className="parent-pill app-micro-text">{entry.approvalCount} approvals</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="home-panel home-panel--calendar">
              <div className="parent-panel-header parent-panel-header--calendar">
                <div>
                  <div className="home-panel__title app-panel-title">Weekly calendar</div>
                  <p className="parent-calendar-subtitle app-helper-text">
                    {activeFamilyMemberId
                      ? `Showing ${activeFamilyMemberLabel}'s week.`
                      : ''}
                  </p>
                </div>

                <button
                  type="button"
                  className="home-secondary-btn home-calendar-open-btn app-button-label"
                  onClick={() => navigate('/calendar')}
                >
                  Open calendar
                </button>
              </div>

              <WeekStrip
                assigneeId={activeFamilyMemberId || user?.id}
                hideDefaultHeader
                variant="home"
                showDetails={false}
                weekStartsOn="monday"
                refreshKey={`${todayISO}-${completedTodayCount}-${coins}-${selectedFamilyMemberId}`}
              />

              <div className="home-week-summary">
                {familyWeekSummary.map((stat) => (
                  <article
                    key={stat.key}
                    className={`home-week-summary__card ${stat.tone}`}
                  >
                    <div className="home-week-summary__icon" aria-hidden="true">
                      {stat.icon}
                    </div>
                    <div className="home-week-summary__value app-section-title">
                      {Number(stat.value || 0).toLocaleString()}
                    </div>
                    <div className="home-week-summary__label app-meta-label">
                      {stat.label}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="home-panel home-panel--avatar parent-snapshot-panel">
              <div className="home-panel__title app-panel-title">Parent snapshot</div>

              <div className="parent-snapshot-stack">
                <div className="parent-snapshot-lead">
                  <div className="parent-snapshot-lead__kicker app-meta-label">Parent account</div>
                  <div className="parent-snapshot-lead__name app-card-title">{user?.name || 'Parent user'}</div>
                </div>

                <div className="parent-stat-pill app-micro-text"><strong>{ownGoals.length}</strong> of your own goals</div>
                <div className="parent-stat-pill app-micro-text"><strong>{children.length}</strong> connected child{children.length === 1 ? '' : 'ren'}</div>
                <div className="parent-stat-pill app-micro-text"><strong>{myDuePlans.length}</strong> of your plans due today</div>
                <div className="parent-stat-pill app-micro-text"><strong>{pendingMyTasks.length}</strong> of your simple tasks still open</div>
                <div className="parent-stat-pill app-micro-text"><strong>{providerPendingApprovals.length}</strong> approvals waiting</div>
              </div>
            </section>

            <section className="home-panel home-panel--badges parent-approvals-panel">
              <div className="parent-panel-header">
                <div className="home-panel__title app-panel-title">Approval list</div>
                <button
                  type="button"
                  className="home-secondary-btn app-button-label"
                  onClick={() => navigate('/parent/dashboard?tab=approvals')}
                >
                  Review
                </button>
              </div>

              {providerPendingApprovals.length === 0 ? (
                <div className="home-badges-empty app-helper-text">
                  No approvals are waiting right now.
                </div>
              ) : (
                <div className="home-badges-list">
                  {providerPendingApprovals.slice(0, 6).map((task) => (
                    <div key={task.id} className="home-friend-row">
                      <div className="home-friend-avatar">
                        {(task.assigneeName || 'P')?.[0]?.toUpperCase() ?? 'P'}
                      </div>
                      <div className="home-friend-info">
                        <div className="home-friend-name app-card-title">
                          {sanitizeTitle(task.title || task.name || 'Untitled task')}
                        </div>
                        <div className="home-friend-meta app-helper-text">
                          {(task.assigneeName || 'Child')} • {task.createdByRole || 'provider'} submitted
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
