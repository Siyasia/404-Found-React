import React from 'react';
import { formatScheduleLabel } from '../lib/schedule.js';
import StreakDisplay from './StreakDisplay.jsx';
import {
  TASK_TYPE_BUILD_HABIT,
  TASK_TYPE_BREAK_HABIT,
} from '../models/index.js';
import '../styles/dashboardTheme.css';

// PHASE 4: New read-only action-plan list for the dashboard surfaces.
// No completion toggles or mutation logic live here yet.
function getTypeLabel(plan) {
  if (plan?.taskType === TASK_TYPE_BREAK_HABIT) return 'Break';
  if (plan?.taskType === TASK_TYPE_BUILD_HABIT) return 'Build';
  return 'Habit';
}

function getScheduleText(plan) {
  return (
    plan?.scheduleLabel ||
    formatScheduleLabel(plan?.schedule) ||
    formatScheduleLabel(plan?.frequency) ||
    'No schedule set'
  );
}

function getTriggerText(plan) {
  const replacements = Array.isArray(plan?.replacements)
    ? plan.replacements.filter(Boolean)
    : [];

  return plan?.trigger || plan?.cue || replacements[0] || '';
}

export default function HabitPlanList({
  plans = [],
  emptyTitle = 'No plans yet',
  emptyDescription = 'Action plans will appear here once saved.',
  limit = 6,
  showAssignee = false,
  showType = true,
  showTrigger = true,
  showStreak = true,
}) {
  const safePlans = Array.isArray(plans) ? plans : [];
  const rows =
    limit == null || limit === Infinity
      ? safePlans
      : safePlans.slice(0, Math.max(0, Number(limit) || 0));

  if (rows.length === 0) {
    return (
      <div className="dashboard-emptyText">
        <div style={{ fontWeight: 700 }}>{emptyTitle}</div>
        <div>{emptyDescription}</div>
      </div>
    );
  }

  return (
    <ul className="habitPlanList" role="list">
      {rows.map((plan) => {
        const typeLabel = getTypeLabel(plan);
        const scheduleText = getScheduleText(plan);
        const triggerText = getTriggerText(plan);
        const assigneeLabel =
          plan?.assigneeName || plan?.assignee?.name || plan?.assignedToName || '';

        return (
          <li key={plan.id || `${plan.title}-${scheduleText}`} className="habitPlanRow">
            <div className="habitPlanMain">
              <div className="habitPlanTitleRow">
                <div className="habitPlanTitle">{plan?.title || 'Untitled plan'}</div>
                {showType && <span className="dashboardInlineChip">{typeLabel}</span>}
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
                    earnedBadges: plan?.earnedBadges,
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
