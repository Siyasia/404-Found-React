// Lightweight frontend models for tasks, habits, and user
// These are intentionally small wrappers around plain objects so existing code
// can continue to access properties directly while we get class semantics.

import {updateGameProfile} from "../lib/api/game.js";

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
      completedDates: this.completedDates.slice(),
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
  }

  static from(obj) {
    if (obj instanceof BuildHabit) return obj;
    return new BuildHabit(obj || {});
  }

  toJSON() {
    return { id: this.id, account_id: this.account_id, goal: this.goal, cue: this.cue, steps: this.steps.slice() };
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
  }

  static from(obj) {
    if (obj instanceof BreakHabit) return obj;
    return new BreakHabit(obj || {});
  }

  toJSON() {
    return { id: this.id, account_id: this.account_id, habit: this.habit, replacements: this.replacements.slice(), microSteps: this.microSteps.slice(), savedOn: this.savedOn };
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
    this.theme = props.theme ?? 'pink';
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
      theme: this.theme,
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
    if (obj instanceof Child) return obj;
    return new Child(obj || {});
  }

  toJSON() {
    return { parentId: this.parentId, id: this.id, name: this.name, code: this.code, age: this.age };
  }
}

export class GameProfile {
  constructor(props = {}) {
    this.id = props.id ?? null; // should also always be same as userId
    this.coins = props.coins ?? 0;
    // array of objects, representing the user's inventory of items/fields in the game
    // format of { id: int, equipped: bool }, where id corresponds to a GameItem id and equipped indicates whether it's currently active
    this.inventory = Array.isArray(props.inventory) ? props.inventory.slice() : [];
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
      equipped: equipped,
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
      inventory: this.inventory.map((field) => ({id: field.id, equipped: field.equipped})),
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

export default {
  Task,
  BuildHabit,
  BreakHabit,
  FormedHabit,
  User,
};
