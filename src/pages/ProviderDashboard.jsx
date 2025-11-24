import React, { useEffect, useState } from 'react';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../roles.js';

const TASKS_KEY = 'ns.childTasks.v1';

export default function ProviderDashboard() {
  const { user } = useUser();
  const isProvider = user?.role === ROLE.PROVIDER;

  const [tasks, setTasks] = useState([]);

  const [targetType, setTargetType] = useState('child'); // 'child' or 'adult'
  const [childCode, setChildCode] = useState('');
  const [adultName, setAdultName] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TASKS_KEY);
      if (stored) {
        setTasks(JSON.parse(stored));
      }
    } catch {
      setTasks([]);
    }
  }, []);

  const saveTasks = (list) => {
    setTasks(list);
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedTitle) {
      setError('Please enter a task name.');
      return;
    }

    // CHILD TARGET (needs approval by parent)
    if (targetType === 'child') {
      const code = childCode.trim();
      if (!code) {
        setError('Please enter a child code.');
        return;
      }

      const newTask = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        assigneeId: null,
        assigneeName: null,
        childCode: code,
        targetType: 'child',
        targetName: null,
        title: trimmedTitle,
        notes: trimmedNotes,
        status: 'pending',
        needsApproval: true,
        createdAt: new Date().toISOString(),
        createdById: user?.id,
        createdByName: user?.name || 'Provider',
        createdByRole: 'provider',
      };

      const updated = [...tasks, newTask];
      saveTasks(updated);
      setChildCode('');
      setTitle('');
      setNotes('');
      return;
    }

    // ADULT TARGET (parent / normal user by name, no approval step)
    if (targetType === 'adult') {
      const trimmedAdultName = adultName.trim();
      if (!trimmedAdultName) {
        setError('Please enter the adult’s name.');
        return;
      }

      const newTask = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        assigneeId: null,          // we don't know their id, match by name later
        assigneeName: trimmedAdultName,
        childCode: null,
        targetType: 'adult',
        targetName: trimmedAdultName,
        title: trimmedTitle,
        notes: trimmedNotes,
        status: 'pending',
        needsApproval: false,      // goes straight to the user
        createdAt: new Date().toISOString(),
        createdById: user?.id,
        createdByName: user?.name || 'Provider',
        createdByRole: 'provider',
      };

      const updated = [...tasks, newTask];
      saveTasks(updated);
      setAdultName('');
      setTitle('');
      setNotes('');
      return;
    }
  };

  const myTasks = tasks.filter(
    (t) => t.createdByRole === 'provider' && t.createdById === user?.id
  );

  const getStatusLabel = (task) => {
    if (task.needsApproval) {
      return 'Waiting for parent approval';
    }

    // Now approved / directly assigned
    if (task.status === 'done' && task.assigneeName) {
      return `Completed by ${task.assigneeName}`;
    }

    if (task.assigneeName && task.status === 'pending') {
      return `Pending for ${task.assigneeName}`;
    }

    if (task.targetType === 'adult' && task.targetName && !task.assigneeId) {
      // Adult target by name, not yet completed
      return `Waiting for ${task.targetName} to complete`;
    }

    return 'Approved and assigned';
  };

  if (!user) {
    return (
      <section className="container">
        <h1>Provider dashboard</h1>
        <p className="sub hero">You need to log in first.</p>
      </section>
    );
  }

  if (!isProvider) {
    return (
      <section className="container">
        <h1>Provider dashboard</h1>
        <p className="sub hero">
          Only providers can create suggested tasks from this page.
        </p>
      </section>
    );
  }

  return (
    <section className="container">
      <h1>Provider dashboard</h1>
      <p className="sub hero">
        Create suggested tasks for children (by code) or adults (by name). Parent approval
        is required for children, but not for adults.
      </p>

      {/* Create provider task */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '780px' }}>
        <h2>Create a suggested task</h2>

        <form onSubmit={handleSubmit}>
          <label className="auth-label">
            Who is this task for?
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setError('');
              }}
            >
              <option value="child">Child (by code, parent approval)</option>
              <option value="adult">Adult (parent / user by name)</option>
            </select>
          </label>

          {targetType === 'child' && (
            <label className="auth-label">
              Child code
              <input
                type="text"
                value={childCode}
                onChange={(e) => setChildCode(e.target.value)}
                placeholder="Example: 483920"
              />
            </label>
          )}

          {targetType === 'adult' && (
            <label className="auth-label">
              Adult&apos;s name
              <input
                type="text"
                value={adultName}
                onChange={(e) => setAdultName(e.target.value)}
                placeholder="Exact name the user logs in with"
              />
            </label>
          )}

          <label className="auth-label">
            Task name
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Practice reading for 10 minutes"
            />
          </label>

          <label className="auth-label">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Example: Focus on new vocabulary words."
              rows={3}
            />
          </label>

          {error && (
            <p style={{ color: '#b91c1c', fontSize: '.95rem', marginTop: '.25rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
          >
            Submit task
          </button>
        </form>
      </div>

      {/* Provider's submitted tasks */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '780px' }}>
        <h2>Your submitted tasks</h2>

        {myTasks.length === 0 && (
          <p className="sub">
            You haven&apos;t submitted any tasks yet. Use the form above to
            create one.
          </p>
        )}

        {myTasks.length > 0 && (
          <ul style={{ marginTop: '1rem' }}>
            {myTasks
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((task) => (
                <li key={task.id} style={{ marginTop: '.35rem' }}>
                  <strong>{task.title}</strong>{' '}
                  {task.targetType === 'child' && (
                    <span style={{ opacity: 0.8 }}>
                      (Child code: {task.childCode})
                    </span>
                  )}
                  {task.targetType === 'adult' && (
                    <span style={{ opacity: 0.8 }}>
                      (Adult: {task.targetName})
                    </span>
                  )}
                  {task.notes && <> — {task.notes}</>}
                  <div style={{ fontSize: '.9rem', marginTop: '.15rem' }}>
                    {getStatusLabel(task)}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}
