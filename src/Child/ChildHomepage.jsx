import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import WeekStrip from '../components/WeekStrip.jsx'
import { DisplayAvatar } from '../components/DisplayAvatar.jsx'
import { useGameProfile } from '../components/useGameProfile.jsx'
import { useItems } from '../components/useItems.jsx'
import { useInventory } from '../components/useInventory.jsx'
import CuePlanCard from '../components/CuePlanCard.jsx'
import MissionsBoard from '../components/MissionsBoard.jsx'
import FocusMissionPanel from '../components/FocusMissionPanel.jsx'
import { goalList } from '../lib/api/goals.js'
import { actionPlanList } from '../lib/api/actionPlans.js'
import { getCoins, markComplete, markIncomplete } from '../lib/api/streaks.js'
import {
  clearActiveReward,
  getActiveReward,
  getAvailableRewards,
  redeemActiveReward,
  setActiveReward as persistActiveReward,
} from '../lib/api/reward.js'
import { friendsList } from '../lib/api/friends.js'
import { getFriendDisplayName, getFriendIdentifier } from '../lib/friendsIdentity.js'
import { isDueOnDate, toLocalISODate } from '../lib/schedule.js'
import { getCueLabel } from '../lib/cuePresets.js'
import {
  buildActionPlanSpeech,
  speakText,
  supportsSpeechSynthesis,
} from '../lib/speech.js'
import {
  taskList,
  taskStart,
  taskComplete,
  taskToggleChecklistItem,
} from '../lib/api/tasks.js'
import './ChildHomepage.css'

function getFirstName(name) {
  if (!name) return ''
  return String(name).split(' ').filter(Boolean)[0] || ''
}

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

function extractCoins(response) {
  return Number(response?.data?.total ?? response?.total ?? 0) || 0
}

