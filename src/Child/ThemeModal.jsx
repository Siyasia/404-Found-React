import React from 'react';

export default function ThemeModal({ open, theme, onSelect, onClose, onSave }) {
  if (!open) return null;

  const options = [
    { key: 'pink', label: 'Pink Pop', gradient: 'linear-gradient(135deg,#ec4899,#f472b6)', accent: '#ec4899' },
    { key: 'blue', label: 'Calm Blue', gradient: 'linear-gradient(135deg,#6366f1,#3b82f6)', accent: '#6366f1' },
    { key: 'mint', label: 'Fresh Mint', gradient: 'linear-gradient(135deg,#34d399,#10b981)', accent: '#10b981' },
  ];

  return (
    <div
      className="auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ backdropFilter: 'blur(6px)' }}
    >
      <div className="auth-dialog" style={{ maxWidth: '520px', borderRadius: '18px', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
        <button className="auth-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="theme-title" style={{ marginTop: 0, marginBottom: '0.35rem' }}>
          Choose your theme
        </h2>
        <p className="sub" style={{ marginTop: 0 }}>Pick a vibe and we&apos;ll apply it across your dashboard.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '1rem' }}>
          {options.map((opt) => (
            <ThemeOption
              key={opt.key}
              active={theme === opt.key}
              label={opt.label}
              gradient={opt.gradient}
              accent={opt.accent}
              onClick={() => onSelect(opt.key)}
            />
          ))}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onSave}>
            Save theme
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({ label, active, gradient, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        border: active ? `2px solid ${accent}` : '1px solid #e5e7eb',
        background: '#fff',
        borderRadius: '14px',
        padding: '14px',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: active ? '0 12px 30px rgba(0,0,0,.12)' : '0 8px 18px rgba(0,0,0,.06)',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
    >
      <div
        style={{
          height: '76px',
          borderRadius: '12px',
          background: gradient,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.3)',
          marginBottom: '10px',
        }}
      />
      <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>{label}</div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>Tap to preview</div>
    </button>
  );
}
