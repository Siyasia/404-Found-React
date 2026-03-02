// SWAP TARGET: Replace localStorage reads/writes with POST /action-plan/create, etc.
// completedDates lives on the action plan object — backend must store and return this field.
// Confirm with backend that completedDates: { "YYYY-MM-DD": true } is the agreed shape before swapping.
import { getItem, setItem, KEYS } from '../storageAdapter.js'

async function safeReadActionPlans() {
  const list = await getItem(KEYS.ACTION_PLANS)
  return Array.isArray(list) ? list : []
}

export async function actionPlanCreate(plan) {
  // SWAP: POST /action-plan/create — send plan object as JSON body
  // Remove crypto.randomUUID() call since backend assigns the id
  // completedDates should be initialized server-side as an empty object if not provided
  try {
    const list = await safeReadActionPlans()
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ap-${Date.now()}`
    const item = {
      ...plan,
      id,
      completedDates: plan && plan.completedDates && typeof plan.completedDates === 'object' ? plan.completedDates : {}
    }
    list.push(item)
    await setItem(KEYS.ACTION_PLANS, list)
    return { status_code: 200, data: item }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function actionPlanGet(id) {
  // SWAP: GET /action-plan/get/:id
  try {
    const list = await safeReadActionPlans()
    const found = list.find((p) => String(p.id) === String(id)) || null
    if (!found) return { status_code: 500, error: 'Not found' }
    return { status_code: 200, data: found }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function actionPlanList(goalId) {
  // SWAP: GET /action-plan/list?goalId=:goalId — goalId is optional query param
  // If goalId is null, backend returns all plans for the authenticated user
  try {
    const list = await safeReadActionPlans()
    const res = goalId == null ? list : list.filter((p) => String(p.goalId) === String(goalId))
    return { status_code: 200, data: res }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function actionPlanUpdate(id, changes) {
  // SWAP: POST /action-plan/update — send { id, ...changes } as JSON body
  // NOTE: completedDates will be updated frequently (every time a habit is checked off).
  // Consider asking backend for a dedicated POST /action-plan/complete endpoint to avoid
  // sending the full object on every completion toggle.
  try {
    const list = await safeReadActionPlans()
    const idx = list.findIndex((p) => String(p.id) === String(id))
    if (idx === -1) return { status_code: 500, error: 'Not found' }
    const updated = { ...list[idx], ...changes, id: list[idx].id }
    // Ensure completedDates exists as an object
    if (!updated.completedDates || typeof updated.completedDates !== 'object') updated.completedDates = {}
    list[idx] = updated
    await setItem(KEYS.ACTION_PLANS, list)
    return { status_code: 200, data: updated }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function actionPlanDelete(id) {
  // SWAP: GET /action-plan/delete/:id
  try {
    const list = await safeReadActionPlans()
    const filtered = list.filter((p) => String(p.id) !== String(id))
    if (filtered.length === list.length) return { status_code: 500, error: 'Not found' }
    await setItem(KEYS.ACTION_PLANS, filtered)
    return { status_code: 200, data: { id } }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function actionPlanDeleteByGoal(goalId) {
  // SWAP: GET /action-plan/delete-by-goal/:goalId — backend cascades the delete
  // Confirm with backend that this endpoint exists before removing local logic
  try {
    const list = await safeReadActionPlans()
    const filtered = list.filter((p) => String(p.goalId) !== String(goalId))
    const removed = list.length - filtered.length
    await setItem(KEYS.ACTION_PLANS, filtered)
    return { status_code: 200, data: { goalId, removed } }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
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
