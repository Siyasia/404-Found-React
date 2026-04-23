import React, { useEffect, useState } from 'react';

export default function Toast({ message, type = 'success', duration = 3000, onClose }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onClose && onClose();
    }, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!visible || !message) return null;

  const bg = type === 'error' ? 'var(--app-danger-bg)' : 'var(--app-build-bg)';
  const border = type === 'error' ? 'var(--app-danger-border)' : 'var(--app-build-border)';
  const color = type === 'error' ? 'var(--app-danger-text)' : 'var(--app-build-text)';

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      <div
        className="toast"
        style={{
          background: bg,
          color,
          border: `1px solid ${border}`,
          boxShadow: 'var(--app-shadow-soft)',
        }}
      >
        {message}
      </div>
    </div>
  );
}
