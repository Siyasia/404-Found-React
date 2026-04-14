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

// For each model class, we allow constructing from a plain object with flexible field names, and we provide a toJSON method that returns a clean plain object for serialization. The meta field can be used to store any additional data that doesn't fit into the defined properties, without losing it during normalization.
export class Task {
  constructor(props = {}) {
    // assign all known properties so code can read t.title, t.status, etc.
    this.id = parseInt(props.id) ?? 0;
    this.assigneeId = parseInt(props.assigneeId) ?? 0;
    this.assigneeName = props.assigneeName ?? '';
    this.childCode = props.childCode ?? 0;
    this.title = props.title ?? '';
    this.notes = props.notes ?? '';
    this.taskType = props.taskType ?? 'simple';
    this.steps = Array.isArray(props.steps) ? props.steps.slice() : [];
    this.habitToBreak = props.habitToBreak ?? '';
    this.replacements = Array.isArray(props.replacements) ? props.replacements.slice() : [];
    this.streak = props.streak ?? 0;
    if (props.completedDates && typeof props.completedDates === 'object' && !Array.isArray(props.completedDates)) {
      this.completedDates = { ...props.completedDates };
    } else {
      this.completedDates = Array.isArray(props.completedDates) ? props.completedDates.slice() : [];
    }
    const incomingMeta = props.meta && typeof props.meta === 'object' && !Array.isArray(props.meta)
      ? { ...props.meta }
      : {};
    this.schedule = Schedule.from(props.schedule ?? props.frequency ?? incomingMeta.schedule);
    const scheduleJson = this.schedule ? this.schedule.toJSON() : null;
    this.frequencyLabel = deriveFrequencyLabel(scheduleJson);
    this.frequency = scheduleJson;
    this.completionLog = props.completionLog ?? incomingMeta.completionLog ?? {};
    this.stats = props.stats ?? incomingMeta.stats ?? {};
    this.timeOfDay = props.timeOfDay ?? incomingMeta.timeOfDay ?? '';
    this.lastCompletedOn = props.lastCompletedOn ?? incomingMeta.lastCompletedOn ?? null;
    this.status = props.status ?? 'pending';
    this.createdAt = props.createdAt ?? new Date().toISOString();
    this.createdById = props.createdById ?? null;
    this.createdByName = props.createdByName ?? '';
    this.createdByRole = props.createdByRole ?? '';
    this.needsApproval = props.needsApproval ?? false;
    this.targetType = props.targetType ?? null;
    this.targetName = props.targetName ?? null;

    this.meta = incomingMeta;
    Object.keys(props).forEach((k) => {
      if (!(k in this)) this.meta[k] = props[k];
    });
  }

  static from(obj) {
    if (obj instanceof Task) return obj;
    return new Task(obj || {});
  }

  toJSON() {
    const scheduleJson = this.schedule ? this.schedule.toJSON() : null;
    const out = {
      id: this.id,
      assigneeId: this.assigneeId,
      assigneeName: this.assigneeName,
      childCode: this.childCode,
      title: this.title,
      notes: this.notes,
      taskType: this.taskType,
      steps: this.steps.slice(),
      habitToBreak: this.habitToBreak,
      replacements: this.replacements.slice(),
      frequency: scheduleJson,
      frequencyLabel: this.frequencyLabel,
      streak: this.streak,
      completedDates: Array.isArray(this.completedDates) ? this.completedDates.slice() : { ...this.completedDates },
      schedule: scheduleJson,
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
    };
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
    this.themeMode = props.themeMode ?? props.theme ?? 'light';
    this.palette = props.palette ?? 'gold';
    this.theme = this.themeMode;
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
      } catch (e) {
        console.error("Inventory parse failed:", inventory);
        inventory = [];
      }
    }

    this.inventory = Array.isArray(inventory)
      ? inventory.slice()
      : [];
    this.meta = props.meta && typeof props.meta === 'object' && !Array.isArray(props.meta)
      ? { ...props.meta }
      : {};
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
    console.log('Serializing GameProfile with id:', this.id, 'coins:', this.coins, 'inventory:', this.inventory);
    return {
      id: this.id,
      coins: this.coins,
      inventory: this.inventory.map((field) => ({ id: field.id, equipped: field.equipped, color: field.color ?? 1 })),
      meta: { ...(this.meta || {}) },
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
      notes: this.notes,
      assigneeId: this.assigneeId,
      assigneeName: this.assigneeName,
      schedule: this.schedule,
      frequency: this.frequency,
      frequencyLabel: this.frequencyLabel,
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
