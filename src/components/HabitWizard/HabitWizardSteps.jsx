import React, { Suspense } from 'react';          // React and lazy loading
import PropTypes from 'prop-types';                // Prop types
import { formatScheduleSummary, toLocalISODate, isDueOnDate } from '../../lib/schedule.js'; // Date helpers
import { CUE_PRESETS } from '../../lib/cuePresets.js';

// Lazy-load the schedule picker to reduce initial bundle size
const SchedulePicker = React.lazy(() => import('../SchedulePicker.jsx'));

// Example phrases for build and break goals (used in GoalStep)
const BUILD_EXAMPLES = [
  'Read for 10 minutes every night',
  'Drink a glass of water after waking up',
  'Meditate for 5 minutes each morning',
  'Walk after dinner',
];
const BREAK_EXAMPLES = [
  'Stop scrolling social media before bed',
  'Quit checking email first thing in the morning',
  'Reduce late-night snacking',
  'Cut back on soda during the week',
];

// Options for "Make it easier" section (used in DetailsStep)
const EASIER_OPTIONS = ['Prepare materials', 'Set reminders', 'Start very small'];
const CUE_DETAIL_OPTIONS = {
  morning: ['Right after waking up', 'After breakfast', 'Before leaving home'],
  afterschool: ['Right after school', 'After snack', 'Before homework'],
  afternoon: ['After lunch', 'During a break', 'Before practice'],
  afterdinner: ['Right after dinner', 'Before cleanup', 'After dishes'],
  evening: ['After homework', 'After shower', 'Before relaxing'],
  bedtime: ['Before brushing teeth', 'After brushing teeth', 'Right before bed'],
};

// Simple inline error display component
function ErrorText({ message }) {
  if (!message) return null;
  return <div className="hw-error">{message}</div>;
}
ErrorText.propTypes = { message: PropTypes.string };

// Display a list of errors (from an object) – used in task form
export function TaskFormErrors({ errors }) {
  if (!errors) return null;
  return (
    <div className="hw-stack-sm">
      {Object.values(errors).map((message, index) => (
        <div key={index} className="hw-error">{message}</div>
      ))}
    </div>
  );
}
TaskFormErrors.propTypes = { errors: PropTypes.object };

