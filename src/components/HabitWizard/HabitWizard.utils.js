// ===================== CONFIG =====================
// All configuration constants are centralized here for easy modification.
export const WIZARD_CONFIG = {
  MAX_TASKS: 5,                                 // Maximum number of action plans per goal
  COINS_PER_COMPLETION: 20,                     // Coins earned per completed task
  DRAFT_VERSION: '2.0',                          // Version of draft data structure
  DRAFT_STORAGE_KEY: 'habitWizard.draft',        // localStorage key for drafts
  // Keywords used to infer goal type from title
  BREAK_SIGNALS: [
    'stop', 'quit', 'less', 'reduce', 'cut', 'avoid', 'no more', 'not', "don't",
    'drop', 'eliminate', 'give up', 'kick', 'stop scrolling', 'quit checking', 'cut back', 'avoid social',
  ],
  BUILD_SIGNALS: [
    'start', 'build', 'more', 'begin', 'develop', 'learn', 'improve', 'grow',
    'add', 'get', 'become', 'make', 'read', 'drink', 'meditate', 'walk',
    'exercise', 'practice', 'study', 'write', 'journal', 'run', 'yoga', 'stretch',
  ],
  // Default milestone rewards (days → coins)
  DEFAULT_MILESTONES: [
    { days: 3, coins: 20, badge: null },
    { days: 7, coins: 75, badge: '🔥' },
    { days: 30, coins: 300, badge: '🏆' },
  ],
};

// ===================== TYPE INFERENCE =====================
/**
 * Guess whether a goal title is a "build" or "break" goal based on keywords.
 * Returns 'build', 'break', or null if undetermined.
 */
export function inferGoalType(value) {
  const lower = (value || '').toLowerCase();
  const breakScore = WIZARD_CONFIG.BREAK_SIGNALS.reduce(
    (score, word) => score + (lower.includes(word) ? 1 : 0),
    0
  );
  const buildScore = WIZARD_CONFIG.BUILD_SIGNALS.reduce(
    (score, word) => score + (lower.includes(word) ? 1 : 0),
    0
  );
  if (breakScore > buildScore) return 'break';
  if (buildScore > breakScore) return 'build';
  return null;
}

// ===================== NORMALIZATION =====================
/**
 * Create a default schedule object (daily, no end date unless provided).
 */
export function defaultSchedule(startDate, endDate) {
  return {
    repeat: 'daily',
    daysOfWeek: [],
    intervalDays: 1,
    startDate,
    endDate: endDate || '',
  };
}

/**
 * Normalize a task object to ensure consistent shape.
 * Used when loading from API, localStorage, or creating a new task.
 */
export function normalizeTask(task, fallbackStart, fallbackEnd) {
  const startDate = task?.startDate || task?.schedule?.startDate || fallbackStart;
  const endDate = task?.endDate || task?.schedule?.endDate || fallbackEnd || '';
  return {
    title: task?.title || '',
    cue: task?.cue || '',
    timeOfDay: task?.timeOfDay || '',
    startDate,
    endDate,
    schedule: task?.schedule || defaultSchedule(startDate, endDate),
    completionLog: task?.completionLog || {},
  };
}

/**
 * Convert a list of replacements (which may be strings or objects) to an array of objects.
 */
export function normalizeReplacementList(value) {
  return (value || []).map((item) =>
    typeof item === 'string' ? { title: item, cue: '' } : item
  );
}

/**
 * Generate a client-side ID (used for optimistic UI; backend may override).
 */
