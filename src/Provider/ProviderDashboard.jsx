import React, { useEffect, useState } from 'react';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { Task } from '../models';
import { taskCreate, taskList } from '../lib/api/tasks.js';

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
    async function func() {
      const stored = await taskList();
      if (stored.status_code === 200) {
        setTasks(Array.isArray(stored.tasks) ? stored.tasks : []);
      }
    } func();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedTitle) {
      setError('Please enter a task name.');
      return;
    }

    let needsApproval = false;
    let name = null;
    let code = null;

    if (targetType === 'child') {
      needsApproval = true;
      code = childCode.trim();
      if (!code) {
        setError('Please enter a child code.');
      }
    } else if (targetType === 'adult') {
        needsApproval = false;
        name = adultName.trim();
        if (!name) {
          setError('Please enter the adult’s name.');
        }
    }

    const newTask = new Task({
      assigneeId: null,
      assigneeName: name,
      childCode: code,
      targetType,
      targetName: name,
      title: trimmedTitle,
      notes: trimmedNotes,
      status: 'pending',
      needsApproval,
      createdAt: new Date().getTime(),
      createdById: user?.id,
      createdByName: user?.name || 'Provider',
      createdByRole: 'provider',
    });

    let response = await taskCreate(newTask);
    if (response.status_code === 200) {
      const added = response.task ? response.task : newTask;
      setTasks((prev) => [...prev, added]); // functional updater to avoid stale closure
      setAdultName('');
      setTitle('');
      setNotes('');
    } else {
      setError('Failed to create task. Please try again.');
    }
  }

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
