import React from 'react';
import { formatScheduleLabel, isDueOnDate, toLocalISODate } from '../lib/schedule.js';
import StreakDisplay from './StreakDisplay.jsx';
import {
  TASK_TYPE_BUILD_HABIT,
  TASK_TYPE_BREAK_HABIT,
} from '../models/index.js';
import '../dashboardTheme.css';

// action plans are now interactive on the first dashboard surface, with completion toggling delegated upward to a shared helper.
function getTypeLabel(plan) {
  if (plan?.taskType === TASK_TYPE_BREAK_HABIT) return 'Break'
  if (plan?.taskType === TASK_TYPE_BUILD_HABIT) return 'Build'
  return 'Habit'
}

function getScheduleText(plan) {
  return (
    plan?.frequencyLabel ||
    plan?.scheduleLabel ||
    formatScheduleLabel(plan?.schedule) ||
    formatScheduleLabel(plan?.frequency) ||
    'No schedule set'
  )
}

function getTriggerText(plan) {
  const replacements = Array.isArray(plan?.replacements)
    ? plan.replacements.filter(Boolean)
    : []

  return plan?.trigger || plan?.cue || replacements[0] || ''
}

function getDoneToday(plan, todayISO) {
  if (typeof plan?.completedToday === 'boolean') return plan.completedToday
  return plan?.completedDates?.[todayISO] === true
}

function isPlanDueToday(plan, todayISO) {
  const schedule =
    plan?.schedule && typeof plan.schedule === 'object'
      ? plan.schedule
      : plan?.frequency && typeof plan.frequency === 'object'
        ? plan.frequency
        : null

  if (!schedule) return true
  return isDueOnDate(schedule, todayISO || toLocalISODate())
}

export default function HabitPlanList({
  plans = [],
  todayISO = toLocalISODate(),
  onToggleCompletion,
  emptyTitle = 'No plans yet',
  emptyDescription = 'Action plans will appear here once saved.',
  limit = 6,
  showAssignee = false,
  showType = true,
  showTrigger = true,
  showStreak = true,
  hideCheckbox = false,
}) {
  const safePlans = Array.isArray(plans) ? plans : []
  const rows =
    limit == null || limit === Infinity
      ? safePlans
      : safePlans.slice(0, Math.max(0, Number(limit) || 0))

  if (rows.length === 0) {
    return (
      <div className="dashboard-emptyText">
        <div style={{ fontWeight: 700 }}>{emptyTitle}</div>
        <div>{emptyDescription}</div>
      </div>
    )
  }

  return (
    <ul className="habitPlanList" role="list">
      {rows.map((plan) => {
        const typeLabel = getTypeLabel(plan)
        const scheduleText = getScheduleText(plan)
        const triggerText = getTriggerText(plan)
        const assigneeLabel =
          plan?.assigneeName || plan?.assignee?.name || plan?.assignedToName || ''
        const doneToday = getDoneToday(plan, todayISO)
        const dueToday = isPlanDueToday(plan, todayISO)
        const toggleDisabled = !dueToday && !doneToday

        return (
          <li key={plan.id || `${plan.title}-${scheduleText}`} className="habitPlanRow">
            {!hideCheckbox && (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
                title={toggleDisabled ? 'This plan is not due today yet.' : doneToday ? 'Mark not done for today' : 'Mark done for today'}
              >
                <input
                  type="checkbox"
                  checked={doneToday}
                  disabled={toggleDisabled}
                  onChange={() => !toggleDisabled && onToggleCompletion && onToggleCompletion(plan)}
                  className="taskCheckbox"
                  aria-label={`${doneToday ? 'Mark not done' : 'Mark done'} for ${plan?.title || 'habit plan'}`}
                />
              </label>
            )}

            <div className="habitPlanMain">
              <div className="habitPlanTitleRow">
                <div className="habitPlanTitle">{plan?.title || 'Untitled plan'}</div>
                {showType && <span className="dashboardInlineChip">{typeLabel}</span>}
                {dueToday && !doneToday && <span className="dashboardInlineChip">Due today</span>}
                {doneToday && <span className="dashboardInlineChip">Done today</span>}
              </div>

              <div className="habitPlanMeta">
                <span>{scheduleText}</span>
                {showAssignee && assigneeLabel && <span>For {assigneeLabel}</span>}
                {showTrigger && triggerText && <span>Support: {triggerText}</span>}
              </div>
            </div>

            {showStreak && (
              <div className="habitPlanSide">
                <StreakDisplay
                  compact
                  streakData={{
                    current: plan?.currentStreak,
                    longest: plan?.bestStreak,
                    totalCompletions: plan?.totalCompletions,
                    earnedBadges: plan?.earnedBadges,
                  }}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