// -------------------- Goal Step --------------------
export function GoalStep({
  habitType,
  title,
  whyItMatters,
  onTitleChange,
  onTitleBlur,
  isValidatingTitle,
  onWhyChange,
  onUseExample,
  error,
  inferredType,
  typeConfirmed,
  onConfirmType,
  goalStartDate,
  goalEndDate,
  onGoalStartChange,
  onGoalEndChange,
  hasGoalEndDate,
  onHasGoalEndDateChange,
  goalWindowError,
}) {
  // Choose examples based on current habit type (if known)
  const examples = habitType
    ? (habitType === 'break' ? BREAK_EXAMPLES : BUILD_EXAMPLES)
    : [...BUILD_EXAMPLES, ...BREAK_EXAMPLES];
  const question = habitType === 'break'
    ? 'What goal are you trying to change?'
    : 'What goal do you want to work toward?';

  return (
    <div className="hw-name-step">
      {/* Heading with a star icon */}
      <div className="hw-name-question">
        <span>✦</span>
        <span>{question}</span>
      </div>

      <div className="hw-goal-hint hw-mt8">
        Start with what you want to change. We’ll turn it into action plans next.
      </div>

      {/* Title input */}
      <input
        id="hw-goal-title"
        className={error ? 'hw-input invalid' : 'hw-input'}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={() => onTitleBlur && onTitleBlur()}
        placeholder={habitType === 'break' ? 'Stop scrolling on my phone before bed.' : 'Read for 10 minutes every night.'}
      />
      <ErrorText message={error} />
      {isValidatingTitle && <div className="muted hw-mt4">Validating title…</div>}

      <div className="hw-examples-box hw-mt8">
        <div className="hw-examples-label">
          <span>✨</span>
          <span>Need ideas? Try one of these examples:</span>
        </div>
        <div className="hw-examples-chips">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              className="hw-example-chip"
              onClick={() => onUseExample(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Type confirmation banners – shown when type is not yet confirmed */}
      {inferredType && !typeConfirmed && (
        <div className="hw-infer-banner hw-infer-required">
          <div className="hw-infer-title">One more thing before continuing</div>
          <div>
            {inferredType === 'break'
              ? 'Sounds like you want to change or reduce something. Is that right?'
              : 'Sounds like you want to build something new. Is that right?'}
          </div>
          <div className="hw-inline-actions">
            <button type="button" className="hw-infer-yes" onClick={() => onConfirmType(inferredType)}>
              Yes
            </button>
            <button
              type="button"
              className="hw-infer-no"
              onClick={() => onConfirmType(inferredType === 'break' ? 'build' : 'break')}
            >
              No
            </button>
          </div>
        </div>
      )}

      {!inferredType && title.trim().length > 3 && !typeConfirmed && (
        <div className="hw-infer-banner hw-infer-required">
          <div className="hw-infer-title">One more thing before continuing</div>
          <div>Is this a goal to build, or something you want to break?</div>
          <div className="hw-inline-actions">
            <button type="button" className="hw-infer-yes" onClick={() => onConfirmType('build')}>
              Build
            </button>
            <button type="button" className="hw-infer-no" onClick={() => onConfirmType('break')}>
              Break
            </button>
          </div>
        </div>
      )}

      {/* Goal window */}
      <div className="hw-section-card hw-mt12">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">📅</span>Goal dates
        </div>
        <div className="muted">The goal is the big date range. Each action plan can have its own smaller date range inside it.</div>

        <div className="hw-task-form-row hw-mt8">
          <div style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="hw-goal-start-date">Goal start date</label>
            <input
              id="hw-goal-start-date"
              type="date"
              className="hw-input"
              value={goalStartDate || ''}
              onChange={(e) => onGoalStartChange(e.target.value)}
            />
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="hw-goal-end-date">Goal end date</label>
            <input
              id="hw-goal-end-date"
              type="date"
              className="hw-input"
              value={goalEndDate || ''}
              min={goalStartDate || undefined}
              onChange={(e) => onGoalEndChange(e.target.value)}
              disabled={!hasGoalEndDate}
            />
          </div>
        </div>

        <label className="hw-inline-actions hw-mt8" htmlFor="hw-goal-has-end-date">
          <input
            id="hw-goal-has-end-date"
            type="checkbox"
            checked={hasGoalEndDate}
            onChange={(e) => onHasGoalEndDateChange(e.target.checked)}
          />
          <span>This goal has an end date</span>
        </label>

        <ErrorText message={goalWindowError} />
      </div>

      {/* "Why it matters" field */}
      <div className="hw-section-card hw-mt12">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">❤</span>Why this goal matters
        </div>
        <input
          id="hw-why-it-matters"
          name="whyItMatters"
          className="hw-input"
          value={whyItMatters}
          onChange={(e) => onWhyChange(e.target.value)}
          placeholder="Optional, but helpful. e.g. I want more energy and less stress."
        />
      </div>
    </div>
  );
}

GoalStep.propTypes = {
  habitType: PropTypes.string,
  title: PropTypes.string.isRequired,
  whyItMatters: PropTypes.string,
  onTitleChange: PropTypes.func.isRequired,
  onTitleBlur: PropTypes.func,
  isValidatingTitle: PropTypes.bool,
  onWhyChange: PropTypes.func.isRequired,
  onUseExample: PropTypes.func,
  error: PropTypes.string,
  inferredType: PropTypes.string,
  typeConfirmed: PropTypes.bool,
  onConfirmType: PropTypes.func.isRequired,
  goalStartDate: PropTypes.string,
  goalEndDate: PropTypes.string,
  onGoalStartChange: PropTypes.func.isRequired,
  onGoalEndChange: PropTypes.func.isRequired,
  hasGoalEndDate: PropTypes.bool.isRequired,
  onHasGoalEndDateChange: PropTypes.func.isRequired,
  goalWindowError: PropTypes.string,
  coinsPerCompletion: PropTypes.number,
  rewardGoalTitle: PropTypes.string,
  rewardGoalCostCoins: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

// -------------------- Details Step --------------------
export function DetailsStep({
  habitType,
  location,
  onLocationChange,
  triggers,
  triggerInput,
  onTriggerInputChange,
  onAddTrigger,
  onRemoveTrigger,
  makeItEasier,
  onToggleMakeItEasier,
  replacements,
  replacementInput,
  onReplacementInputChange,
  onAddReplacement,
  onEditReplacement,
  onRemoveReplacement,
  error,
}) {
  return (
    <div className="hw-stack-md">
      <div className="hw-info-banner">
        <span>ℹ️</span>
        <div>
          This step shapes the goal details. The actual calendar that appears on the homepage is set on each action plan in the next step.
        </div>
      </div>

      {/* Replacements section – only for break goals */}
      {habitType === 'break' && (
        <section className="hw-section-card">
          <div className="hw-section-card-title">
            <span className="hw-section-icon">🔁</span>What could you do instead?
          </div>
          <div className="muted">Required for break goals. This powers smarter action suggestions on the next step.</div>
          <div className="hw-col-gap8-mt8">
            <input
              className="hw-input"
              value={replacementInput.title}
              onChange={(e) => onReplacementInputChange('title', e.target.value)}
              placeholder="e.g. read 5 pages"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddReplacement();
                }
              }}
            />
            <input
              className="hw-input"
              value={replacementInput.cue}
              onChange={(e) => onReplacementInputChange('cue', e.target.value)}
              placeholder="Optional cue, e.g. when I reach for my phone"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddReplacement();
                }
              }}
            />
            <button type="button" className="hw-add-button" onClick={onAddReplacement}>
              + Add replacement idea
            </button>
          </div>

          <ErrorText message={error} />

          {replacements.length > 0 && (
            <div className="replacement-list hw-mt12">
              {replacements.map((item, index) => (
                <div key={`${item.title}-${index}`} className="replacement-item">
                  <div>
                    <strong>{item.title}</strong>
                    {item.cue ? <div className="muted">{item.cue}</div> : null}
                  </div>
                  <div>
                    <button type="button" className="tiny" onClick={() => onEditReplacement(index)}>
                      Edit
                    </button>
                    <button type="button" className="tiny" onClick={() => onRemoveReplacement(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Triggers */}
      <section className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">⚡</span>What usually triggers this?
        </div>
        <div className="hw-input-add-row">
          <input
            className="hw-input"
            value={triggerInput}
            onChange={(e) => onTriggerInputChange(e.target.value)}
            placeholder="e.g. after dinner, after class, when I wake up"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddTrigger();
              }
            }}
          />
          <button
            type="button"
            className="hw-add-icon-btn"
            onClick={onAddTrigger}
            disabled={!triggerInput.trim()}
          >
            ＋
          </button>
        </div>
        {triggers.length > 0 && (
          <div className="hw-flex-gap8-mt6">
            {triggers.map((trigger, index) => (
              <div key={`${trigger}-${index}`} className="hw-inline-flex chip">
                <span>{trigger}</span>
                <button type="button" className="tiny" onClick={() => onRemoveTrigger(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Location */}
      <section className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">📍</span>Where will it happen?
        </div>
        <input
          className="hw-input"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          placeholder="e.g. at home, in the kitchen, at the gym"
        />
      </section>

      {/* Make it easier */}
      <section className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">🪄</span>Make it easier
        </div>
        <div className="muted">Small supports that reduce friction.</div>
        <div className="hw-flex-gap8-mt6">
          {EASIER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={makeItEasier.includes(option) ? 'chip selected' : 'chip'}
              onClick={() => onToggleMakeItEasier(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      {/* Milestone rewards moved to the Rewards step */}
    </div>
  );
}
DetailsStep.propTypes = {
  habitType: PropTypes.string,
  location: PropTypes.string.isRequired,
  onLocationChange: PropTypes.func.isRequired,
  triggers: PropTypes.array.isRequired,
  triggerInput: PropTypes.string.isRequired,
  onTriggerInputChange: PropTypes.func.isRequired,
  onAddTrigger: PropTypes.func.isRequired,
  onRemoveTrigger: PropTypes.func.isRequired,
  makeItEasier: PropTypes.array.isRequired,
  onToggleMakeItEasier: PropTypes.func.isRequired,
  replacements: PropTypes.array.isRequired,
  replacementInput: PropTypes.shape({ title: PropTypes.string, cue: PropTypes.string }).isRequired,
  onReplacementInputChange: PropTypes.func.isRequired,
  onAddReplacement: PropTypes.func.isRequired,
  onEditReplacement: PropTypes.func.isRequired,
  onRemoveReplacement: PropTypes.func.isRequired,
  error: PropTypes.string,
  
};

// -------------------- Task Card (used in ActionPlansStep) --------------------
export function TaskCard({ task, index, onEdit, onRemove }) {
  const scheduleSummary = task?.schedule ? formatScheduleSummary(task.schedule) : '';
  const cueLabel = task?.cueLabel || task?.meta?.cueLabel || '';
  const cueDetail = task?.cueDetail || task?.meta?.cueDetail || '';
  const cueDisplay = cueDetail || cueLabel || task?.cue || '';

  return (
    <div className="hw-task-card">
      <div className="hw-between-row">
        <div>
          <strong>{task.title}</strong>

          <div className="muted hw-mt4">
            {cueDisplay ? `${cueDisplay} · ` : ''}
            {task.startDate || ''}
            {task.endDate ? ` – ${task.endDate}` : ''}
            {task.timeOfDay ? ` · ${task.timeOfDay}` : ''}
          </div>

          {cueLabel && (
            <div className="hw-task-card-cue">
              Cue: {cueLabel}
              {cueDetail && cueDetail !== cueLabel ? ` · ${cueDetail}` : ''}
            </div>
          )}

          {scheduleSummary && <div className="muted">{scheduleSummary}</div>}
        </div>
        <div>
          <button type="button" className="tiny" onClick={() => onEdit(index)}>Edit</button>
          <button type="button" className="tiny" onClick={() => onRemove(index)}>Remove</button>
        </div>
      </div>
    </div>
  );
}
TaskCard.propTypes = {
  task: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onEdit: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

// -------------------- Action Plans Step --------------------
export function ActionPlansStep({
  goal,
  tasks,
  taskForm,
  taskFormError,
  onTaskFormChange,
  onSaveTask,
  onRemoveTask,
  onEditTask,
  editingIndex,
  maxTasks,
  suggestedActionTitles = [],
  onUseSuggestion = null,
}) {
  const isEditing = editingIndex !== null && editingIndex !== undefined;
  const scheduleValue = taskForm?.schedule || null;
  const scheduleSummary = scheduleValue ? formatScheduleSummary(scheduleValue) : '';
  const selectedCuePreset = taskForm?.cuePreset || '';
  const selectedCueLabel = taskForm?.cueLabel || '';
  const cueDetailValue = taskForm?.cueDetail ?? taskForm?.cue ?? '';
  const cueDetailOptions = selectedCuePreset ? (CUE_DETAIL_OPTIONS[selectedCuePreset] || []) : [];

  return (
    <div className="hw-phase2">
      <div className="hw-info-banner">
        <span>📌</span>
        <div>
          These action plans are the pieces that get scheduled and shown on the homepage. The goal above is just the container.
        </div>
      </div>

      {/* Goal summary (read-only) */}
      <div className="hw-habit-summary">
        <div className="hw-habit-summary-row">
          <strong>{goal.title}</strong>
          <span className={`hw-habit-badge ${goal.type || 'build'}`}>
            {goal.type === 'break' ? 'Break goal' : 'Build goal'}
          </span>
        </div>
        <div className="muted">
          {goal.startDate}
          {goal.endDate ? ` – ${goal.endDate}` : ' – ongoing'}
        </div>
      </div>

      {/* List of existing tasks */}
      <div className="hw-task-list">
        {tasks.length > 0 ? (
          tasks.map((task, index) => (
            <TaskCard
              key={`${task.title}-${index}`}
              task={task}
              index={index}
              onEdit={onEditTask}
              onRemove={onRemoveTask}
            />
          ))
        ) : (
          <div className="hw-tasks-empty">
            <div className="hw-tasks-empty-icon">◌</div>
            <div>No action plans yet. Add your first one below.</div>
          </div>
        )}
      </div>

      {/* Task form */}
      <div className="hw-task-form">
        <div className="hw-task-form-header">
          <div className="hw-task-form-title">
            {isEditing ? 'Edit action plan' : 'Add new action plan'}
          </div>
          <div className="muted">
            {tasks.length} of {maxTasks} added
          </div>
        </div>

        {/* Server-suggested action titles (chips) */}
        {Array.isArray(suggestedActionTitles) && suggestedActionTitles.length > 0 && (
          <div className="hw-mt8">
            <div className="hw-examples-section-label">Suggested actions</div>
            <div className="hw-examples-chips hw-mt6">
              {suggestedActionTitles.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="hw-example-chip"
                  onClick={() => onUseSuggestion && onUseSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Special message for break goals */}
        {goal.type === 'break' && (
          <div className="hw-section-card hw-mb8">
            <div className="hw-section-card-title">
              <span className="hw-section-icon">🔁</span>For break goals
            </div>
            <div className="muted">
              Create actions that interrupt or replace the old pattern. We suggest replacement-style actions below.
            </div>
            {goal.replacements && goal.replacements.length > 0 && (
              <div className="hw-mt8 muted">Suggested: {goal.replacements[0].title}</div>
            )}
          </div>
        )}

        {/* Task title input */}
        <label htmlFor="hw-task-title">
          {goal.type === 'break' ? 'Replacement action name' : 'Action plan name'}
        </label>
        <input
          id="hw-task-title"
          className="hw-input"
          value={taskForm.title}
          onChange={(e) => onTaskFormChange('title', e.target.value)}
          placeholder={goal.type === 'break' ? 'e.g. Read instead of scrolling' : 'e.g. Read 10 pages'}
        />

        {/* Time row */}
        <div className="hw-task-form-row hw-mt8">
          <div style={{ minWidth: 140, maxWidth: 220 }}>
            <label htmlFor="hw-task-time">Time (optional)</label>
            <input
              id="hw-task-time"
              type="time"
              className="hw-input"
              value={taskForm.timeOfDay || ''}
              onChange={(e) => onTaskFormChange('timeOfDay', e.target.value)}
            />
          </div>
        </div>

        <div className="hw-mt8">
          <label>Schedule for this action plan</label>
          <div className="muted hw-mt4">
            Choose the repeat pattern and dates here.
          </div>

          <Suspense fallback={<div className="muted hw-mt8">Loading schedule options…</div>}>
            <SchedulePicker
              id="hw-task-frequency"
              value={scheduleValue}
              onChange={(nextSchedule) => onTaskFormChange('schedule', nextSchedule)}
            />
          </Suspense>

          {scheduleSummary && <div className="muted hw-mt8">{scheduleSummary}</div>}
        </div>

        {/* Cue picker */}
        <div className="hw-section-card hw-mt8">
          <div className="hw-section-card-title">
            <span className="hw-section-icon">⏱️</span>When should this happen?
          </div>

          <div className="muted">
            Pick one main cue so the homepage can group this action plan clearly.
          </div>

          <div className="hw-cue-grid hw-mt8">
            {CUE_PRESETS.map((preset) => {
              const isSelected = selectedCuePreset === preset.key;

              return (
                <button
                  key={preset.key}
                  type="button"
                  className={isSelected ? 'hw-cue-pill selected' : 'hw-cue-pill'}
                  onClick={() => {
                    const isChangingPreset = selectedCuePreset !== preset.key;
                    onTaskFormChange('cuePreset', preset.key);
                    onTaskFormChange('cueLabel', preset.label);
                    if (isChangingPreset) {
                      onTaskFormChange('cueDetail', '');
                    }
                    onTaskFormChange('cue', preset.label);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {selectedCuePreset && (
            <>
              <div className="hw-mt12">
                <div className="hw-examples-section-label">Quick trigger ideas</div>
                <div className="hw-examples-chips hw-mt6">
                  {cueDetailOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={cueDetailValue === option ? 'chip selected' : 'chip'}
                      onClick={() => {
                        onTaskFormChange('cueDetail', option);
                        onTaskFormChange('cue', option);
                      }}
                    >
                      {option}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="tiny"
                    onClick={() => {
                      onTaskFormChange('cueDetail', '');
                      onTaskFormChange('cue', selectedCueLabel || '');
                    }}
                  >
                    Clear detail
                  </button>
                </div>
              </div>

              <div className="hw-mt12">
                <label htmlFor="hw-task-cue-detail">Optional custom trigger detail</label>
                <input
                  id="hw-task-cue-detail"
                  className="hw-input"
                  value={cueDetailValue}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    onTaskFormChange('cueDetail', nextValue);
                    onTaskFormChange('cue', nextValue || selectedCueLabel || '');
                  }}
                  placeholder={`Optional. Example: ${cueDetailOptions[0] || selectedCueLabel}`}
                />
              </div>
            </>
          )}

          {!selectedCuePreset && (
            <div className="hw-cue-help hw-mt8">
              Choose one of the six cues above to continue shaping this action plan.
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="hw-mt12">
          <button type="button" className="hw-save-task-btn" onClick={onSaveTask}>
            {isEditing ? 'Save changes' : 'Save action plan'}
          </button>
        </div>

        {/* Task form errors */}
        <div className="hw-mt8">
          <TaskFormErrors errors={taskFormError} />
        </div>
      </div>
    </div>
  );
}
ActionPlansStep.propTypes = {
  goal: PropTypes.object.isRequired,
  tasks: PropTypes.array.isRequired,
  taskForm: PropTypes.object.isRequired,
  taskFormError: PropTypes.object,
  onTaskFormChange: PropTypes.func.isRequired,
  onSaveTask: PropTypes.func.isRequired,
  onRemoveTask: PropTypes.func.isRequired,
  onEditTask: PropTypes.func.isRequired,
  editingIndex: PropTypes.number,
  maxTasks: PropTypes.number.isRequired,
  suggestedActionTitles: PropTypes.array,
  onUseSuggestion: PropTypes.func,
};

// Helper to compute next 7 days due summary (used in ReviewLaunchStep)
function nextDueSummary(tasks) {
  const today = new Date();
  const upcoming = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const iso = toLocalISODate(date);
    const count = tasks.reduce(
      (total, task) => total + (task?.schedule && isDueOnDate(task.schedule, iso) ? 1 : 0),
      0
    );
    if (count > 0) {
      upcoming.push(
        `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${count}`
      );
    }
  }

  return upcoming.length > 0 ? upcoming : ['No upcoming due dates found in the next 7 days.'];
}

// -------------------- Review & Launch Step --------------------
export function ReviewLaunchStep({
  goal,
  tasks,
  savingFor,
  rewardGoalTitle,
  rewardGoalCostCoins,
  coinsPerCompletion,
  completionsNeeded,
  onSavingForChange,
  onRewardGoalTitleChange,
  onRewardGoalCostCoinsChange,
  onJumpToStep,
  detailsStepIndex = 1,
  actionsStepIndex = 2,
  onSubmit,
  saving = false,
  assignees = [],
  assigneeNames = [],
}) {
  const dueSummary = nextDueSummary(tasks);

  return (
    <div className="hw-review-step">
      {/* Hero section with checkmark */}
      <div className="hw-reward-hero">
        <div className="hw-review-check-circle">✓</div>
        <div className="hw-review-title">Review your goal</div>
        <div className="hw-review-sub">
          Everything looks good? Add a reward, double-check the action plans, and launch it.
        </div>
        {assignees.length > 0 && (
          <div className="hw-review-assignees">
            <span className="hw-review-assignees-label">
              {assignees.length === 1 ? 'Creating for' : `Creating ${assignees.length} goals for`}
            </span>
            <div className="hw-review-assignees-pills">
              {assigneeNames.map((name, i) => (
                <span key={assignees[i] ?? i} className="hw-review-assignee-pill">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reward box */}
      <div className="hw-reward-box">
        <div className="hw-reward-coins-row">✨ {coinsPerCompletion} coins</div>
        <div className="hw-reward-coins-sub">Earned for each completed action plan</div>

        <label className="hw-reward-field-label" htmlFor="hw-savingfor">
          What are you saving for?
        </label>
        <input
          id="hw-savingfor"
          className="hw-input"
          value={savingFor}
          onChange={(e) => onSavingForChange(e.target.value)}
          placeholder="e.g. a new book, a movie night, a nice dinner"
        />

        <label className="hw-reward-field-label" htmlFor="hw-goal-name">
          Reward goal name
        </label>
        <input
          id="hw-goal-name"
          className="hw-input"
          value={rewardGoalTitle}
          onChange={(e) => onRewardGoalTitleChange(e.target.value)}
          placeholder="e.g. My treat"
        />

        <label className="hw-reward-field-label" htmlFor="hw-goal-cost">
          Cost (coins)
        </label>
        <input
          id="hw-goal-cost"
          type="number"
          min="0"
          className="hw-input"
          value={rewardGoalCostCoins}
          onChange={(e) => onRewardGoalCostCoinsChange(e.target.value)}
          placeholder="100"
        />

        {completionsNeeded && (
          <div className="hw-goal-hint">
            💡 At {coinsPerCompletion} coins each, you will reach this in about {completionsNeeded} completed action plans.
          </div>
        )}
      </div>

      {/* Goal summary card */}
      <div className="hw-review-card">
        <div className="hw-between-row hw-review-card-header">
          <div>
            <div className="hw-review-card-label">Your goal</div>
            <div className="hw-review-habit-title">{goal.title}</div>
            <div className="muted">
              {goal.type === 'break' ? 'Break goal' : 'Build goal'} · {goal.startDate}
              {goal.endDate ? ` – ${goal.endDate}` : ' – ongoing'}
            </div>
            {goal.whyItMatters && (
              <div className="muted hw-mt8">Why it matters: {goal.whyItMatters}</div>
            )}
          </div>
          <button type="button" className="tiny" onClick={() => onJumpToStep(0)}>
            Edit
          </button>
        </div>
      </div>

      {/* Pattern & support summary */}
      <div className="hw-review-timeline">
        <div className="hw-between-row hw-review-card-header">
          <div>
            <div className="hw-review-timeline-label">Pattern & support</div>
            <ul className="hw-review-list">
              {goal.location && (
                <li>
                  <strong>Location:</strong> {goal.location}
                </li>
              )}
              {goal.triggers && goal.triggers.length > 0 && (
                <li>
                  <strong>Triggers:</strong> {goal.triggers.join(', ')}
                </li>
              )}
              {goal.makeItEasier && goal.makeItEasier.length > 0 && (
                <li>
                  <strong>Supports:</strong> {goal.makeItEasier.join(', ')}
                </li>
              )}
              {goal.replacements && goal.replacements.length > 0 && (
                <li>
                  <strong>Replacements:</strong>{' '}
                  {goal.replacements.map((item) => item.title).join(', ')}
                </li>
              )}
              {!goal.location &&
                (!goal.triggers || goal.triggers.length === 0) &&
                (!goal.makeItEasier || goal.makeItEasier.length === 0) &&
                (!goal.replacements || goal.replacements.length === 0) && (
                  <li className="muted">No extra pattern details added.</li>
                )}
            </ul>
          </div>
          <button type="button" className="tiny" onClick={() => onJumpToStep(detailsStepIndex)}>
            Edit
          </button>
        </div>
      </div>

      {/* Action plans summary */}
      <div className="hw-review-timeline">
        <div className="hw-between-row hw-review-card-header">
          <div>
            <div className="hw-review-timeline-label">Action plans</div>
            <div className="muted">
              {tasks.length} action plan{tasks.length === 1 ? '' : 's'} ready
            </div>
            <ul className="hw-review-list">
              {tasks.map((task, index) => (
                <li key={`${task.title}-${index}`}>
                  <strong>{task.title}</strong>
                  <span className="muted"> — {formatScheduleSummary(task.schedule)}</span>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="tiny" onClick={() => onJumpToStep(actionsStepIndex)}>
            Edit
          </button>
        </div>
      </div>

      {/* Next 7 days due summary */}
      <div className="hw-review-timeline">
        <div className="hw-review-timeline-label">Coming up next</div>
        <ul className="hw-review-list">
          {dueSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Create button */}
      <div className="hw-actions-end">
        <button type="button" className="hw-create-btn" onClick={onSubmit} disabled={saving}>
          {saving ? 'Creating…' : 'Create My Goal'}
        </button>
      </div>
    </div>
  );
}
ReviewLaunchStep.propTypes = {
  goal: PropTypes.object.isRequired,
  tasks: PropTypes.array.isRequired,
  savingFor: PropTypes.string.isRequired,
  rewardGoalTitle: PropTypes.string.isRequired,
  rewardGoalCostCoins: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  coinsPerCompletion: PropTypes.number.isRequired,
  completionsNeeded: PropTypes.number,
  onSavingForChange: PropTypes.func.isRequired,
  onRewardGoalTitleChange: PropTypes.func.isRequired,
  onRewardGoalCostCoinsChange: PropTypes.func.isRequired,
  onJumpToStep: PropTypes.func.isRequired,
  detailsStepIndex: PropTypes.number,
  actionsStepIndex: PropTypes.number,
  onSubmit: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  assignees: PropTypes.arrayOf(PropTypes.string),
  assigneeNames: PropTypes.arrayOf(PropTypes.string),
};