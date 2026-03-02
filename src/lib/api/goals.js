import { getItem, setItem, KEYS } from '../storageAdapter.js'

async function safeReadGoals() {
  const list = await getItem(KEYS.GOALS)
  return Array.isArray(list) ? list : []
}

export async function goalCreate(goal) {
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

export async function goalGet(id) {
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
  try {
    const list = await safeReadGoals()
    return { status_code: 200, data: list }
  } catch (err) {
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

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
    return { status_code: 500, error: err && err.message ? err.message : String(err) }
  }
}

export async function goalDelete(id) {
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

export default { goalCreate, goalGet, goalList, goalUpdate, goalDelete }