export function generateId(prefix) {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ===================== VALIDATION =====================
/**
 * Validate the goal step.
 * Returns an object with error messages (empty if valid).
 */
export function validateGoalStep(title, typeConfirmed, habitType, goalStartDate, hasGoalEndDate, goalEndDate) {
  const errors = {};
  if (!title.trim()) errors.title = 'Give your goal a clear name.';
  if (!typeConfirmed || !habitType) errors.title = 'Confirm whether this is a build goal or a break goal.';
  if (!goalStartDate) errors.goalWindow = 'Choose when this goal starts.';
  if (hasGoalEndDate && goalStartDate && goalEndDate && goalEndDate < goalStartDate) {
    errors.goalWindow = 'Goal end date cannot be before the start date.';
  }
  return errors;
}

/**
 * Validate the details step.
 */
export function validateDetailsStep(habitType, replacements) {
  const errors = {};
  if (habitType === 'break' && replacements.length === 0) {
    errors.details = 'Add at least one replacement idea before continuing.';
  }
  return errors;
}

/**
 * Validate the actions step.
 */
export function validateActionsStep(tasks) {
  const errors = {};
  if (tasks.length === 0) errors.tasks = 'Add at least one action plan.';
  return errors;
}

/**
 * Validate a task form before saving.
 */
export function validateTaskForm(taskForm, tasks, editingIndex, goalStartDate, goalEndDate, config) {
  const errors = {};
  const titleValue = (taskForm.title || '').trim();

  if (!titleValue) {
    errors.title = 'Action plan name is required.';
    return errors;
  }

  // Check for duplicate title (case‑insensitive)
  const normalized = titleValue.toLowerCase();
  const isDuplicate = tasks.some(
    (task, idx) =>
      idx !== editingIndex && (task.title || '').trim().toLowerCase() === normalized
  );
  if (isDuplicate) {
    errors.title = 'An action plan with that name already exists.';
    return errors;
  }

  // Check max tasks limit (only for new tasks, not edits)
  if (editingIndex === null && tasks.length >= config.MAX_TASKS) {
    errors.max = `Maximum ${config.MAX_TASKS} action plans reached.`;
    return errors;
  }

  // Date validations
  const startDate = taskForm.startDate || goalStartDate;
  const endDate = taskForm.endDate || '';

  if (endDate && startDate && endDate < startDate) {
    errors.dateOrder = 'Action plan end date cannot be before its start date.';
    return errors;
  }

  if (goalStartDate && startDate < goalStartDate) {
    errors.outside = 'Action plans cannot start before the goal starts.';
    return errors;
  }

  if (goalEndDate) {
    if (startDate > goalEndDate) {
      errors.outside = 'Action plans cannot start after the goal ends.';
      return errors;
    }
    if (endDate && endDate > goalEndDate) {
      errors.outside = 'Action plans cannot end after the goal ends.';
      return errors;
    }
  }

  return errors; // empty object means valid
}

// ===================== DRAFT MANAGEMENT =====================
/**
 * Load draft data from localStorage or use initialValues.
 * Returns a complete initial state object.
 */
export function loadDraft(initialValues, today, config) {
  // Base state from initialValues (if provided)
  const base = {
    habitType: initialValues?.type || null,
    inferredType: null,
    typeConfirmed: Boolean(initialValues?.type),
    title: initialValues?.title || initialValues?.goalTitle || '',
    whyItMatters: initialValues?.whyItMatters || '',
    goalStartDate: initialValues?.startDate || today,
    goalEndDate: initialValues?.endDate || '',
    hasGoalEndDate: Boolean(initialValues?.endDate),
    location: initialValues?.location || '',
    triggers: Array.isArray(initialValues?.triggers)
      ? initialValues.triggers.filter((item) => typeof item === 'string')
      : [],
    triggerInput: '',
    makeItEasier: Array.isArray(initialValues?.makeItEasier)
      ? initialValues.makeItEasier.filter((item) => typeof item === 'string')
      : [],
    replacements: normalizeReplacementList(initialValues?.replacements || []),
    replacementInput: { title: '', cue: '' },
    savingFor: initialValues?.savingFor || '',
    rewardGoalTitle: initialValues?.rewardGoalTitle || '',
    milestoneRewards: initialValues?.milestoneRewards || config.DEFAULT_MILESTONES,
    rewardGoalCostCoins: initialValues?.rewardGoalCostCoins || '',
    assignee: initialValues?.assignee || '',
    tasks: Array.isArray(initialValues?.tasks)
      ? initialValues.tasks.map((task) =>
          normalizeTask(task, initialValues?.startDate || today, initialValues?.endDate || '')
        )
      : [],
  };

  // If initialValues were provided (e.g., editing), use them directly, ignoring localStorage.
  if (initialValues) return base;
  if (typeof window === 'undefined') return base; // SSR

  // Try to load from localStorage
  try {
    const raw = localStorage.getItem(config.DRAFT_STORAGE_KEY);
    if (!raw) return base;

    const parsed = JSON.parse(raw);
    // Handle old draft format (version 1.0)
    const draft = parsed?.version ? parsed : { version: '1.0', data: parsed };

    if (!draft || typeof draft !== 'object') return base;
    if (draft.version !== config.DRAFT_VERSION && draft.version !== '1.0') {
      localStorage.removeItem(config.DRAFT_STORAGE_KEY);
      return base;
    }

    const data = draft.data && typeof draft.data === 'object' ? draft.data : {};
    const next = { ...base };

    // Override base fields with draft data where present
    if ('habitType' in data && ['build', 'break', null].includes(data.habitType))
      next.habitType = data.habitType;
    if ('typeConfirmed' in data) next.typeConfirmed = Boolean(data.typeConfirmed);
    if ('title' in data) next.title = data.title || '';
    if ('whyItMatters' in data) next.whyItMatters = data.whyItMatters || '';
    if ('goalStartDate' in data) next.goalStartDate = data.goalStartDate || base.goalStartDate;
    if ('goalEndDate' in data) next.goalEndDate = data.goalEndDate || '';
    if ('hasGoalEndDate' in data) next.hasGoalEndDate = Boolean(data.hasGoalEndDate);
    if ('location' in data) next.location = data.location || '';
    if (Array.isArray(data.triggers))
      next.triggers = data.triggers.filter((item) => typeof item === 'string');
    if (Array.isArray(data.makeItEasier))
      next.makeItEasier = data.makeItEasier.filter((item) => typeof item === 'string');
    if (Array.isArray(data.replacements)) next.replacements = normalizeReplacementList(data.replacements);
    if ('savingFor' in data) next.savingFor = data.savingFor || '';
    if ('rewardGoalTitle' in data) next.rewardGoalTitle = data.rewardGoalTitle || '';
    if (Array.isArray(data.milestoneRewards)) next.milestoneRewards = data.milestoneRewards;
    if ('rewardGoalCostCoins' in data) next.rewardGoalCostCoins = data.rewardGoalCostCoins || '';
    if ('assignee' in data) next.assignee = data.assignee || '';
    if (Array.isArray(data.tasks)) {
      next.tasks = data.tasks.map((task) =>
        normalizeTask(task, next.goalStartDate || base.goalStartDate, next.goalEndDate || '')
      );
    }
    // Re‑infer type from title if not already confirmed
    next.inferredType = next.typeConfirmed ? next.habitType : inferGoalType(next.title);
    return next;
  } catch (error) {
    return base; // On any error, fall back to base
  }
}

/**
 * Save draft data to localStorage, and optionally to an API or custom handler.
 */
export function saveDraft(data, config, draftApiUrl, authToken, onDraftSave) {
  const draftData = {
    version: config.DRAFT_VERSION,
    data: {
      habitType: data.habitType,
      typeConfirmed: data.typeConfirmed,
      title: data.title,
      whyItMatters: data.whyItMatters,
      goalStartDate: data.goalStartDate,
      goalEndDate: data.goalEndDate,
      hasGoalEndDate: data.hasGoalEndDate,
      location: data.location,
      triggers: data.triggers,
      makeItEasier: data.makeItEasier,
      replacements: data.replacements,
      savingFor: data.savingFor,
      rewardGoalTitle: data.rewardGoalTitle,
      rewardGoalCostCoins: data.rewardGoalCostCoins,
      milestoneRewards: data.milestoneRewards,
      assignee: data.assignee,
      tasks: data.tasks,
    },
  };

  // Local storage
  try {
    localStorage.setItem(config.DRAFT_STORAGE_KEY, JSON.stringify(draftData));
  } catch (e) {
    // ignore
  }

  // Custom handler (e.g., for analytics or custom storage)
  if (typeof onDraftSave === 'function') {
    try {
      onDraftSave(draftData);
    } catch (e) {
      // ignore
    }
  }

  // API sync (if URL provided)
  if (draftApiUrl) {
    fetch(draftApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(draftData),
    }).catch(() => {
      // Silently ignore network errors – draft saving is non‑critical
    });
  }
}

