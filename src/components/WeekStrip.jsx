import React, { useEffect, useMemo, useState } from 'react'
import { getCalendarWeek } from '../lib/api/calendar.js'

function pad(num) {
  return String(num).padStart(2, '0')
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toLocalISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfWeekSunday(date = new Date()) {
  const d = new Date(date)
  const diff = d.getDay()
  d.setDate(d.getDate() - diff)
  return toISO(d)
}

function filterEntries(entries = [], assigneeId) {
  if (!assigneeId) return entries
  return entries.filter((entry) => String(entry?.actionPlan?.assigneeId) === String(assigneeId))
}

export default function WeekStrip({ assigneeId, onExpandClick, hideDefaultHeader = false, refreshKey = 0 }) {
  const todayISO = useMemo(() => toLocalISO(new Date()), [])
  const [weekData, setWeekData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeDate, setActiveDate] = useState(null)

  const startISO = useMemo(() => startOfWeekSunday(new Date()), [])
  const weekDates = useMemo(() => {
    const start = new Date(`${startISO}T00:00:00`)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return toISO(d)
    })
  }, [startISO])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')

    getCalendarWeek(startISO, assigneeId)
      .then((res) => {
        if (!mounted) return
        if (res?.status_code === 200) setWeekData(res.data || {})
        else setError(res?.error || 'Could not load week overview.')
      })
      .catch((err) => {
        if (mounted) setError(err?.message || 'Could not load week overview.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [assigneeId, refreshKey, startISO])

  const renderIndicator = (entries = []) => {
    const filtered = filterEntries(entries, assigneeId)
    if (filtered.length === 0) return null

    const incomplete = filtered.filter((entry) => !entry.completed).length
    const done = incomplete === 0

    if (done) {
      return (
        <span
          aria-label="All done"
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#16a34a',
            color: 'white',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
          }}
        >
          ✓
        </span>
      )
    }

    return (
      <span
        aria-label="Incomplete habits"
        style={{
          minWidth: 18,
          height: 18,
          borderRadius: '50%',
          background: '#e2e8f0',
          color: '#0f172a',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          padding: '0 4px',
        }}
      >
        {incomplete}
      </span>
    )
  }

  const activeEntries = useMemo(
    () => filterEntries(weekData[activeDate] || [], assigneeId),
    [activeDate, assigneeId, weekData]
  )

  return (
    <div style={{ marginBottom: '12px' }}>
      {typeof onExpandClick === 'function' && !hideDefaultHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>This week</div>
          <button
            type="button"
            onClick={onExpandClick}
            style={{
              border: '1px solid rgba(226,232,240,.9)',
              background: 'white',
              borderRadius: '8px',
              padding: '6px 10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Open calendar →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {weekDates.map((iso) => {
          const dateObj = new Date(`${iso}T00:00:00`)
          const label = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
          const isToday = iso === todayISO
          const entries = weekData[iso] || []
          const filtered = filterEntries(entries, assigneeId)

          return (
            <button
              type="button"
              key={iso}
              onClick={() => setActiveDate(iso)}
              disabled={loading}
              style={{
                flex: '1 1 0',
                minWidth: '90px',
                borderRadius: '12px',
                border: isToday ? '2px solid #4f46e5' : '1px solid rgba(226,232,240,.9)',
                background: 'white',
                padding: '10px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ fontSize: '.85rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 6 }}>{dateObj.getDate()}</div>
              {renderIndicator(filtered)}
            </button>
          )
        })}
      </div>

      {error && <div style={{ color: '#b91c1c', fontSize: '.9rem', marginTop: 6 }}>{error}</div>}
      {loading && <div style={{ color: '#64748b', fontSize: '.9rem', marginTop: 6 }}>Loading week…</div>}

      {activeDate && activeEntries.length > 0 && (
        <div style={{ marginTop: '8px', padding: '10px', border: '1px solid rgba(226,232,240,.9)', borderRadius: '12px', background: 'rgba(248,250,252,.8)' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Due on {activeDate}</div>
          <ul style={{ listStyle: 'disc', paddingLeft: '18px', margin: 0 }}>
            {activeEntries.map((entry) => (
              <li key={entry.actionPlan.id} style={{ marginBottom: 4 }}>
                {entry.actionPlan.title || entry.actionPlan.name || 'Habit'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeDate && !loading && activeEntries.length === 0 && (
        <div style={{ marginTop: '8px', padding: '10px', border: '1px solid rgba(226,232,240,.9)', borderRadius: '12px', background: 'rgba(248,250,252,.8)', color: '#64748b' }}>
          No habits scheduled for {activeDate}.
        </div>
      )}
    </div>
  )
}
