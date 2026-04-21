import React from 'react'

export function StatCard({
  label,
  number,
  detail,
  icon,
  tone = 'blue',
  compact = false,
  onClick,
}) {
  const Element = onClick ? 'button' : 'div'

  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`parent-ui-card parent-ui-stat parent-ui-stat--${tone} ${compact ? 'is-compact' : ''} ${onClick ? 'is-clickable' : ''}`}
    >
      <div className="parent-ui-stat__icon" aria-hidden="true">
        {icon}
      </div>

      <div className="parent-ui-stat__content">
        <div className="parent-ui-stat__label app-meta-label">{label}</div>
        <div className="parent-ui-stat__number app-section-title">{number}</div>
        {detail ? <div className="parent-ui-stat__detail app-helper-text">{detail}</div> : null}
      </div>
    </Element>
  )
}

export function ActionCard({
  title,
  description,
  cta,
  secondaryCta,
  onClick,
  onSecondaryClick,
  icon = '✨',
}) {
  return (
    <section className="parent-ui-card parent-ui-action-card">
      <div className="parent-ui-action-card__icon" aria-hidden="true">
        {icon}
      </div>

      <div className="parent-ui-action-card__body">
        <h3 className="parent-ui-action-card__title app-card-title">{title}</h3>
        <p className="parent-ui-action-card__description app-helper-text">{description}</p>
      </div>

      <div className="parent-ui-action-card__actions">
        <button type="button" className="parent-ui-btn parent-ui-btn--primary app-button-label" onClick={onClick}>
          {cta}
        </button>

        {secondaryCta ? (
          <button
            type="button"
            className="parent-ui-btn parent-ui-btn--ghost app-button-label"
            onClick={onSecondaryClick}
          >
            {secondaryCta}
          </button>
        ) : null}
      </div>
    </section>
  )
}

export function ApprovalCard({ pendingCount = 0, onClick }) {
  const hasItems = pendingCount > 0

  return (
    <section className={`parent-ui-card parent-ui-approval-card ${hasItems ? 'has-items' : 'is-empty'}`}>
      <div className="parent-ui-approval-card__badge" aria-hidden="true">
        {hasItems ? '✓' : '•'}
      </div>

      <div className="parent-ui-approval-card__content">
        <h3 className="parent-ui-approval-card__title app-card-title">Approvals</h3>
        <p className="parent-ui-approval-card__description app-helper-text">
          {hasItems
            ? `${pendingCount} provider task${pendingCount === 1 ? '' : 's'} need approval.`
            : 'No approvals are waiting right now.'}
        </p>
      </div>

      <button
        type="button"
        className="parent-ui-btn parent-ui-btn--primary app-button-label"
        onClick={onClick}
        disabled={!hasItems}
      >
        Review
      </button>
    </section>
  )
}

export default {
  StatCard,
  ActionCard,
  ApprovalCard,
}
