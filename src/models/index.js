// Lightweight frontend models for tasks, habits, and user
// These are intentionally small wrappers around plain objects so existing code
// can continue to access properties directly while we get class semantics.

// Task type constants
export const TASK_TYPE_SIMPLE = 'simple';
export const TASK_TYPE_BUILD_HABIT = 'build-habit';
export const TASK_TYPE_BREAK_HABIT = 'break-habit';

// Task status constants
export const TASK_STATUS_PENDING = 'pending';
export const TASK_STATUS_DONE = 'done'

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

export class Task {
  constructor(props = {}) {
    // assign all known properties so code can read t.title, t.status, etc.
    this.id = props.id ?? String(Date.now());
    this.assigneeId = props.assigneeId ?? null;
    this.assigneeName = props.assigneeName ?? '';
    this.childCode = props.childCode ?? '';
    this.title = props.title ?? '';
    this.notes = props.notes ?? '';
    this.taskType = props.taskType ?? 'simple';
    this.steps = Array.isArray(props.steps) ? props.steps.slice() : [];
    this.habitToBreak = props.habitToBreak ?? '';
    this.replacements = Array.isArray(props.replacements) ? props.replacements.slice() : [];
    this.frequency = props.frequency ?? null;
    this.streak = props.streak ?? 0;
    this.completedDates = Array.isArray(props.completedDates) ? props.completedDates.slice() : [];
    this.schedule = Schedule.from(props.schedule);
    this.lastCompletedOn = props.lastCompletedOn ?? null;
    this.status = props.status ?? 'pending';
    this.createdAt = props.createdAt ?? new Date().toISOString();
    this.createdById = props.createdById ?? null;
    this.createdByName = props.createdByName ?? '';
    this.createdByRole = props.createdByRole ?? '';
    // common optional/extra properties made explicit
    this.needsApproval = props.needsApproval ?? false;
    this.targetType = props.targetType ?? null; // 'child' | 'adult' | null
    this.targetName = props.targetName ?? null;

    // container for any other arbitrary keys not part of the explicit model
    this.meta = {};
    Object.keys(props).forEach((k) => {
      if (!(k in this)) this.meta[k] = props[k];
    });
  }

  static from(obj) {
    if (obj instanceof Task) return obj;
    return new Task(obj || {});
  }

  toJSON() {
    // produce a plain object that preserves previous top-level shape while
    // also including meta keys flattened for backward compatibility
    const out = {
      id: this.id,
      assigneeId: this.assigneeId,
      assigneeName: this.assigneeName,
      title: this.title,
      notes: this.notes,
      taskType: this.taskType,
      steps: this.steps.slice(),
      habitToBreak: this.habitToBreak,
      replacements: this.replacements.slice(),
      frequency: this.frequency,
      streak: this.streak,
      schedule: this.schedule ? this.schedule.toJSON() : null,
      schedule: this.schedule,
      lastCompletedOn: this.lastCompletedOn,
      status: this.status,
      createdAt: this.createdAt,
      createdById: this.createdById,
      createdByName: this.createdByName,
      createdByRole: this.createdByRole,
      needsApproval: this.needsApproval,
      targetType: this.targetType,
      targetName: this.targetName,
    };
    // flatten meta keys too
    Object.keys(this.meta || {}).forEach((k) => {
      out[k] = this.meta[k];
    });
    return out;
  }
}

export class BuildHabit {
  constructor(props = {}) {
    this.id = props.id ?? null;
    this.account_id = props.account_id ?? null;
    this.goal = props.goal ?? '';
    this.cue = props.cue ?? '';
    this.steps = Array.isArray(props.steps) ? props.steps.slice() : [];
    this.schedule = props.schedule ?? null;
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
    this.type = props.type ?? 'build'; // 'build' | 'break'
    this.createdAt = props.createdAt ?? new Date().toISOString();
    // explicit common extras
    this.details = props.details ?? null;
    this.completedAt = props.completedAt ?? null;

    // container for other arbitrary properties
    this.meta = {};
    Object.keys(props).forEach((k) => { if (!(k in this)) this.meta[k] = props[k]; });
  }

  static from(obj) {
    if (obj instanceof FormedHabit) return obj;
    return new FormedHabit(obj || {});
  }

  toJSON() {
    // return known fields plus flattened meta for backward compatibility
    const out = {
      id: this.id,
      userId: this.userId,
      title: this.title,
      type: this.type,
      createdAt: this.createdAt,
      details: this.details,
      completedAt: this.completedAt,
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
    this.type = this.role; // i think these should be the same?
    this.themeMode = props.themeMode ?? props.theme ?? 'light';
    this.palette = props.palette ?? 'gold';
    this.theme = this.themeMode; // legacy alias
    this.profilePic = props.profilePic ?? '';
    this.stats = props.stats ?? {};
    // explicit common extras
    this.code = props.code ?? null;

    // collect any other arbitrary props under `meta`
    this.meta = {};
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
      palette: this.palette,
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
    this.code = props.code ?? '';
    this.age = props.age ?? null;
    this.createdAt = props.createdAt ?? null;
  }

  static from(obj) {
  // Return any child payload (instance, object, stringified JSON) when possible, or null if there was nothing.
  if (obj instanceof Child) return obj;
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string') {
    try { return new Child(JSON.parse(obj)); }
    catch { return new Child({}); }
  }
  return new Child(obj || {});
}

  toJSON() {
    return { parentId: this.parentId, id: this.id, name: this.name, code: this.code, age: this.age };
  }
}

export default {
  Task,
  BuildHabit,
  BreakHabit,
  FormedHabit,
  User,
  Child,
};
