import React from 'react';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';

export default function Profile() {
  const { user, setUser } = useUser();

  //If  user is not logged in, prompt to log in
  if (!user) {
    return (
      <section className="container">
        <h1>Profile</h1>
        <p><a href="/login">You need to log in first</a></p>
      </section>
    );
  }

  const themeMode = user?.themeMode || (user?.theme === 'dark' ? 'dark' : 'light');
  const palette = user?.palette || 'gold';

  const handleModeChange = (event) => {
    const themeMode = event.target.value;
    setUser({ ...user, themeMode, theme: themeMode });
  };

  const handlePaletteChange = (event) => {
    const palette = event.target.value;
    setUser({ ...user, palette });
  };

  return (
    <section className="container">
      <h1>Profile</h1>
      <p className="sub hero">Your account information</p>

      <div className="card" style={{ padding: '2.5rem 2rem', maxWidth: '780px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <p><strong>Name:</strong> {user.name}</p>
            {user.role === ROLE.CHILD ? (
              <p><strong>Username:</strong> {user.username}{user.code ? `#${user.code}` : ''}</p>
            ) : (
              <p><strong>Email:</strong> {user.email}</p>
            )}
            <p><strong>Age:</strong> {user.age}</p>
            <p><strong>Role:</strong> {user.role === ROLE.PARENT ? 'Parent' : user.role === ROLE.PROVIDER ? 'Provider' : user.role === ROLE.CHILD ? 'Child' : 'User'}</p>
          </div>
          <div>
            <p><strong>Total Tasks Completed:</strong> {user.stats?.tasksCompleted || 0}</p>
            <p><strong>Total Habits Built:</strong> {user.stats?.habitsBuilt || 0}</p>
            <p><strong>Total Habits Broken:</strong> {user.stats?.habitsBroken || 0}</p>
            <p><strong>Longest Streak:</strong> {user.stats?.longestStreak || "0 days"}</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.8rem 1.5rem', maxWidth: '820px', marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Theme</h3>
        <p className="sub" style={{ marginBottom: '1rem' }}>Choose your palette and mode.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '0.6rem' }}>Palette</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { value: 'gold', label: 'Gold Dust' },
                { value: 'cool', label: 'Cool Systems' },
                { value: 'morning', label: 'Morning Routine' },
              ].map((opt) => (
                <label key={opt.value} className="auth-label" style={{ width: 'fit-content', margin: 0, padding: '0.35rem 0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{opt.label}</span>
                  <input
                    type="radio"
                    name="palette"
                    value={opt.value}
                    checked={palette === opt.value}
                    onChange={handlePaletteChange}
                    style={{ width: 'auto' }}
                  />
                </label>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '0.6rem' }}>Mode</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label className="auth-label" style={{ width: 'fit-content', margin: 0, padding: '0.35rem 0.5rem' }}>
                <span style={{ fontWeight: 600 }}>Light</span>
                <input
                  type="radio"
                  name="themeMode"
                  value="light"
                  checked={themeMode !== 'dark'}
                  onChange={handleModeChange}
                  style={{ width: 'auto' }}
                />
              </label>
              <label className="auth-label" style={{ width: 'fit-content', margin: 0, padding: '0.35rem 0.5rem' }}>
                <span style={{ fontWeight: 600 }}>Dark</span>
                <input
                  type="radio"
                  name="themeMode"
                  value="dark"
                  checked={themeMode === 'dark'}
                  onChange={handleModeChange}
                  style={{ width: 'auto' }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
