import React from 'react';

function formatLongDate(iso) {
  if (!iso) return 'No start date';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'No start date';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch (err) {
    return 'No start date';
  }
}

// GoalCard.jsx — simple presentational component to display a goal in a list. Used on ParentHomepage and ChildHomepage.
// This component is intentionally dumb and focused on display. It receives all data as props and has no internal state or side effects.
export default function GoalCard({ goal = {}, actionPlans = [] }) {
  const title = goal.title || goal.goal || goal.name || 'Untitled goal'; // Fallback to 'Untitled goal' if no title-like field is found

  const rawType = goal.goalType || goal.type || goal.taskType || '';
  const typeLabel = rawType.includes('build') || rawType === 'build' ? 'Build' : 'Break'; // Normalize various type fields to a simple Build/Break label for display

  const assignee = goal.assigneeName || goal.assignedToName || goal.ownerName || 'Unassigned'; // Try multiple fields for assignee name, fallback to 'Unassigned'

  const start = goal.startDate || goal.start || goal.createdAt || ''; // Fallback to createdAt if startDate is missing, to ensure we always have a date to display
  const startLabel = formatLongDate(start);// If start is invalid or missing, formatLongDate will return 'No start date'

  const planCount = Array.isArray(actionPlans) ? actionPlans.length : 0; // In case actionPlans is not an array, default to 0 plans

  return (
    <div
      className="goal-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '10px 0',
        borderBottom: '1px solid rgba(226,232,240,.8)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div
            style={{
              borderRadius: '999px',
              padding: '4px 8px',
              border: '1px solid rgba(148,163,184,.8)',
              background: 'rgba(255,255,255,.6)',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.75rem',
              lineHeight: '1rem',
            }}
            title={typeLabel}
          >
            {typeLabel}
          </div>
        </div>

        <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: '6px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div>For {assignee}</div>
          <div>{startLabel}</div>
          <div>{planCount} plan{planCount === 1 ? '' : 's'}</div>
          {/* STREAK_DISPLAY_GOES_HERE */}
        </div>
      </div>

      <div>
        <button type="button" className="btn btn-ghost" style={{ height: '34px' }} onClick={() => {}}>
          View
        </button>
      </div>
    </div>
  );
}
