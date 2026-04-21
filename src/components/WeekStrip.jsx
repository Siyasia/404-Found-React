import React, { useEffect, useMemo, useState } from 'react'
import { getCalendarWeek } from '../lib/api/calendar.js'

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
.weekStrip { margin-bottom: 12px; }
.weekStrip--home { margin-bottom: 0; }

.weekStrip__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.weekStrip__headerTitle { font-weight: 800; color: var(--app-heading); }
.weekStrip__expandBtn { border: 1px solid var(--app-border); background: var(--app-card); color: var(--app-text); border-radius: 8px; padding: 6px 10px; font-weight: 700; cursor: pointer; }

.weekStrip__strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.weekStrip--home .weekStrip__strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; overflow-x: unset; padding-bottom: 0; }

.weekStrip__day { flex: 1 1 0; min-width: 90px; border-radius: 12px; border: 1px solid var(--app-border); background: var(--app-card); color: var(--app-text); padding: 10px 12px; text-align: left; cursor: pointer; box-shadow: var(--app-shadow-soft); }
.weekStrip--home .weekStrip__day { min-width: 0; width: 100%; padding: 8px 6px; text-align: center; box-shadow: none; }
.weekStrip__day.is-today { border: 2px solid var(--app-success); background: var(--app-build-bg); }
.weekStrip__day.is-active { background: var(--app-card-soft); }
.weekStrip__day:focus-visible { outline: 2px solid var(--app-primary); outline-offset: 2px; }

.weekStrip__dayLabel { display: block; font-size: .85rem; font-weight: 500; color: var(--app-text-muted); margin-bottom: 4px; }
.weekStrip--home .weekStrip__dayLabel { text-align: center; margin-bottom: 6px; }
.weekStrip__day.is-today .weekStrip__dayLabel { color: var(--app-success); font-weight: 700; }

.weekStrip__dayNum { display: block; font-weight: 800; font-size: 1.1rem; margin-bottom: 6px; }

.weekStrip__ringWrap { display: grid; place-items: center; margin-bottom: 6px; }
.weekStrip__ring { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; }
.weekStrip__ringInner { width: 40px; height: 40px; border-radius: 50%; background: var(--app-card); display: grid; place-items: center; font-weight: 800; font-size: 1.05rem; color: var(--app-text); }
.weekStrip__dayIndicatorRow { display: flex; justify-content: center; }

.weekStrip__indicator { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; font-size: .8rem; }
.weekStrip__indicator--empty { background: var(--app-card-soft); border: 1px solid var(--app-border); }
.weekStrip__indicator--done { background: var(--app-success); color: var(--app-success-text); }
.weekStrip__indicator--pending { min-width: 18px; width: auto; background: var(--app-secondary-bg); color: var(--app-secondary-text); padding: 0 4px; }

.weekStrip__error { margin: 6px 0 0; color: var(--app-danger-text); font-size: .9rem; }
.weekStrip__loading { margin: 6px 0 0; color: var(--app-text-muted); font-size: .9rem; }

