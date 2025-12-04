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

  const bg = type === 'error' ? '#fee2e2' : '#dcfce7';
  const border = type === 'error' ? '#fca5a5' : '#86efac';
  const color = type === 'error' ? '#991b1b' : '#14532d';

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      <div
        className="toast"
        style={{
          background: bg,
          color,
          border: `1px solid ${border}`,
          boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
        }}
      >
        {message}
      </div>
    </div>
  );
}
