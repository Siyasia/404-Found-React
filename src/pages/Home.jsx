import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import GoalCard from '../components/GoalCard.jsx'
import HabitPlanList from '../components/HabitPlanList.jsx'
import Toast from '../components/Toast.jsx'
import WeekStrip from '../components/WeekStrip.jsx'
import { goalList } from '../lib/api/goals.js'
import { actionPlanList } from '../lib/api/actionPlans.js'
import { getCoins } from '../lib/api/streaks.js'
import togglePlanCompletion from '../lib/actionPlanCompletion.js'
import { isDueOnDate, toLocalISODate } from '../lib/schedule.js'
import '../dashboardTheme.css'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useUser()

  const [goals, setGoals] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [coins, setCoins] = useState(0)
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [rewardMessage, setRewardMessage] = useState('')
  const [weekRefreshKey, setWeekRefreshKey] = useState(0) // refresh the week strip after completion changes

  const todayISO = useMemo(() => toLocalISODate(), [])

  useEffect(() => {
    let active = true

    async function loadHabitData() {
      setLoading(true)
      try {
        const [goalResponse, planResponse, coinsResponse] = await Promise.all([
          goalList(),
          actionPlanList(),
          getCoins(user?.id),
        ])

        if (!active) return

        const nextGoals = Array.isArray(goalResponse?.goals) ? goalResponse.goals : []
        const nextPlans = Array.isArray(planResponse?.plans) ? planResponse.plans : []
        const totalCoins = Number(coinsResponse?.data?.total || 0)

        setGoals(nextGoals)
        setActionPlans(nextPlans)
        setCoins(totalCoins)
      } catch (error) {
        console.error('[PHASE 5] Failed to load goals/action plans for Home:', error)
        if (!active) return
        setGoals([])
        setActionPlans([])
        setCoins(0)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHabitData()

    return () => {
      active = false
    }
  }, [user?.id])

  const visibleGoals = useMemo(() => {
    if (!Array.isArray(goals) || !user?.id) return []

    return goals.filter((goal) => {
      const isAssignedToUser = String(goal?.assigneeId) === String(user.id)
      const isCreatedByUser = String(goal?.createdById) === String(user.id)
      return isAssignedToUser || isCreatedByUser
    })
  }, [goals, user])

  const goalsById = useMemo(() => {
    const map = {}
    visibleGoals.forEach((goal) => {
      map[String(goal.id)] = goal
    })
    return map
  }, [visibleGoals])

  const visibleActionPlans = useMemo(() => {
    const visibleGoalIds = new Set(visibleGoals.map((goal) => String(goal.id)))
    return (Array.isArray(actionPlans) ? actionPlans : []).filter((plan) =>
      visibleGoalIds.has(String(plan.goalId))
    )
  }, [actionPlans, visibleGoals])

  const todaysPlans = useMemo(() => {
    return visibleActionPlans.filter((plan) => {
      const schedule =
        plan?.schedule && typeof plan.schedule === 'object'
          ? plan.schedule
          : plan?.frequency && typeof plan.frequency === 'object'
            ? plan.frequency
            : null

      if (!schedule) return false
      return isDueOnDate(schedule, todayISO)
    })
  }, [visibleActionPlans, todayISO])

  const activeStreakCount = useMemo(() => {
    return visibleActionPlans.filter((plan) => Number(plan?.currentStreak || 0) > 0).length
  }, [visibleActionPlans])

  const assignedToMeCount = useMemo(() => {
    return visibleGoals.filter((goal) => String(goal?.assigneeId) === String(user?.id)).length
  }, [visibleGoals, user])

  const managedForOthersCount = useMemo(() => {
    return visibleGoals.filter(
      (goal) =>
        String(goal?.createdById) === String(user?.id) &&
        String(goal?.assigneeId) !== String(user?.id)
    ).length
  }, [visibleGoals, user])

  const handleRewardFeedback = useCallback((newBadgeIds = [], coinPayload = null, planTitle = '') => {
    if (Array.isArray(newBadgeIds) && newBadgeIds.length > 0) {
      setRewardMessage(`New badge${newBadgeIds.length === 1 ? '' : 's'} earned: ${newBadgeIds.join(', ')}`)
    }

    const delta = Number(coinPayload?.delta || 0)
    if (delta > 0) {
      setSuccessMessage(`Completed ${planTitle || 'habit plan'} • earned ${delta} coins`)
    } else if (delta === 0) {
      setSuccessMessage(`Updated ${planTitle || 'habit plan'} for today`)
    }
  }, [])

  const handleToggleActionPlanCompletion = useCallback(
    async (plan) => {
      if (!plan) return null

      const goal = goalsById[String(plan.goalId)]
      const milestoneRewards = Array.isArray(goal?.milestoneRewards) ? goal.milestoneRewards : []

      try {
        const result = await togglePlanCompletion({
          plan,
          todayISO,
          milestoneRewards,
          setActionPlans,
          onBadges: (badgeIds) => handleRewardFeedback(badgeIds, null, plan?.title),
          onCoins: ({ delta = 0, total = null }) => {
            const isForCurrentUser = String(plan?.assigneeId) === String(user?.id)

            if (isForCurrentUser) {
              if (typeof total === 'number' && !Number.isNaN(total)) {
                setCoins(total)
              } else if (typeof delta === 'number' && !Number.isNaN(delta)) {
                setCoins((prev) => Math.max(0, prev + delta))
              }
            }

            handleRewardFeedback([], { delta, total }, plan?.title)
          },
          onAfterToggle: () => {
            setWeekRefreshKey((prev) => prev + 1) //refresh weekly overview after calendar-affecting changes
          },
        })

        return result
      } catch (error) {
        console.error('[PHASE 5] Failed to toggle action plan completion:', error)
        return null
      }
    },
    [goalsById, handleRewardFeedback, todayISO, user?.id]
  )

  if (!user) {
    return (
      <section className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1>Home</h1>
        <p className="sub hero">You need to log in first.</p>
      </section>
    )
  }

  return (
    <div className="dashboard-shell">
      <Toast message={successMessage} type="success" onClose={() => setSuccessMessage('')} />
      <Toast message={rewardMessage} type="success" onClose={() => setRewardMessage('')} />

      <div className="homeDashboard">
        <header className="homeHeader">
          <div className="homeHeaderTop">
            <div>
              <h1 className="homeTitle">Good day, {user?.name || 'there'}</h1>
              <p className="homeSub">
                Your new habit system is now interactive here.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  padding: '.5rem .8rem',
                  borderRadius: '999px',
                  border: '1px solid var(--hw-border)',
                  background: 'linear-gradient(135deg, #fffaf0, #fef3c7)',
                  fontWeight: 800,
                  color: '#8a5a00',
                }}
              >
                🪙 {coins}
              </div>

              <button type="button" className="btn" onClick={() => navigate('/habit-wizard')}>
                Create habit
              </button>
            </div>
          </div>
        </header>

        <div className="homeGrid">
          <main className="homeMain">
            <section className="dashboard-card">
              <h2 className="sectionTitle">Today&apos;s plans</h2>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <p className="dashboard-emptyText">Loading your action plans…</p>
                ) : (
                  <HabitPlanList
                    plans={todaysPlans}
                    todayISO={todayISO}
                    onToggleCompletion={handleToggleActionPlanCompletion}
                    emptyTitle="Nothing due today"
                    emptyDescription="Once your schedules line up with today, they will show here."
                    limit={8}
                    showAssignee
                    showType
                    showTrigger
                    showStreak
                  />
                )}
              </div>
            </section>

            <section className="dashboard-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h2 className="sectionTitle">Saved goals</h2>
                <span className="dashboardInlineChip">Interactive view</span>
              </div>

              {loading ? (
                <p className="dashboard-emptyText" style={{ marginTop: 12 }}>Loading your goals…</p>
              ) : visibleGoals.length > 0 ? (
                <ul className="goalCardsList">
                  {visibleGoals.map((goal) => (
                    <li key={goal.id}>
                      <GoalCard
                        goal={goal}
                        actionPlans={visibleActionPlans.filter(
                          (plan) => String(plan.goalId) === String(goal.id)
                        )}
                        todayISO={todayISO}
                        onToggleActionPlanCompletion={handleToggleActionPlanCompletion}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-emptyText" style={{ marginTop: 12 }}>
                  No goals are visible yet. Create one in the Habit Wizard or from the parent dashboard.
                </p>
              )}
            </section>
          </main>

          <aside className="homeSide">
            <section className="dashboard-card">
              {/* weekly habit overview strip linking into the calendar page */}
              <WeekStrip assigneeId={user?.id} refreshKey={weekRefreshKey} onExpandClick={() => navigate('/calendar')} />
            </section>

            <section className="dashboard-card">
              <h2 className="sectionTitle">Overview</h2>
              <div className="statsGrid" style={{ marginTop: 12 }}>
                <div className="statCard">
                  <div className="statLabel">Visible goals</div>
                  <div className="statValue">{visibleGoals.length}</div>
                  <div className="statSub">Goals you own or created</div>
                </div>

                <div className="statCard">
                  <div className="statLabel">Plans due today</div>
                  <div className="statValue">{todaysPlans.length}</div>
                  <div className="statSub">Scheduled for {todayISO}</div>
                </div>

                <div className="statCard">
                  <div className="statLabel">Active streaks</div>
                  <div className="statValue">{activeStreakCount}</div>
                  <div className="statSub">Plans with a current streak above zero</div>
                </div>

                <div className="statCard">
                  <div className="statLabel">Coins</div>
                  <div className="statValue">{coins}</div>
                  <div className="statSub">New habit-system balance</div>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="sectionTitle">Breakdown</h2>
              <div className="infoList">
                <div className="infoRow">
                  <span className="infoLabel">Assigned to you</span>
                  <span className="infoValue">{assignedToMeCount}</span>
                </div>
                <div className="infoRow">
                  <span className="infoLabel">Created for others</span>
                  <span className="infoValue">{managedForOthersCount}</span>
                </div>
                <div className="infoRow">
                  <span className="infoLabel">Visible action plans</span>
                  <span className="infoValue">{visibleActionPlans.length}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
