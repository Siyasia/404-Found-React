import { describe, it, expect } from 'vitest'
import { sortTimelineTasks, timeToMinutes } from '../lib/timeOfDay'

describe('timeOfDay helpers', () => {
  it('parses HH:MM to minutes and rejects invalids', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('09:05')).toBe(9 * 60 + 5)
    expect(timeToMinutes('23:59')).toBe(23 * 60 + 59)
    expect(timeToMinutes('')).toBeNull()
    expect(timeToMinutes(null)).toBeNull()
    expect(timeToMinutes('24:00')).toBeNull()
    expect(timeToMinutes('bad')).toBeNull()
  })

  it('sorts tasks into timeline order', () => {
    const tasks = [
      { id: 'a', title: 'Alpha', timeOfDay: '09:00', createdAt: '2020-01-01' },
      { id: 'b', title: 'Beta', timeOfDay: null, createdAt: '2020-01-02' },
      { id: 'c', title: 'Charlie', timeOfDay: '08:30', createdAt: '2020-01-03' },
      { id: 'd', title: 'Delta', timeOfDay: '09:00', createdAt: '2020-01-04' },
    ]

    const { timed, anytime, ordered } = sortTimelineTasks(tasks)

    // timed: Charlie (08:30), Alpha (09:00, title Alpha before Delta), Delta (09:00)
    expect(timed.map(t => t.id)).toEqual(['c', 'a', 'd'])
    // anytime: Beta
    expect(anytime.map(t => t.id)).toEqual(['b'])
    // ordered: timed then anytime
    expect(ordered.map(t => t.id)).toEqual(['c', 'a', 'd', 'b'])
  })
})
