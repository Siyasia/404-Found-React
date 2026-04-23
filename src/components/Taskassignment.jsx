// src/models/taskAssignment.js

export const TASK_ASSIGNMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
});

export const TASK_ASSIGNMENT_COMPLETION_SOURCE = Object.freeze({
  MANUAL: 'manual',
  TIMER: 'timer',
  CHECKLIST: 'checklist',
});

export const TASK_ASSIGNMENT_CREATED_BY_ROLE = Object.freeze({
  USER: 'user',
  PARENT: 'parent',
  PROVIDER: 'provider',
});

function nowIso() {
  return new Date().toISOString();
}

function toId(value) {
  if (value == null) return '';
  return String(value);
}

function toNullableId(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function toSafeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function toNullableString(value) {
  const str = toSafeString(value);
  return str ? str : null;
}

function toBool(value) {
  return value === true;
}

function toPositiveInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return Math.round(num);
}

function createId(prefix = 'task') {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

function normalizeRole(role) {
  const safe = toSafeString(role).toLowerCase();
  if (safe === TASK_ASSIGNMENT_CREATED_BY_ROLE.PARENT) {
    return TASK_ASSIGNMENT_CREATED_BY_ROLE.PARENT;
  }
  if (safe === TASK_ASSIGNMENT_CREATED_BY_ROLE.PROVIDER) {
    return TASK_ASSIGNMENT_CREATED_BY_ROLE.PROVIDER;
  }
  return TASK_ASSIGNMENT_CREATED_BY_ROLE.USER;
}

function normalizeStatus(status) {
  const safe = toSafeString(status).toLowerCase();
  if (safe === TASK_ASSIGNMENT_STATUS.ACTIVE) {
    return TASK_ASSIGNMENT_STATUS.ACTIVE;
  }
  if (safe === TASK_ASSIGNMENT_STATUS.COMPLETED) {
    return TASK_ASSIGNMENT_STATUS.COMPLETED;
  }
  return TASK_ASSIGNMENT_STATUS.PENDING;
}

function normalizeCompletionSource(source) {
  const safe = toSafeString(source).toLowerCase();
  if (safe === TASK_ASSIGNMENT_COMPLETION_SOURCE.MANUAL) {
    return TASK_ASSIGNMENT_COMPLETION_SOURCE.MANUAL;
  }
  if (safe === TASK_ASSIGNMENT_COMPLETION_SOURCE.TIMER) {
    return TASK_ASSIGNMENT_COMPLETION_SOURCE.TIMER;
  }
  if (safe === TASK_ASSIGNMENT_COMPLETION_SOURCE.CHECKLIST) {
    return TASK_ASSIGNMENT_COMPLETION_SOURCE.CHECKLIST;
  }
  return null;
}

export function normalizeChecklistItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      if (typeof item === 'string') {
        const label = item.trim();
        if (!label) return null;

        return {
          id: createId('task_step'),
          label,
          isCompleted: false,
          completedAt: null,
          sortOrder: index,
        };
      }

      if (!item || typeof item !== 'object') return null;

      const label = toSafeString(item.label ?? item.title ?? item.text);
      if (!label) return null;

      return {
        id: toId(item.id) || createId('task_step'),
        label,
        isCompleted: toBool(item.isCompleted),
        completedAt: item.completedAt || null,
        sortOrder: Number.isFinite(Number(item.sortOrder))
          ? Number(item.sortOrder)
          : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index,
    }));
}

export function isChecklistComplete(checklist = []) {
  if (!Array.isArray(checklist) || checklist.length === 0) return false;
  return checklist.every((item) => item?.isCompleted === true);
}

export function buildTaskAssignment(data = {}) {
  const useTimer = toBool(data.useTimer);
  const checklist = normalizeChecklistItems(data.checklist);

  const status = normalizeStatus(data.status);
  const completionSource =
    status === TASK_ASSIGNMENT_STATUS.COMPLETED
      ? normalizeCompletionSource(data.completionSource)
      : null;

  return {
    id: toId(data.id) || createId('task_assignment'),
    title: toSafeString(data.title) || 'Untitled task',
    note: toSafeString(data.note),

    linkedActionPlanId: toNullableId(data.linkedActionPlanId),
    linkedGoalId: toNullableId(data.linkedGoalId),

    assigneeId: toId(data.assigneeId),
    assigneeName: toSafeString(data.assigneeName),

    createdById: toId(data.createdById),
    createdByName: toSafeString(data.createdByName),
    createdByRole: normalizeRole(data.createdByRole),

    useTimer,
    durationMinutes: useTimer ? toPositiveInt(data.durationMinutes) : null,

    checklist,

    status,
    completionSource,

    sentAt: data.sentAt || nowIso(),
    startedAt: data.startedAt || null,
    completedAt: data.completedAt || null,

    dueDateISO: toNullableString(data.dueDateISO),
  };
}

