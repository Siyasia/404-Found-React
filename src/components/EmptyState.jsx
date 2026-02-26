import React from 'react';
import { Link } from 'react-router-dom';

export default function EmptyState({ icon, title, description, buttonLabel, buttonLink, buttonAction }) {
  return (
    <div style={{
      height: '72px',
      padding: '16px',
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '.95rem' }}>{title}</div>
          <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{description}</div>
        </div>
      </div>
      {buttonLink ? (
        <Link to={buttonLink} className="btn btn-ghost" style={{ padding: '.4rem .6rem', fontSize: '.85rem', whiteSpace: 'nowrap' }}>
          {buttonLabel}
        </Link>
      ) : buttonAction ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={buttonAction}
          style={{ padding: '.4rem .6rem', fontSize: '.85rem', whiteSpace: 'nowrap' }}
        >
          {buttonLabel}
        </button>
      ) : null}
    </div>
  );
}
