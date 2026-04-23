import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { getCalendarMonth, getCalendarDay } from '../lib/api/calendar.js'
import { markComplete, markIncomplete } from '../lib/api/streaks.js'
import { toLocalISODate } from '../lib/schedule.js'

function pad(num) {
  return String(num).padStart(2, '0')
}

function toISO(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function filterEntries(entries = [], assigneeId) {
  if (!assigneeId) return entries
  return entries.filter((entry) => String(entry?.actionPlan?.assigneeId) === String(assigneeId))
}

export default function HabitCalendar({
  assigneeId,
  onRewardMessage,
  emptyStateLinkTo = '/habit-wizard',
  emptyStateLabel = 'Add a habit',
}) {
  const todayISO = useMemo(() => toLocalISODate(), [])
  const today = useMemo(() => new Date(), [])

  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)
  const [calendarData, setCalendarData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDayEntries, setSelectedDayEntries] = useState([])
  const [dayDetailLoading, setDayDetailLoading] = useState(false)

  const daysInMonth = useMemo(() => new Date(currentYear, currentMonth, 0).getDate(), [currentYear, currentMonth])
  const firstDayOfWeek = useMemo(() => new Date(currentYear, currentMonth - 1, 1).getDay(), [currentYear, currentMonth])
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(currentYear, currentMonth - 1, 1)),
    [currentYear, currentMonth]
  )

  const hasAnyEntries = useMemo(
    () => Object.values(calendarData).some((entries) => filterEntries(entries, assigneeId).length > 0),
    [calendarData, assigneeId]
  )

  const fetchMonth = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getCalendarMonth(currentYear, currentMonth, assigneeId)
      if (res?.status_code === 200) setCalendarData(res.data || {})
      else setError(res?.error || 'Failed to load calendar')
    } catch (err) {
      setError(err?.message || 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [currentYear, currentMonth, assigneeId])

  useEffect(() => {
    fetchMonth()
  }, [fetchMonth])

  const handlePrevMonth = () => {
    setSelectedDate(null)
    setSelectedDayEntries([])
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    setSelectedDate(null)
    setSelectedDayEntries([])
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const handleDayClick = async (dateISO) => {
    setSelectedDate(dateISO)
    setDayDetailLoading(true)
    try {
      const res = await getCalendarDay(dateISO, assigneeId)
      if (res?.status_code === 200 && res.data) setSelectedDayEntries(res.data.entries || [])
      else setSelectedDayEntries([])
    } finally {
      setDayDetailLoading(false)
    }
  }

  const handleToggleComplete = async (actionPlanId, dateISO) => {
    const dayEntries = Array.isArray(calendarData[dateISO]) ? calendarData[dateISO] : []
    const entry = (selectedDayEntries || []).find((e) => String(e?.actionPlan?.id) === String(actionPlanId))
      || dayEntries.find((e) => String(e?.actionPlan?.id) === String(actionPlanId))
    const plan = entry?.actionPlan
    if (!plan) return

    const alreadyDone = plan?.completedDates?.[dateISO] === true
    const res = alreadyDone
      ? await markIncomplete(plan.id, dateISO)
      : await markComplete(plan.id, dateISO)

    if (!res || res.status_code !== 200) return

    const data = res.data || {}
    const updatedPlan = data.plan || plan
    const streak = data.current ?? data.currentStreak ?? updatedPlan.currentStreak ?? 0
    const completed = Boolean(updatedPlan?.completedDates?.[dateISO])

    if (Array.isArray(data.newBadges) && data.newBadges.length && typeof onRewardMessage === 'function') {
      onRewardMessage(`New badge${data.newBadges.length === 1 ? '' : 's'} earned: ${data.newBadges.join(', ')}`)
    }

    const coinDelta =
      Number(data?.coinsEarned || 0) +
      Number(data?.badgeCoinsEarned || 0)

    if (!alreadyDone && coinDelta > 0 && typeof onRewardMessage === 'function') {
      onRewardMessage(`Updated ${plan?.title || 'habit plan'} • earned ${coinDelta} coins`)
    }

    setCalendarData((prev) => {
      const next = { ...prev }
      const items = Array.isArray(next[dateISO]) ? [...next[dateISO]] : []
      next[dateISO] = items.map((e) =>
        String(e?.actionPlan?.id) === String(actionPlanId)
          ? { ...e, completed, streak, actionPlan: { ...e.actionPlan, ...updatedPlan } }
          : e
      )
      return next
    })

    setSelectedDayEntries((prev) =>
      (prev || []).map((e) =>
        String(e?.actionPlan?.id) === String(actionPlanId)
          ? { ...e, completed, streak, actionPlan: { ...e.actionPlan, ...updatedPlan } }
          : e
      )
    )
  }

  const renderDots = (entries = []) => {
    const filtered = filterEntries(entries, assigneeId)
    if (filtered.length === 0) return null

    const limited = filtered.slice(0, 4)
    const overflow = filtered.length - limited.length

    return (
      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
        {limited.map((entry) => (
          <span
            key={entry.actionPlan.id}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: entry.completed ? 'var(--app-success)' : 'var(--app-progress-track)',
              display: 'inline-block',
            }}
          />
        ))}
        {overflow > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)', fontWeight: 700 }}>+{overflow}</span>}
      </div>
    )
  }

  const dayCells = useMemo(() => {
    const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`b-${i}`} />)
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateISO = toISO(currentYear, currentMonth, day)
      const entries = calendarData[dateISO] || []
      const filtered = filterEntries(entries, assigneeId)
      const isToday = dateISO === todayISO
      const isSelected = selectedDate === dateISO

      return (
        <button
          type="button"
          key={dateISO}
          onClick={() => handleDayClick(dateISO)}
          style={{
            textAlign: 'left',
            border: isSelected
              ? '2px solid var(--app-primary)'
              : isToday
                ? '2px solid var(--app-success)'
                : '1px solid var(--app-border)',
            borderRadius: '10px',
            padding: '8px',
            background: 'var(--app-card)',
            color: 'var(--app-text)',
            cursor: 'pointer',
            minHeight: '82px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--app-heading)' }}>{day}</div>
          {renderDots(filtered)}
        </button>
      )
    })

    return [...blanks, ...days]
  }, [assigneeId, calendarData, currentMonth, currentYear, daysInMonth, firstDayOfWeek, selectedDate, todayISO])

  const skeletonCells = useMemo(
    () => Array.from({ length: 35 }, (_, idx) => (
      <div
        key={`s-${idx}`}
        style={{
          background: 'linear-gradient(90deg, var(--app-card-soft), var(--app-secondary-bg), var(--app-card-soft))',
          borderRadius: '10px',
          height: '82px',
          animation: 'pulse 1.2s ease-in-out infinite',
        }}
      />
    )),
    []
  )

  const filteredSelectedEntries = useMemo(
    () => filterEntries(selectedDayEntries, assigneeId),
    [selectedDayEntries, assigneeId]
  )

  return (
    <div className="card" style={{ padding: '12px', border: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-card) 65%, transparent)', minHeight: '720px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <button type="button" onClick={handlePrevMonth} aria-label="Previous month" className="btn btn-ghost" style={{ padding: '6px 10px' }}>
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{monthLabel}</div>
        <button type="button" onClick={handleNextMonth} aria-label="Next month" className="btn btn-ghost" style={{ padding: '6px 10px' }}>
          →
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--app-danger-bg)', border: '1px solid var(--app-danger-border)', color: 'var(--app-danger-text)', padding: '10px', borderRadius: '10px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Could not load calendar</div>
          <div style={{ marginBottom: 8 }}>{error}</div>
          <button type="button" className="btn" onClick={fetchMonth} style={{ padding: '8px 12px' }}>
            Retry
          </button>
        </div>
      )}

      {!error && !loading && !hasAnyEntries && (
        <div style={{ border: '1px dashed var(--app-border-strong)', borderRadius: '12px', padding: '18px', textAlign: 'center', color: 'var(--app-text-muted)' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>No habits scheduled this month</div>
          <div style={{ marginBottom: 10 }}>Add a habit to see it on the calendar.</div>
          <a href={emptyStateLinkTo} className="btn" style={{ padding: '8px 12px', display: 'inline-block' }}>
            {emptyStateLabel}
          </a>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', color: 'var(--app-text-muted)', fontWeight: 700, fontSize: '.9rem' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ textAlign: 'center' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', flex: '1 1 auto', overflowY: 'auto', paddingRight: '4px' }}>
        {loading ? skeletonCells : dayCells}
      </div>

      <div style={{ borderTop: '1px solid var(--app-border)', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ fontWeight: 800 }}>{selectedDate || 'Day details'}</div>
          {dayDetailLoading && <span style={{ fontSize: '.85rem', color: 'var(--app-text-muted)' }}>Loading…</span>}
        </div>

        {!selectedDate && <div style={{ color: 'var(--app-text-muted)' }}>Select any day to see plan details.</div>}
        {selectedDate && filteredSelectedEntries.length === 0 && !dayDetailLoading && (
          <div style={{ color: 'var(--app-text-muted)' }}>No habits due for this day.</div>
        )}

        {filteredSelectedEntries.map((entry) => (
          <div
            key={entry.actionPlan.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '8px',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid var(--app-border)',
            }}
          >
            <div>
              <div style={{ fontWeight: 800 }}>{entry.actionPlan.title || 'Habit plan'}</div>
              <div style={{ color: 'var(--app-text-muted)', fontSize: '.9rem' }}>
                {entry.actionPlan.assigneeName || 'Assignee'} • Streak {entry.streak}
              </div>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => handleToggleComplete(entry.actionPlan.id, selectedDate)}
              style={{ padding: '8px 10px' }}
            >
              {entry.completed ? 'Mark not done' : 'Mark done'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