export function createTaskAssignment(data = {}) {
  return buildTaskAssignment({
    ...data,
    status: TASK_ASSIGNMENT_STATUS.PENDING,
    completionSource: null,
    startedAt: null,
    completedAt: null,
    sentAt: data.sentAt || nowIso(),
  });
}

export function canStartTaskAssignment(task) {
  if (!task) return false;
  if (task.useTimer !== true) return false;
  return task.status === TASK_ASSIGNMENT_STATUS.PENDING;
}

export function canCompleteTaskAssignment(task) {
  if (!task) return false;
  return task.status !== TASK_ASSIGNMENT_STATUS.COMPLETED;
}

export function startTaskAssignment(task, startedAt = nowIso()) {
  const normalized = buildTaskAssignment(task);

  if (!canStartTaskAssignment(normalized)) {
    return normalized;
  }

  return buildTaskAssignment({
    ...normalized,
    status: TASK_ASSIGNMENT_STATUS.ACTIVE,
    startedAt,
    completedAt: null,
    completionSource: null,
  });
}

export function completeTaskAssignment(
  task,
  source = TASK_ASSIGNMENT_COMPLETION_SOURCE.MANUAL,
  completedAt = nowIso()
) {
  const normalized = buildTaskAssignment(task);

  if (!canCompleteTaskAssignment(normalized)) {
    return normalized;
  }

  const normalizedSource =
    normalizeCompletionSource(source) ||
    TASK_ASSIGNMENT_COMPLETION_SOURCE.MANUAL;

  return buildTaskAssignment({
    ...normalized,
    status: TASK_ASSIGNMENT_STATUS.COMPLETED,
    completionSource: normalizedSource,
    completedAt,
    startedAt:
      normalized.startedAt ||
      (normalized.useTimer ? completedAt : null),
  });
}

export function toggleTaskAssignmentChecklistItem(
  task,
  itemId,
  completedAt = nowIso()
) {
  const normalized = buildTaskAssignment(task);
  const targetId = toId(itemId);

  const checklist = normalized.checklist.map((item) => {
    if (toId(item.id) !== targetId) return item;

    const nextCompleted = !item.isCompleted;
    return {
      ...item,
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? completedAt : null,
    };
  });

  const nextTask = buildTaskAssignment({
    ...normalized,
    checklist,
  });

  if (isChecklistComplete(nextTask.checklist)) {
    return completeTaskAssignment(
      nextTask,
      TASK_ASSIGNMENT_COMPLETION_SOURCE.CHECKLIST,
      completedAt
    );
  }

  return nextTask;
}

export function expandAssignmentForAssignees(baseAssignment = {}, assignees = []) {
  const safeAssignees = Array.isArray(assignees) ? assignees : [];

  return safeAssignees
    .map((assignee) => {
      if (!assignee) return null;

      if (typeof assignee === 'string' || typeof assignee === 'number') {
        const assigneeId = toId(assignee);
        if (!assigneeId) return null;

        return createTaskAssignment({
          ...baseAssignment,
          assigneeId,
          assigneeName: '',
        });
      }

      const assigneeId = toId(assignee.id ?? assignee.assigneeId ?? assignee.userId);
      if (!assigneeId) return null;

      const assigneeName = toSafeString(
        assignee.name ?? assignee.assigneeName ?? assignee.displayName
      );

      return createTaskAssignment({
        ...baseAssignment,
        assigneeId,
        assigneeName,
      });
    })
    .filter(Boolean);
}

export function isTimedTaskAssignment(task) {
  return buildTaskAssignment(task).useTimer === true;
}

export function isUntimedTaskAssignment(task) {
  return !isTimedTaskAssignment(task);
}

export function isPendingTaskAssignment(task) {
  return buildTaskAssignment(task).status === TASK_ASSIGNMENT_STATUS.PENDING;
}

export function isActiveTaskAssignment(task) {
  return buildTaskAssignment(task).status === TASK_ASSIGNMENT_STATUS.ACTIVE;
}

export function isCompletedTaskAssignment(task) {
  return buildTaskAssignment(task).status === TASK_ASSIGNMENT_STATUS.COMPLETED;
}

export function isTaskAssignmentLinked(task) {
  const normalized = buildTaskAssignment(task);
  return Boolean(normalized.linkedActionPlanId);
}

export default {
  TASK_ASSIGNMENT_STATUS,
  TASK_ASSIGNMENT_COMPLETION_SOURCE,
  TASK_ASSIGNMENT_CREATED_BY_ROLE,
  normalizeChecklistItems,
  isChecklistComplete,
  buildTaskAssignment,
  createTaskAssignment,
  canStartTaskAssignment,
  canCompleteTaskAssignment,
  startTaskAssignment,
  completeTaskAssignment,
  toggleTaskAssignmentChecklistItem,
  expandAssignmentForAssignees,
  isTimedTaskAssignment,
  isUntimedTaskAssignment,
  isPendingTaskAssignment,
  isActiveTaskAssignment,
  isCompletedTaskAssignment,
  isTaskAssignmentLinked,
};