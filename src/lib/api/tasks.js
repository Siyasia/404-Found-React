import { getItem, setItem, KEYS } from './storageAdapter.js'
import {
  buildTaskAssignment,
  createTaskAssignment,
  startTaskAssignment,
  completeTaskAssignment,
  toggleTaskAssignmentChecklistItem,
  expandAssignmentForAssignees,
  TASK_ASSIGNMENT_STATUS,
  TASK_ASSIGNMENT_COMPLETION_SOURCE,
} from '../../models/index.js'

function ok(data = {}) {
  return {
    status_code: 200,
    error: null,
    data,
  }
}

function fail(error, statusCode = 500) {
  return {
    status_code: statusCode,
    error: error?.message || String(error || 'Unknown error'),
    data: null,
  }
}

function toId(value) {
  if (value == null) return ''
  return String(value)
}

function matchesFilter(assignment, filters = {}) {
  if (!assignment) return false

  const {
    assigneeId,
    assigneeIds,
    createdById,
    status,
    linkedActionPlanId,
    useTimer,
  } = filters

  if (assigneeId != null && toId(assignment.assigneeId) !== toId(assigneeId)) {
    return false
  }

  if (Array.isArray(assigneeIds) && assigneeIds.length > 0) {
    const wanted = assigneeIds.map(toId)
    if (!wanted.includes(toId(assignment.assigneeId))) {
      return false
    }
  }

  if (createdById != null && toId(assignment.createdById) !== toId(createdById)) {
    return false
  }

  if (status != null && assignment.status !== status) {
    return false
  }

  if (
    linkedActionPlanId != null &&
    toId(assignment.linkedActionPlanId) !== toId(linkedActionPlanId)
  ) {
    return false
  }

  if (typeof useTimer === 'boolean' && assignment.useTimer !== useTimer) {
    return false
  }

  return true
}

function isExpiredPendingTask(task, nowMs = Date.now()) {
  if (!task) return false
  if (task.status !== TASK_ASSIGNMENT_STATUS.PENDING) return false
  if (!task.dueDateISO) return false

  const dueMs = new Date(task.dueDateISO).getTime()
  if (!Number.isFinite(dueMs)) return false

  return dueMs < nowMs
}

function sortTasks(assignments = []) {
  return [...assignments].sort((a, b) => {
    const aCompleted = a?.completedAt ? new Date(a.completedAt).getTime() : 0
    const bCompleted = b?.completedAt ? new Date(b.completedAt).getTime() : 0
    const aStarted = a?.startedAt ? new Date(a.startedAt).getTime() : 0
    const bStarted = b?.startedAt ? new Date(b.startedAt).getTime() : 0
    const aSent = a?.sentAt ? new Date(a.sentAt).getTime() : 0
    const bSent = b?.sentAt ? new Date(b.sentAt).getTime() : 0

    return (
      bCompleted - aCompleted ||
      bStarted - aStarted ||
      bSent - aSent
    )
  })
}

async function readAllTasks() {
  const raw = await getItem(KEYS.TASK_ASSIGNMENTS)
  if (!Array.isArray(raw)) return []

  const normalized = raw.map((item) => buildTaskAssignment(item))
  const active = normalized.filter((item) => !isExpiredPendingTask(item))

  if (active.length !== normalized.length) {
    await writeAllTasks(active)
  }

  return active
}

async function writeAllTasks(assignments) {
  await setItem(KEYS.TASK_ASSIGNMENTS, assignments.map((item) => buildTaskAssignment(item)))
}

function findAssignmentIndex(assignments, id) {
  return assignments.findIndex((item) => toId(item.id) === toId(id))
}

/**
 * Create one assignment for the current user or a specific assignee.
 * Use this for the User Homepage self-flow.
 */
