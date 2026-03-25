import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import React, { useState, useEffect } from 'react';
import { friendsList, friendsAdd, friendsRemove } from '../lib/api/friends.js';
import { useGameProfile } from '../components/useGameProfile';
import { useItems } from '../components/useItems.jsx';
import { useInventory } from '../components/useInventory.jsx';
import { DisplayAvatar } from '../components/DisplayAvatar.jsx';

export default function Profile() {
  
  const { user, setUser } = useUser();
  const { profile, saveProfile, loading, error } = useGameProfile();
  const { items, loading: itemLoading, error: itemError } = useItems();
  const invItems = useInventory(profile, items);

  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState('');
  const [friendError, setFriendError] = useState('');

  const themeMode = user?.themeMode || (user?.theme === 'dark' ? 'dark' : 'light');
  const palette = user?.palette || 'gold';

  //Sprint 5: Comparing parent / provider for friends
  useEffect(() => {
    async function load() {
      if (user?.role === ROLE.PARENT || user?.role === ROLE.PROVIDER) return;
      const res = await friendsList();
      if (res.status === 200 && res.data?.friends) setFriends(res.data.friends);
    }
    load();
  }, [user]);


  if (loading || itemLoading) return <p>Loading...</p>;

  //If  user is not logged in, prompt to log in
  if (!user) {
    return (
      <section className="container">
        <h1>Profile</h1>
        <p><a href="/login">You need to log in first</a></p>
      </section>
    );
  }



  const handleModeChange = (event) => {
    const themeMode = event.target.value;
    setUser({ ...user, themeMode, theme: themeMode });
  };

  const handlePaletteChange = (event) => {
    const palette = event.target.value;
    setUser({ ...user, palette });
  };


  return (
    <section className="container" >
      <h1>Profile</h1>
      <p className="sub hero">Your account information</p>

      <div style={{ maxWidth: '100%', padding: '1.5rem', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          <div>
            <p><strong>Name:</strong> {user.name}</p>
            {user.role === ROLE.CHILD || user.role === ROLE.USER ? (
              <p><strong>Username:</strong> {user.username}{user.code ? `#${user.code}` : ''}</p>
            ) : (
              <p><strong>Email:</strong> {user.email}</p>
            )}
            <p><strong>Role:</strong> {user.role === ROLE.PARENT ? 'Parent' : user.role === ROLE.PROVIDER ? 'Provider' : user.role === ROLE.CHILD ? 'Child' : 'User'}</p>
          </div>

          <div>
            <p><strong>Total Tasks Completed:</strong> {user.stats?.tasksCompleted || 0}</p>
            <p><strong>Total Habits Built:</strong> {user.stats?.habitsBuilt || 0}</p>
            <p><strong>Total Habits Broken:</strong> {user.stats?.habitsBroken || 0}</p>
            <p><strong>Longest Streak:</strong> {user.stats?.longestStreak || "0 days"}</p>
          </div>

          <DisplayAvatar invItems={invItems} />

        </div>



      </div>

      {user.role !== ROLE.PARENT && user.role !== ROLE.PROVIDER && (
        <div className="card" style={{ padding: '1.8rem 1.5rem', maxWidth: '820px', marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Friends</h3>

          {friendError && <p style={{ color: 'crimson' }}>{friendError}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              placeholder="Add a friend (username or child username#code)"
            />
            <button
              className="btn"
              onClick={async () => {
                setFriendError('');
                const value = friendInput.trim();
                if (!value) return;
                const res = await friendsAdd(value);
                if (res.status !== 200) { setFriendError(res.data?.error || 'Failed to add friend'); return; }
                setFriends(res.data.friends || []);
                setFriendInput('');
              }}
            >
              Add
            </button>
          </div>
          
          <div className="friendsBox">
            {friends.length === 0 ? (
              <p style={{ margin: 0 }}>No friends yet.</p>
            ) : (
              <ul className="friendsList">
                {friends.map((f) => (
                  <li key={f} className="friendsListRow">
                    <span>{f}</span>
                    <button
                      className="btn"
                      onClick={async () => {
                        const res = await friendsRemove(f);
                        if (res.status !== 200) { setFriendError(res.data?.error || 'Failed to remove'); return; }
                        setFriends(res.data.friends || []);
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
