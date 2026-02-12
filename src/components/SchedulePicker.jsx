import React from 'react'
import { REPEAT, toLocalISODate } from '../lib/schedule.js'
import { REPEAT, toLocalISODate, DAY_LABELS } from '../lib/schedule.js';

export default function SchedulePicker({ value, onChange }) {
  const schedule = value || {
    repeat: REPEAT.DAILY,
    daysOfWeek: [],
    intervalDays: 1,
    startDate: toLocalISODate(),
    endDate: ''
  }

  const noEndDate = !schedule.endDate

  const update = (partial) => {
    onChange({ ...schedule, ...partial })
  }

  const toggleDay = (day) => {
    const set = new Set(schedule.daysOfWeek || [])
    set.has(day) ? set.delete(day) : set.add(day);
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
    <div className="schedule-picker">
      <label className="schedule-field">
        <span>Repeat</span>
        <select
          value={schedule.repeat}
          onChange={(e) => update({ repeat: e.target.value })}
          className="schedule-control"
        >
          {repeatOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {showDays && (
        <div className="schedule-field">
          <span>Days of week</span>
          <div className="schedule-days">
            {DAY_LABELS.map((day) => {
              const active = (schedule.daysOfWeek || []).includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`schedule-day ${active ? 'active' : ''}`}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showInterval && (
        <label className="schedule-field schedule-interval">
          <span>Interval (days)</span>
          <input
            type="number"
            min="1"
            value={schedule.intervalDays || 1}
            onChange={(e) => update({ intervalDays: Math.max(1, Number(e.target.value) || 1) })}
            className="schedule-control"
          />
        </label>
      )}

      <div className="scheduleGrid">
        <label className="schedule-field">
          <span>Start date</span>
          <input
            type="date"
            value={schedule.startDate || toLocalISODate()}
            onChange={(e) => update({ startDate: e.target.value })}
            className="schedule-control"
          />
        </label>

        <div className="schedule-field">
          <label className="schedule-checkbox">
            <input
              type="checkbox"
              checked={noEndDate}
              onChange={(e) => update({ endDate: e.target.checked ? '' : schedule.startDate })}
            />
            <span>No end date</span>
          </label>
          {!noEndDate && (
            <input
              type="date"
              value={schedule.endDate || ''}
              onChange={(e) => update({ endDate: e.target.value })}
              className="schedule-control"
            />
          )}
        </div>
      </div>
    </div>
  )
}
