import React, { useCallback } from 'react';                // React core and hooks
import PropTypes from 'prop-types';                        // Type checking for props
import './HabitWizard.css';                                // Wizard styles
import { GoalStep, DetailsStep, ActionPlansStep, ReviewLaunchStep } from './HabitWizardSteps.jsx'; // Step UI components
import { RewardsStep } from './HabitWizardRewards.jsx';
import { useHabitWizard, useTitleValidation } from './HabitWizard.hooks.js'; // Custom hooks for state and validation
import { WIZARD_CONFIG } from './HabitWizard.utils.js';
import { toLocalISODate } from '../../lib/schedule.js';

// Human-readable labels for each step (used in progress and navigation)
const STEP_LABELS = {
  goal: 'Goal',
  details: 'Pattern & Support',
  actions: 'Action Plans',
  rewards: 'Rewards',
  review: 'Review & Launch',
};

/**
 * HabitWizard – main component that orchestrates the multi-step habit creation flow.
 * It uses custom hooks for state management, validation, and auto-save.
 */
export default function HabitWizard({
  context = 'self',                 // 'self' or 'parent' – determines if assignee panel is shown
  availableChildren = [],           // List of child users (for parent context)
  onSubmit,                         // Callback when wizard is finished (receives final payload)
  initialValues = null,             // Pre-fill data (e.g., when editing an existing habit)
  parentUser = null,                // Current parent user object (for assignee dropdown)
  embedded = false,                 // If true, removes outer card styles (for embedding in another page)
  suggestedActionTitles = [],       // Server-provided suggestions for action plan titles
  onUseSuggestion: externalOnUseSuggestion = null, // External handler when a suggestion is clicked
  draftApiUrl = '',                 // URL to POST draft data (for cross-device sync)
  authToken = '',                   // Auth token for draft API and title validation
  titleValidationUrl = '',          // URL to validate goal title against backend rules
  onDraftSave = null,               // Custom callback for saving draft (alternative to API)
}) {
  const today = toLocalISODate();   // Current date in YYYY-MM-DD format

  // ---- Custom hooks ----
  // Main wizard state and actions
  const wizard = useHabitWizard(initialValues, today, draftApiUrl, authToken, onDraftSave);
  // Title validation (runs on blur)
  const { isValidating: isValidatingTitle, error: titleError, validate: validateTitle } = 
    useTitleValidation(wizard.state.title, titleValidationUrl, authToken);

  // ---- Handlers ----
  // When a suggestion chip is clicked: either call external handler or fill the task form title
  const handleUseSuggestion = useCallback((suggestion) => {
    if (typeof externalOnUseSuggestion === 'function') {
      externalOnUseSuggestion(suggestion); // Let parent app handle it (e.g., analytics)
    } else {
      wizard.updateTaskForm('title', suggestion); // Fill the task title field directly
    }
  }, [externalOnUseSuggestion, wizard.updateTaskForm]);

  // ---- Render current step ----
  const renderStep = () => {
    // Common props used by ActionPlansStep
    const actionPlansProps = {
      goal: wizard.goalSummary,
      tasks: wizard.state.tasks,
      taskForm: wizard.state.taskForm,
      taskFormError: wizard.state.errors.taskForm || (wizard.state.errors.tasks ? { tasks: wizard.state.errors.tasks } : undefined),
      onTaskFormChange: wizard.updateTaskForm,
      onSaveTask: wizard.saveTask,
      onRemoveTask: wizard.removeTask,
      onEditTask: wizard.editTask,
      editingIndex: wizard.state.editingIndex,
      maxTasks: WIZARD_CONFIG.MAX_TASKS,
      suggestedActionTitles,
      onUseSuggestion: handleUseSuggestion,
    };

    switch (wizard.currentStep) {
      case 'goal':
        return (
          <GoalStep
            habitType={wizard.state.habitType}
            title={wizard.state.title}
            whyItMatters={wizard.state.whyItMatters}
            onTitleChange={wizard.setGoalTitle}
            onTitleBlur={validateTitle}               // Validate title when input loses focus
            isValidatingTitle={isValidatingTitle}
            onWhyChange={wizard.setWhyItMatters}
            onUseExample={wizard.setGoalTitle}        // Clicking an example fills the title
            error={wizard.state.errors.title || titleError} // Show both local and validation errors
            inferredType={wizard.state.inferredType}
            typeConfirmed={wizard.state.typeConfirmed}
            onConfirmType={wizard.confirmType}
            goalStartDate={wizard.state.goalStartDate}
            goalEndDate={wizard.state.goalEndDate}
            onGoalStartChange={wizard.setGoalStartDate}
            onGoalEndChange={wizard.setGoalEndDate}
            hasGoalEndDate={wizard.state.hasGoalEndDate}
            onHasGoalEndDateChange={wizard.setHasGoalEndDate}
            goalWindowError={wizard.state.errors.goalWindow}
          />
        );
      case 'details':
        return (
          <DetailsStep
            habitType={wizard.state.habitType}
            location={wizard.state.location}
            onLocationChange={wizard.setLocation}
            triggers={wizard.state.triggers}
            triggerInput={wizard.state.triggerInput}
            onTriggerInputChange={wizard.setTriggerInput}
            onAddTrigger={wizard.addTrigger}
            onRemoveTrigger={wizard.removeTrigger}
            makeItEasier={wizard.state.makeItEasier}
            onToggleMakeItEasier={wizard.toggleMakeItEasier}
            replacements={wizard.state.replacements}
            replacementInput={wizard.state.replacementInput}
            onReplacementInputChange={wizard.setReplacementInput}
            onAddReplacement={wizard.addReplacement}
            onEditReplacement={wizard.editReplacement}
            onRemoveReplacement={wizard.removeReplacement}
            error={wizard.state.errors.details}
          
          />
        );
      case 'actions':
        return <ActionPlansStep {...actionPlansProps} />;
      case 'rewards':
        return (
          <RewardsStep
            coinsPerCompletion={WIZARD_CONFIG.COINS_PER_COMPLETION}
            milestoneRewards={wizard.state.milestoneRewards}
            onMilestoneRewardChange={wizard.setMilestoneReward}
            savingFor={wizard.state.savingFor}
            onSavingForChange={wizard.setSavingFor}
            rewardGoalTitle={wizard.state.rewardGoalTitle}
            onRewardGoalTitleChange={wizard.setRewardGoalTitle}
            rewardGoalCostCoins={wizard.state.rewardGoalCostCoins}
            onRewardGoalCostCoinsChange={wizard.setRewardGoalCostCoins}
            completionsNeeded={wizard.completionsNeeded}
            error={wizard.state.errors.rewards}
          />
        );
      case 'review':
        return (
          <ReviewLaunchStep
            goal={wizard.goalSummary}
            tasks={wizard.state.tasks}
            savingFor={wizard.state.savingFor}
            rewardGoalTitle={wizard.state.rewardGoalTitle}
            rewardGoalCostCoins={wizard.state.rewardGoalCostCoins}
            coinsPerCompletion={WIZARD_CONFIG.COINS_PER_COMPLETION}
            completionsNeeded={wizard.completionsNeeded}
            onSavingForChange={wizard.setSavingFor}
            onRewardGoalTitleChange={wizard.setRewardGoalTitle}
            onRewardGoalCostCoinsChange={wizard.setRewardGoalCostCoins}
            onJumpToStep={wizard.jumpToStep}
            onSubmit={() => wizard.handleFinish(onSubmit)} // Call the finish handler with the onSubmit prop
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={embedded ? 'hw-container hw-embedded' : 'hw-container'}>
      <div className="hw-card">
        {/* Header with title and progress bar */}
        <div className="hw-header">
          <div>
            <h3>Create a goal</h3>
            <div className="muted hw-mt4">
              The goal is the big picture. The action plans are the scheduled pieces that show up on the homepage.
            </div>
          </div>
          <div className="hw-progress">
            <div
              className="hw-progress-bar"
              style={{ width: `${((wizard.currentStepIndex + 1) / wizard.totalSteps) * 100}%` }}
            />
            <span className="hw-progress-text">
              {STEP_LABELS[wizard.currentStep]} · Step {wizard.currentStepIndex + 1} of {wizard.totalSteps}
            </span>
          </div>
        </div>

        {/* Assignee panel – only shown in parent context */}
        {context === 'parent' && (
          <div className="hw-assignee-panel hw-mt12">
            <div>
              <div className="hw-assignee-title">Assign this goal</div>
              <div className="hw-assignee-subtitle">
                Pick who this goal and its action plans belong to.
              </div>
            </div>
            <div className="hw-assignee-control">
              <select
                className="hw-input"
                value={wizard.state.assignee || ''}
                onChange={(e) => wizard.setAssignee(e.target.value)}
              >
                <option value="">Select assignee</option>
                {parentUser ? (
                  <option value={parentUser.id}>{parentUser.name || 'You'} (you)</option>
                ) : null}
                {availableChildren.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step navigation dots */}
        <div className="hw-step-nav">
          {['goal', 'details', 'actions', 'rewards', 'review'].map((stepKey, index) => {
            const completed = wizard.currentStepIndex > index && wizard.isStepComplete(stepKey);
            const active = wizard.currentStepIndex === index;
            return (
              <button
                key={stepKey}
                type="button"
                className={`hw-step-nav-item${active ? ' active' : ''}${completed ? ' completed' : ''}`}
                onClick={() => index <= wizard.currentStepIndex && wizard.jumpToStep(index)}
                disabled={index > wizard.currentStepIndex} // Can't jump to future steps
              >
                <div className="hw-step-nav-dot">{index + 1}</div>
                <div className="hw-step-nav-label">{STEP_LABELS[stepKey]}</div>
              </button>
            );
          })}
        </div>

        {/* Current step content */}
        <div className="hw-body">
          <div className="hw-step">{renderStep()}</div>

          {/* Navigation buttons (Back/Next) – hidden on review step */}
          {wizard.currentStep !== 'review' && (
            <div className="hw-actions">
                <div className="hw-step-hint">
                  {wizard.currentStep === 'goal' && `Step 1 of ${wizard.totalSteps} · Press Enter to continue`}
                  {wizard.currentStep === 'details' &&
                    'Add cues, supports, and a replacement idea before scheduling action plans.'}
                  {wizard.currentStep === 'actions' && 'Goal window and action plans stay separate.'}
                  {wizard.currentStep === 'rewards' && 'Optional: set rewards and milestones to stay motivated.'}
                </div>
              <button
                type="button"
                className="small"
                onClick={wizard.goBack}
                disabled={wizard.currentStepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                className="hw-btn-primary"
                onClick={wizard.goNext}
                disabled={!wizard.isStepValid()}
              >
                {wizard.currentStepIndex + 1 < wizard.totalSteps ? 'Next' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

HabitWizard.propTypes = {
  context: PropTypes.oneOf(['self', 'parent']),
  availableChildren: PropTypes.array,
  onSubmit: PropTypes.func.isRequired,
  initialValues: PropTypes.object,
  parentUser: PropTypes.object,
  embedded: PropTypes.bool,
  suggestedActionTitles: PropTypes.array,
  onUseSuggestion: PropTypes.func,
  draftApiUrl: PropTypes.string,
  authToken: PropTypes.string,
  titleValidationUrl: PropTypes.string,
  onDraftSave: PropTypes.func,
};
