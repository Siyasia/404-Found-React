import * as Responses from './response.js'
import { getJSON, postJSON } from './api.js'

// Create a new action plan
export async function actionPlanCreate(plan) {
  try {
    const payload = (plan && typeof plan.toJSON === 'function') ? plan.toJSON() : (plan || {})
    const info = await postJSON('/action-plan/create', payload)
    return new Responses.CreateActionPlanResponse(info.status, info.data)
  } catch (err) {
    return new Responses.CreateActionPlanResponse(500, { error: err?.message || String(err) })
  }
}

// Retrieves a single action plan by id.
export async function actionPlanGet(id) {
  try {
    const info = await getJSON(`/action-plan/get/${id}`)
    return new Responses.GetActionPlanResponse(info.status, info.data)
  } catch (err) {
    return new Responses.GetActionPlanResponse(500, { error: err?.message || String(err) })
  }
}

// If goalId is provided, returns only action plans for that goal. Otherwise returns all action plans.
export async function actionPlanList(goalId, options) {
  // maintain existing flexible signature: actionPlanList(options) or actionPlanList(goalId, options)
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
    // backend endpoint supports optional query ?goalId=...
    const url = goalId ? `/action-plan/list?goalId=${encodeURIComponent(String(goalId))}` : '/action-plan/list'
    const info = await getJSON(url)
    return new Responses.ListActionPlanResponse(info.status, info.data)
  } catch (err) {
    if (err && err.name === 'AbortError') throw err
    return new Responses.ListActionPlanResponse(500, { error: err?.message || String(err) })
  }
}

// Update an action plan (partial allowed)
export async function actionPlanUpdate(id, changes) {
  try {
    const payload = (changes && typeof changes.toJSON === 'function') ? changes.toJSON() : (changes || {})
    payload.id = id
    const info = await postJSON('/action-plan/update', payload)
    return new Responses.UpdateActionPlanResponse(info.status, info.data)
  } catch (err) {
    return new Responses.UpdateActionPlanResponse(500, { error: err?.message || String(err) })
  }
}

// Deletes the specified action plan by id. Returns the id of the deleted plan on success.
export async function actionPlanDelete(id) {
  try {
    const info = await getJSON(`/action-plan/delete/${id}`)
    return new Responses.DeleteResponse(info.status, info.data)
  } catch (err) {
    return new Responses.DeleteResponse(500, { error: err?.message || String(err) })
  }
}

// Deletes all action plans associated with the specified goalId. Returns the number of deleted plans on success.
export async function actionPlanDeleteByGoal(goalId) {
  try {
    const info = await postJSON('/action-plan/delete-by-goal', { goalId })
    return new Responses.DeleteResponse(info.status, info.data)
  } catch (err) {
    return new Responses.DeleteResponse(500, { error: err?.message || String(err) })
  }
}

export async function actionPlanComplete(actionPlanId, dateISO) {
  try {
    const info = await postJSON('/action-plan/complete', { actionPlanId, dateISO })
    return new Responses.UpdateActionPlanResponse(info.status, info.data)
  } catch (err) {
    return new Responses.UpdateActionPlanResponse(500, { error: err?.message || String(err) })
  }
}

export async function actionPlanIncomplete(actionPlanId, dateISO) {
  try {
    const info = await postJSON('/action-plan/incomplete', { actionPlanId, dateISO })
    return new Responses.UpdateActionPlanResponse(info.status, info.data)
  } catch (err) {
    return new Responses.UpdateActionPlanResponse(500, { error: err?.message || String(err) })
  }
}

export async function completeActionPlan(actionPlanId, dateISO) {
  return actionPlanComplete(actionPlanId, dateISO)
}

export async function incompleteActionPlan(actionPlanId, dateISO) {
  return actionPlanIncomplete(actionPlanId, dateISO)
}

export default {
  actionPlanCreate,
  actionPlanGet,
  actionPlanList,
  actionPlanUpdate,
  actionPlanDelete,
  actionPlanDeleteByGoal,
  actionPlanComplete,
  actionPlanIncomplete,
  completeActionPlan,
  incompleteActionPlan,
}
