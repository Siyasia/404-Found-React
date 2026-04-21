import React, { useMemo, useState } from 'react'
import { formatScheduleSummary, toLocalISODate } from '../lib/schedule.js'
import HabitPlanList from './HabitPlanList.jsx'

// GoalCard stays mostly read-focused, but nested plans are now checkable.

function formatLongDate(iso) {
  if (!iso) return 'No start date'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'No start date'
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch {
    return 'No start date'
  }
}

function getTypeLabel(goal) {
  const raw = String(goal?.goalType || goal?.type || goal?.taskType || '').toLowerCase()
  if (raw.includes('build')) return 'Build'
  if (raw.includes('break')) return 'Break'
  return 'Habit'
}

function asTextList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => (typeof item === 'string' ? item : item?.title || item?.label || ''))
    .filter(Boolean)
}

export default function GoalCard({
  goal = {},
  actionPlans = [],
  todayISO,
  onToggleActionPlanCompletion,
}) {
  const [expanded, setExpanded] = useState(false)

  const title = goal.title || goal.goal || goal.name || 'Untitled goal'
  const typeLabel = getTypeLabel(goal)
  const assignee = goal.assigneeName || goal.assignedToName || goal.ownerName || 'Unassigned'
  const start = goal.startDate || goal.start || goal.createdAt || ''
  const startLabel = formatLongDate(start)

  const planCount = Array.isArray(actionPlans) ? actionPlans.length : 0
  const triggers = asTextList(goal.triggers)
  const replacements = asTextList(goal.replacements)
  const supports = asTextList(goal.makeItEasier)

  const normalizedPlans = useMemo(() => {
    const today = todayISO || toLocalISODate()
    return (Array.isArray(actionPlans) ? actionPlans : []).map((plan) => {
      const schedule =
        plan?.schedule && typeof plan.schedule === 'object'
          ? plan.schedule
          : plan?.frequency && typeof plan.frequency === 'object'
            ? plan.frequency
            : null

      return {
        ...plan,
        scheduleLabel: schedule ? formatScheduleSummary(schedule, today) : '',
      }
    })
  }, [actionPlans, todayISO])

  return (
    <article className="goalCard dashboard-card">
      <div className="goalCardHeader">
        <div className="goalCardMain">
          <div className="goalCardTitleRow">
            <h3 className="goalCardTitle app-card-title">{title}</h3>
            <span className="dashboardInlineChip app-micro-text" data-type={typeLabel}>{typeLabel}</span>
          </div>

          <div className="goalCardMeta">
            <span className="app-micro-text">For {assignee}</span>
            <span className="app-micro-text">{startLabel}</span>
            <span className="app-micro-text">
              {planCount} plan{planCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost app-button-label"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Hide details' : 'View details'}
        </button>
      </div>

      {expanded && (
        <div className="goalCardBody">
          <section className="goalCardSection">
            <div className="dashboard-section-label app-panel-title">Goal summary</div>
            <div className="goalCardBodyText app-body-text">
              <strong className="app-card-title">{title}</strong>
              {goal.startDate ? ` · ${goal.startDate}` : ''}
              {goal.endDate ? ` – ${goal.endDate}` : goal.startDate ? ' – ongoing' : ''}
            </div>
            {goal.whyItMatters && (
              <div className="goalCardMutedText app-helper-text">Why it matters: {goal.whyItMatters}</div>
            )}
          </section>

          <section className="goalCardSection">
            <div className="dashboard-section-label app-panel-title">Pattern & support</div>
            <ul className="goalCardBulletList">
              {goal.location && <li>Location: {goal.location}</li>}
              {triggers.length > 0 && <li>Triggers: {triggers.join(', ')}</li>}
              {supports.length > 0 && <li>Supports: {supports.join(', ')}</li>}
              {replacements.length > 0 && <li>Replacements: {replacements.join(', ')}</li>}
              {!goal.location &&
                triggers.length === 0 &&
                supports.length === 0 &&
                replacements.length === 0 && (
                  <li className="goalCardMutedText app-helper-text">No extra support details were added.</li>
                )}
            </ul>
          </section>

          <section className="goalCardSection">
            <div className="dashboard-section-label app-panel-title">Action plans</div>
            <HabitPlanList
              plans={normalizedPlans}
              todayISO={todayISO}
              onToggleCompletion={onToggleActionPlanCompletion}
              emptyTitle="No action plans saved"
              emptyDescription="This goal has not been broken into smaller plans yet."
              limit={Infinity}
              showAssignee={false}
              showType
              showTrigger
              showStreak
            />
          </section>

          <section className="goalCardSection">
            <div className="dashboard-section-label app-panel-title">Rewards</div>
            {(goal.rewardGoalTitle || goal.rewardGoalCostCoins || goal.savingFor) ? (
              <ul className="goalCardBulletList app-body-text">
                {goal.savingFor && <li>Saving for: {goal.savingFor}</li>}
                {goal.rewardGoalTitle && <li>Reward goal: {goal.rewardGoalTitle}</li>}
                {goal.rewardGoalCostCoins && <li>Cost: {goal.rewardGoalCostCoins} coins</li>}
              </ul>
            ) : (
              <div className="goalCardMutedText app-helper-text">No reward details added yet.</div>
            )}
          </section>
        </div>
      )}
    </article>
  )
}

