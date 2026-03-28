// PHASE 6: Local calendar API for the new habit system.
// This reads action plans from local storage and expands them into calendar-friendly day entries.

import { getItem, KEYS } from './storageAdapter.js'
import { isDueOnDate, computeCurrentStreak } from '../schedule.js'
import {actionPlanList} from "./actionPlans.js";

function pad(num) {
  return String(num).padStart(2, '0')
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function readActionPlans() {
  const list = await actionPlanList()
  if (list.status_code === 200) {
    return list?.plans ? Array.isArray(list.plans) ? list.plans : [list.plans] : []
  }
  return []
}

function getSchedule(plan) {
  if (plan?.schedule && typeof plan.schedule === 'object') return plan.schedule
  if (plan?.frequency && typeof plan.frequency === 'object') return plan.frequency
  return null
}

function filterPlansForAssignee(plans, assigneeId) {
  if (!assigneeId) return plans
  return (plans || []).filter((plan) => String(plan?.assigneeId) === String(assigneeId))
}

function computePlanStreak(plan, dateISO) {
  const schedule = getSchedule(plan)
  const completionLog = plan?.completedDates && typeof plan.completedDates === 'object' && !Array.isArray(plan.completedDates)
    ? plan.completedDates
    : {}

  if (!schedule) return Number(plan?.currentStreak || 0) || 0

  return computeCurrentStreak({ schedule, completionLog }, dateISO)
}

function buildEntry(plan, dateISO) {
  return {
    actionPlan: plan,
    completed: Boolean(plan?.completedDates?.[dateISO] === true),
    streak: computePlanStreak(plan, dateISO),
  }
}

function range(days, startISO) {
  const results = []
  const startDate = new Date(`${startISO}T00:00:00`)
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    results.push(toISO(d))
  }
  return results
}

export async function getCalendarMonth(year, month, assigneeId) {
  try {
    const allPlans = await readActionPlans()
    const plans = filterPlansForAssignee(allPlans, assigneeId)
    const daysInMonth = new Date(year, month, 0).getDate()
    const data = {}

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateISO = `${year}-${pad(month)}-${pad(day)}`
      const entries = plans
        .filter((plan) => {
          const schedule = getSchedule(plan)
          return schedule ? isDueOnDate(schedule, dateISO) : false
        })
        .map((plan) => buildEntry(plan, dateISO))

      if (entries.length > 0) data[dateISO] = entries
    }

    return { status_code: 200, data }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function getCalendarDay(dateISO, assigneeId) {
  try {
    const allPlans = await readActionPlans()
    const plans = filterPlansForAssignee(allPlans, assigneeId)
    const entries = plans
      .filter((plan) => {
        const schedule = getSchedule(plan)
        return schedule ? isDueOnDate(schedule, dateISO) : false
      })
      .map((plan) => buildEntry(plan, dateISO))

    return { status_code: 200, data: { entries } }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function getCalendarWeek(startDateISO, assigneeId) {
  try {
    const allPlans = await readActionPlans()
    const plans = filterPlansForAssignee(allPlans, assigneeId)
    const dates = range(7, startDateISO)
    const data = {}

    dates.forEach((dateISO) => {
      const entries = plans
        .filter((plan) => {
          const schedule = getSchedule(plan)
          return schedule ? isDueOnDate(schedule, dateISO) : false
        })
        .map((plan) => buildEntry(plan, dateISO))

      if (entries.length > 0) data[dateISO] = entries
    })

    return { status_code: 200, data }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export default {
  getCalendarMonth,
  getCalendarDay,
  getCalendarWeek,
}