export async function taskCreate(input = {}) {
  try {
    const task = createTaskAssignment(input)
    const all = await readAllTasks()
    all.unshift(task)
    await writeAllTasks(all)
    return ok({ task })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Create many assignments at once.
 * Best for parent flow when one item is assigned to multiple people.
 * This expands one draft into one stored record per assignee.
 */
export async function taskCreateMany(baseInput = {}, assignees = []) {
  try {
    const expanded = expandAssignmentForAssignees(baseInput, assignees)
    const all = await readAllTasks()
    const next = [...expanded, ...all]
    await writeAllTasks(next)
    return ok({ tasks: expanded })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Get one assignment by id.
 */
export async function taskGet(id) {
  try {
    const all = await readAllTasks()
    const task = all.find((item) => toId(item.id) === toId(id)) || null

    if (!task) {
      return fail('Task not found', 404)
    }

    return ok({ task })
  } catch (error) {
    return fail(error)
  }
}

/**
 * List assignments with optional filters.
 *
 * Example:
 * taskAssignmentList()
 * taskAssignmentList({ assigneeId: user.id })
 * taskAssignmentList({ assigneeId: childId, status: TASK_ASSIGNMENT_STATUS.PENDING })
 */
export async function taskList(filters = {}) {
  try {
    const all = await readAllTasks()
    const tasks = sortTasks(all.filter((item) => matchesFilter(item, filters)))
    return ok({ tasks })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Update a task assignment with partial changes.
 * Use carefully — status transitions should usually go through
 * start/complete/checklist helpers instead.
 */
export async function taskUpdate(id, changes = {}) {
  try {
    const all = await readAllTasks()
    const index = findAssignmentIndex(all, id)

    if (index === -1) {
      return fail('Task assignment not found', 404)
    }

    const current = all[index]
    const updated = buildTaskAssignment({
      ...current,
      ...changes,
      id: current.id,
    })

    all[index] = updated
    await writeAllTasks(all)

    return ok({ task: updated })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Start a timed task assignment.
 * Untimed assignments stay pending until manual/checklist completion.
 */
export async function taskStart(id, startedAt) {
  try {
    const all = await readAllTasks()
    const index = findAssignmentIndex(all, id)

    if (index === -1) {
      return fail('Task assignment not found', 404)
    }

    const current = all[index]

    if (current.useTimer !== true) {
      return fail('Only timed tasks can be started', 400)
    }

    const started = startTaskAssignment(current, startedAt)
    all[index] = started
    await writeAllTasks(all)

    return ok({ task: started })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Toggle one checklist item.
 * If this finishes the checklist, the task auto-completes.
 */
export async function taskToggleChecklistItem(id, itemId, completedAt) {
  try {
    const all = await readAllTasks()
    const index = findAssignmentIndex(all, id)

    if (index === -1) {
      return fail('Task assignment not found', 404)
    }

    const current = all[index]
    const updated = toggleTaskAssignmentChecklistItem(current, itemId, completedAt)

    all[index] = updated
    await writeAllTasks(all)

    return ok({ task: updated })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Complete an assignment manually or from timer/checklist logic.
 */
export async function taskComplete(
  id,
  source = TASK_ASSIGNMENT_COMPLETION_SOURCE.MANUAL,
  completedAt
) {
  try {
    const all = await readAllTasks()
    const index = findAssignmentIndex(all, id)

    if (index === -1) {
      return fail('Task assignment not found', 404)
    }

    const current = all[index]
    const completed = completeTaskAssignment(current, source, completedAt)

    all[index] = completed
    await writeAllTasks(all)

    return ok({ task: completed })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Delete one assignment.
 */
export async function taskDelete(id) {
  try {
    const all = await readAllTasks()
    const next = all.filter((item) => toId(item.id) !== toId(id))

    if (next.length === all.length) {
      return fail('Task not found', 404)
    }

    await writeAllTasks(next)
    return ok({ id: toId(id) })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Delete all assignments that match the given filters.
 * Handy later for bulk cleanup/testing.
 */
export async function taskDeleteMany(filters = {}) {
  try {
    const all = await readAllTasks()
    const toDelete = all.filter((item) => matchesFilter(item, filters))
    const next = all.filter((item) => !matchesFilter(item, filters))

    await writeAllTasks(next)

    return ok({
      deletedCount: toDelete.length,
      deletedIds: toDelete.map((item) => item.id),
    })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Convenience helpers for common list views.
 */
export async function taskListPending(filters = {}) {
  return taskList({
    ...filters,
    status: TASK_ASSIGNMENT_STATUS.PENDING,
  })
}

export async function taskListActive(filters = {}) {
  return taskList({
    ...filters,
    status: TASK_ASSIGNMENT_STATUS.ACTIVE,
  })
}

export async function taskListCompleted(filters = {}) {
  return taskList({
    ...filters,
    status: TASK_ASSIGNMENT_STATUS.COMPLETED,
  })
}

export default {
  taskCreate,
  taskCreateMany,
  taskGet,
  taskList,
  taskUpdate,
  taskStart,
  taskToggleChecklistItem,
  taskComplete,
  taskDelete,
  taskDeleteMany,
  taskListPending,
  taskListActive,
  taskListCompleted,
}