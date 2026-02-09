import React from 'react';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';

export default function Profile() {
  const { user } = useUser();

  if (!user) {
    return (
      <section className="container">
        <h1>Profile</h1>
        <p className="sub hero">You need to log in first.</p>
      </section>
    );
  }

  return (
    <section className="container">
      <h1>Profile</h1>
      <p className="sub hero">Your account information</p>

      <div className="card" style={{ padding: '2.5rem 2rem', maxWidth: '780px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
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
    </section>
  );
}