.weekStrip__detail { margin-top: 8px; padding: 10px; border: 1px solid var(--app-border); border-radius: 12px; background: var(--app-card-soft); color: var(--app-text); }
.weekStrip__detail--empty { color: var(--app-text-muted); }
.weekStrip__detailTitle { font-weight: 800; margin-bottom: 6px; }
.weekStrip__detailList { list-style: disc; padding-left: 18px; margin: 0; }
.weekStrip__detailList li { margin-bottom: 4px; }
`

let stylesInjected = false
function injectStyles() {
  if (stylesInjected) return
  const tag = document.createElement('style')
  tag.textContent = STYLES
  document.head.appendChild(tag)
  stylesInjected = true
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function pad(n) {
  return String(n).padStart(2, '0')
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfWeek(date = new Date(), startsOn = 'sunday') {
  const d = new Date(date)
  const day = d.getDay()
  const diff = startsOn === 'monday' ? (day === 0 ? -6 : 1 - day) : -day
  d.setDate(d.getDate() + diff)
  return toISO(d)
}

function buildWeekDates(startISO) {
  const start = new Date(`${startISO}T00:00:00`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toISO(d)
  })
}

// ─── Entry helpers ────────────────────────────────────────────────────────────

function filterEntries(entries = [], assigneeId) {
  if (!assigneeId) return entries
  return entries.filter(
    (e) => String(e?.actionPlan?.assigneeId) === String(assigneeId)
  )
}

function getStats(entries = [], assigneeId) {
  const filtered = filterEntries(entries, assigneeId)
  const total = filtered.length
  const complete = filtered.filter((e) => e.completed).length
  return {
    filtered,
    total,
    complete,
    incomplete: Math.max(0, total - complete),
    progress: total ? Math.round((complete / total) * 100) : 0,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Indicator({ filtered = [] }) {
  if (filtered.length === 0) {
    return <span className="weekStrip__indicator weekStrip__indicator--empty" aria-label="No habits" />
  }

  const incomplete = filtered.filter((e) => !e.completed).length

  if (incomplete === 0) {
    return (
      <span className="weekStrip__indicator weekStrip__indicator--done" aria-label="All done">
        ✓
      </span>
    )
  }

  return (
    <span className="weekStrip__indicator weekStrip__indicator--pending" aria-label="Incomplete habits">
      {incomplete}
    </span>
  )
}

function ProgressRing({ progress, date, total }) {
  return (
    <div className="weekStrip__ringWrap">
      <div
        className="weekStrip__ring"
        style={{
          background: total > 0
            ? `conic-gradient(var(--app-progress-fill) ${progress}%, var(--app-progress-track) 0)`
            : 'var(--app-progress-track)',
        }}
      >
        <div className="weekStrip__ringInner">{date}</div>
      </div>
    </div>
  )
}

function ActiveDetail({ activeDate, entries, loading }) {
  if (!activeDate) return null

  if (!loading && entries.length === 0) {
    return (
      <div className="weekStrip__detail weekStrip__detail--empty">
        No habits scheduled for {activeDate}.
      </div>
    )
  }

  if (entries.length > 0) {
    return (
      <div className="weekStrip__detail">
        <div className="weekStrip__detailTitle">Due on {activeDate}</div>
        <ul className="weekStrip__detailList">
          {entries.map((entry) => (
            <li key={entry.actionPlan.id}>
              {entry.actionPlan.title || entry.actionPlan.name || 'Habit'}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeekStrip({
  assigneeId,
  onExpandClick,
  hideDefaultHeader = false,
  refreshKey = 0,
  variant = 'default',
  showDetails = true,
  weekStartsOn = 'sunday',
}) {
  injectStyles()

  const todayISO = useMemo(() => toISO(new Date()), [])
  const isHome = variant === 'home'

  const [weekData, setWeekData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeDate, setActiveDate] = useState(null)

  const startISO = useMemo(() => startOfWeek(new Date(), weekStartsOn), [weekStartsOn])
  const weekDates = useMemo(() => buildWeekDates(startISO), [startISO])

  const activeEntries = useMemo(
    () => filterEntries(weekData[activeDate] || [], assigneeId),
    [activeDate, assigneeId, weekData]
  )

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

    return () => { mounted = false }
  }, [assigneeId, refreshKey, startISO])

  function toggleDate(iso) {
    setActiveDate((prev) => (prev === iso ? null : iso))
  }

  return (
    <div className={`weekStrip ${isHome ? 'weekStrip--home' : ''}`}>

      {typeof onExpandClick === 'function' && !hideDefaultHeader && (
        <div className="weekStrip__header">
          <span className="weekStrip__headerTitle">This week</span>
          <button type="button" className="weekStrip__expandBtn" onClick={onExpandClick}>
            Open calendar →
          </button>
        </div>
      )}

      <div className="weekStrip__strip">
        {weekDates.map((iso) => {
          const dateObj = new Date(`${iso}T00:00:00`)
          const label = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
          const isToday = iso === todayISO
          const isActive = activeDate === iso
          const stats = getStats(weekData[iso] || [], assigneeId)

          return (
            <button
              type="button"
              key={iso}
              className={[
                'weekStrip__day',
                isToday && 'is-today',
                isActive && !isHome && 'is-active',
              ].filter(Boolean).join(' ')}
              onClick={() => toggleDate(iso)}
              disabled={loading}
            >
              <span className="weekStrip__dayLabel">{label}</span>

              {isHome ? (
                <>
                  <ProgressRing
                    progress={stats.progress}
                    date={dateObj.getDate()}
                    total={stats.total}
                  />
                  <div className="weekStrip__dayIndicatorRow">
                    <Indicator filtered={stats.filtered} />
                  </div>
                </>
              ) : (
                <>
                  <span className="weekStrip__dayNum">{dateObj.getDate()}</span>
                  <Indicator filtered={stats.filtered} />
                </>
              )}
            </button>
          )
        })}
      </div>

      {error && <p className="weekStrip__error">{error}</p>}
      {loading && <p className="weekStrip__loading">Loading week…</p>}

      {showDetails && (
        <ActiveDetail
          activeDate={activeDate}
          entries={activeEntries}
          loading={loading}
        />
      )}
    </div>
  )
}
