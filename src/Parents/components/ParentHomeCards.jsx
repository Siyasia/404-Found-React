import React from 'react';

export function StatCard({ label, number, detail, icon, color = '#7a9bb8', gradient, compact = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        textAlign: 'left',
        width: '100%',
        background: gradient || 'white',
        border: '1px solid var(--parent-border, var(--border))',
        borderRadius: '1rem',
        padding: compact ? '0.9rem 1rem' : '1.25rem 1.35rem',
        boxShadow: '0 10px 30px -20px rgba(0,0,0,0.12)',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ fontSize: compact ? '1.4rem' : '1.6rem' }}>{icon}</div>
        <div>
          <div style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '0.15rem' }}>{label}</div>
          <div style={{ fontSize: compact ? '1.55rem' : '1.8rem', fontWeight: 800, color }}>{number}</div>
          {detail && <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.2rem' }}>{detail}</div>}
        </div>
      </div>
    </button>
  );
}

export function ActionCard({ title, description, cta, onClick }) {
  return (
    <div
      className="card"
      style={{
        border: '1px solid var(--parent-border, var(--border))',
        borderRadius: '1rem',
        padding: '1.1rem 1.25rem',
        background: 'linear-gradient(135deg, rgba(122, 155, 184, 0.08), rgba(45, 140, 138, 0.05))',
        boxShadow: '0 10px 30px -20px rgba(0,0,0,0.12)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h3>
          <p className="sub" style={{ margin: '0.15rem 0 0' }}>{description}</p>
        </div>
        <button type="button" className="btn btn-parent-primary" onClick={onClick}>
          {cta}
        </button>
      </div>
    </div>
  );
}

export function ApprovalCard({ variant = 'banner', pendingCount = 0, onClick }) {
  const hasItems = pendingCount > 0;
  const bg = hasItems ? 'rgba(15, 118, 110, 0.08)' : 'rgba(122, 155, 184, 0.08)';
  const text = hasItems ? `${pendingCount} provider task${pendingCount === 1 ? '' : 's'} need approval` : 'No approvals pending';
  return (
    <div
      className="card"
      style={{
        border: '1px solid var(--parent-border, var(--border))',
        borderRadius: '0.95rem',
        padding: variant === 'banner' ? '1rem 1.1rem' : '0.85rem 1rem',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem'
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Approvals</h3>
        <p className="sub" style={{ margin: '0.2rem 0 0' }}>{text}</p>
      </div>
      <button type="button" className="btn btn-parent-primary" onClick={onClick} disabled={!hasItems}>
        Review
      </button>
    </div>
  );
}

export default { StatCard, ActionCard, ApprovalCard };
