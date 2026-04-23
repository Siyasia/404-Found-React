import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import WeekStrip from '../components/WeekStrip.jsx'
import { DisplayAvatar } from '../components/DisplayAvatar.jsx'
import { useGameProfile } from '../components/useGameProfile.jsx'
import { useItems } from '../components/useItems.jsx'
import { useInventory } from '../components/useInventory.jsx'
import CuePlanCard from '../components/CuePlanCard.jsx'
import '../dashboardTheme.css'
import './Home.css'
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
import { isDueOnDate, toLocalISODate } from '../lib/schedule.js'
import { getCueLabel } from '../lib/cuePresets.js'
import {
  buildActionPlanSpeech,
  speakText,
  supportsSpeechSynthesis,
} from '../lib/speech.js'
import MissionsBoard from '../components/MissionsBoard.jsx'
import TaskAssignmentPanel from '../components/TaskAssignmentPanel.jsx'
import FocusMissionPanel from '../components/FocusMissionPanel.jsx'
import {
  taskList,
  taskStart,
  taskComplete,
  taskToggleChecklistItem,
  taskDelete,
} from '../lib/api/tasks.js'

/* =========================================================
   SMALL HELPER FUNCTIONS
   These keep the main component cleaner and centralize
   formatting / data extraction logic.
========================================================= */

/* Formats the small date card at the top */
function formatShortDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/* Formats the live time card */
function formatClock(date = new Date()) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* Creates fallback initials when avatar data is missing */
function getInitials(name) {
  if (!name) return 'NS'

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

function getGreetingPrefix() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const DAILY_QUOTES = [
  'Success is the sum of small efforts repeated day in and day out.',
  'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
  'Motivation gets you going, but habit gets you there.',
  "You don't rise to the level of your goals, you fall to the level of your systems.",
  'Small steps every day lead to big results over time.',
  'The secret of your future is hidden in your daily routine.',
  'Your habits will determine your future.',
  'Discipline is choosing between what you want now and what you want most.',
  'The chains of habit are too weak to be felt until they are too strong to be broken.',
]

function getDailyQuote() {
  return DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length]
}


