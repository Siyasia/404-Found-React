import React from 'react'
import { REPEAT, toLocalISODate } from '../lib/schedule.js'

const DAY_LABELS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
]

export default function SchedulePicker({ value, onChange }) {
  const schedule = value || {
    repeat: REPEAT.DAILY,
    daysOfWeek: [],
    intervalDays: 1,
    startDate: toLocalISODate(),
    endDate: ''
  }

  const update = (partial) => {
    onChange({ ...schedule, ...partial })
  }

  const toggleDay = (day) => {
    const set = new Set(schedule.daysOfWeek || [])
    if (set.has(day)) {
      set.delete(day)
    } else {
      set.add(day)
    }
    update({ daysOfWeek: Array.from(set).sort((a, b) => a - b) })
  }

  const repeatOptions = [
    { value: REPEAT.DAILY, label: 'Daily' },
    { value: REPEAT.WEEKDAYS, label: 'Weekdays (Mon-Fri)' },
    { value: REPEAT.WEEKENDS, label: 'Weekends (Sat-Sun)' },
    { value: REPEAT.CUSTOM_DOW, label: 'Custom days' },
    { value: REPEAT.INTERVAL_DAYS, label: 'Every N days' }
  ]

  const showDays = schedule.repeat === REPEAT.CUSTOM_DOW
  const showInterval = schedule.repeat === REPEAT.INTERVAL_DAYS

  return (
    <div className="schedule-picker" style={{ display: 'grid', gap: '0.5rem' }}>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span>Repeat</span>
        <select
          value={schedule.repeat}
          onChange={(e) => update({ repeat: e.target.value })}
        >
          {repeatOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {showDays && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Days of week</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {DAY_LABELS.map((day) => {
              const active = (schedule.daysOfWeek || []).includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '999px',
                    border: '1px solid #ccc',
                    background: active ? '#2563eb' : '#fff',
                    color: active ? '#fff' : '#000',
                    cursor: 'pointer'
                  }}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showInterval && (
        <label style={{ display: 'grid', gap: '0.25rem', maxWidth: '160px' }}>
          <span>Interval (days)</span>
          <input
            type="number"
            min="1"
            value={schedule.intervalDays || 1}
            onChange={(e) => update({ intervalDays: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      )}

      <label style={{ display: 'grid', gap: '0.25rem', maxWidth: '220px' }}>
        <span>Start date</span>
        <input
          type="date"
          value={schedule.startDate || toLocalISODate()}
          onChange={(e) => update({ startDate: e.target.value })}
        />
      </label>

      <div style={{ display: 'grid', gap: '0.25rem', maxWidth: '220px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={!schedule.endDate}
            onChange={(e) => update({ endDate: e.target.checked ? '' : schedule.startDate })}
          />
          <span>No end date</span>
        </label>
        <input
          type="date"
          value={schedule.endDate || ''}
          disabled={!schedule.endDate}
          onChange={(e) => update({ endDate: e.target.value })}
        />
      </div>
    </div>
  )
}
