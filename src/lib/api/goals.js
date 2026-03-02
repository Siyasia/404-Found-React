// SWAP : Will replace localStorage reads/writes with POST /goal/create, GET /goal/get/:id, etc.
// Return shape has to stay identical: { status_code: 200, data: ... } or { status_code: 500, error: ... }
// tasks.js has the  the pattern this should match after swap.

import { getItem, setItem, KEYS } from '../storageAdapter.js'

async function safeReadGoals() {
  const list = await getItem(KEYS.GOALS)
  return Array.isArray(list) ? list : []
}

// CRUD operations for goals, using localStorage as the backend.
export async function goalCreate(goal) {
  // SWAP: POST /goal/create — send goal object as JSON body, return { status_code, data: createdGoal }
  // Remove crypto.randomUUID() call since backend assigns the id
  try {
    const list = await safeReadGoals()
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `g-${Date.now()}`
    const item = { ...goal, id }
    list.push(item)
    await setItem(KEYS.GOALS, list)
    return { status_code: 200, data: item }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

// Note: goalGet, goalList, goalUpdate, and goalDelete all follow a similar pattern of: 
// 1) read the full list of goals, 2) find/update/delete the relevant item, 3) write back the full list.
export async function goalGet(id) {
  // SWAP: GET /goal/get/:id — id comes from the URL param
  try {
    const list = await safeReadGoals()
    const found = list.find((g) => String(g.id) === String(id)) || null
    if (!found) return { status_code: 500, error: 'Not found' }
    return { status_code: 200, data: found }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function goalList() {
  // SWAP: GET /goal/list — no params, returns all goals for the authenticated user
  // Backend will scope by user session automatically, remove any manual filtering here
  try {
    const list = await safeReadGoals()
    return { status_code: 200, data: list }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function goalUpdate(id, changes) {
  // SWAP: POST /goal/update — send { id, ...changes } as JSON body
  // Remove the manual array find/splice logic, backend handles record lookup
  try {
    const list = await safeReadGoals()
    const idx = list.findIndex((g) => String(g.id) === String(id))
    if (idx === -1) return { status_code: 500, error: 'Not found' }
    const updated = { ...list[idx], ...changes, id: list[idx].id }
    list[idx] = updated
    await setItem(KEYS.GOALS, list)
    return { status_code: 200, data: updated }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function goalDelete(id) {
  // SWAP: GET /goal/delete/:id — matches the pattern in tasks.js taskDelete()
  try {
    const list = await safeReadGoals()
    const filtered = list.filter((g) => String(g.id) !== String(id))
    if (filtered.length === list.length) return { status_code: 500, error: 'Not found' }
    await setItem(KEYS.GOALS, filtered)
    return { status_code: 200, data: { id } }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

// Export all functions as a default object for easier imports
export default { goalCreate, goalGet, goalList, goalUpdate, goalDelete }
