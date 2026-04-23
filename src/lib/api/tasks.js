import { getJSON, postJSON } from './api.js'
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

function fail(error, statusCode = 500, data = null) {
  return {
    status_code: statusCode,
    error: error?.message || error?.error || String(error || 'Unknown error'),
    data,
  }
}

function toId(value) {
  if (value == null) return ''
  return String(value)
}

function toNullableId(value) {
  const id = toId(value)
  return id || null
}

function toBool(value) {
  return value === true
}

function toPositiveInt(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return Math.round(num)
}

function normalizeError(info, fallback = 'Request failed') {
  if (!info) return fallback
  if (typeof info === 'string') return info
  if (typeof info?.data === 'string') return info.data
  if (info?.data?.error) return info.data.error
  if (info?.error) return info.error
  return fallback
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

  if (status != null && String(assignment.status) !== String(status)) {
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

function sortTasks(assignments = []) {
  return [...assignments].sort((a, b) => {
    const aCompleted = a?.completedAt ? new Date(a.completedAt).getTime() : 0
    const bCompleted = b?.completedAt ? new Date(b.completedAt).getTime() : 0
    const aStarted = a?.startedAt ? new Date(a.startedAt).getTime() : 0
    const bStarted = b?.startedAt ? new Date(b.startedAt).getTime() : 0
    const aSent = a?.sentAt ? new Date(a.sentAt).getTime() : 0
    const bSent = b?.sentAt ? new Date(b.sentAt).getTime() : 0

    return bCompleted - aCompleted || bStarted - aStarted || bSent - aSent
  })
}

function taskToBackendPayload(taskLike = {}, { includeId = false } = {}) {
  const task = buildTaskAssignment(taskLike)

  const meta = {
    ...(task.meta && typeof task.meta === 'object' && !Array.isArray(task.meta) ? task.meta : {}),
    checklist: Array.isArray(task.checklist)
      ? task.checklist.map((item, index) => ({
          id: toId(item?.id) || `task_step_${index + 1}`,
          label: String(item?.label || '').trim(),
          isCompleted: item?.isCompleted === true,
          completedAt: item?.completedAt || null,
          sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
        })).filter((item) => item.label)
      : [],
    useTimer: toBool(task.useTimer),
    durationMinutes: toBool(task.useTimer) ? toPositiveInt(task.durationMinutes) : null,
    linkedActionPlanId: toNullableId(task.linkedActionPlanId),
    linkedGoalId: toNullableId(task.linkedGoalId),
    startedAt: task.startedAt || null,
    completedAt: task.completedAt || null,
    completionSource: task.completionSource || null,
    sentAt: task.sentAt || task.createdAt || null,
    dueDateISO: task.dueDateISO || null,
    note: task.note || task.notes || '',
    schedule: task.schedule || task.frequency || null,
    frequencyLabel: task.frequencyLabel || '',
  }

  const payload = {
    assigneeId: toNullableId(task.assigneeId),
    assigneeName: task.assigneeName || '',
    title: task.title || 'Untitled task',
    notes: task.note || task.notes || '',
    taskType: task.taskType || 'assignment',
    steps: Array.isArray(meta.checklist) ? meta.checklist.map((item) => item.label) : [],
    habitToBreak: task.habitToBreak || '',
    replacements: Array.isArray(task.replacements) ? task.replacements : [],
    frequency: task.schedule || task.frequency || null,
    streak: Number(task.streak || 0) || 0,
    completedDates: Array.isArray(task.completedDates) ? task.completedDates : [],
    status: task.status || TASK_ASSIGNMENT_STATUS.PENDING,
    createdAt: task.createdAt || task.sentAt || new Date().toISOString(),
    createdById: toNullableId(task.createdById),
    createdByName: task.createdByName || '',
    createdByRole: task.createdByRole || 'user',
    needsApproval: task.needsApproval === true,
    targetType: task.targetType ?? null,
    targetName: task.targetName ?? null,
    meta,
  }

  if (includeId) {
    payload.id = task.id
  }

  return payload
}

function taskFromBackendPayload(raw = {}) {
  const meta = raw?.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)
    ? raw.meta
    : {}

  const checklist = Array.isArray(meta.checklist) && meta.checklist.length > 0
    ? meta.checklist
    : (Array.isArray(raw.steps) ? raw.steps : [])

  return buildTaskAssignment({
    ...raw,
    note: raw.note ?? raw.notes ?? meta.note ?? '',
    checklist,
    useTimer: meta.useTimer === true,
    durationMinutes: meta.durationMinutes ?? null,
    linkedActionPlanId: raw.linkedActionPlanId ?? meta.linkedActionPlanId ?? null,
    linkedGoalId: raw.linkedGoalId ?? meta.linkedGoalId ?? null,
    startedAt: raw.startedAt ?? meta.startedAt ?? null,
    completedAt: raw.completedAt ?? meta.completedAt ?? null,
    completionSource: raw.completionSource ?? meta.completionSource ?? null,
    sentAt: raw.sentAt ?? meta.sentAt ?? raw.createdAt ?? null,
    dueDateISO: raw.dueDateISO ?? meta.dueDateISO ?? null,
    schedule: raw.schedule ?? meta.schedule ?? raw.frequency ?? null,
    frequency: raw.frequency ?? meta.schedule ?? null,
  })
}

async function fetchTaskById(id) {
  const info = await getJSON(`/task/get/${encodeURIComponent(String(id))}`)

  if (info.status >= 400) {
    return fail(normalizeError(info, 'Task not found'), info.status)
  }

  const task = taskFromBackendPayload(info.data?.task || {})
  return ok({ task })
}

async function fetchAllTasksFromBackend() {
  const info = await getJSON('/task/list')

  if (info.status >= 400) {
    return fail(normalizeError(info, 'Failed to load tasks'), info.status)
  }

  const tasks = Array.isArray(info.data?.tasks)
    ? info.data.tasks.map(taskFromBackendPayload)
    : []

  return ok({ tasks: sortTasks(tasks) })
}

export async function taskCreate(input = {}) {
  try {
    const draft = createTaskAssignment(input)
    const payload = taskToBackendPayload(draft)
    const info = await postJSON('/task/create', payload)

    if (info.status >= 400) {
      return fail(normalizeError(info, 'Unable to create task.'), info.status)
    }

    const createdId = info.data?.id

    if (createdId == null) {
      return ok({ task: taskFromBackendPayload({ ...payload, id: draft.id }) })
    }

    const fetched = await fetchTaskById(createdId)
    if (fetched.status_code >= 400) {
      return ok({ task: taskFromBackendPayload({ ...payload, id: createdId }) })
    }

    return fetched
  } catch (error) {
    return fail(error)
  }
}

export async function taskCreateMany(baseInput = {}, assignees = []) {
  try {
    const expanded = expandAssignmentForAssignees(baseInput, assignees)
    const createdTasks = []

    for (const item of expanded) {
      const response = await taskCreate(item)
      if (!response || response.status_code >= 400) {
        return fail(response?.error || 'Unable to create tasks.', response?.status_code || 500, {
          tasks: createdTasks,
        })
      }
      if (response?.data?.task) {
        createdTasks.push(response.data.task)
      }
    }

    return ok({ tasks: createdTasks })
  } catch (error) {
    return fail(error)
  }
}

export async function taskGet(id) {
  try {
    return await fetchTaskById(id)
  } catch (error) {
    return fail(error)
  }
}

export async function taskList(filters = {}) {
  try {
    const response = await fetchAllTasksFromBackend()
    if (response.status_code >= 400) {
      return response
    }

    const tasks = response.data.tasks.filter((item) => matchesFilter(item, filters))
    return ok({ tasks: sortTasks(tasks) })
  } catch (error) {
    return fail(error)
  }
}

export async function taskUpdate(id, changes = {}) {
  try {
    const currentResponse = await taskGet(id)
    if (currentResponse.status_code >= 400) {
      return currentResponse
    }

    const current = currentResponse.data.task
    const updated = buildTaskAssignment({
      ...current,
      ...changes,
      id: current.id,
    })

    const payload = taskToBackendPayload(updated, { includeId: true })
    const info = await postJSON('/task/update/', payload)

    if (info.status >= 400) {
      return fail(normalizeError(info, 'Unable to update task.'), info.status)
    }

    return await taskGet(id)
  } catch (error) {
    return fail(error)
  }
}

export async function taskStart(id, startedAt) {
  try {
    const currentResponse = await taskGet(id)
    if (currentResponse.status_code >= 400) {
      return currentResponse
    }

    const current = currentResponse.data.task
    if (current.useTimer !== true) {
      return fail('Only timed tasks can be started', 400)
    }

    const started = startTaskAssignment(current, startedAt)
    return await taskUpdate(id, started)
  } catch (error) {
    return fail(error)
  }
}

export async function taskToggleChecklistItem(id, itemId, completedAt) {
  try {
    const currentResponse = await taskGet(id)
    if (currentResponse.status_code >= 400) {
      return currentResponse
    }

    const current = currentResponse.data.task
    const updated = toggleTaskAssignmentChecklistItem(current, itemId, completedAt)
    return await taskUpdate(id, updated)
  } catch (error) {
    return fail(error)
  }
}

export async function taskComplete(
  id,
  source = TASK_ASSIGNMENT_COMPLETION_SOURCE.MANUAL,
  completedAt
) {
  try {
    const currentResponse = await taskGet(id)
    if (currentResponse.status_code >= 400) {
      return currentResponse
    }

    const current = currentResponse.data.task
    const completed = completeTaskAssignment(current, source, completedAt)
    return await taskUpdate(id, completed)
  } catch (error) {
    return fail(error)
  }
}

export async function taskDelete(id) {
  try {
    const info = await getJSON(`/task/delete/${encodeURIComponent(String(id))}`)

    if (info.status >= 400) {
      return fail(normalizeError(info, 'Could not delete task.'), info.status)
    }

    return ok({ id: toId(id) })
  } catch (error) {
    return fail(error)
  }
}

export async function taskDeleteMany(filters = {}) {
  try {
    const listed = await taskList(filters)
    if (listed.status_code >= 400) {
      return listed
    }

    const tasks = listed.data.tasks || []
    const deletedIds = []

    for (const task of tasks) {
      const response = await taskDelete(task.id)
      if (!response || response.status_code >= 400) {
        return fail(response?.error || 'Could not delete all tasks.', response?.status_code || 500, {
          deletedCount: deletedIds.length,
          deletedIds,
        })
      }
      deletedIds.push(toId(task.id))
    }

    return ok({
      deletedCount: deletedIds.length,
      deletedIds,
    })
  } catch (error) {
    return fail(error)
  }
}

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