// ===================== PAYLOAD BUILDING =====================
/**
 * Build the final payload to send to the backend when the wizard is submitted.
 */
export function buildFinalPayload(
  goalSummary,
  tasks,
  savingFor,
  rewardGoalTitle,
  rewardGoalCostCoins,
  triggers,
  location,
  makeItEasier,
  replacements,
  assignee,
  milestoneRewards,
  config
) {
  const habitId = generateId('habit'); // Client-generated ID (backend may replace)
  const normalizedTasks = tasks.map((task) => ({
    taskId: generateId('task'),
    habitId,
    title: task.title,
    cue: task.cue || null,
    timeOfDay: task.timeOfDay || null,
    startDate: task.startDate,
    endDate: task.endDate || '',
    schedule: task.schedule,
    completionLog: task.completionLog || {},
  }));

  return {
    habitId,
    type: goalSummary.type,
    title: goalSummary.title,
    goalTitle: goalSummary.title,        // Duplicate for backward compatibility
    goalName: goalSummary.title,          // Duplicate for backward compatibility
    whyItMatters: goalSummary.whyItMatters,
    startDate: goalSummary.startDate,
    endDate: goalSummary.endDate || '',
    reward: config.COINS_PER_COMPLETION,
    savingFor: savingFor || '',
    rewardGoalTitle: rewardGoalTitle || '',
    rewardGoalCostCoins: rewardGoalCostCoins || '',
    triggers,
    location,
    makeItEasier,
    replacements,
    assignee: assignee || null,
    tasks: normalizedTasks,
    milestoneRewards,
  };
}