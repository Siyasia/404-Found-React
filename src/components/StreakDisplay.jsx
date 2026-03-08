import React from 'react';

// PHASE 4: New read-only streak summary for action plans.
// This component only displays progress data already stored on the plan.
export default function StreakDisplay({ streakData, compact = false }) {
  const current = Number(streakData?.current ?? streakData?.currentStreak ?? 0) || 0;
  const longest = Number(streakData?.longest ?? streakData?.bestStreak ?? 0) || 0;
  const earnedBadges = Array.isArray(streakData?.earnedBadges)
    ? streakData.earnedBadges
    : [];

  const wrapStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: compact ? 8 : 10,
    flexWrap: 'wrap',
  };

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    border: '1px solid var(--hw-border)',
    background: 'var(--hw-surface-soft)',
    padding: compact ? '4px 8px' : '5px 10px',
    fontSize: compact ? '0.76rem' : '0.82rem',
    color: 'var(--hw-muted)',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  };

  const valueStyle = {
    fontWeight: 800,
    color: 'var(--hw-text)',
  };

  return (
    <div style={wrapStyle} aria-label="Streak summary">
      <span style={pillStyle}>
        <span role="img" aria-hidden="true">🔥</span>
        Current <span style={valueStyle}>{current}</span>
      </span>

      <span style={pillStyle}>
        <span role="img" aria-hidden="true">🏆</span>
        Best <span style={valueStyle}>{longest}</span>
      </span>

      <span style={pillStyle}>
        <span role="img" aria-hidden="true">✨</span>
        Badges <span style={valueStyle}>{earnedBadges.length}</span>
      </span>
    </div>
  );
}
