// Lightweight frontend models for tasks, habits, and user
// These are intentionally small wrappers around plain objects so existing code
// can continue to access properties directly while we get class semantics.

import { updateGameProfile } from "../lib/api/game.js";
import { formatScheduleLabel, REPEAT } from "../lib/schedule.js";

// Helper to derive a human-friendly frequency label from a schedule object, for display purposes.
const deriveFrequencyLabel = (schedule) => {
  if (!schedule) return '';
  switch ((schedule.repeat || '').toUpperCase()) {
    case REPEAT.WEEKDAYS:
      return 'Weekdays';
    case REPEAT.WEEKENDS:
      return 'Weekends';
    case REPEAT.CUSTOM_DOW:
      return formatScheduleLabel(schedule) || 'Custom days';
    case REPEAT.INTERVAL_DAYS:
      return formatScheduleLabel(schedule) || 'Every N days';
    case REPEAT.DAILY:
    default:
      return 'Daily';
  }
};

// Task / Task Assignment constants
// Keep the old export name "Task" so existing imports do not explode.
// But the actual shape is now the new assignment model.

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

// Legacy aliases kept so old imports do not crash.
// Use the TASK_ASSIGNMENT_* constants in new code.
export const TASK_STATUS_PENDING = TASK_ASSIGNMENT_STATUS.PENDING;
export const TASK_STATUS_ACTIVE = TASK_ASSIGNMENT_STATUS.ACTIVE;
export const TASK_STATUS_COMPLETED = TASK_ASSIGNMENT_STATUS.COMPLETED;
export const TASK_STATUS_DONE = TASK_ASSIGNMENT_STATUS.COMPLETED;

// Legacy task type exports kept only for compatibility.
export const TASK_TYPE_SIMPLE = 'assignment';
export const TASK_TYPE_BUILD_HABIT = 'build-habit';
export const TASK_TYPE_BREAK_HABIT = 'break-habit';

//create a Schedule class to clearly define what a schedule looks like.
export class Schedule {
  constructor(props = {}) {
    this.repeat = props.repeat ?? 'DAILY'
    this.daysOfWeek = Array.isArray(props.daysOfWeek) ? props.daysOfWeek.slice() : []
    this.intervalDays = Math.max(1, props.intervalDays || 1)
    this.startDate = props.startDate ?? null
    this.endDate = props.endDate ?? null
  }

  //safely create a Schedule from any input (object, string, etc.)
  static from(obj) {
    if (obj instanceof Schedule) return obj
    if (obj === null || obj === undefined) return null
    if (typeof obj === 'string') {
      try { return new Schedule(JSON.parse(obj)) } catch { return new Schedule({}) }
    }
    return new Schedule(obj || {})
  }

  //make sure we always save or send schedules in the same format.
  toJSON() {
    return {
      repeat: this.repeat,
      daysOfWeek: this.daysOfWeek.slice(),
      intervalDays: this.intervalDays,
      startDate: this.startDate,
      endDate: this.endDate
    }
  }
}

function taskNowIso() {
  return new Date().toISOString();
}

