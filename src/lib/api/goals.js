// This mirrors the local-storage CRUD style used by actionPlans.js.

import { getItem, setItem, KEYS } from './storageAdapter.js'

// Helper function to read the goals list safely, ensuring it returns an array.
async function safeReadGoals() {
  const list = await getItem(KEYS.GOALS)
  return Array.isArray(list) ? list : []
}

// Create a new goal or update an existing one if an ID is provided.
export async function goalCreate(goal) {
  try {
    const list = await safeReadGoals()
    const id = goal?.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `g-${Date.now()}`)
    const item = { ...goal, id }
    list.push(item)
    await setItem(KEYS.GOALS, list)
    return { status_code: 200, data: item }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

// Retrieve a specific goal by its ID.
export async function goalGet(id) {
  try {
    const list = await safeReadGoals()
    const found = list.find((g) => String(g.id) === String(id)) || null
    if (!found) return { status_code: 500, error: 'Not found' }
    return { status_code: 200, data: found }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

// List all goals.
export async function goalList() {
  try {
    const list = await safeReadGoals()
    return { status_code: 200, data: list }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

// Update an existing goal by its ID with the provided changes.
export async function goalUpdate(id, changes) {
  try {
    const list = await safeReadGoals()
    const idx = list.findIndex((g) => String(g.id) === String(id))
    if (idx === -1) return { status_code: 500, error: 'Not found' }
    const updated = { ...list[idx], ...changes, id: list[idx].id }
    list[idx] = updated
    await setItem(KEYS.GOALS, list)
    return { status_code: 200, data: updated }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

// Delete a goal by its ID.
export async function goalDelete(id) {
  try {
    const list = await safeReadGoals()
    const filtered = list.filter((g) => String(g.id) !== String(id))
    if (filtered.length === list.length) return { status_code: 500, error: 'Not found' }
    await setItem(KEYS.GOALS, filtered)
    return { status_code: 200, data: { id } }
  } catch (err) {
    return { status_code: 500, error: err?.message || String(err) }
  }
}

// Export all functions as a default object for easy import elsewhere.
export default { goalCreate, goalGet, goalList, goalUpdate, goalDelete }
