// Reusable scheduling helpers for task recurrence in local time.
export const REPEAT = {
  DAILY: 'DAILY',
  WEEKDAYS: 'WEEKDAYS',
  WEEKENDS: 'WEEKENDS',
  CUSTOM_DOW: 'CUSTOM_DOW',
  INTERVAL_DAYS: 'INTERVAL_DAYS'
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_LABELS = DAY_NAMES.map((label, value) => ({ value, label }))

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

function isoToLocalDate(iso) {
  return new Date(`${iso}T00:00:00`)
}

function formatMonthDay(iso) {
  if (!iso) return ''
  return isoToLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Inclusive date range check against start/end.
export function isWithinRange(schedule, dateISO) {
  if (!dateISO) return false;
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
export function getNextDueDate(schedule, fromDateISO = toLocalISODate(), maxLookaheadDays = 60) {
  if (!schedule) return null
  const startIso = schedule.startDate ? (schedule.startDate > fromDateISO ? schedule.startDate : fromDateISO) : fromDateISO
  const start = toLocalDate(startIso)

  for (let i = 0; i <= maxLookaheadDays; i++) {
    const candidate = addDays(start, i)
    const iso = toLocalISODate(candidate)
    if (schedule.endDate && iso > schedule.endDate) return null
    if (isDueOnDate(schedule, iso)) return iso
  }
  return null
}

// Find the previous date (before fromDateISO) that matches the schedule.
export function getPrevDueDate(schedule, fromDateISO = toLocalISODate(), maxLookbackDays = 365) {
  if (!schedule) return null
  const start = toLocalDate(fromDateISO)
  for (let i = 1; i <= maxLookbackDays; i++) {
    const candidate = addDays(start, -i)
    const iso = toLocalISODate(candidate)
    if (schedule.startDate && iso < schedule.startDate) return null
    if (isDueOnDate(schedule, iso)) return iso
  }
  return null
}

export function computeCurrentStreak(task, todayISO = toLocalISODate()) {
  if (!task?.schedule) return 0
  const log = task.completionLog || {}
  const schedule = task.schedule
  let cursor = isDueOnDate(schedule, todayISO) ? todayISO : getPrevDueDate(schedule, todayISO)
  let streak = 0

  while (cursor && log[cursor]) {
    streak += 1
    cursor = getPrevDueDate(schedule, cursor)
  }
  return streak
}

export function computeBestStreak(task, maxLookbackDays = 365) {
  if (!task?.schedule) return task?.stats?.bestStreak || 0
  const log = task.completionLog || {}
  const schedule = task.schedule
  const dates = Object.keys(log)
    .filter((d) => isDueOnDate(schedule, d))
    .sort()

  let best = task?.stats?.bestStreak || 0
  const streakEndingAt = {}

  dates.forEach((date) => {
    const prev = getPrevDueDate(schedule, date, maxLookbackDays)
    const prevStreak = prev && log[prev] ? streakEndingAt[prev] || 0 : 0
    const current = prevStreak + 1
    streakEndingAt[date] = current
    if (current > best) best = current
  })

  return best
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

export function formatScheduleSummary(schedule, todayISO = toLocalISODate()) {
  if (!schedule) return ''
  const parts = []

  const label = formatScheduleLabel(schedule)
  if (label) parts.push(label)

  if (schedule.startDate && schedule.startDate >= todayISO) {
    parts.push(`Starts ${formatMonthDay(schedule.startDate)}`)
  } else if (schedule.startDate) {
    parts.push(`Started ${formatMonthDay(schedule.startDate)}`)
  }

  if (schedule.endDate) {
    parts.push(`Ends ${formatMonthDay(schedule.endDate)}`)
  }

  return parts.join(' • ')
}

export function formatRepeatBadge(schedule) {
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
      return days.length ? days.join('/') : 'Custom'
    }
    case REPEAT.INTERVAL_DAYS: {
      const interval = Math.max(1, schedule.intervalDays || 1)
      return interval === 1 ? 'Daily' : `Every ${interval} days`
    }
    default:
      return ''
  }
}

export function formatNextDueLabel(schedule, todayISO = toLocalISODate()) {
  if (!schedule) return ''
  if (schedule.endDate && todayISO > schedule.endDate) return 'Ended'
  if (schedule.startDate && todayISO < schedule.startDate) {
    return `Starts ${formatMonthDay(schedule.startDate)}`
  }

  const next = getNextDueDate(schedule, todayISO)
  if (!next) return schedule.endDate ? 'Ended' : 'No upcoming'
  if (next === todayISO) return 'Due today'

  const today = isoToLocalDate(todayISO)
  const nextDate = isoToLocalDate(next)
  const diffDays = Math.floor((nextDate - today) / (1000 * 60 * 60 * 24))

  if (diffDays <= 7) {
    const dow = nextDate.toLocaleDateString('en-US', { weekday: 'short' })
    return `Next due: ${dow}`
  }
  return `Next due: ${formatMonthDay(next)}`
}

export default {
  REPEAT,
  toLocalISODate,
  isWithinRange,
  isDueOnDate,
  getNextDueDate,
  getPrevDueDate,
  computeCurrentStreak,
  computeBestStreak,
  formatScheduleLabel,
  formatScheduleSummary,
  formatNextDueLabel,
  formatRepeatBadge
}