function taskDefaultDueDateISO() {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

function taskToId(value) {
  if (value == null) return '';
  return String(value);
}

function taskToNullableId(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function taskToSafeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function taskToNullableString(value) {
  const str = taskToSafeString(value);
  return str ? str : null;
}

function taskToBool(value) {
  return value === true;
}

function taskToPositiveInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return Math.round(num);
}

function createTaskLocalId(prefix = 'task_assignment') {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

function normalizeTaskRole(role) {
  const safe = taskToSafeString(role).toLowerCase();
  if (safe === TASK_ASSIGNMENT_CREATED_BY_ROLE.PARENT) {
    return TASK_ASSIGNMENT_CREATED_BY_ROLE.PARENT;
  }
  if (safe === TASK_ASSIGNMENT_CREATED_BY_ROLE.PROVIDER) {
    return TASK_ASSIGNMENT_CREATED_BY_ROLE.PROVIDER;
  }
  return TASK_ASSIGNMENT_CREATED_BY_ROLE.USER;
}

function normalizeTaskStatus(status) {
  const safe = taskToSafeString(status).toLowerCase();

  if (safe === TASK_ASSIGNMENT_STATUS.ACTIVE) {
    return TASK_ASSIGNMENT_STATUS.ACTIVE;
  }

  if (
    safe === TASK_ASSIGNMENT_STATUS.COMPLETED ||
    safe === 'done'
  ) {
    return TASK_ASSIGNMENT_STATUS.COMPLETED;
  }

  return TASK_ASSIGNMENT_STATUS.PENDING;
}

function normalizeTaskCompletionSource(source) {
  const safe = taskToSafeString(source).toLowerCase();

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
          id: createTaskLocalId('task_step'),
          label,
          isCompleted: false,
          completedAt: null,
          sortOrder: index,
        };
      }

      if (!item || typeof item !== 'object') return null;

      const label = taskToSafeString(item.label ?? item.title ?? item.text);
      if (!label) return null;

      return {
        id: taskToId(item.id) || createTaskLocalId('task_step'),
        label,
        isCompleted: taskToBool(item.isCompleted),
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
  const incomingMeta =
    data.meta && typeof data.meta === 'object' && !Array.isArray(data.meta)
      ? { ...data.meta }
      : {};

  const useTimer = taskToBool(data.useTimer);
  const checklist = normalizeChecklistItems(
    data.checklist ?? data.steps ?? []
  );

  const schedule = Schedule.from(data.schedule ?? data.frequency ?? incomingMeta.schedule);
  const scheduleJson = schedule ? schedule.toJSON() : null;

  let completedDates;
  if (data.completedDates && typeof data.completedDates === 'object' && !Array.isArray(data.completedDates)) {
    completedDates = { ...data.completedDates };
  } else if (Array.isArray(data.completedDates)) {
    completedDates = data.completedDates.slice();
  } else {
    completedDates = {};
  }

  const status = normalizeTaskStatus(data.status);
  const completionSource =
    status === TASK_ASSIGNMENT_STATUS.COMPLETED
      ? normalizeTaskCompletionSource(data.completionSource)
      : null;

  const normalized = {
    id: taskToId(data.id) || createTaskLocalId('task_assignment'),

    title: taskToSafeString(data.title) || 'Untitled task',
    note: taskToSafeString(data.note ?? data.notes),

    linkedActionPlanId: taskToNullableId(
      data.linkedActionPlanId ?? data.actionPlanId
    ),
    linkedGoalId: taskToNullableId(
      data.linkedGoalId ?? data.goalId
    ),

    assigneeId: taskToId(data.assigneeId),
    assigneeName: taskToSafeString(data.assigneeName),

    createdById: taskToId(data.createdById),
    createdByName: taskToSafeString(data.createdByName),
    createdByRole: normalizeTaskRole(data.createdByRole),

    useTimer,
    durationMinutes: useTimer ? taskToPositiveInt(data.durationMinutes) : null,

    checklist,

    status,
    completionSource,

    sentAt: data.sentAt || data.createdAt || taskNowIso(),
    startedAt: data.startedAt || null,
    completedAt: data.completedAt || null,

    dueDateISO: taskToNullableString(data.dueDateISO) || taskDefaultDueDateISO(),

    // Compatibility fields so older UI does not instantly break
    notes: taskToSafeString(data.note ?? data.notes),
    steps: checklist.map((item) => ({
      id: item.id,
      label: item.label,
      isCompleted: item.isCompleted,
      completedAt: item.completedAt,
      sortOrder: item.sortOrder,
    })),
    taskType: 'assignment',
    childCode: 0,
    habitToBreak: taskToSafeString(data.habitToBreak),
    replacements: Array.isArray(data.replacements) ? data.replacements.slice() : [],
    streak: Number(data.streak ?? 0) || 0,
    completedDates,
    schedule: scheduleJson,
    frequency: scheduleJson,
    frequencyLabel: deriveFrequencyLabel(scheduleJson),
    completionLog: data.completionLog ?? incomingMeta.completionLog ?? {},
    stats: data.stats ?? incomingMeta.stats ?? {},
    timeOfDay: taskToSafeString(data.timeOfDay ?? incomingMeta.timeOfDay),
    lastCompletedOn: data.lastCompletedOn ?? incomingMeta.lastCompletedOn ?? null,
    needsApproval: taskToBool(data.needsApproval),
    targetType: data.targetType ?? null,
    targetName: data.targetName ?? null,
    createdAt: data.createdAt || data.sentAt || taskNowIso(),

    meta: { ...incomingMeta },
  };

  Object.keys(data).forEach((key) => {
    if (!(key in normalized)) normalized.meta[key] = data[key];
  });

  return normalized;
}

export function createTaskAssignment(data = {}) {
  return buildTaskAssignment({
    ...data,
    status: TASK_ASSIGNMENT_STATUS.PENDING,
    completionSource: null,
    startedAt: null,
    completedAt: null,
    sentAt: data.sentAt || taskNowIso(),
  });
}

export function canStartTaskAssignment(task) {
  if (!task) return false;
  const normalized = buildTaskAssignment(task);
  if (normalized.useTimer !== true) return false;
  return normalized.status === TASK_ASSIGNMENT_STATUS.PENDING;
}

export function canCompleteTaskAssignment(task) {
  if (!task) return false;
  const normalized = buildTaskAssignment(task);
  return normalized.status !== TASK_ASSIGNMENT_STATUS.COMPLETED;
}

export function startTaskAssignment(task, startedAt = taskNowIso()) {
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
  completedAt = taskNowIso()
) {
  const normalized = buildTaskAssignment(task);

  if (!canCompleteTaskAssignment(normalized)) {
    return normalized;
  }

  const normalizedSource =
    normalizeTaskCompletionSource(source) ||
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
  completedAt = taskNowIso()
) {
  const normalized = buildTaskAssignment(task);
  const targetId = taskToId(itemId);

  const checklist = normalized.checklist.map((item) => {
    if (taskToId(item.id) !== targetId) return item;

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
        const assigneeId = taskToId(assignee);
        if (!assigneeId) return null;

        return createTaskAssignment({
          ...baseAssignment,
          assigneeId,
          assigneeName: '',
        });
      }

      const assigneeId = taskToId(
        assignee.id ?? assignee.assigneeId ?? assignee.userId
      );
      if (!assigneeId) return null;

      const assigneeName = taskToSafeString(
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

// For each model class, we allow constructing from a plain object with flexible field names, and we provide a toJSON method that returns a clean plain object for serialization. The meta field can be used to store any additional data that doesn't fit into the defined properties, without losing it during normalization.
export class Task {
  constructor(props = {}) {
    const normalized = buildTaskAssignment(props);
    Object.assign(this, normalized);
  }

  static from(obj) {
    if (obj instanceof Task) return obj;
    return new Task(obj || {});
  }

  toJSON() {
    return {
      id: this.id,
      assigneeId: this.assigneeId,
      assigneeName: this.assigneeName,
      childCode: this.childCode,
      title: this.title,
      note: this.note,
      notes: this.notes,
      taskType: this.taskType,
      checklist: Array.isArray(this.checklist)
        ? this.checklist.map((item) => ({ ...item }))
        : [],
      steps: Array.isArray(this.steps)
        ? this.steps.map((item) => ({ ...item }))
        : [],
      linkedActionPlanId: this.linkedActionPlanId,
      linkedGoalId: this.linkedGoalId,
      useTimer: this.useTimer,
      durationMinutes: this.durationMinutes,
      completionSource: this.completionSource,
      sentAt: this.sentAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      dueDateISO: this.dueDateISO,
      habitToBreak: this.habitToBreak,
      replacements: this.replacements.slice(),
      frequency: this.frequency,
      frequencyLabel: this.frequencyLabel,
      streak: this.streak,
      completedDates: Array.isArray(this.completedDates)
        ? this.completedDates.slice()
        : { ...(this.completedDates || {}) },
      schedule: this.schedule,
      completionLog: { ...(this.completionLog || {}) },
      stats: { ...(this.stats || {}) },
      timeOfDay: this.timeOfDay,
      lastCompletedOn: this.lastCompletedOn,
      status: this.status,
      createdAt: this.createdAt,
      createdById: this.createdById,
      createdByName: this.createdByName,
      createdByRole: this.createdByRole,
      needsApproval: this.needsApproval,
      targetType: this.targetType,
      targetName: this.targetName,
      meta: { ...(this.meta || {}) },
    };
  }
}

export class BuildHabit {
  constructor(props = {}) {
    this.id = props.id ?? null;
    this.account_id = props.account_id ?? null;
    this.goal = props.goal ?? '';
    this.cue = props.cue ?? '';
    this.steps = Array.isArray(props.steps) ? props.steps.slice() : [];
    this.schedule = Schedule.from(props.schedule);
    this.savedOn = props.savedOn ?? null;
    this.reward = props.reward ?? '';
  }

  static from(obj) {
    if (obj instanceof BuildHabit) return obj;
    return new BuildHabit(obj || {});
  }

  toJSON() {
    return {
      id: this.id,
      account_id: this.account_id,
      goal: this.goal,
      cue: this.cue,
      steps: this.steps.slice(),
      schedule: this.schedule ? this.schedule.toJSON() : null,
      savedOn: this.savedOn,
      reward: this.reward
    };
  }
}

export class BreakHabit {
  constructor(props = {}) {
    this.id = props.id ?? null;
    this.account_id = props.account_id ?? null;
    this.habit = props.habit ?? '';
    this.replacements = Array.isArray(props.replacements) ? props.replacements.slice() : [];
    this.microSteps = Array.isArray(props.microSteps) ? props.microSteps.slice() : [];
    this.savedOn = props.savedOn ?? null;
    this.schedule = Schedule.from(props.schedule);
    this.reward = props.reward ?? '';
  }

  static from(obj) {
    if (obj instanceof BreakHabit) return obj;
    return new BreakHabit(obj || {});
  }

  toJSON() {
    return {
      id: this.id,
      account_id: this.account_id,
      habit: this.habit,
      replacements: this.replacements.slice(),
      microSteps: this.microSteps.slice(),
      savedOn: this.savedOn,
      schedule: this.schedule ? this.schedule.toJSON() : null,
      reward: this.reward
    };
  }
}

export class FormedHabit {
  constructor(props = {}) {
    this.id = props.id ?? String(Date.now());
    this.userId = props.userId ?? null;
    this.title = props.title ?? '';
    this.type = props.type ?? 'build';
    this.createdAt = props.createdAt ?? new Date().toISOString();
    this.details = props.details ?? null;
    this.completedAt = props.completedAt ?? null;

    this.meta = props.meta && typeof props.meta === 'object' && !Array.isArray(props.meta)
      ? { ...props.meta }
      : {};
    Object.keys(props).forEach((k) => { if (!(k in this)) this.meta[k] = props[k]; });
  }

  static from(obj) {
    if (obj instanceof FormedHabit) return obj;
    return new FormedHabit(obj || {});
  }

  toJSON() {
    const out = {
      id: this.id,
      userId: this.userId,
      title: this.title,
      type: this.type,
      createdAt: this.createdAt,
      details: this.details,
      completedAt: this.completedAt,
      meta: { ...(this.meta || {}) },
    };
    Object.keys(this.meta || {}).forEach((k) => { out[k] = this.meta[k]; });
    return out;
  }
}

// New Goal model — light wrapper/normalizer for goal objects used by goals.js and UI components
export class Goal {
  constructor(props = {}) {
    // identity
    this.id = props.id ?? props.goalId ?? null;

    // primary display/title fields (components sometimes use title, goal, or name)
    this.title = props.title ?? props.goalTitle ?? props.goal ?? props.name ?? '';
    this.goal = props.goal ?? props.title ?? this.title;

    // type / classification
    this.type = props.type ?? props.goalType ?? props.taskType ?? 'goal';

    // assignee / owner fields (code uses a few different names across the app)
    this.assigneeId = props.assigneeId ?? props.assignee ?? props.assignedToId ?? null;
    this.assigneeName = props.assigneeName ?? props.assignedToName ?? props.ownerName ?? props.assignee ?? '';

    // window / dates
    this.startDate = props.startDate ?? props.start ?? props.createdAt ?? null;
    this.endDate = props.endDate ?? props.end ?? null;

    // reward / savings
    this.savingFor = props.savingFor ?? null;
    this.rewardGoalTitle = props.rewardGoalTitle ?? null;
    this.rewardGoalCostCoins = props.rewardGoalCostCoins ?? null;

    // supportive fields used by GoalCard and wizard
    this.triggers = Array.isArray(props.triggers) ? props.triggers.slice() : (props.triggers ? [props.triggers] : []);
    this.replacements = Array.isArray(props.replacements) ? props.replacements.slice() : (props.replacements ? [props.replacements] : []);
    this.makeItEasier = Array.isArray(props.makeItEasier) ? props.makeItEasier.slice() : (props.makeItEasier ? [props.makeItEasier] : []);
    this.location = props.location ?? null;

    // metadata about creation/ownership
    this.createdAt = props.createdAt ?? new Date().toISOString();
    this.createdById = props.createdById ?? props.ownerId ?? null;
    this.createdByName = props.createdByName ?? props.ownerName ?? '';
    this.createdByRole = props.createdByRole ?? null;

    // keep any extra fields in meta to avoid dropping unknowns
    this.meta = props.meta && typeof props.meta === 'object' && !Array.isArray(props.meta)
      ? { ...props.meta }
      : {};
    Object.keys(props).forEach((k) => { if (!(k in this)) this.meta[k] = props[k]; });
  }

  static from(obj) {
    if (obj instanceof Goal) return obj;
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string') {
      try { return new Goal(JSON.parse(obj)); } catch { return new Goal({}); }
    }
    return new Goal(obj || {});
  }

  toJSON() {
    const out = {
      id: this.id,
      title: this.title,
      goal: this.goal,
      type: this.type,
      assigneeId: this.assigneeId,
      assigneeName: this.assigneeName,
      startDate: this.startDate,
      endDate: this.endDate,
      savingFor: this.savingFor,
      rewardGoalTitle: this.rewardGoalTitle,
      rewardGoalCostCoins: this.rewardGoalCostCoins,
      triggers: Array.isArray(this.triggers) ? this.triggers.slice() : [],
      replacements: Array.isArray(this.replacements) ? this.replacements.slice() : [],
      makeItEasier: Array.isArray(this.makeItEasier) ? this.makeItEasier.slice() : [],
      location: this.location,
      createdAt: this.createdAt,
      createdById: this.createdById,
      createdByName: this.createdByName,
      createdByRole: this.createdByRole,
      meta: { ...(this.meta || {}) },
    };
    Object.keys(this.meta || {}).forEach((k) => { out[k] = this.meta[k]; });
    return out;
  }
}

export class User {
  constructor(props = {}) {
    this.id = props.id ?? props.user_id ?? null;
    this.username = props.username ?? '';
    this.email = props.email ?? '';
    this.name = props.name ?? props.fullName ?? '';
    this.age = props.age ?? null;
    this.role = props.role ?? props.type ?? 'user';
    this.createdAt = props.createdAt ?? null;
    this.type = this.role;
    this.themeMode = props.themeMode ?? (props.theme === 'dark' ? 'dark' : 'light');
    this.theme = this.themeMode;
    this.palette = null;
    this.profilePic = props.profilePic ?? '';
    this.stats = props.stats ?? {};
    this.code = props.code ?? null;

    this.meta = props.meta && typeof props.meta === 'object' && !Array.isArray(props.meta)
      ? { ...props.meta }
      : {};
    Object.keys(props).forEach((k) => { if (!(k in this)) this.meta[k] = props[k]; });
  }

  static from(obj) {
    if (obj instanceof User) return obj;
    return new User(obj || {});
  }

  toJSON() {
    const out = {
      id: this.id,
      username: this.username,
      email: this.email,
      name: this.name,
      age: this.age,
      role: this.role,
      createdAt: this.createdAt,
      type: this.type,
      theme: this.themeMode,
      themeMode: this.themeMode,
      profilePic: this.profilePic,
      stats: this.stats,
      code: this.code,
    };
    Object.keys(this.meta || {}).forEach((k) => { out[k] = this.meta[k]; });
    return out;
  }
}

export class Child {
  constructor(props = {}) {
    this.parentId = props.parentId ?? null;
    this.id = props.id ?? null;
    this.name = props.name ?? '';
    this.username = props.username ?? '';
    this.code = props.code ?? '';
    this.age = props.age ?? null;
    this.createdAt = props.createdAt ?? null;
    this.theme = props.theme ?? 'pink';
  }

  static from(obj) {
    if (obj instanceof Child) return obj;
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string') {
      try { return new Child(JSON.parse(obj)); }
      catch { return new Child({}); }
    }
    return new Child(obj || {});
  }

  toJSON() {
    return {
      parentId: this.parentId,
      id: this.id,
      name: this.name,
      username: this.username,
      code: this.code,
      age: this.age,
      createdAt: this.createdAt,
      theme: this.theme,
    };
  }
}

export class GameProfile {
  constructor(props = {}) {
    this.id = props.id ?? null;
    this.coins = props.coins ?? 0;

    let inventory = props.inventory;

    if (typeof inventory === "string") {
      try {
        inventory = JSON.parse(inventory || "[]");
      } catch {
        console.error("Inventory parse failed:", inventory);
        inventory = [];
      }
    }

    this.inventory = Array.isArray(inventory)
      ? inventory.slice()
      : [];

    const rawMeta = props.meta && typeof props.meta === 'object' && !Array.isArray(props.meta)
      ? { ...props.meta }
      : {};

    const earnedBadges = Array.isArray(props.earnedBadges)
      ? props.earnedBadges.slice()
      : Array.isArray(rawMeta.earnedBadges)
        ? rawMeta.earnedBadges.slice()
        : [];

    const badgeEarnedDates =
      props.badgeEarnedDates &&
      typeof props.badgeEarnedDates === 'object' &&
      !Array.isArray(props.badgeEarnedDates)
        ? { ...props.badgeEarnedDates }
        : rawMeta.badgeEarnedDates &&
          typeof rawMeta.badgeEarnedDates === 'object' &&
          !Array.isArray(rawMeta.badgeEarnedDates)
          ? { ...rawMeta.badgeEarnedDates }
          : {};

    this.meta = {
      ...rawMeta,
      earnedBadges,
      badgeEarnedDates,
    };
  }

  async setCoinCount(newCoins) {
    this.coins = newCoins;
    await updateGameProfile({
      coins: this.coins,
    })
  }

  async addToInventory(item, equipped = false) {
    this.inventory.push({
      id: item.id,
      equipped,
    })
    await updateGameProfile({
      inventory: this.inventory,
    })
  }

  async toggleItem(itemId) {
    this.inventory = this.inventory.map((field) => {
      if (field.id === itemId) {
        return { ...field, equipped: !field.equipped };
      }
      return field;
    });
    await updateGameProfile({
      inventory: this.inventory,
    })
  }

  static from(obj) {
    if (obj instanceof GameProfile) return obj;
    return new GameProfile(obj || {});
  }

  toJSON() {
    const safeMeta =
      this.meta && typeof this.meta === 'object' && !Array.isArray(this.meta)
        ? { ...this.meta }
        : {};

    return {
      id: this.id,
      coins: this.coins,
      inventory: this.inventory.map((field) => ({
        id: field.id,
        equipped: field.equipped,
        color: field.color ?? 1,
      })),
      meta: {
        ...safeMeta,
        earnedBadges: Array.isArray(safeMeta.earnedBadges)
          ? safeMeta.earnedBadges.slice()
          : [],
        badgeEarnedDates:
          safeMeta.badgeEarnedDates &&
          typeof safeMeta.badgeEarnedDates === 'object' &&
          !Array.isArray(safeMeta.badgeEarnedDates)
            ? { ...safeMeta.badgeEarnedDates }
            : {},
      },
    };
  }
}

export class GameItem {
  constructor(props = {}) {
    this.id = props.id ?? null;
    this.name = props.name ?? '';
    this.path = props.path ?? '';
    this.price = props.price ?? 0;
    this.placement = props.placement ?? null;
    this.type = props.type ?? null;
  }

  static from(obj) {
    if (obj instanceof GameItem) return obj;
    return new GameItem(obj || {});
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      path: this.path,
      price: this.price,
      placement: this.placement,
      type: this.type,
    };
  }
}

function normalizeActionPlanTaskType(value) {
  const raw = String(value || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (raw.includes('break')) return TASK_TYPE_BREAK_HABIT;
  if (raw.includes('build')) return TASK_TYPE_BUILD_HABIT;
  return value ?? null;
}

export class ActionPlan {
  constructor(props = {}) {
    const p = props || {};
    const meta =
      p.meta && typeof p.meta === 'object' && !Array.isArray(p.meta)
        ? { ...p.meta }
        : {};

    this.id = p.id ?? p.planId ?? p._id ?? null;
    this.goalId = p.goalId ?? p.goal_id ?? p.goal ?? null;
    this.title = p.title ?? p.name ?? '';
    this.taskType = normalizeActionPlanTaskType(p.taskType ?? p.type ?? meta.taskType ?? meta.type ?? null);
    this.notes = p.notes ?? p.description ?? '';
    this.assigneeId = p.assigneeId ?? p.assignee ?? (p.assignedToId ?? null);
    if (this.assigneeId != null) this.assigneeId = String(this.assigneeId);
    this.assigneeName = p.assigneeName ?? p.assignedToName ?? p.ownerName ?? '';

    this.schedule = p.schedule ?? p.frequency ?? null;
    this.frequency = this.schedule;
    this.frequencyLabel =
      p.frequencyLabel ??
      (this.schedule
        ? typeof this.schedule === 'object'
          ? this.schedule.label || null
          : String(this.schedule)
        : '');
    this.cue = p.cue ?? meta.cue ?? '';
    this.cuePreset = p.cuePreset ?? meta.cuePreset ?? '';
    this.cueLabel = p.cueLabel ?? meta.cueLabel ?? '';
    this.cueDetail = p.cueDetail ?? meta.cueDetail ?? '';
    this.timeOfDay = p.timeOfDay ?? meta.timeOfDay ?? '';

    if (p.completedDates && typeof p.completedDates === 'object' && !Array.isArray(p.completedDates)) {
      this.completedDates = { ...p.completedDates };
    } else {
      this.completedDates = {};
    }

    this.streak = Number(p.streak ?? meta.currentStreak ?? 0) || 0;
    this.currentStreak = Number(p.currentStreak ?? meta.currentStreak ?? this.streak ?? 0) || 0;
    this.bestStreak = Number(p.bestStreak ?? meta.bestStreak ?? 0) || 0;

    this.totalCompletions =
      Number(
        p.totalCompletions ??
        meta.totalCompletions ??
        Object.keys(this.completedDates).filter((d) => this.completedDates[d] === true).length
      ) || 0;

    this.earnedBadges = Array.isArray(p.earnedBadges)
      ? [...p.earnedBadges]
      : Array.isArray(meta.earnedBadges)
        ? [...meta.earnedBadges]
        : [];

    this.awardedMilestones = Array.isArray(p.awardedMilestones)
      ? [...p.awardedMilestones]
      : Array.isArray(meta.awardedMilestones)
        ? [...meta.awardedMilestones]
        : [];

    this.badgeEarnedDates =
      p.badgeEarnedDates && typeof p.badgeEarnedDates === 'object' && !Array.isArray(p.badgeEarnedDates)
        ? { ...p.badgeEarnedDates }
        : meta.badgeEarnedDates && typeof meta.badgeEarnedDates === 'object' && !Array.isArray(meta.badgeEarnedDates)
          ? { ...meta.badgeEarnedDates }
          : {};

    this.rewardedCompletionDates =
      p.rewardedCompletionDates &&
      typeof p.rewardedCompletionDates === 'object' &&
      !Array.isArray(p.rewardedCompletionDates)
        ? { ...p.rewardedCompletionDates }
        : meta.rewardedCompletionDates &&
          typeof meta.rewardedCompletionDates === 'object' &&
          !Array.isArray(meta.rewardedCompletionDates)
          ? { ...meta.rewardedCompletionDates }
          : {};

    this.createdAt = p.createdAt ?? new Date().toISOString();
    this.createdById = p.createdById ?? p.ownerId ?? null;
    this.createdByName = p.createdByName ?? p.ownerName ?? '';
    this.createdByRole = p.createdByRole ?? null;

    this.meta = {
      ...meta,
      taskType: this.taskType,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      totalCompletions: this.totalCompletions,
      earnedBadges: [...this.earnedBadges],
      awardedMilestones: [...this.awardedMilestones],
      badgeEarnedDates: { ...this.badgeEarnedDates },
      rewardedCompletionDates: { ...this.rewardedCompletionDates },
    };

    Object.keys(p).forEach((k) => {
      if (!(k in this)) this.meta[k] = p[k];
    });
  }

  static from(obj) {
    if (obj instanceof ActionPlan) return obj;
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string') {
      try { return new ActionPlan(JSON.parse(obj)); } catch { return new ActionPlan({}); }
    }
    return new ActionPlan(obj || {});
  }

  toJSON() {
    const out = {
      id: this.id,
      goalId: this.goalId,
      title: this.title,
      taskType: this.taskType,
      notes: this.notes,
      assigneeId: this.assigneeId,
      assigneeName: this.assigneeName,
      schedule: this.schedule,
      frequency: this.frequency,
      frequencyLabel: this.frequencyLabel,
      cue: this.cue,
      cuePreset: this.cuePreset,
      cueLabel: this.cueLabel,
      cueDetail: this.cueDetail,
      timeOfDay: this.timeOfDay,
      completedDates: { ...(this.completedDates || {}) },
      streak: this.streak,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      totalCompletions: this.totalCompletions,
      earnedBadges: Array.isArray(this.earnedBadges) ? [...this.earnedBadges] : [],
      awardedMilestones: Array.isArray(this.awardedMilestones) ? [...this.awardedMilestones] : [],
      badgeEarnedDates: { ...(this.badgeEarnedDates || {}) },
      rewardedCompletionDates: { ...(this.rewardedCompletionDates || {}) },
      createdAt: this.createdAt,
      createdById: this.createdById,
      createdByName: this.createdByName,
      createdByRole: this.createdByRole,
      meta: {
        ...(this.meta || {}),
        cue: this.cue,
        cuePreset: this.cuePreset,
        cueLabel: this.cueLabel,
        cueDetail: this.cueDetail,
        taskType: this.taskType,
        timeOfDay: this.timeOfDay,
        currentStreak: this.currentStreak,
        bestStreak: this.bestStreak,
        totalCompletions: this.totalCompletions,
        earnedBadges: Array.isArray(this.earnedBadges) ? [...this.earnedBadges] : [],
        awardedMilestones: Array.isArray(this.awardedMilestones) ? [...this.awardedMilestones] : [],
        badgeEarnedDates: { ...(this.badgeEarnedDates || {}) },
        rewardedCompletionDates: { ...(this.rewardedCompletionDates || {}) },
      },
    };

    Object.keys(this.meta || {}).forEach((k) => {
      out[k] = this.meta[k];
    });

    return out;
  }
}

export default {
  Task,
  BuildHabit,
  BreakHabit,
  FormedHabit,
  Goal,
  ActionPlan,
  User,
  Child,
};
