// This mirrors the local-storage CRUD style used by actionPlans.js.

import * as Responses from './response.js'
import { getJSON, postJSON } from './api.js'

// Create a new goal
export async function goalCreate(goal) {
  try {
    const payload = (goal && typeof goal.toJSON === 'function') ? goal.toJSON() : (goal || {})
    const info = await postJSON('/goals/create', payload)
    return new Responses.CreateGoalResponse(info.status, info.data)
  } catch (err) {
    return new Responses.CreateGoalResponse(500, { error: err?.message || String(err) })
  }
}

// Retrieve a specific goal by its ID.
export async function goalGet(id) {
  try {
    const info = await getJSON(`/goals/get/${id}`)
    return new Responses.GetGoalResponse(info.status, info.data)
  } catch (err) {
    return new Responses.GetGoalResponse(500, { error: err?.message || String(err) })
  }
}

// List all goals.
export async function goalList() {
  try {
    const info = await getJSON('/goals/list')
    return new Responses.ListGoalResponse(info.status, info.data)
  } catch (err) {
    return new Responses.ListGoalResponse(500, { error: err?.message || String(err) })
  }
}

// Update an existing goal by its ID with the provided changes.
export async function goalUpdate(id, changes) {
  try {
    const payload = (changes && typeof changes.toJSON === 'function') ? changes.toJSON() : (changes || {})
    // keep id in payload to match backend expectations
    payload.id = id
    const info = await postJSON('/goals/update', payload)
    return new Responses.UpdateGoalResponse(info.status, info.data)
  } catch (err) {
    return new Responses.UpdateGoalResponse(500, { error: err?.message || String(err) })
  }
}

// Delete a goal by its ID.
export async function goalDelete(id) {
  try {
    const info = await getJSON(`/goals/delete/${id}`)
    return new Responses.DeleteResponse(info.status, info.data)
  } catch (err) {
    return new Responses.DeleteResponse(500, { error: err?.message || String(err) })
  }
}

export async function saveGoalBundle(payload) {
  try {
    const info = await postJSON('/goal-bundle/save', payload || {})
    return {
      status_code: info.status,
      error: info.data?.error || null,
      data: info.data || null,
      success: Boolean(info.data?.success),
      goal: info.data?.goal || null,
      actionPlans: Array.isArray(info.data?.actionPlans) ? info.data.actionPlans : [],
    }
  } catch (err) {
    return {
      status_code: 500,
      error: err?.message || String(err),
      data: { error: err?.message || String(err) },
      success: false,
      goal: null,
      actionPlans: [],
    }
  }
}

export default { goalCreate, goalGet, goalList, goalUpdate, goalDelete, saveGoalBundle }
