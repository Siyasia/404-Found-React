// Reusable scheduling helpers for task recurrence in local time.
export const REPEAT = {
  DAILY: 'DAILY',
  WEEKDAYS: 'WEEKDAYS',
  WEEKENDS: 'WEEKENDS',
  CUSTOM_DOW: 'CUSTOM_DOW',
  INTERVAL_DAYS: 'INTERVAL_DAYS'
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(num) {
  return num.toString().padStart(2, '0')
}

// Format a Date into YYYY-MM-DD using local calendar values (no UTC shift).
export function toLocalISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

function toLocalDate(dateInput) {
  if (typeof dateInput === 'string') {
    // Construct at local midnight to avoid timezone shifts.
    return new Date(`${dateInput}T00:00:00`)
  }
  return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate())
}

function addDays(dateInput, days) {
  const d = toLocalDate(dateInput)
  d.setDate(d.getDate() + days)
  return d
}

// Inclusive date range check against start/end.
export function isWithinRange(schedule, dateISO) {
  if (!schedule || !schedule.startDate) return false
  if (dateISO < schedule.startDate) return false
  if (schedule.endDate && dateISO > schedule.endDate) return false
  return true
}

export function isDueOnDate(schedule, dateISO) {
  if (!schedule) return false
  if (!isWithinRange(schedule, dateISO)) return false

  const date = toLocalDate(dateISO)
  const dow = date.getDay()

  switch (schedule.repeat) {
    case REPEAT.DAILY:
      return true
    case REPEAT.WEEKDAYS:
      return dow >= 1 && dow <= 5
    case REPEAT.WEEKENDS:
      return dow === 0 || dow === 6
    case REPEAT.CUSTOM_DOW: {
      const set = new Set(schedule.daysOfWeek || [])
      return set.has(dow)
    }
    case REPEAT.INTERVAL_DAYS: {
      const interval = Math.max(1, schedule.intervalDays || 1)
      const start = toLocalDate(schedule.startDate)
      const diffDays = Math.floor((date - start) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays % interval === 0
    }
    default:
      return false
  }
}

// Find the next date (including fromDateISO) that matches the schedule.
export function getNextDueDate(schedule, fromDateISO = toLocalISODate()) {
  if (!schedule) return null
  const start = toLocalDate(fromDateISO)

  for (let i = 0; i < 366; i++) {
    const candidate = addDays(start, i)
    const iso = toLocalISODate(candidate)
    if (schedule.endDate && iso > schedule.endDate) return null
    if (isDueOnDate(schedule, iso)) return iso
  }

  return null
}

export function formatScheduleLabel(schedule) {
  if (!schedule) return ''
  switch (schedule.repeat) {
    case REPEAT.DAILY:
      return 'Daily'
    case REPEAT.WEEKDAYS:
      return 'Weekdays'
    case REPEAT.WEEKENDS:
      return 'Weekends'
    case REPEAT.CUSTOM_DOW: {
      const days = (schedule.daysOfWeek || [])
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAY_NAMES[d])
      return days.length ? days.join('/') : 'Custom days'
    }
    case REPEAT.INTERVAL_DAYS: {
      const interval = Math.max(1, schedule.intervalDays || 1)
      return interval === 1 ? 'Daily' : `Every ${interval} days`
    }
    default:
      return ''
  }
}

export default {
  REPEAT,
  toLocalISODate,
  isWithinRange,
  isDueOnDate,
  getNextDueDate,
  formatScheduleLabel
}
