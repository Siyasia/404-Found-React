import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HabitCalendar from '../components/HabitCalendar.jsx'
import Toast from '../components/Toast.jsx'
import { useUser } from '../UserContext.jsx'
import { ROLE } from '../Roles/roles.js'
import { goalList } from '../lib/api/goals.js'
import { childList } from '../lib/api/children.js'
import './CalendarPage.css'

/* ── Chip — pill selector for child filtering ── */
function Chip({ label, active, onClick }) {
  const isAll = label === 'All'
  const initials = !isAll
    ? label.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`calendar-page__chip${active ? ' calendar-page__chip--active' : ''}`}
    >
      {!isAll && (
        <span className="calendar-page__chip-avatar" aria-hidden="true">
          {initials}
        </span>
      )}
      {label}
    </button>
  )
}

/* ── Page ── */
export default function CalendarPage() {
  const { user } = useUser()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [goals, setGoals] = useState([])
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [rewardMessage, setRewardMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [goalResp, childResp] = await Promise.all([
          goalList(),
          user?.role === ROLE.PARENT
            ? childList()
            : Promise.resolve({ status_code: 200, children: [] }),
        ])

        if (!cancelled) {
          if (goalResp?.status_code === 200) {
            setGoals(Array.isArray(goalResp.goals) ? goalResp.goals : [])
          } else {
            setGoals([])
            setError('Could not load goals for the calendar.')
          }
          if (childResp?.status_code === 200 && Array.isArray(childResp.children)) {
            setChildren(childResp.children)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setGoals([])
          setError(err?.message || 'Failed to load calendar data.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  const viewerChildId = useMemo(() => {
    if (!user) return null
    if (user.role === ROLE.CHILD) return user.id
    if (user.role === ROLE.PARENT) return selectedChildId
    return user.id
  }, [selectedChildId, user])

  const showChildSelector = user?.role === ROLE.PARENT && children.length > 0

  const getMilestoneRewards = (plan) => {
    const goal = (goals || []).find((g) => String(g.id) === String(plan?.goalId))
    return Array.isArray(goal?.milestoneRewards) ? goal.milestoneRewards : []
  }

  const emptyLink = user?.role === ROLE.PARENT ? '/parent/dashboard?tab=assign' : '/habit-wizard'

  return (
    <section className="calendar-page">
      <Toast message={rewardMessage} type="success" onClose={() => setRewardMessage('')} />

      {/* ── Header ── */}
      <div className="calendar-page__header">
        <div className="calendar-page__title-block">
          <span className="calendar-page__eyebrow">
            <span className="calendar-page__eyebrow-dot" aria-hidden="true" />
            Habit Tracker
          </span>
          <h1 className="calendar-page__title">Calendar</h1>
          <p className="calendar-page__subtitle">
            View and update your habit plans across the month.
          </p>
        </div>

        <button
          type="button"
          className="calendar-page__back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <span className="calendar-page__back-arrow">←</span>
          Back
        </button>
      </div>

      <div className="calendar-page__divider" />

      {/* ── Child selector ── */}
      {showChildSelector && (
        <div className="calendar-page__child-selector" role="group" aria-label="Filter by child">
          <Chip label="All" active={!viewerChildId} onClick={() => setSelectedChildId(null)} />
          {children.map((child) => (
            <Chip
              key={child.id}
              label={child.name || 'Child'}
              active={String(viewerChildId) === String(child.id)}
              onClick={() => setSelectedChildId(child.id)}
            />
          ))}
        </div>
      )}

      {/* ── Calendar body ── */}
      <div className="calendar-page__body">
        {loading ? (
          <div className="calendar-page__state-card calendar-page__state-card--loading">
            <span className="calendar-page__spinner" aria-hidden="true" />
            Loading calendar…
          </div>
        ) : error ? (
          <div
            className="calendar-page__state-card calendar-page__state-card--error"
            role="alert"
          >
            <span className="calendar-page__error-icon">⚠️</span>
            {error}
          </div>
        ) : (
          <div className="calendar-page__calendar-wrapper">
            <HabitCalendar
              assigneeId={viewerChildId}
              getMilestoneRewards={getMilestoneRewards}
              onRewardMessage={setRewardMessage}
              emptyStateLinkTo={emptyLink}
              emptyStateLabel={user?.role === ROLE.PARENT ? 'Assign a goal' : 'Create a goal'}
            />
          </div>
        )}
      </div>
    </section>
  )
}
