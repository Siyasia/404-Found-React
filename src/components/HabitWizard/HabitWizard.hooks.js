import { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // React hooks
import {
  WIZARD_CONFIG,
  loadDraft,
  saveDraft,
  validateGoalStep,
  validateDetailsStep,
  validateActionsStep,
  validateTaskForm,
  buildFinalPayload,
  defaultSchedule,
  inferGoalType,
} from './HabitWizard.utils.js'; // Pure utilities

/**
 * Main hook for the Habit Wizard.
 * Manages all state, validation, and side effects (auto-save, navigation).
 */
export function useHabitWizard(initialValues, today, draftApiUrl, authToken, onDraftSave) {
  // Load initial data from props or localStorage draft
  const initialData = useMemo(
    () => loadDraft(initialValues, today, WIZARD_CONFIG),
    [initialValues, today]
  );

  // Single state object containing all wizard fields
  const [state, setState] = useState({
    currentStepIndex: 0,
    habitType: initialData.habitType,
    inferredType: initialData.inferredType,
    typeConfirmed: initialData.typeConfirmed,
    title: initialData.title,
    whyItMatters: initialData.whyItMatters,
    goalStartDate: initialData.goalStartDate,
    goalEndDate: initialData.goalEndDate,
    hasGoalEndDate: initialData.hasGoalEndDate,
    location: initialData.location,
    triggers: initialData.triggers,
    triggerInput: '',
    makeItEasier: initialData.makeItEasier,
    replacements: initialData.replacements,
    replacementInput: { title: '', cue: '' },
    savingFor: initialData.savingFor,
    rewardGoalTitle: initialData.rewardGoalTitle,
    rewardGoalCostCoins: initialData.rewardGoalCostCoins,
    milestoneRewards: initialData.milestoneRewards || WIZARD_CONFIG.DEFAULT_MILESTONES,
    assignee: initialData.assignee,
    tasks: initialData.tasks,
    taskForm: {
      title: '',
      cue: '',
      timeOfDay: '',
      startDate: initialData.goalStartDate,
      endDate: initialData.goalEndDate || '',
      schedule: defaultSchedule(initialData.goalStartDate, initialData.goalEndDate),
    },
    editingIndex: null,
    errors: {},
    isValidatingTitle: false,
    isSavingTask: false,
    isSubmitting: false,
  });

  const submitErrorRef = useRef(null); // Hold submission error for parent

  // Derived values
  const totalSteps = 5; // goal, details, actions, rewards, review
  const currentStep = ['goal', 'details', 'actions', 'rewards', 'review'][state.currentStepIndex];

  // Simple validation for the rewards step
  const validateRewardsStep = (stateObj) => {
    const errors = {};
    // rewardGoalCostCoins should be numeric if provided
    const cost = stateObj.rewardGoalCostCoins;
    if (cost !== '' && cost !== null && isNaN(Number(cost))) {
      errors.rewards = 'Reward cost must be a number.';
    }
    // milestoneRewards should be an array with non-negative coin values
    if (Array.isArray(stateObj.milestoneRewards)) {
      const bad = stateObj.milestoneRewards.some((m) => Number.isNaN(Number(m.coins)) || Number(m.coins) < 0);
      if (bad) errors.rewards = 'Milestone rewards must have non-negative coin values.';
    }
    return errors;
  };

  // Memoized summary of the goal (used in review step and payload)
  const goalSummary = useMemo(
    () => ({
      type: state.habitType,
      title: (state.title || '').trim(),
      goalTitle: (state.title || '').trim(),
      whyItMatters: (state.whyItMatters || '').trim(),
      startDate: state.goalStartDate,
      endDate: state.goalEndDate || '',
      location: state.location,
      triggers: state.triggers,
      makeItEasier: state.makeItEasier,
      replacements: state.replacements,
      assignee: state.assignee,
    }),
    [
      state.habitType,
      state.title,
      state.whyItMatters,
      state.goalStartDate,
      state.goalEndDate,
      state.location,
      state.triggers,
      state.makeItEasier,
      state.replacements,
      state.assignee,
    ]
  );

  // Number of completions needed to reach the reward goal
  const completionsNeeded =
    state.rewardGoalCostCoins && Number(state.rewardGoalCostCoins) > 0
      ? Math.ceil(Number(state.rewardGoalCostCoins) / WIZARD_CONFIG.COINS_PER_COMPLETION)
      : null;

  // ---- Actions (state setters) ----

  // Update goal title and infer type
  const setGoalTitle = useCallback((value) => {
    setState((prev) => {
      const trimmedValue = (value || '').trim();
      let newInferredType = prev.inferredType;
      let newHabitType = prev.habitType;

      if (trimmedValue && trimmedValue.length >= 3) {
        newInferredType = inferGoalType(trimmedValue);
        // Debug: show what inference produced for this title
        // eslint-disable-next-line no-console
        console.log('[HabitWizard] inferGoalType ->', newInferredType, 'for title:', trimmedValue);
      } else {
        newInferredType = null;
      }

      // If the user edits the title after previously confirming a type,
      // clear confirmation so they must re-confirm the new intent.
      let newTypeConfirmed = prev.typeConfirmed;
      if (prev.typeConfirmed && prev.title !== value) {
        newHabitType = null;
        newTypeConfirmed = false;
      }

      return {
        ...prev,
        title: value,
        inferredType: newInferredType,
        habitType: newHabitType,
        typeConfirmed: newTypeConfirmed,
        errors: { ...prev.errors, title: undefined },
      };
    });
  }, []);

  // Confirm the goal type (build/break)
  const confirmType = useCallback((nextType) => {
    setState((prev) => ({
      ...prev,
      habitType: nextType,
      typeConfirmed: true,
      errors: { ...prev.errors, title: undefined, details: undefined },
    }));
  }, []);

  // Add a trigger from input
  const addTrigger = useCallback(() => {
    setState((prev) => {
      const value = prev.triggerInput.trim();
      if (!value || prev.triggers.length >= WIZARD_CONFIG.MAX_TASKS) return prev;
      return {
        ...prev,
        triggers: [...prev.triggers, value],
        triggerInput: '',
      };
    });
  }, []);

  // Add a replacement idea
  const addReplacement = useCallback(() => {
    setState((prev) => {
      const titleValue = prev.replacementInput.title.trim();
      const cueValue = prev.replacementInput.cue.trim();
      if (!titleValue || prev.replacements.length >= WIZARD_CONFIG.MAX_TASKS) return prev;
      return {
        ...prev,
        replacements: [...prev.replacements, { title: titleValue, cue: cueValue }],
        replacementInput: { title: '', cue: '' },
        errors: { ...prev.errors, details: undefined },
      };
    });
  }, []);

  // Update any field in taskForm (including schedule which updates dates)
  const updateTaskForm = useCallback((field, value) => {
    setState((prev) => {
      const newErrors = { ...prev.errors, taskForm: undefined };

      if (field === 'schedule') {
        // When schedule changes, also update startDate/endDate from schedule if present
        return {
          ...prev,
          taskForm: {
            ...prev.taskForm,
            schedule: value,
            startDate: value.startDate || prev.taskForm.startDate || prev.goalStartDate,
            endDate: value.endDate || prev.taskForm.endDate || '',
          },
          errors: newErrors,
        };
      }

      return {
        ...prev,
        taskForm: { ...prev.taskForm, [field]: value },
        errors: newErrors,
      };
    });
  }, []);

  // Save the current task (either new or edited)
  const saveTask = useCallback(() => {
    setState((prev) => {
      if (prev.isSavingTask) return prev;

      const taskErrors = validateTaskForm(
        prev.taskForm,
        prev.tasks,
        prev.editingIndex,
        prev.goalStartDate,
        prev.goalEndDate,
        WIZARD_CONFIG
      );

      if (Object.keys(taskErrors).length > 0) {
        return { ...prev, errors: { ...prev.errors, taskForm: taskErrors } };
      }

      const nextTask = {
        title: prev.taskForm.title.trim(),
        cue: prev.taskForm.cue || '',
        timeOfDay: prev.taskForm.timeOfDay || '',
        startDate: prev.taskForm.startDate || prev.goalStartDate,
        endDate: prev.taskForm.endDate || '',
        schedule: prev.taskForm.schedule,
        completionLog: prev.taskForm.completionLog || {},
      };

      const newTasks =
        prev.editingIndex !== null
          ? prev.tasks.map((task, i) => (i === prev.editingIndex ? nextTask : task))
          : [...prev.tasks, nextTask];

      return {
        ...prev,
        tasks: newTasks,
        taskForm: {
          title: '',
          cue: '',
          timeOfDay: '',
          startDate: prev.goalStartDate,
          endDate: prev.goalEndDate || '',
          schedule: defaultSchedule(prev.goalStartDate, prev.goalEndDate),
        },
        editingIndex: null,
        isSavingTask: false,
      };
    });
  }, []);

  // Start editing a task (populate taskForm with task data)
  const editTask = useCallback((index) => {
    setState((prev) => {
      const task = prev.tasks[index];
      if (!task) return prev;
      return {
        ...prev,
        taskForm: {
          title: task.title || '',
          cue: task.cue || '',
          timeOfDay: task.timeOfDay || '',
          startDate: task.startDate || prev.goalStartDate,
          endDate: task.endDate || '',
          schedule: task.schedule || defaultSchedule(prev.goalStartDate, prev.goalEndDate),
          completionLog: task.completionLog || {},
        },
        editingIndex: index,
      };
    });
  }, []);

  // Remove a task after confirmation
  const removeTask = useCallback((index) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to remove this action plan?'))
      return;
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index),
    }));
  }, []);

  // Go to next step (with validation)
  const goNext = useCallback(() => {
    setState((prev) => {
      let stepErrors = {};
      if (prev.currentStepIndex === 0) {
        stepErrors = validateGoalStep(
          prev.title,
          prev.typeConfirmed,
          prev.habitType,
          prev.goalStartDate,
          prev.hasGoalEndDate,
          prev.goalEndDate
        );
      } else if (prev.currentStepIndex === 1) {
        stepErrors = validateDetailsStep(prev.habitType, prev.replacements);
      } else if (prev.currentStepIndex === 2) {
        stepErrors = validateActionsStep(prev.tasks);
      } else if (prev.currentStepIndex === 3) {
        stepErrors = validateRewardsStep(prev);
      }

      if (Object.keys(stepErrors).length > 0) {
        return { ...prev, errors: { ...prev.errors, ...stepErrors } };
      }

      if (prev.currentStepIndex + 1 < 4) {
        return { ...prev, currentStepIndex: prev.currentStepIndex + 1 };
      }
      return prev;
    });
  }, []);

  // Go to previous step
  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStepIndex: Math.max(0, prev.currentStepIndex - 1),
    }));
  }, []);

  // Jump to a specific step (only if allowed by navigation logic)
  const jumpToStep = useCallback((index) => {
    setState((prev) => ({
      ...prev,
      currentStepIndex: Math.max(0, Math.min(3, index)),
    }));
  }, []);

  // Final submission – build payload and call onSubmit
  const handleFinish = useCallback(
    async (onSubmit) => {
      setState((prev) => ({ ...prev, isSubmitting: true }));

      const payload = buildFinalPayload(
        goalSummary,
        state.tasks,
        state.savingFor,
        state.rewardGoalTitle,
        state.rewardGoalCostCoins,
        state.triggers,
        state.location,
        state.makeItEasier,
        state.replacements,
        state.assignee,
        state.milestoneRewards,
        WIZARD_CONFIG
      );

      try {
        const result = await onSubmit(payload);
        localStorage.removeItem(WIZARD_CONFIG.DRAFT_STORAGE_KEY); // Clear draft on success
        return result;
      } catch (error) {
        submitErrorRef.current = error;
        return null;
      } finally {
        setState((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [goalSummary, state]
  );

  // Auto-save draft on any state change (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(
        {
          habitType: state.habitType,
          typeConfirmed: state.typeConfirmed,
          title: state.title,
          whyItMatters: state.whyItMatters,
          goalStartDate: state.goalStartDate,
          goalEndDate: state.goalEndDate,
          hasGoalEndDate: state.hasGoalEndDate,
          location: state.location,
          triggers: state.triggers,
          makeItEasier: state.makeItEasier,
          replacements: state.replacements,
          savingFor: state.savingFor,
          rewardGoalTitle: state.rewardGoalTitle,
          rewardGoalCostCoins: state.rewardGoalCostCoins,
          milestoneRewards: state.milestoneRewards,
          assignee: state.assignee,
          tasks: state.tasks,
        },
        WIZARD_CONFIG,
        draftApiUrl,
        authToken,
        onDraftSave
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [state, draftApiUrl, authToken, onDraftSave]);

  // Helper to check if a step is valid (no errors)
  const isStepValid = useCallback(
    (index = state.currentStepIndex) => {
      if (index === 0) {
        return (
          Object.keys(
            validateGoalStep(
              state.title,
              state.typeConfirmed,
              state.habitType,
              state.goalStartDate,
              state.hasGoalEndDate,
              state.goalEndDate
            )
          ).length === 0
        );
      }
      if (index === 1) {
        return Object.keys(validateDetailsStep(state.habitType, state.replacements)).length === 0;
      }
      if (index === 2) {
        return Object.keys(validateActionsStep(state.tasks)).length === 0;
      }
      if (index === 3) {
        return Object.keys(validateRewardsStep(state)).length === 0;
      }
      return true;
    },
    [state]
  );

  // Helper to check if a step is complete (used for navigation dot styling)
  const isStepComplete = useCallback(
    (stepKey) => {
      if (stepKey === 'goal')
        return Boolean(state.title.trim() && state.typeConfirmed && state.habitType);
      if (stepKey === 'details') {
        if (state.habitType === 'break') return state.replacements.length > 0;
        return Boolean(state.location.trim() || state.triggers.length || state.makeItEasier.length);
      }
      if (stepKey === 'actions') return state.tasks.length > 0;
      if (stepKey === 'rewards') {
        // Consider rewards step complete if any reward-related field is populated
        return (
          Boolean(state.milestoneRewards && state.milestoneRewards.length) ||
          Boolean((state.rewardGoalTitle || '').trim()) ||
          Boolean(state.rewardGoalCostCoins || state.savingFor)
        );
      }
      return false;
    },
    [state]
  );

  return {
    // Raw state (use sparingly)
    state,
    // Derived values
    currentStepIndex: state.currentStepIndex,
    currentStep,
    totalSteps,
    goalSummary,
    completionsNeeded,
    // Validation helpers
    isStepValid,
    isStepComplete,
    // Actions (state setters)
    setGoalTitle,
    confirmType,
    setWhyItMatters: (value) => setState((prev) => ({ ...prev, whyItMatters: value })),
    setGoalStartDate: (value) => setState((prev) => ({ ...prev, goalStartDate: value })),
    setGoalEndDate: (value) => setState((prev) => ({ ...prev, goalEndDate: value })),
    setHasGoalEndDate: (value) =>
      setState((prev) => ({
        ...prev,
        hasGoalEndDate: value,
        goalEndDate: value ? prev.goalEndDate : '',
      })),
    setLocation: (value) => setState((prev) => ({ ...prev, location: value })),
    setTriggerInput: (value) => setState((prev) => ({ ...prev, triggerInput: value })),
    addTrigger,
    removeTrigger: (index) =>
      setState((prev) => ({ ...prev, triggers: prev.triggers.filter((_, i) => i !== index) })),
    toggleMakeItEasier: (option) =>
      setState((prev) => ({
        ...prev,
        makeItEasier: prev.makeItEasier.includes(option)
          ? prev.makeItEasier.filter((item) => item !== option)
          : [...prev.makeItEasier, option],
      })),
    setReplacementInput: (field, value) =>
      setState((prev) => ({
        ...prev,
        replacementInput: { ...prev.replacementInput, [field]: value },
      })),
    addReplacement,
    editReplacement: (index) =>
      setState((prev) => {
        const value = prev.replacements[index];
        if (!value) return prev;
        return {
          ...prev,
          replacementInput: { title: value.title || '', cue: value.cue || '' },
          replacements: prev.replacements.filter((_, i) => i !== index),
        };
      }),
    removeReplacement: (index) =>
      setState((prev) => ({
        ...prev,
        replacements: prev.replacements.filter((_, i) => i !== index),
      })),
    setMilestoneReward: (index, newCoins) =>
      setState((prev) => ({
        ...prev,
        milestoneRewards: prev.milestoneRewards.map((m, i) =>
          i === index
            ? { ...m, coins: Math.max(0, Number.isNaN(Number(newCoins)) ? 0 : Number(newCoins)) }
            : m
        ),
      })),
    setSavingFor: (value) => setState((prev) => ({ ...prev, savingFor: value })),
    setRewardGoalTitle: (value) => setState((prev) => ({ ...prev, rewardGoalTitle: value })),
    setRewardGoalCostCoins: (value) => setState((prev) => ({ ...prev, rewardGoalCostCoins: value })),
    setAssignee: (value) => setState((prev) => ({ ...prev, assignee: value })),
    // Task actions
    updateTaskForm,
    saveTask,
    editTask,
    removeTask,
    // Navigation
    goNext,
    goBack,
    jumpToStep,
    // Submission
    handleFinish,
    isSubmitting: state.isSubmitting,
    submitErrorRef,
    // Error handling
    setErrors: (errors) => setState((prev) => ({ ...prev, errors })),
    clearErrors: () => setState((prev) => ({ ...prev, errors: {} })),
    // Title validation flag (used by parent)
    setIsValidatingTitle: (value) => setState((prev) => ({ ...prev, isValidatingTitle: value })),
  };
}

/**
 * Hook for validating the goal title against a backend endpoint.
 * Returns validation state, error message, and a function to trigger validation.
 */
export function useTitleValidation(title, titleValidationUrl, authToken) {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState(null);

  const validate = useCallback(async () => {
    const trimmed = (title || '').trim();
    if (!trimmed || !titleValidationUrl) return;

    setIsValidating(true);
    try {
      const res = await fetch(titleValidationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) {
        setError('Could not validate title right now.');
        return;
      }
      const json = await res.json();
      if (json && json.valid === false) {
        setError(json.message || 'Title not allowed');
      } else {
        setError(null); // Clear any previous error
      }
    } catch (e) {
      // Silent fail – don't block the user
      setError(null);
    } finally {
      setIsValidating(false);
    }
  }, [title, titleValidationUrl, authToken]);

  return { isValidating, error, validate };
}