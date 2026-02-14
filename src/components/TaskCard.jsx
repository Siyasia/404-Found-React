import React from 'react'
import { toLocalISODate, computeCurrentStreak, computeBestStreak, formatRepeatBadge, formatScheduleSummary, formatNextDueLabel } from '../lib/schedule.js'

export default function TaskCard({ task, children }) {
  const todayISO = React.useMemo(() => toLocalISODate(), [])
  const currentStreak = React.useMemo(
    () => (task?.schedule ? computeCurrentStreak(task, todayISO) : 0),
    [task, todayISO]
  )
  const bestStreak = React.useMemo(
    () => (task?.schedule ? computeBestStreak(task) || currentStreak : 0),
    [task, currentStreak]
  )

  const schedule = task?.schedule
  const ended = schedule && schedule.endDate && todayISO > schedule.endDate

  return (
    <div className="card" style={{ padding: '0.85rem 1rem', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: schedule ? '.15rem' : 0 }}>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
              {task?.title || 'Untitled task'}
            </div>
            {schedule && formatRepeatBadge(task.schedule) && (
              <span
                style={{
                  fontSize: '.72rem',
                  padding: '.1rem .45rem',
                  borderRadius: '999px',
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #e0e7ff'
                }}
              >
                {formatRepeatBadge(task.schedule)}
              </span>
            )}
          </div>
          {schedule && (
            <div style={{ display: 'grid', gap: '0.15rem', color: '#4b5563', marginBottom: '.25rem' }}>
              <div style={{ fontSize: '.85rem' }}>🔁 {formatScheduleSummary(schedule, todayISO)}</div>
              {!ended && (
                <div style={{ fontSize: '.78rem', color: '#6b7280' }}>
                  {formatNextDueLabel(schedule, todayISO)}
                </div>
              )}
              {ended && (
                <div style={{ fontSize: '.78rem', color: '#9ca3af' }}>
                  {`Ended${schedule.endDate ? ' ' + new Date(`${schedule.endDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`}
                </div>
              )}
            </div>
          )}
        </div>
        {children}
      </div>
      {task.schedule && (
        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem', fontSize: '.8rem', color: '#6b7280' }}>
          <span>🔥 Streak: {currentStreak || 0}</span>
          <span>🏆 Best: {bestStreak || 0}</span>
        </div>
      )}
    </div>
  )
}
