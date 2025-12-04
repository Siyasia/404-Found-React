import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import ParentHabitAssignment from './ParentHabitAssignment.jsx';
import Toast from '../components/Toast.jsx';

const CHILDREN_KEY = 'ns.children.v1';
const TASKS_KEY = 'ns.childTasks.v1';

function generateChildCode(existingChildren) {
  const existingCodes = new Set(
    existingChildren
      .map((c) => c.code)
      .filter(Boolean)
  );

  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (existingCodes.has(code));

  return code;
}

export default function ParentDashboard() {
  const { user } = useUser();
  const isParent = user?.role === ROLE.PARENT;

  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childError, setChildError] = useState('');
  const [childSuccess, setChildSuccess] = useState('');

  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskError, setTaskError] = useState('');
  const [taskSuccess, setTaskSuccess] = useState('');

  useEffect(() => {
    try {
      const storedChildren = localStorage.getItem(CHILDREN_KEY);
      if (storedChildren) {
        setChildren(JSON.parse(storedChildren));
      }
    } catch (err) {
      console.error('Failed to load children', err);
    }

    try {
      const storedTasks = localStorage.getItem(TASKS_KEY);
      if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
      }
    } catch (err) {
      console.error('Failed to load tasks', err);
    }
  }, []);

  useEffect(() => {
    if (!taskAssigneeId && user?.id) {
      setTaskAssigneeId(user.id);
    }
  }, [user, taskAssigneeId]);

  const saveChildren = (list) => {
    setChildren(list);
    try {
      localStorage.setItem(CHILDREN_KEY, JSON.stringify(list));
    } catch (err) {
      console.error('Failed to save children', err);
    }
  };

  const saveTasks = (list) => {
    setTasks(list);
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(list));
    } catch (err) {
      console.error('Failed to save tasks', err);
    }
  };

  const handleAddChild = (e) => {
    e.preventDefault();
    setChildError('');

    const name = childName.trim();
    const ageNumber = Number(childAge);

    if (!name || !childAge) {
      setChildError('Please enter a name and age for the child.');
      return;
    }

    if (ageNumber <= 0) {
      setChildError('Age must be a positive number.');
      return;
    }

    const newChild = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      age: ageNumber,
      code: generateChildCode(children),
      createdAt: new Date().toISOString(),
    };

    console.log('[ParentDashboard] Add child submit');
    const updated = [...children, newChild];
    saveChildren(updated);
    setChildName('');
    setChildAge('');
    setChildSuccess(`${newChild.name} added. Code: ${newChild.code}`);
    setTimeout(() => setChildSuccess(''), 3000);
  };

  const handleRemoveChild = (id) => {
    const updatedChildren = children.filter((c) => c.id !== id);
    saveChildren(updatedChildren);

    const updatedTasks = tasks.filter((t) => t.assigneeId !== id);
    saveTasks(updatedTasks);
  };

  const handleAssignTask = (e) => {
    e.preventDefault();
    setTaskError('');

    if (!taskAssigneeId) {
      setTaskError('Please select who this task is for.');
      return;
    }

    const title = taskTitle.trim();
    const notes = taskNotes.trim();

    if (!title) {
      setTaskError('Please enter a task name.');
      return;
    }

    const assignee =
      children.find((c) => c.id === taskAssigneeId) ||
      (user && user.id === taskAssigneeId ? user : null);

    const newTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      assigneeId: taskAssigneeId,
      assigneeName: assignee ? assignee.name : 'Unknown',
      title,
      notes,
      status: 'pending',
      needsApproval: false,
      childCode: assignee?.code || null,
      targetType: assignee?.code ? 'child' : 'adult',
      targetName: assignee?.code ? null : assignee?.name || null,
      createdAt: new Date().toISOString(),
      createdById: user?.id,
      createdByName: user?.name || 'Parent',
      createdByRole: 'parent',
    };

    const updated = [...tasks, newTask];
    saveTasks(updated);
    setTaskTitle('');
    setTaskNotes('');
  };

  const handleToggleTaskStatus = (taskId) => {
    console.log('[ParentDashboard] Toggle status', taskId);
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'done' ? 'pending' : 'done' }
          : t
      );
      saveTasks(updated);
      const changed = updated.find((t) => t.id === taskId);
      if (changed) {
        setTaskSuccess(`Marked ${changed.title || 'task'} ${changed.status === 'done' ? 'done' : 'not done'}.`);
        setTimeout(() => setTaskSuccess(''), 2500);
      }
      return updated;
    });
  };

  const providerPendingTasks = tasks.filter(
    (t) => t.needsApproval && t.createdByRole === 'provider'
  );

  const handleApproveProviderTask = (taskId) => {
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== taskId) return t;

        const child = children.find((c) => c.code === t.childCode);
        if (!child) {
          alert(
            `No child found with code ${t.childCode}. Add the child or correct the code before approving.`
          );
          return t;
        }

        return {
          ...t,
          assigneeId: child.id,
          assigneeName: child.name,
          needsApproval: false,
          approvedByParentId: user?.id,
          approvedAt: new Date().toISOString(),
        };
      });

      saveTasks(updated);
      return updated;
    });
  };

  const handleRejectProviderTask = (taskId) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    saveTasks(updated);
  };

  const getAssigneeLabel = (task) => {
    if (user && task.assigneeId === user.id) {
      return `${task.assigneeName} (you)`;
    }
    return task.assigneeName || 'Unknown';
  };

  // === Tasks for children ===
  const childIds = children.map((c) => c.id);
  const tasksForChildren = tasks.filter(
    (t) => t.assigneeId && childIds.includes(t.assigneeId)
  );

  if (!user) {
    return (
      <section className="container">
        <h1>Parent dashboard</h1>
        <p className="sub hero">You need to log in first.</p>
      </section>
    );
  }

  if (!isParent) {
    return (
      <section className="container">
        <h1>Parent dashboard</h1>
        <p className="sub hero">
          Only parents can manage child accounts and assign tasks from this page.
        </p>
      </section>
    );
  }

  return (
    <section className="container">
      <Toast message={childSuccess} type="success" onClose={() => setChildSuccess('')} />
      <Toast message={taskSuccess} type="success" onClose={() => setTaskSuccess('')} />
      <h1>Parent dashboard</h1>
      <p className="sub hero">
        Add child accounts, see their codes, assign your own tasks, and approve
        tasks submitted by providers.
      </p>

      {/* Embedded UI below; removed external navigation link */}

      {/* Add child */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '780px' }}>
        <h2>Add a child</h2>

        <form onSubmit={handleAddChild}>
          <label className="auth-label">
            Child&apos;s name <span aria-hidden="true" className="required-asterisk">*</span>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Example: Paxton"
              required
              aria-required="true"
            />
          </label>

          <label className="auth-label">
            Age <span aria-hidden="true" className="required-asterisk">*</span>
            <input
              type="number"
              min="1"
              value={childAge}
              onChange={(e) => setChildAge(e.target.value)}
              placeholder="Example: 10"
              required
              aria-required="true"
            />
          </label>

          {childError && (
            <p style={{ color: '#b91c1c', fontSize: '.95rem', marginTop: '.25rem' }}>
              {childError}
            </p>
          )}
          {childSuccess && (
            <p style={{ color: '#16a34a', fontSize: '.95rem', marginTop: '.25rem' }}>
              {childSuccess}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
          >
            Add child
          </button>
        </form>
      </div>

      {/* Children list */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '780px' }}>
        <h2>Your children</h2>

        {children.length === 0 && (
          <p className="sub">You haven&apos;t added any child accounts yet.</p>
        )}

        {children.length > 0 && (
          <ul style={{ marginTop: '1rem' }}>
            {children.map((child) => (
              <li
                key={child.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '.5rem',
                  marginTop: '.25rem',
                }}
              >
                <span>
                  <strong>{child.name}</strong> — {child.age} years old
                  {child.code && (
                    <> (Code: <code>{child.code}</code>)</>
                  )}
                </span>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleRemoveChild(child.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Embedded assign task / habit UI (replaces the old assign card) */}
      <div style={{ marginTop: '1.5rem', maxWidth: '780px' }}>
        <ParentHabitAssignment
          embed
          parentChildren={children}
          parentTasks={tasks}
          onTasksChange={saveTasks}
        />
      </div>

      {/* Tasks you've created (as parent) */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '780px' }}>
        <h2>Tasks you&apos;ve created</h2>

        {tasks.filter((t) => t.createdByRole === 'parent').length === 0 && (
          <p className="sub">
            You haven&apos;t created any tasks yet. Use the form above to create one,
            or approve tasks from providers below.
          </p>
        )}

        {tasks.filter((t) => t.createdByRole === 'parent').length > 0 && (
          <ul style={{ marginTop: '1rem' }}>
            {tasks
              .filter((t) => t.createdByRole === 'parent')
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((task) => (
                <li
                  key={task.id}
                  style={{
                    marginTop: '.35rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '.75rem',
                  }}
                >
                  <span>
                    <strong>{task.title}</strong> for{' '}
                    <span>{getAssigneeLabel(task)}</span>
                    {task.notes && <> — {task.notes}</>}
                    {task.status === 'done' && ' ✅'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleToggleTaskStatus(task.id)}
                  >
                    {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Tasks for your children (grouped by type, side-by-side) */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '100%' }}>
        <h2>Tasks for your children</h2>

        {tasksForChildren.length === 0 ? (
          <p className="sub">
            None of your children have tasks yet, or they haven't been assigned any.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Simple tasks */}
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h3>Simple Tasks</h3>
              <ul style={{ marginTop: '1rem' }}>
                {tasksForChildren
                  .filter((t) => (t.taskType || 'simple') === 'simple')
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((task) => {
                    const child = children.find((c) => c.id === task.assigneeId);
                    const childName = child ? child.name : 'Unknown child';
                    return (
                      <li key={task.id} style={{
                        marginTop: '.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem',
                      }}>
                        <span>
                          <strong>{task.title}</strong> for <span>{childName}</span>
                          {task.notes && <> — {task.notes}</>}
                          {' · '}<em>{task.status === 'done' ? 'Completed' : 'Pending'}</em>
                        </span>
                        <button type="button" className="btn btn-ghost" onClick={() => handleToggleTaskStatus(task.id)}>
                          {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>

            {/* Build habits */}
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h3>Build Habits</h3>
              <ul style={{ marginTop: '1rem' }}>
                {tasksForChildren
                  .filter((t) => (t.taskType || 'simple') === 'build-habit')
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((task) => {
                    const child = children.find((c) => c.id === task.assigneeId);
                    const childName = child ? child.name : 'Unknown child';
                    const steps = Array.isArray(task.steps) ? task.steps : [];
                    return (
                      <li key={task.id} style={{
                        marginTop: '.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem',
                      }}>
                        <span>
                          <strong>{task.title}</strong> for <span>{childName}</span>
                          {task.notes && <> — {task.notes}</>}
                          {' · '}<em>{task.status === 'done' ? 'Completed' : 'Pending'}</em>
                          <div style={{ fontSize: '.9rem', marginTop: '.25rem', opacity: 0.85 }}>
                            {steps.length > 0 && (
                              <div>
                                <strong>Steps:</strong>
                                <ol style={{ marginLeft: '1.25rem', marginTop: '.15rem' }}>
                                  {steps.map((s, idx) => (<li key={idx}>{s}</li>))}
                                </ol>
                              </div>
                            )}
                            {task.frequency && (
                              <div style={{ marginTop: '.15rem' }}>
                                <strong>Frequency:</strong> {task.frequency}
                              </div>
                            )}
                          </div>
                        </span>
                        <button type="button" className="btn btn-ghost" onClick={() => handleToggleTaskStatus(task.id)}>
                          {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>

            {/* Break habits */}
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h3>Break Habits</h3>
              <ul style={{ marginTop: '1rem' }}>
                {tasksForChildren
                  .filter((t) => (t.taskType || 'simple') === 'break-habit')
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((task) => {
                    const child = children.find((c) => c.id === task.assigneeId);
                    const childName = child ? child.name : 'Unknown child';
                    const reps = Array.isArray(task.replacements) ? task.replacements : [];
                    return (
                      <li key={task.id} style={{
                        marginTop: '.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem',
                      }}>
                        <span>
                          <strong>{task.habitToBreak || task.title}</strong> for <span>{childName}</span>
                          {task.notes && <> — {task.notes}</>}
                          {' · '}<em>{task.status === 'done' ? 'Completed' : 'Pending'}</em>
                          <div style={{ fontSize: '.9rem', marginTop: '.25rem', opacity: 0.85 }}>
                            {reps.length > 0 && (
                              <div>
                                <strong>Replacements:</strong>{' '}
                                <ul style={{ marginLeft: '1.25rem', marginTop: '.15rem', listStyle: 'disc' }}>
                                  {reps.map((r, idx) => (<li key={idx}>{r}</li>))}
                                </ul>
                              </div>
                            )}
                            {task.frequency && (
                              <div style={{ marginTop: '.15rem' }}>
                                <strong>Frequency:</strong> {task.frequency}
                              </div>
                            )}
                          </div>
                        </span>
                        <button type="button" className="btn btn-ghost" onClick={() => handleToggleTaskStatus(task.id)}>
                          {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Provider tasks awaiting approval */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '780px' }}>
        <h2>Provider tasks waiting for your approval</h2>

        {providerPendingTasks.length === 0 && (
          <p className="sub">
            There are no provider-submitted tasks waiting for approval.
          </p>
        )}

        {providerPendingTasks.length > 0 && (
          <ul style={{ marginTop: '1rem' }}>
            {providerPendingTasks.map((task) => (
              <li
                key={task.id}
                style={{
                  marginTop: '.35rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '.75rem',
                }}
              >
                <span>
                  <strong>{task.title}</strong>{' '}
                  <span style={{ opacity: 0.8 }}>
                    (Child code: {task.childCode}, from {task.createdByName})
                  </span>
                  {task.notes && <> — {task.notes}</>}
                </span>
                <span style={{ display: 'flex', gap: '.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleApproveProviderTask(task.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleRejectProviderTask(task.id)}
                  >
                    Reject
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