/* Returns Monday of the current week */
function startOfWeekMonday(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/* Adds N days to a Date */
function addDays(date, amount) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

/* Makes goal API responses safe even if shape changes slightly */
function extractGoals(response) {
  if (Array.isArray(response?.goals)) return response.goals
  if (Array.isArray(response?.data?.goals)) return response.data.goals
  if (Array.isArray(response?.data)) return response.data
  return []
}

/* Makes plan API responses safe even if shape changes slightly */
function extractPlans(response) {
  if (Array.isArray(response?.plans)) return response.plans
  if (Array.isArray(response?.data?.plans)) return response.data.plans
  if (Array.isArray(response?.data)) return response.data
  return []
}

/* Pulls the numeric coin total out of the API response */
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

function isPlanDoneToday(plan, todayISO) {
  return plan?.completedDates?.[todayISO] === true
}

function buildUpdatedPlanFromResult(plan, resultData, todayISO, completedNow) {
  const backendPlan = resultData?.plan
  if (backendPlan && typeof backendPlan === 'object') {
    return backendPlan
  }

  const nextCompletedDates = {
    ...(plan?.completedDates || {}),
  }

  if (completedNow) nextCompletedDates[todayISO] = true
  else delete nextCompletedDates[todayISO]

  return {
    ...plan,
    completedDates: nextCompletedDates,
    currentStreak: Number(resultData?.current ?? resultData?.currentStreak ?? plan?.currentStreak ?? 0) || 0,
    bestStreak: Number(resultData?.longest ?? resultData?.bestStreak ?? plan?.bestStreak ?? 0) || 0,
    totalCompletions: Number(resultData?.totalCompletions ?? plan?.totalCompletions ?? 0) || 0,
    streak: Number(resultData?.current ?? resultData?.currentStreak ?? plan?.streak ?? 0) || 0,
    earnedBadges: Array.isArray(resultData?.earnedBadges) ? resultData.earnedBadges : plan?.earnedBadges || [],
    awardedMilestones: Array.isArray(resultData?.awardedMilestones) ? resultData.awardedMilestones : plan?.awardedMilestones || [],
    badgeEarnedDates:
      resultData?.badgeEarnedDates && typeof resultData.badgeEarnedDates === 'object'
        ? resultData.badgeEarnedDates
        : plan?.badgeEarnedDates || {},
  }
}

/* =========================================================
   HOME PAGE
========================================================= */
export default function Home() {
  const navigate = useNavigate()
  const { user } = useUser()
  /* -------------------------------------------------------
     AVATAR / PROFILE DATA
     These hooks let us render the user's real avatar if
     inventory items exist. If not, we fall back to initials.
  -------------------------------------------------------- */
  const { profile, setProfile } = useGameProfile()
  const { items } = useItems()
  const inventoryItems = useInventory(profile, items)

  /* -------------------------------------------------------
     REAL HOMEPAGE DATA
     These hold the actual goals, plans, coins, and loading
     state for the page.
  -------------------------------------------------------- */
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

  const supportsTTS = supportsSpeechSynthesis()

  /* -------------------------------------------------------
     LIVE CLOCK
     Keeps the time card updated.
  -------------------------------------------------------- */
  const [clockTime, setClockTime] = useState(formatClock())

  /* -------------------------------------------------------
     FIXED DATE HELPERS
     today = current Date object
     todayISO = local YYYY-MM-DD for schedule calculations
  -------------------------------------------------------- */
  const today = useMemo(() => new Date(), [])
  const todayISO = useMemo(() => toLocalISODate(new Date()), [])

  /* -------------------------------------------------------
     LIVE CLOCK EFFECT
     Updates the time once every second.
  -------------------------------------------------------- */
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTime(formatClock(new Date()))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  /* -------------------------------------------------------
     LOAD HOMEPAGE DATA
     Fetches goals, plans, and coins for the signed-in user.
  -------------------------------------------------------- */
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

        setGoals(nextGoals)
        setActionPlans(extractPlans(plansResponse))
        setCoins(extractCoins(coinsResponse))

        const activeRewardResponse = await getActiveReward({
          userId: user.id,
          goals: nextGoals,
        })

        if (!active) return
        setActiveReward(activeRewardResponse)
      } catch (error) {
        console.error('Failed to load homepage data:', error)

        if (active) {
          setGoals([])
          setActionPlans([])
          setCoins(0)
          setActiveReward(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadHomeData()

    return () => {
      active = false
    }
  }, [user?.id])

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
      } catch (err) {
        console.error('Failed to load friends:', err)

        if (active) {
          setFriends([])
        }
      } finally {
        if (active) setFriendsLoading(false)
      }
    }

    loadFriends()

    return () => {
      active = false
    }
  }, [user?.id])

  /* -------------------------------------------------------
     FILTER GOALS FOR THIS USER
     Only keep goals that belong to this user.
  -------------------------------------------------------- */
  const visibleGoals = useMemo(() => {
    if (!user?.id) return []

    return goals.filter((goal) => {
      const assignedToUser = String(goal?.assigneeId) === String(user.id)
      const createdByUser = String(goal?.createdById) === String(user.id)
      const ownedByUser = String(goal?.userId) === String(user.id)
      return assignedToUser || createdByUser || ownedByUser
    })
  }, [goals, user?.id])

  /* -------------------------------------------------------
     GOAL IDS FOR FAST LOOKUPS
  -------------------------------------------------------- */
  const visibleGoalIds = useMemo(() => {
    return new Set(visibleGoals.map((goal) => String(goal.id)))
  }, [visibleGoals])

  /* -------------------------------------------------------
     FILTER PLANS FOR VISIBLE GOALS
  -------------------------------------------------------- */
  const visiblePlans = useMemo(() => {
    return actionPlans.filter((plan) =>
      visibleGoalIds.has(String(plan?.goalId))
    )
  }, [actionPlans, visibleGoalIds])

  /* -------------------------------------------------------
     GOAL LOOKUP MAP
     Lets us quickly find a plan's parent goal later.
  -------------------------------------------------------- */
  const goalsById = useMemo(() => {
    const map = {}

    visibleGoals.forEach((goal) => {
      map[String(goal.id)] = goal
    })

    return map
  }, [visibleGoals])

  const plansById = useMemo(() => {
    const map = {}

    visiblePlans.forEach((plan) => {
      map[String(plan.id)] = plan
    })

    return map
  }, [visiblePlans])

  /* -------------------------------------------------------
     TODAY'S DUE ACTION PLANS
     Only plans due today go in the action plan panel.
  -------------------------------------------------------- */
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
  }, [visiblePlans, todayISO])

  const taskActionPlanOptions = useMemo(() => {
    return visiblePlans
      .filter((plan) => plan?.completedDates?.[todayISO] !== true)
      .map((plan) => {
        const goal = goalsById[String(plan.goalId)]
        const goalLabel = goal ? getGoalTitle(goal) : ''
        const cueLabel =
          plan?.cueDetail ||
          plan?.cueLabel ||
          plan?.meta?.cueDetail ||
          plan?.meta?.cueLabel ||
          plan?.cue ||
          ''
        const title = plan.title || 'Untitled plan'

        return {
          id: String(plan.id),
          title,
          cueLabel,
          label: `${title}${cueLabel ? ` • ${cueLabel}` : ''}${goalLabel ? ` — ${goalLabel}` : ''}`,
          goalId: plan.goalId ? String(plan.goalId) : null,
          notes: plan.notes || '',
        }
      })
  }, [visiblePlans, goalsById, todayISO])

  const activeStreakCount = useMemo(() => {
    return visiblePlans.filter((plan) => Number(plan?.currentStreak || 0) > 0)
      .length
  }, [visiblePlans])

  /* -------------------------------------------------------
     HOW MANY OF TODAY'S PLANS ARE COMPLETE
  -------------------------------------------------------- */
  const completedTodayCount = useMemo(() => {
    return todaysPlans.filter(
      (plan) => plan?.completedDates?.[todayISO] === true
    ).length
  }, [todaysPlans, todayISO])

  /* -------------------------------------------------------
     DAILY PROGRESS %
  -------------------------------------------------------- */
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
        id: plan.id,
        title: plan?.title || 'Untitled habit',
        subLabel: getGoalTitle(goal),
        detail: cueDetail,
        isComplete,
        habitType: plan?.taskType || plan?.type || goal?.taskType || goal?.type || goal?.goalType || 'build-habit',
        raw: plan,
      })
    })

    return Array.from(sectionMap.values())
  }, [todaysPlans, goalsById, todayISO])

  const speakActionPlans = useCallback(() => {
    if (!supportsTTS) return

    speakText(buildActionPlanSpeech({
      name: user?.name?.split(' ').filter(Boolean)[0] || 'there',
      ownerLabel: 'You',
      sections: actionCueSections,
    }))
  }, [actionCueSections, supportsTTS, user?.name])

  /* -------------------------------------------------------
     REWARD BAR
     Tracks the one active reward.
  -------------------------------------------------------- */
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
      if (result?.purchasedItem?.name) {
        setRewardMessage(`Redeemed reward and bought ${result.purchasedItem.name}!`)
      } else {
        setRewardMessage(`Redeemed ${result?.reward?.title || 'your reward'}!`)
      }
    } catch (error) {
      console.error('Failed to redeem reward:', error)
      setRewardToastType('error')
      setRewardMessage(error?.message || 'Could not redeem reward.')
    } finally {
      setRedeemingReward(false)
    }
  }, [activeReward, redeemingReward, user?.id, visibleGoals, setProfile])

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

  /* -------------------------------------------------------
     LATEST GOALS WITH PROGRESS %
     Used in the goal list card.
  -------------------------------------------------------- */
  const latestGoals = useMemo(() => {
    return visibleGoals.slice(0, 4).map((goal) => {
      const plansForGoal = visiblePlans.filter(
        (plan) => String(plan.goalId) === String(goal.id)
      )

      const completed = plansForGoal.filter(
        (plan) => plan?.completedDates?.[todayISO] === true
      ).length

      const percent = plansForGoal.length
        ? Math.round((completed / plansForGoal.length) * 100)
        : 0

      return {
        id: goal.id,
        title: goal.title || 'Untitled goal',
        percent,
      }
    })
  }, [visibleGoals, visiblePlans, todayISO])

  const weekStart = useMemo(() => startOfWeekMonday(new Date()), [])
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) =>
      toLocalISODate(addDays(weekStart, index))
    )
  }, [weekStart])

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

        const doneCount = duePlans.filter(
          (plan) => plan?.completedDates?.[iso] === true
        ).length

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

    const profileMeta =
      profile?.meta && typeof profile.meta === 'object' ? profile.meta : {}

    const profileBadgeDates =
      profileMeta.badgeEarnedDates &&
      typeof profileMeta.badgeEarnedDates === 'object'
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
      {
        key: 'badges',
        icon: '🏅',
        label: 'Badges',
        value: weeklyBadgeCount,
        tone: 'is-blue',
      },
      {
        key: 'due',
        icon: '🗓',
        label: 'Due',
        value: weeklyTotals.totalDue,
        tone: 'is-gold',
      },
      {
        key: 'done',
        icon: '✅',
        label: 'Done',
        value: weeklyTotals.totalDone,
        tone: 'is-green',
      },
      {
        key: 'streaks',
        icon: '🔥',
        label: 'Streaks',
        value: activeStreakCount,
        tone: 'is-orange',
      },
      {
        key: 'coins',
        icon: '🪙',
        label: 'Coins',
        value: weeklyTotals.totalDone * COINS_PER_COMPLETION,
        tone: 'is-purple',
      },
    ]
  }, [weeklyBadgeCount, weeklyTotals, activeStreakCount])

  const completePlanForToday = useCallback(async (plan) => {
    if (!plan) return null

    const alreadyDone = isPlanDoneToday(plan, todayISO)
    try {
      const response = alreadyDone
        ? await markIncomplete(plan.id, todayISO)
        : await markComplete(plan.id, todayISO)

      if (!response || response.status_code !== 200) {
        throw new Error(response?.error || 'Failed to update action plan.')
      }

      const data = response.data || {}
      const updatedPlan = buildUpdatedPlanFromResult(plan, data, todayISO, !alreadyDone)

      setActionPlans((prev) =>
        (Array.isArray(prev) ? prev : []).map((item) =>
          String(item?.id) === String(plan?.id) ? { ...item, ...updatedPlan } : item
        )
      )

      if (String(data?.assigneeId) === String(user?.id)) {
        if (typeof data?.totalCoins === 'number' && !Number.isNaN(data.totalCoins)) {
          setCoins(data.totalCoins)
        }
      }

      if (Array.isArray(data?.newBadges) && data.newBadges.length) {
        setRewardMessage(
          `New badge${data.newBadges.length === 1 ? '' : 's'} earned: ${data.newBadges.join(', ')}`
        )
      }

      const coinDelta =
        Number(data?.coinsEarned || 0) +
        Number(data?.badgeCoinsEarned || 0)

      if (!alreadyDone) {
        if (coinDelta > 0) {
          setSuccessMessage(`Completed ${plan?.title || 'habit plan'} • earned ${coinDelta} coins`)
        } else {
          setSuccessMessage(`Completed ${plan?.title || 'habit plan'}`)
        }
      } else {
        setSuccessMessage(`Updated ${plan?.title || 'habit plan'} for today`)
      }

      return response
    } catch (error) {
      console.error('Failed to toggle plan completion:', error)
      return null
    }
  }, [todayISO, user?.id])

  const syncLinkedPlanFromTask = useCallback(async (task) => {
    if (!task?.linkedActionPlanId) return

    const linkedPlan = visiblePlans.find(
      (plan) => String(plan?.id) === String(task.linkedActionPlanId)
    )

    if (!linkedPlan) return
    if (linkedPlan?.completedDates?.[todayISO] === true) return

    await completePlanForToday(linkedPlan)
  }, [visiblePlans, todayISO, completePlanForToday])

  /* -------------------------------------------------------
     PLAN TOGGLE HANDLER
     This is the real completion logic for action plans.
  -------------------------------------------------------- */
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

      const response = await taskList({
        assigneeId: String(user.id),
      })

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Failed to load tasks.')
      }

      setTasks(response?.data?.tasks || [])
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

  const activeTasks = useMemo(() => {
    return tasks.filter((task) => String(task?.status || '').toLowerCase() === 'active')
  }, [tasks])

  const pendingTasks = useMemo(() => {
    return tasks.filter((task) => String(task?.status || '').toLowerCase() === 'pending')
  }, [tasks])

  const completedTasks = useMemo(() => {
    return tasks.filter((task) => {
      const status = String(task?.status || '').toLowerCase()
      return status === 'completed' || status === 'done'
    })
  }, [tasks])

  const focusedTask = useMemo(() => {
    return tasks.find((task) => String(task.id) === String(focusedTaskId)) || null
  }, [tasks, focusedTaskId])

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

  const handleTaskCreated = useCallback(async () => {
    await refreshTasks()
  }, [refreshTasks])

  const handleStartTask = useCallback(async (taskId) => {
    try {
      const response = await taskStart(taskId)

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Could not start task.')
      }

      setSuccessMessage('Timed task started.')
      await refreshTasks()
    } catch (error) {
      console.error('Failed to start task:', error)
    }
  }, [refreshTasks, setSuccessMessage])

  const handleCompleteTask = useCallback(async (taskId, title = 'task', source = 'manual') => {
    try {
      const currentTask =
        tasks.find((task) => String(task.id) === String(taskId)) || null

      const response = await taskComplete(taskId, source)

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Could not complete task.')
      }

      const updatedTask = response?.data?.task || currentTask
      await syncLinkedPlanFromTask(updatedTask)

      setSuccessMessage(
        source === 'timer'
          ? `${title} finished automatically.`
          : `Completed ${title}`
      )
      await refreshTasks()
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
    }, [tasks, syncLinkedPlanFromTask, refreshTasks, setSuccessMessage])

  const handleToggleTaskChecklistItem = useCallback(async (taskId, itemId) => {
    try {
      const previousTask =
        tasks.find((task) => String(task.id) === String(taskId)) || null

      const response = await taskToggleChecklistItem(taskId, itemId)

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Could not update checklist.')
      }

      const updatedTask = response?.data?.task || null

      if (
        updatedTask?.status === 'completed' &&
        previousTask?.status !== 'completed'
      ) {
        await syncLinkedPlanFromTask(updatedTask)
      }

      await refreshTasks()
    } catch (error) {
      console.error('Failed to toggle checklist item:', error)
    }
  }, [tasks, syncLinkedPlanFromTask, refreshTasks])

  const handleDeleteTask = useCallback(async (taskId) => {
    try {
      const response = await taskDelete(taskId)

      if (response?.status_code >= 400) {
        throw new Error(response?.error || 'Could not delete task.')
      }

      setSuccessMessage('Task deleted.')
      await refreshTasks()
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [refreshTasks, setSuccessMessage])

  /* -------------------------------------------------------
     SIMPLE LOGIN GUARD
  -------------------------------------------------------- */
  if (!user) {
    return (
      <section className="home-empty">
        <h1>Home</h1>
        <p>You need to log in first.</p>
      </section>
    )
  }

  /* =======================================================
     RENDER
  ======================================================== */
  return (
    <div className="dashboard-shell">
      <section className="home-page">
        {/* Toasts for success and reward messages */}
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

        {/* Fixed 1920px canvas that matches your desktop wireframe */}
        <div className="home-canvas">
          {/* ---------------- TOP BAR ---------------- */}
          <div className="home-topbar-grid">
            {/* Greeting + quote */}
            <div className="home-panel home-panel--greeting">
              <div className="home-panel__title app-page-title">
                {getGreetingPrefix()}, <span className="home-greeting__name">{user?.name?.split(' ')[0] || 'there'}</span>!
              </div>
              <p className="home-quote app-helper-text">{getDailyQuote()}</p>
            </div>

            {/* Time + date */}
            <div className="home-panel home-panel--datetime">
              <div className="home-mini-line app-micro-text">🗓 {formatShortDate(today)}</div>
              <div className="home-mini-line app-micro-text">🕒 {clockTime}</div>
            </div>

            {/* Reward bar */}
            <div className="home-panel home-panel--reward">
              {activeReward ? (
                <>
                  <div className="home-reward-header">
                    <div className="home-reward-header__title app-card-title">
                      {activeReward.title}
                    </div>
                    <div className={`home-reward-status app-micro-text ${coins >= activeReward.costCoins ? 'home-reward-status--ready' : ''}`}>
                      {coins < activeReward.costCoins
                        ? <><span className="home-reward-status__coins">{coins.toLocaleString()}</span><span className="home-reward-status__sep">/</span><span>{activeReward.costCoins.toLocaleString()}</span></>
                        : <span className="home-reward-status--ready-label">✨ Ready to redeem!</span>}
                    </div>
                  </div>
                  <div className="home-reward-row">
                    <div className="home-reward-track-wrap">
                      <div className="home-progress-track">
                        <div className="home-progress-fill" style={{ width: `${rewardProgress}%` }} />
                      </div>
                      <div className="home-reward-pct">{rewardProgress}%</div>
                    </div>
                    <button
                      type="button"
                      className={`home-redeem-btn btn-success ${coins >= activeReward.costCoins ? 'home-redeem-btn--unlocked' : ''}`}
                      onClick={handleRedeemReward}
                      disabled={redeemingReward || coins < activeReward.costCoins}
                      aria-label="Redeem reward"
                      title="Redeem reward"
                    >
                      <span aria-hidden="true">{redeemingReward ? '...' : '✓'}</span>
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
                  <div className="home-reward-header__title app-card-title">No active reward</div>
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

            {/* Coin display */}
            <div className="home-panel home-panel--coins">
              <span className="home-coin-icon">🪙</span>
              <span className="home-coin-number app-card-title">{coins.toLocaleString()}</span>
            </div>

            {/* Create habit button */}
            <div className="home-panel home-panel--cta">
              <button
                type="button"
                className="home-primary-btn app-button-label"
                onClick={() => navigate('/habit-wizard')}
              >
                Create habit
              </button>
            </div>
          </div>

          {/* ---------------- MAIN GRID ---------------- */}
          <div className="home-main-grid">
            {/* Action plan panel: reusable cue-grouped card */}
            <div className="home-panel--action">
              <CuePlanCard
                title="Action plan"
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
                progressLabel="Daily progress"
                progressValue={dailyProgress}
                progressValueText={`${dailyProgress}%`}
                sections={actionCueSections}
                loading={loading}
                loadingText="Loading today's plans…"
                emptyTitle="Nothing due today"
                emptyDescription="Your action plans due today will show here."
                onItemClick={handleTogglePlan}
              />
            </div>

            <section className="home-panel home-panel--workspace">
              {taskView === 'board' ? (
                <MissionsBoard
                  title="Your missions"
                  primaryActionLabel="Create task"
                  onPrimaryAction={openTaskBuilder}
                  activeTasks={activeTasks}
                  pendingTasks={pendingTasks}
                  completedTasks={completedTasks.slice(0, 4)}
                  onOpenTask={openTaskFocus}
                  onStartTask={async (taskId) => {
                    await handleStartTask(taskId)
                    openTaskFocus(taskId)
                  }}
                  onCompleteTask={handleCompleteTask}
                  onDeleteTask={handleDeleteTask}
                  emptyReadyText={tasksLoading ? 'Loading tasks…' : 'You are all caught up right now.'}
                  emptyFinishedText={tasksLoading ? 'Loading tasks…' : 'Finish a mission to see it here.'}
                />
              ) : null}

              {taskView === 'builder' ? (
                <TaskAssignmentPanel
                  mode="self"
                  currentUser={user}
                  actionPlanOptions={taskActionPlanOptions}
                  onCreated={async () => {
                    await handleTaskCreated()
                    goBackToTaskBoard()
                  }}
                  onCancel={goBackToTaskBoard}
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
                  onDeleteTask={async (taskId) => {
                    await handleDeleteTask(taskId)
                    goBackToTaskBoard()
                  }}
                />
              ) : null}
            </section>

            {/* Goal list card */}
            <section className="home-panel home-panel--goals">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div className="home-panel__title app-panel-title">Goal list</div>
                <button
                  type="button"
                  className="home-secondary-btn app-button-label"
                  onClick={() => navigate('/goals')}
                >
                  View all goals
                </button>
              </div>

              {loading ? (
                <p className="home-muted app-helper-text">Loading goals…</p>
              ) : latestGoals.length === 0 ? (
                <p className="home-muted app-helper-text">No goals yet.</p>
              ) : (
                <div className="home-goal-list">
                  {latestGoals.map((goal, index) => (
                    <div className="home-goal-item" key={`goal-${goal.id || index}`}>
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
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Weekly calendar card spanning the lower middle width */}
            <section className="home-panel home-panel--calendar">
              <div className="home-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="home-panel__title app-panel-title">Weekly calendar</div>
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
                assigneeId={user?.id}
                hideDefaultHeader
                variant="home"
                showDetails={false}
                weekStartsOn="monday"
                refreshKey={`${todayISO}-${completedTodayCount}-${coins}`}
              />

              <div className="home-week-summary">
                {weeklySummary.map((stat) => (
                  <article
                    key={`summary-${stat.key}`}
                    className={`home-week-summary__card ${stat.tone}`}
                  >
                    <div className="home-week-summary__icon" aria-hidden="true">
                      {stat.icon}
                    </div>
                    <div className="home-week-summary__value app-card-title">
                      {Number(stat.value || 0).toLocaleString()}
                    </div>
                    <div className="home-week-summary__label app-meta-label">
                      {stat.label}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Friends list card */}
            <section className="home-panel home-panel--badges">
              <div className="home-badges-header">
                <div className="home-panel__title app-panel-title">Friends</div>
                {!!friends.length && (
                  <div className="home-badges-count app-micro-text">{friends.length} online</div>
                )}
              </div>

              {friendsLoading ? (
                <p className="home-muted app-helper-text">Loading friends…</p>
              ) : friends.length === 0 ? (
                <div className="home-badges-empty app-helper-text">
                  Add friends to see them here.
                </div>
              ) : (
                <div className="home-badges-list">
                  {friends.map((friend, index) => (
                    <div key={`friend-${friend.id || friend.name || index}`} className="home-friend-row">
                      <div className="home-friend-avatar">
                        {friend.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="home-friend-info">
                        <div className="home-friend-name app-card-title">{friend.name}</div>
                        {friend.streak > 0 && (
                          <div className="home-friend-meta app-micro-text">
                            🔥 {friend.streak} day streak
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Avatar card in the lower-right */}
            <section className="home-panel home-panel--avatar">
              <div className="home-panel__title app-panel-title">Avatar display</div>

              <div className="home-avatar-shell">
                {inventoryItems?.length ? (
                  <DisplayAvatar invItems={inventoryItems} />
                ) : (
                  <div className="home-avatar-fallback">
                    {getInitials(user?.name)}
                  </div>
                )}
              </div>

              <div className="home-avatar-name app-card-title">{user?.name || 'John Doe'}</div>
              <div className="home-avatar-rank app-helper-text">Habit Tracker Pro</div>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