function getGoalTitle(goal) {
  return goal?.title || goal?.goal || goal?.name || 'Untitled goal'
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

function startOfWeekMonday(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date, amount) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function normalizeTaskStatus(task) {
  const status = String(task?.status || '').toLowerCase()
  if (status === 'done' || status === 'completed') return 'completed'
  if (status === 'active') return 'active'
  return 'pending'
}

function readDailyBonusState(userId) {
  try {
    const raw = localStorage.getItem(`childDailyBonus:${userId || 'guest'}`)
    if (!raw) {
      return {
        lastClaimDate: '',
        lastClaimAmount: 0,
      }
    }

    const parsed = JSON.parse(raw)
    return {
      lastClaimDate: parsed?.lastClaimDate || '',
      lastClaimAmount: Number(parsed?.lastClaimAmount || 0),
    }
  } catch {
    return {
      lastClaimDate: '',
      lastClaimAmount: 0,
    }
  }
}

export default function ChildHomepage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { profile, setProfile } = useGameProfile()
  const { items } = useItems()
  const inventoryItems = useInventory(profile, items)

  const [goals, setGoals] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [coins, setCoins] = useState(0)
  const [activeReward, setActiveReward] = useState(null)
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [taskView, setTaskView] = useState('board')
  const [focusedTaskId, setFocusedTaskId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [rewardMessage, setRewardMessage] = useState('')
  const [rewardToastType, setRewardToastType] = useState('success')
  const [redeemingReward, setRedeemingReward] = useState(false)
  const [showRewardPicker, setShowRewardPicker] = useState(false)
  const [availableRewards, setAvailableRewards] = useState([])
  const [rewardPickerLoading, setRewardPickerLoading] = useState(false)

  const [now, setNow] = useState(() => new Date())

  const [petMood, setPetMood] = useState('happy')
  const [showPetSpeech, setShowPetSpeech] = useState(false)
  const [petSpeechText, setPetSpeechText] = useState('')

  const supportsTTS = supportsSpeechSynthesis()

  const todayISO = useMemo(() => toLocalISODate(now), [now])
  const shortDate = useMemo(() => formatShortDate(now), [now])
  const clockTime = useMemo(() => formatClock(now), [now])
  const firstName = useMemo(() => getFirstName(user?.name), [user?.name])
  const triggerFunConfetti = useCallback(() => {
    confetti({
      particleCount: 90,
      spread: 72,
      origin: { y: 0.62 },
      startVelocity: 18,
      colors: ['#ffb347', '#4caf50', '#ff6b6b', '#3b82f6', '#f9a825'],
    })
  }, [])

  const speakAsPet = useCallback((message, mood = 'excited') => {
    setPetSpeechText(message)
    setPetMood(mood)
    setShowPetSpeech(true)

    window.setTimeout(() => setShowPetSpeech(false), 2500)
    window.setTimeout(() => setPetMood('happy'), 3000)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true

    async function loadHomeData() {
      if (!user?.id) {
        setGoals([])
        setActionPlans([])
        setCoins(0)
        setActiveReward(null)
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const [goalsResponse, plansResponse, coinsResponse] = await Promise.all([
          goalList(),
          actionPlanList(),
          getCoins(user.id),
        ])

        if (!active) return

        const nextGoals = extractGoals(goalsResponse)
        const todayBonusState = readDailyBonusState(user.id)
        const todayBonus = todayBonusState.lastClaimDate === todayISO
          ? todayBonusState.lastClaimAmount
          : 0

        setGoals(nextGoals)
        setActionPlans(extractPlans(plansResponse))
        setCoins(extractCoins(coinsResponse) + todayBonus)

        const activeRewardResponse = await getActiveReward({
          userId: user.id,
          goals: nextGoals,
        })

        if (!active) return
        setActiveReward(activeRewardResponse)
      } catch (error) {
        console.error('Failed to load child homepage data:', error)

        if (active) {
          setGoals([])
          setActionPlans([])
          setCoins(0)
          setActiveReward(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHomeData()

    return () => {
      active = false
    }
  }, [todayISO, user?.id])

  useEffect(() => {
    let active = true

    async function loadFriends() {
      if (!user?.id) {
        setFriends([])
        setFriendsLoading(false)
        return
      }

      setFriendsLoading(true)

      try {
        const resp = await friendsList()

        if (active && Array.isArray(resp?.data?.friends)) {
          setFriends(resp.data.friends)
        } else if (active) {
          setFriends([])
        }
      } catch (error) {
        console.error('Failed to load friends:', error)
        if (active) setFriends([])
      } finally {
        if (active) setFriendsLoading(false)
      }
    }

    loadFriends()

    return () => {
      active = false
    }
  }, [user?.id])

  const visibleGoals = useMemo(() => {
    if (!user?.id) return []

    return goals.filter((goal) =>
      String(goal?.assigneeId) === String(user.id) ||
      String(goal?.createdById) === String(user.id) ||
      String(goal?.userId) === String(user.id)
    )
  }, [goals, user?.id])

  const visibleGoalIds = useMemo(
    () => new Set(visibleGoals.map((goal) => String(goal.id))),
    [visibleGoals]
  )

  const visiblePlans = useMemo(
    () => actionPlans.filter((plan) => visibleGoalIds.has(String(plan?.goalId))),
    [actionPlans, visibleGoalIds]
  )

  const goalsById = useMemo(
    () => Object.fromEntries(visibleGoals.map((goal) => [String(goal.id), goal])),
    [visibleGoals]
  )

  const plansById = useMemo(
    () => Object.fromEntries(visiblePlans.map((plan) => [String(plan.id), plan])),
    [visiblePlans]
  )

  const todaysPlans = useMemo(() => {
    return visiblePlans.filter((plan) => {
      const schedule =
        plan?.schedule && typeof plan.schedule === 'object'
          ? plan.schedule
          : plan?.frequency && typeof plan.frequency === 'object'
            ? plan.frequency
            : null

      return schedule ? isDueOnDate(schedule, todayISO) : false
    })
  }, [todayISO, visiblePlans])

  const activeStreakCount = useMemo(() => {
    return visiblePlans.filter((plan) => Number(plan?.currentStreak || 0) > 0).length
  }, [visiblePlans])

  const completedTodayCount = useMemo(() => {
    return todaysPlans.filter((plan) => plan?.completedDates?.[todayISO] === true).length
  }, [todayISO, todaysPlans])

  const dailyProgress = useMemo(() => {
    if (!todaysPlans.length) return 0
    return Math.round((completedTodayCount / todaysPlans.length) * 100)
  }, [completedTodayCount, todaysPlans.length])

  const actionCueSections = useMemo(() => {
    const sectionMap = new Map()

    todaysPlans.forEach((plan, index) => {
      const cueKey = getPlanCueKey(plan) || 'uncategorized'
      const cueLabel = getPlanCueLabel(plan) || 'No cue'
      const cueDetail = getPlanCueDetail(plan)
      const goal = goalsById[String(plan?.goalId)]
      const isComplete = plan?.completedDates?.[todayISO] === true

      if (!sectionMap.has(cueKey)) {
        sectionMap.set(cueKey, {
          key: cueKey,
          label: cueLabel,
          items: [],
        })
      }

      sectionMap.get(cueKey).items.push({
        id: plan.id || plan.tempId || `${cueKey}-${index}`,
        title: plan?.title || 'Untitled habit',
        subLabel: getGoalTitle(goal),
        detail: cueDetail,
        isComplete,
        habitType: plan?.taskType || plan?.type || goal?.taskType || goal?.type || goal?.goalType || 'build-habit',
        raw: plan,
      })
    })

    return Array.from(sectionMap.values())
  }, [goalsById, todayISO, todaysPlans])

  const speakActionPlans = useCallback(() => {
    if (!supportsTTS) return

    speakText(buildActionPlanSpeech({
      name: firstName || 'there',
      ownerLabel: 'You',
      sections: actionCueSections,
    }))
  }, [actionCueSections, firstName, supportsTTS])

  const rewardProgress = useMemo(() => {
    if (!activeReward?.costCoins || activeReward.costCoins <= 0) return 0
    return Math.min(100, Math.round((coins / activeReward.costCoins) * 100))
  }, [activeReward, coins])

  const handleRedeemReward = useCallback(async () => {
    if (!activeReward || redeemingReward) return

    try {
      setRedeemingReward(true)

      const result = await redeemActiveReward({
        reward: activeReward,
        userId: user?.id,
        goals: visibleGoals,
      })

      setCoins(Number(result?.remainingCoins || 0))
      setActiveReward(result?.activeReward ?? null)

      if (result?.updatedProfile) {
        setProfile(result.updatedProfile)
      }

      setRewardToastType('success')
      setRewardMessage(
        result?.purchasedItem?.name
          ? `Redeemed reward and bought ${result.purchasedItem.name}!`
          : `Redeemed ${result?.reward?.title || 'your reward'}!`
      )

      triggerFunConfetti()
      speakAsPet('You got a reward! Amazing! 🎁', 'excited')
    } catch (error) {
      console.error('Failed to redeem reward:', error)
      setRewardToastType('error')
      setRewardMessage(error?.message || 'Could not redeem reward.')
    } finally {
      setRedeemingReward(false)
    }
  }, [
    activeReward,
    redeemingReward,
    setProfile,
    speakAsPet,
    triggerFunConfetti,
    user?.id,
    visibleGoals,
  ])

  const openRewardPicker = useCallback(async () => {
    try {
      setRewardPickerLoading(true)
      const rewards = await getAvailableRewards({
        userId: user?.id,
        goals: visibleGoals,
      })
      setAvailableRewards(Array.isArray(rewards) ? rewards : [])
      setShowRewardPicker(true)
    } catch (error) {
      console.error('Failed to load rewards:', error)
      setRewardToastType('error')
      setRewardMessage('Could not load available rewards.')
    } finally {
      setRewardPickerLoading(false)
    }
  }, [user?.id, visibleGoals])

  const handleSelectReward = useCallback(async (reward) => {
    try {
      const nextReward = await persistActiveReward(reward, {
        userId: user?.id,
        goals: visibleGoals,
      })

      setActiveReward(nextReward || null)
      setShowRewardPicker(false)
      setRewardToastType('success')
      setRewardMessage(`Active reward set to ${reward?.title || 'your reward'}.`)
    } catch (error) {
      console.error('Failed to set active reward:', error)
      setRewardToastType('error')
      setRewardMessage('Could not set that reward.')
    }
  }, [user?.id, visibleGoals])

  const handleClearReward = useCallback(async () => {
    if (!activeReward) return

    try {
      await clearActiveReward({
        reward: activeReward,
        userId: user?.id,
        goals: visibleGoals,
      })
      setActiveReward(null)
      setRewardToastType('success')
      setRewardMessage('Reward hidden for now.')
    } catch (error) {
      console.error('Failed to clear reward:', error)
      setRewardToastType('error')
      setRewardMessage('Could not hide reward.')
    }
  }, [activeReward, user?.id, visibleGoals])

  const latestGoals = useMemo(() => {
    return visibleGoals.slice(0, 4).map((goal) => {
      const plansForGoal = visiblePlans.filter((plan) => String(plan.goalId) === String(goal.id))
      const completed = plansForGoal.filter((plan) => plan?.completedDates?.[todayISO] === true).length
      const percent = plansForGoal.length
        ? Math.round((completed / plansForGoal.length) * 100)
        : 0

      return {
        id: goal.id,
        title: goal.title || 'Untitled goal',
        percent,
        completed,
        total: plansForGoal.length,
      }
    })
  }, [todayISO, visibleGoals, visiblePlans])

  const weekStart = useMemo(() => startOfWeekMonday(now), [now])
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => toLocalISODate(addDays(weekStart, index))),
    [weekStart]
  )

  const weeklyTotals = useMemo(() => {
    return weekDates.reduce(
      (acc, iso) => {
        const duePlans = visiblePlans.filter((plan) => {
          const schedule =
            plan?.schedule && typeof plan.schedule === 'object'
              ? plan.schedule
              : plan?.frequency && typeof plan.frequency === 'object'
                ? plan.frequency
                : null

          return schedule ? isDueOnDate(schedule, iso) : false
        })

        const doneCount = duePlans.filter((plan) => plan?.completedDates?.[iso] === true).length

        acc.totalDue += duePlans.length
        acc.totalDone += doneCount
        return acc
      },
      { totalDue: 0, totalDone: 0 }
    )
  }, [visiblePlans, weekDates])

  const weeklyBadgeCount = useMemo(() => {
    const weekEnd = addDays(weekStart, 7)
    const mergedBadgeDates = new Map()
    const profileMeta = profile?.meta && typeof profile.meta === 'object' ? profile.meta : {}
    const profileBadgeDates =
      profileMeta.badgeEarnedDates && typeof profileMeta.badgeEarnedDates === 'object'
        ? profileMeta.badgeEarnedDates
        : {}

    Object.entries(profileBadgeDates).forEach(([badgeId, earnedAt]) => {
      mergedBadgeDates.set(badgeId, earnedAt || null)
    })

    visiblePlans.forEach((plan) => {
      const badgeDates =
        plan?.badgeEarnedDates && typeof plan.badgeEarnedDates === 'object'
          ? plan.badgeEarnedDates
          : {}

      Object.entries(badgeDates).forEach(([badgeId, earnedAt]) => {
        const existing = mergedBadgeDates.get(badgeId)
        const nextTime = earnedAt ? new Date(earnedAt).getTime() : 0
        const existingTime = existing ? new Date(existing).getTime() : 0

        if (!existing || nextTime > existingTime) {
          mergedBadgeDates.set(badgeId, earnedAt || null)
        }
      })
    })

    return Array.from(mergedBadgeDates.values()).filter((earnedAt) => {
      if (!earnedAt) return false

      const date = new Date(earnedAt)
      if (Number.isNaN(date.getTime())) return false

      return date >= weekStart && date < weekEnd
    }).length
  }, [profile, visiblePlans, weekStart])

  const weeklySummary = useMemo(() => {
    const COINS_PER_COMPLETION = 20

    return [
      { key: 'badges', icon: '🏅', label: 'Badges', value: weeklyBadgeCount, tone: 'is-blue' },
      { key: 'due', icon: '🗓', label: 'Due', value: weeklyTotals.totalDue, tone: 'is-gold' },
      { key: 'done', icon: '✅', label: 'Done', value: weeklyTotals.totalDone, tone: 'is-green' },
      { key: 'streaks', icon: '🔥', label: 'Streaks', value: activeStreakCount, tone: 'is-orange' },
      { key: 'coins', icon: '🪙', label: 'Coins', value: weeklyTotals.totalDone * COINS_PER_COMPLETION, tone: 'is-purple' },
    ]
  }, [activeStreakCount, weeklyBadgeCount, weeklyTotals])

  const completePlanForToday = useCallback(async (plan) => {
    if (!plan) return null

    const alreadyDone = plan?.completedDates?.[todayISO] === true

    try {
      const response = alreadyDone
        ? await markIncomplete(plan.id, todayISO)
        : await markComplete(plan.id, todayISO)

      if (!response || response.status_code !== 200) {
        throw new Error(response?.error || 'Failed to update plan')
      }

      const data = response.data || {}

      if (data?.plan) {
        setActionPlans((prev) =>
          (Array.isArray(prev) ? prev : []).map((item) =>
            String(item.id) === String(plan.id) ? data.plan : item
          )
        )
      }

      if (String(data?.assigneeId) === String(user?.id)) {
        if (typeof data?.totalCoins === 'number' && !Number.isNaN(data.totalCoins)) {
          setCoins(data.totalCoins)
        }
      }

      if (Array.isArray(data?.newBadges) && data.newBadges.length) {
        setRewardMessage(
          `New badge${data.newBadges.length === 1 ? '' : 's'} earned: ${data.newBadges.join(', ')}`
        )
        triggerFunConfetti()
      }

      if (!alreadyDone) {
        triggerFunConfetti()
        speakAsPet('Nice job! 🎉', 'excited')
        setSuccessMessage(`Completed ${plan.title || 'habit plan'}`)
      } else {
        setSuccessMessage(`Updated ${plan.title || 'habit plan'}`)
      }

      return response
    } catch (error) {
      console.error('Plan toggle failed:', error)
      return null
    }
  }, [speakAsPet, todayISO, triggerFunConfetti, user?.id])

  const syncLinkedPlanFromTask = useCallback(async (task) => {
    if (!task?.linkedActionPlanId) return

    const linkedPlan = visiblePlans.find(
      (plan) => String(plan?.id) === String(task.linkedActionPlanId)
    )

    if (!linkedPlan) return
    if (linkedPlan?.completedDates?.[todayISO] === true) return

    await completePlanForToday(linkedPlan)
  }, [completePlanForToday, todayISO, visiblePlans])

  const handleTogglePlan = useCallback(async (plan) => {
    await completePlanForToday(plan)
  }, [completePlanForToday])

  const refreshTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([])
      setTasksLoading(false)
      return
    }

    try {
      setTasksLoading(true)

      const response = await taskList()

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Failed to load tasks.')
      }

      const nextTasks = Array.isArray(response?.data?.tasks)
        ? response.data.tasks
        : []

      setTasks(nextTasks)
    } catch (error) {
      console.error('Failed to load tasks:', error)
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    refreshTasks()
  }, [refreshTasks])

  const activeTasks = useMemo(
    () => tasks.filter((task) => normalizeTaskStatus(task) === 'active'),
    [tasks]
  )

  const pendingTasks = useMemo(
    () => tasks.filter((task) => normalizeTaskStatus(task) === 'pending'),
    [tasks]
  )

  const completedTasks = useMemo(() => {
    const allCompleted = tasks.filter((task) => normalizeTaskStatus(task) === 'completed')

    const completedToday = allCompleted.filter((task) =>
      task?.completedAt
        ? toLocalISODate(new Date(task.completedAt)) === todayISO
        : false
    )

    return (completedToday.length ? completedToday : allCompleted).slice(0, 4)
  }, [tasks, todayISO])

  const focusedTask = useMemo(() => {
    return tasks.find((task) => String(task.id) === String(focusedTaskId)) || null
  }, [focusedTaskId, tasks])

  const openTaskFocus = useCallback((taskId) => {
    setFocusedTaskId(taskId)
    setTaskView('focus')
  }, [])

  const goBackToTaskBoard = useCallback(() => {
    setFocusedTaskId(null)
    setTaskView('board')
  }, [])

  const handleStartTask = useCallback(async (taskId) => {
    try {
      const response = await taskStart(taskId)

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Could not start task.')
      }

      setSuccessMessage('Nice! Your timed mission has started.')
      await refreshTasks()
    } catch (error) {
      console.error('Failed to start task:', error)
    }
  }, [refreshTasks])

  const handleCompleteTask = useCallback(async (taskId, title = 'task') => {
    try {
      const currentTask = tasks.find((task) => String(task.id) === String(taskId)) || null
      const response = await taskComplete(taskId, 'manual')

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Could not complete task.')
      }

      const updatedTask = response?.data?.task || currentTask

      await syncLinkedPlanFromTask(updatedTask)
      setSuccessMessage(`Finished ${title}`)
      triggerFunConfetti()
      speakAsPet(`Great job finishing "${title}"! 🎯`, 'excited')
      await refreshTasks()
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }, [refreshTasks, speakAsPet, syncLinkedPlanFromTask, tasks, triggerFunConfetti])

  const handleToggleTaskChecklistItem = useCallback(async (taskId, itemId) => {
    try {
      const previousTask = tasks.find((task) => String(task.id) === String(taskId)) || null
      const response = await taskToggleChecklistItem(taskId, itemId)

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Could not update checklist.')
      }

      const updatedTask = response?.data?.task || null

      if (updatedTask?.status === 'completed' && previousTask?.status !== 'completed') {
        await syncLinkedPlanFromTask(updatedTask)
      }

      await refreshTasks()
    } catch (error) {
      console.error('Failed to toggle checklist item:', error)
    }
  }, [refreshTasks, syncLinkedPlanFromTask, tasks])

  if (!user) {
    return (
      <section className="home-empty">
        <h1>Child Home</h1>
        <p>You need to log in first.</p>
      </section>
    )
  }

  return (
    <div className="dashboard-shell">
      <section className="home-page child-home-page">
        <Toast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage('')}
        />

        <Toast
          message={rewardMessage}
          type={rewardToastType}
          onClose={() => setRewardMessage('')}
        />

        <div className="home-canvas">
          <div className="home-topbar-grid">
            <div className="home-panel home-panel--greeting child-top-card">
              <div className="child-greeting-row">
                <div className="child-greeting-copy">
                  <div className="home-panel__title app-page-title">Today’s adventure</div>
                  <p className="home-quote app-helper-text">
                    Hi {firstName || 'friend'} — finish your missions and make your buddy proud.
                  </p>
                </div>

                {/* status pill removed per UI update request */}
              </div>
            </div>

            <div className="home-panel home-panel--datetime child-top-card">
              <div className="home-mini-line app-micro-text">🗓 {shortDate}</div>
              <div className="home-mini-line app-micro-text">🕒 {clockTime}</div>
            </div>

            <div className="home-panel home-panel--reward child-top-card">
              {activeReward ? (
                <>
                  <div className="home-reward-header">
                    <div className="home-panel__title app-panel-title">
                      {activeReward.title}
                    </div>

                    <div className="home-reward-meta app-micro-text">
                      {coins < activeReward.costCoins
                        ? `${(activeReward.costCoins - coins).toLocaleString()} left`
                        : activeReward?.sourceType === 'goal'
                          ? 'Assigned'
                          : 'Ready to claim'}
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
                      disabled={redeemingReward || coins < activeReward.costCoins}
                      aria-label="Redeem reward"
                      title="Redeem reward"
                    >
                      <span className="home-redeem-btn__check" aria-hidden="true">
                        ✓
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost app-button-label home-reward-clear"
                    onClick={handleClearReward}
                  >
                    Hide reward
                  </button>
                </>
              ) : (
                <div className="home-reward-empty">
                  <div className="home-panel__title app-panel-title">No active reward</div>
                  <div className="app-helper-text">Pick something fun to save your coins for.</div>
                  <button
                    type="button"
                    className="btn btn-primary app-button-label"
                    onClick={openRewardPicker}
                    disabled={rewardPickerLoading}
                  >
                    {rewardPickerLoading ? 'Loading...' : 'Choose reward'}
                  </button>
                </div>
              )}

              {showRewardPicker ? (
                <div className="home-reward-picker">
                  {availableRewards.length === 0 ? (
                    <div className="app-helper-text">No saved rewards available yet.</div>
                  ) : (
                    availableRewards.map((reward, index) => (
                      <button
                        key={`reward-${reward.id || index}`}
                        type="button"
                        className="home-reward-picker__item"
                        onClick={() => handleSelectReward(reward)}
                      >
                        <span className="home-reward-picker__copy">
                          <span className="app-card-title">{reward.title}</span>
                          <span className="app-micro-text">
                            {reward.sourceGoalTitle ? `From ${reward.sourceGoalTitle}` : 'Saved reward'}
                          </span>
                        </span>
                        <span className="app-helper-text">{reward.costCoins} coins</span>
                      </button>
                    ))
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost app-button-label"
                    onClick={() => setShowRewardPicker(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>

            <div className="home-panel home-panel--coins child-top-card">
              <span className="home-coin-icon">🪙</span>
              <span className="home-coin-number app-card-title">{coins.toLocaleString()}</span>
              <span className="child-coin-label app-micro-text">coin stash</span>
            </div>

          </div>

          <div className="home-main-grid">
            <section className="home-panel home-panel--action child-surface child-surface--flush">
              <CuePlanCard
                title="Adventure list"
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
                progressLabel="Today’s progress"
                progressValue={dailyProgress}
                progressValueText={`${dailyProgress}%`}
                sections={actionCueSections}
                loading={loading}
                loadingText="Loading today’s adventures…"
                emptyTitle="Nothing due right now"
                emptyDescription="Your next quest will pop up here."
                onItemClick={handleTogglePlan}
              />
            </section>

            <section className="home-panel home-panel--workspace child-surface">
              {taskView === 'board' ? (
                <MissionsBoard
                  title="Mission control"
                  activeTasks={activeTasks}
                  pendingTasks={pendingTasks}
                  completedTasks={completedTasks}
                  onOpenTask={openTaskFocus}
                  onStartTask={async (taskId) => {
                    await handleStartTask(taskId)
                    openTaskFocus(taskId)
                  }}
                  onCompleteTask={handleCompleteTask}
                  emptyReadyText={tasksLoading ? 'Loading tasks…' : 'You are all caught up right now.'}
                  emptyFinishedText={tasksLoading ? 'Loading tasks…' : 'Finish a mission to see it here.'}
                />
              ) : null}

              {taskView === 'focus' ? (
                <FocusMissionPanel
                  task={focusedTask}
                  plansById={plansById}
                  goalsById={goalsById}
                  onBack={goBackToTaskBoard}
                  onStartTask={handleStartTask}
                  onCompleteTask={handleCompleteTask}
                  onToggleChecklistItem={handleToggleTaskChecklistItem}
                />
              ) : null}
            </section>

            <section className="home-panel home-panel--goals child-surface">
                <div className="home-section-header-row">
                <div className="home-panel__title app-panel-title">Quest progress</div>
                <button
                  type="button"
                  className="btn btn-ghost app-button-label"
                  onClick={() => navigate('/goals')}
                >
                  View all
                </button>
              </div>

              {loading ? (
                <p className="home-muted app-helper-text">Loading goals…</p>
              ) : latestGoals.length === 0 ? (
                <div className="home-empty-goals">
                  <span role="img" aria-label="cute monster">👾</span>
                  <p className="app-helper-text">No goals yet — let’s make your first adventure!</p>
                  <button
                    className="btn btn-primary app-button-label"
                    onClick={() => navigate('/habit-wizard')}
                  >
                    Create a goal
                  </button>
                </div>
              ) : (
                <div className="home-goal-list">
                  {latestGoals.map((goal, index) => (
                    <div className="home-goal-item" key={`goal-${goal.id || goal.tempId || index}`}>
                      <div className="home-goal-item__row">
                        <span className="home-goal-item__title app-card-title">{goal.title}</span>
                        <span className="home-goal-item__value app-micro-text">{goal.percent}%</span>
                      </div>

                      <div className="home-progress-track">
                        <div
                          className={`home-progress-fill color-${index % 4}`}
                          style={{ width: `${goal.percent}%` }}
                        />
                      </div>

                      <div className="home-goal-item__meta app-helper-text">
                        {goal.total > 0
                          ? `${goal.completed} of ${goal.total} steps done today`
                          : 'No steps yet'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="home-panel home-panel--calendar child-surface">
              <div className="home-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="home-panel__title app-panel-title">Adventure map</div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost app-button-label"
                  onClick={() => navigate('/calendar')}
                >
                  Open calendar
                </button>
              </div>

              <WeekStrip
                assigneeId={user?.id}
                hideDefaultHeader
                variant="home"
                showDetails={false}
                weekStartsOn="monday"
                refreshKey={`${todayISO}-${completedTodayCount}-${coins}`}
              />

              <div className="home-week-summary">
                {weeklySummary.map((stat) => (
                  <article key={`summary-${stat.key}`} className={`home-week-summary__card ${stat.tone}`}>
                    <div className="home-week-summary__icon" aria-hidden="true">
                      {stat.icon}
                    </div>
                    <div className="home-week-summary__value app-card-title">
                      {Number(stat.value || 0).toLocaleString()}
                    </div>
                    <div className="home-week-summary__label app-meta-label">{stat.label}</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="home-panel home-panel--badges child-surface">
              <div className="home-badges-header">
                <div className="home-panel__title app-panel-title">My sidekicks</div>
                {!!friends.length && (
                  <div className="home-badges-count app-micro-text">
                    {friends.length} friend{friends.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {friendsLoading ? (
                <p className="home-muted">Loading friends…</p>
              ) : friends.length === 0 ? (
                <div className="home-badges-empty">
                  Add friends to cheer each other on.
                </div>
              ) : (
                <div className="home-badges-list">
                  {friends.map((friend, index) => {
                    const friendIdentifier = getFriendIdentifier(friend)
                    const friendName = getFriendDisplayName(friend) || 'Friend'
                    const friendStreak = typeof friend === 'object' ? Number(friend?.streak || 0) : 0

                    return (
                      <div key={`friend-${friendIdentifier || index}`} className="home-friend-row">
                        <div className="home-friend-avatar">
                          {friendName[0]?.toUpperCase() ?? '?'}
                        </div>

                        <div className="home-friend-info">
                          <div className="home-friend-name app-card-title">{friendName}</div>
                          {friendStreak > 0 ? (
                            <div className="home-friend-meta app-micro-text">
                              🔥 {friendStreak} day streak
                            </div>
                          ) : (
                            <div className="home-friend-meta app-helper-text">Working on their goals</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="home-panel home-panel--avatar child-surface">
              <div className="home-panel__title app-panel-title">Buddy zone</div>

              <div className="home-avatar-shell">
                {inventoryItems?.length ? (
                  <DisplayAvatar invItems={inventoryItems} />
                ) : (
                  <div className={`home-pet home-pet--${petMood}`}>
                    {petMood === 'excited'
                      ? '🐶✨'
                      : petMood === 'sleepy'
                        ? '🐶💤'
                        : '🐶'}
                  </div>
                )}
              </div>

              {showPetSpeech && <div className="home-pet-speech app-helper-text">{petSpeechText}</div>}

              <div className="home-avatar-name app-card-title">{user?.name || 'Champion'}</div>
              <div className="home-avatar-rank app-helper-text">
                {dailyProgress >= 100
                  ? 'Quest Superstar'
                  : dailyProgress > 0
                    ? 'Brave Explorer'
                    : 'Adventure Starter'}
              </div>
            </section>
          </div>
        </div>

      </section>
    </div>
  )
}
