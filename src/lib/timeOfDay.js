export function timeToMinutes(hhmm) {
  if (!hhmm && hhmm !== '') return null
  const str = String(hhmm).trim()
  if (!str) return null
  const parts = str.split(':')
  if (parts.length !== 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function sortTimelineTasks(tasks) {
  const safeTasks = (tasks || []).slice()
  const timed = []
  const anytime = []

  safeTasks.forEach((t, idx) => {
    const minutes = timeToMinutes(t.timeOfDay)
    if (minutes === null) {
      anytime.push({ ...t, __createdIndex: idx })
    } else {
      timed.push({ ...t, __minutes: minutes, __createdIndex: idx })
    }
  })

  timed.sort((a, b) => {
    if (a.__minutes !== b.__minutes) return a.__minutes - b.__minutes
    const titleCmp = (a.title || '').localeCompare(b.title || '')
    if (titleCmp !== 0) return titleCmp
    return (a.__createdIndex || 0) - (b.__createdIndex || 0)
  })

  anytime.sort((a, b) => {
    const titleCmp = (a.title || '').localeCompare(b.title || '')
    if (titleCmp !== 0) return titleCmp
    return (a.__createdIndex || 0) - (b.__createdIndex || 0)
  })

  return { timed, anytime, ordered: timed.concat(anytime) }
}

export default { timeToMinutes, sortTimelineTasks }
