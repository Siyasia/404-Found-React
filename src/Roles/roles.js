// src/roles.js

// Canonical role IDs
export const ROLE = {
  USER: 'user',         // 15+ self-directed user
  CHILD: 'child',       // can only be assigned tasks
  PARENT: 'parent',     // manages children + approves provider tasks
  PROVIDER: 'provider', // creates task templates only
};

// Human-friendly labels for UI
export const ROLE_LABEL = {
  [ROLE.USER]: 'User',
  [ROLE.CHILD]: 'Child',
  [ROLE.PARENT]: 'Parent',
  [ROLE.PROVIDER]: 'Provider',
};

// ===== Permission helpers =====

// 1. A User - Can create / abandon tasks - Must be 15 or older
// 4. A Provider role that can only create tasks and not have any assigned to them
export function canCreateOwnTasks(user) {
  if (!user) return false;
  return user.role === ROLE.USER || user.role === ROLE.PARENT;
  // NOTE: provider creates tasks FOR OTHERS, so excluded here
}

// Who is allowed to be assigned tasks themselves
export function canBeAssignedTasks(user) {
  if (!user) return false;
  // Providers cannot have tasks assigned; others can
  return user.role === ROLE.USER || user.role === ROLE.CHILD || user.role === ROLE.PARENT;
}

// 2. A Child user who can only be assigned tasks (no creation)
export function canChildCreateTasks(user) {
  return user?.role === ROLE.CHILD;
  // This is just a helper to check; UI will *deny* creation if true
}

// 3a. A Parent user that can assign tasks to a child user
export function canAssignTasksToChildren(user) {
  return user?.role === ROLE.PARENT;
}

// 3b. A Parent user can accept a provider role's tasks
export function canAcceptProviderTasks(user) {
  return user?.role === ROLE.PARENT;
}

// 4. Provider role that can only create tasks and not have any assigned
export function canCreateProviderTasks(user) {
  return user?.role === ROLE.PROVIDER;
}
