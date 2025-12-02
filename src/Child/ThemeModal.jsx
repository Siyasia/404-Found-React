import React from 'react';

export default function ThemeModal({ open, theme, onSelect, onClose, onSave }) {
  return (
    <div className="auth-modal" hidden={!open} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="theme-title">
        <button className="auth-close" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="theme-title" style={{ marginTop: 0 }}>Choose your theme</h2>
        <p className="sub" style={{ marginTop: '.25rem' }}>Pick a color you like. You can change it anytime.</p>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <ThemeOption
            label="Blue"
            active={theme === 'blue'}
            onClick={() => onSelect('blue')}
            gradient="linear-gradient(135deg,#6366f1,#4338ca)"
          />
          <ThemeOption
            label="Pink"
            active={theme === 'pink'}
            onClick={() => onSelect('pink')}
            gradient="linear-gradient(135deg,#ec4899,#db2777)"
          />
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({ label, active, onClick, gradient }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        width: '160px',
        padding: '1rem',
        borderRadius: '1rem',
        border: active ? '2px solid #4f46e5' : '1px solid #e5e7eb',
        background: '#fff',
        boxShadow: active ? '0 8px 20px rgba(79,70,229,.25)' : '0 6px 16px rgba(0,0,0,.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '.5rem',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: gradient,
        boxShadow: '0 4px 12px rgba(0,0,0,.15)'
      }} />
      <span style={{ fontWeight: 600 }}>{label}</span>
    </button>
  );
}
