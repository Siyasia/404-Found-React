// SWAP TARGET: Replace localStorage reads/writes with POST /action-plan/create, etc.
// completedDates lives on the action plan object — backend must store and return this field.
// Confirm with backend that completedDates: { "YYYY-MM-DD": true } is the agreed shape before swapping.

import { getItem, setItem, KEYS } from '../storageAdapter.js'
import { formatScheduleLabel } from '../schedule.js'

async function safeReadActionPlans() {
  const list = await getItem(KEYS.ACTION_PLANS)
  return Array.isArray(list) ? list : []
}

function normalizePlan(plan) {
  const normalizedPlan = { ...(plan || {}) }

  if (normalizedPlan.assigneeId != null) {
    normalizedPlan.assigneeId = String(normalizedPlan.assigneeId)
  }

  if (normalizedPlan.schedule && !normalizedPlan.frequency) {
    normalizedPlan.frequency = normalizedPlan.schedule
  }

  if (!normalizedPlan.frequencyLabel) {
    normalizedPlan.frequencyLabel = formatScheduleLabel(normalizedPlan.schedule || normalizedPlan.frequency)
  }

  if (!normalizedPlan.completedDates || typeof normalizedPlan.completedDates !== 'object' || Array.isArray(normalizedPlan.completedDates)) {
    normalizedPlan.completedDates = {}
  }

  return normalizedPlan
}

export async function actionPlanCreate(plan) {
  try {
    const list = await safeReadActionPlans()
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ap-${Date.now()}`
    const item = {
      ...normalizePlan(plan),
      id,
    }
    list.push(item)
    await setItem(KEYS.ACTION_PLANS, list)
    return { status_code: 200, data: item }
  } catch (err) {
    if (err && err.name === 'AbortError') throw err
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function actionPlanGet(id) {
  try {
    const list = await safeReadActionPlans()
    const found = list.find((p) => String(p.id) === String(id)) || null
    if (!found) return { status_code: 500, error: 'Not found' }
    return { status_code: 200, data: found }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function actionPlanList(goalId, options) {
  if (goalId && typeof goalId === 'object' && !Array.isArray(goalId)) {
    options = goalId
    goalId = undefined
  }

  const signal = options?.signal || null

  if (signal?.aborted) {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    throw err
  }

  try {
    const list = await safeReadActionPlans()
    const res = goalId == null ? list : list.filter((p) => String(p.goalId) === String(goalId))

    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }

    return { status_code: 200, data: res }
  } catch (err) {
    if (err && err.name === 'AbortError') throw err
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function actionPlanUpdate(id, changes) {
  try {
    const list = await safeReadActionPlans()
    const idx = list.findIndex((p) => String(p.id) === String(id))
    if (idx === -1) return { status_code: 500, error: 'Not found' }

    const updated = normalizePlan({
      ...list[idx],
      ...changes,
      id: list[idx].id,
    })

    list[idx] = updated
    await setItem(KEYS.ACTION_PLANS, list)
    return { status_code: 200, data: updated }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function actionPlanDelete(id) {
  try {
    const list = await safeReadActionPlans()
    const filtered = list.filter((p) => String(p.id) !== String(id))
    if (filtered.length === list.length) return { status_code: 500, error: 'Not found' }
    await setItem(KEYS.ACTION_PLANS, filtered)
    return { status_code: 200, data: { id } }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export async function actionPlanDeleteByGoal(goalId) {
  try {
    const list = await safeReadActionPlans()
    const filtered = list.filter((p) => String(p.goalId) !== String(goalId))
    const removed = list.length - filtered.length
    await setItem(KEYS.ACTION_PLANS, filtered)
    return { status_code: 200, data: { goalId, removed } }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

export default {
  actionPlanCreate,
  actionPlanGet,
  actionPlanList,
  actionPlanUpdate,
  actionPlanDelete,
  actionPlanDeleteByGoal,
}
