import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HabitCalendar from '../components/HabitCalendar.jsx'
import Toast from '../components/Toast.jsx'
import { useUser } from '../UserContext.jsx'
import { ROLE } from '../Roles/roles.js'
import { goalList } from '../lib/api/goals.js'
import { childList } from '../lib/api/children.js'

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: '999px',
        padding: '6px 12px',
        border: active ? '2px solid rgba(79,70,229,.65)' : '1px solid rgba(148,163,184,.8)',
        background: active ? 'rgba(79,70,229,.08)' : 'rgba(255,255,255,.85)',
        color: '#0f172a',
        fontWeight: 700,
        fontSize: '0.9rem',
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {label}
    </button>
  )
}

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
          user?.role === ROLE.PARENT ? childList() : Promise.resolve({ status_code: 200, children: [] }),
        ])

        if (!cancelled) {
          if (goalResp?.status_code === 200) {
            setGoals(Array.isArray(goalResp.data) ? goalResp.data : [])
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
    return () => {
      cancelled = true
    }
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
    <section className="container" style={{ padding: '1.5rem 1rem', maxWidth: '1100px' }}>
      <Toast message={rewardMessage} type="success" onClose={() => setRewardMessage('')} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Calendar</h1>
          <p className="sub" style={{ margin: '4px 0 0' }}>
            View and update your new habit plans across the month.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => navigate(-1)} style={{ padding: '8px 12px' }}>
          ← Back
        </button>
      </div>

      {showChildSelector && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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

      <div style={{ marginTop: '16px' }}>
        {loading ? (
          <div className="card" style={{ padding: '18px' }}>Loading calendar…</div>
        ) : error ? (
          <div className="card" style={{ padding: '18px', color: '#991b1b' }}>{error}</div>
        ) : (
          <HabitCalendar
            assigneeId={viewerChildId}
            getMilestoneRewards={getMilestoneRewards}
            onRewardMessage={setRewardMessage}
            emptyStateLinkTo={emptyLink}
            emptyStateLabel={user?.role === ROLE.PARENT ? 'Assign a goal' : 'Create a goal'}
          />
        )}
      </div>
    </section>
  )
}
