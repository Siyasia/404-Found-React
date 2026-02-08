import React, { useEffect, useState } from 'react';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { Task } from '../models';
import Toast from '../components/Toast.jsx';

const CHILDREN_KEY = 'ns.children.v1';
const TASKS_KEY = 'ns.childTasks.v1';

function generateId() {
  return (typeof crypto !== 'undefined' && crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
}

export default function ParentHabitAssignment({ embed = false, parentChildren = null, parentTasks = null, onTasksChange = null }) {
  const { user } = useUser();
  const isParent = user?.role === ROLE.PARENT;

  const [children, setChildren] = useState(parentChildren || []);
  const [tasks, setTasks] = useState(parentTasks || []);

  // Form state
  const [assigneeId, setAssigneeId] = useState('');
  const [taskType, setTaskType] = useState(''); // 'simple', 'build-habit', 'break-habit'
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  // Build habit fields (steps-only)
  const [steps, setSteps] = useState([]);
  const [newStep, setNewStep] = useState('');

  // Break habit fields
  const [habitToBreak, setHabitToBreak] = useState('');
  const [replacements, setReplacements] = useState([]);
  const [newReplacement, setNewReplacement] = useState('');

  // Recurrence
  const [frequency, setFrequency] = useState('daily');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load children + tasks from localStorage on mount unless parent passed them in
  useEffect(() => {
    if (parentChildren) {
      setChildren(parentChildren);
    } else {
      try {
        const storedChildren = localStorage.getItem(CHILDREN_KEY);
        if (storedChildren) setChildren(JSON.parse(storedChildren));
      } catch (err) {
        console.error('Failed to load children', err);
      }
    }

    if (parentTasks) {
      // normalize incoming list to Task instances
      setTasks(Array.isArray(parentTasks) ? parentTasks.map(Task.from) : []);
    } else {
      try {
        const storedTasks = localStorage.getItem(TASKS_KEY);
        if (storedTasks) {
          const parsed = JSON.parse(storedTasks);
          setTasks(Array.isArray(parsed) ? parsed.map(Task.from) : []);
        }
      } catch (err) {
        console.error('Failed to load tasks', err);
      }
    }
  }, [parentChildren, parentTasks]);

  // default assignee: first child if present, else the parent themself
  useEffect(() => {
    if (!assigneeId) {
      if (children.length > 0) setAssigneeId(children[0].id);
      else if (user?.id) setAssigneeId(user.id);
    }
  }, [children, assigneeId, user]);

  const saveTasks = (list) => {
    // Keep instances in state, but persist plain JSON
    setTasks(list);
    try {
      const serial = (list || []).map((t) => (t && typeof t.toJSON === 'function' ? t.toJSON() : t));
      if (onTasksChange) {
        onTasksChange(list);
      } else {
        localStorage.setItem(TASKS_KEY, JSON.stringify(serial));
      }
    } catch (err) {
      console.error('Failed to save tasks', err);
    }
  };

  const resetForm = () => {
    setTaskType('');
    setTitle('');
    setNotes('');
    setSteps([]);
    setNewStep('');
    setHabitToBreak('');
    setReplacements([]);
    setNewReplacement('');
    setFrequency('daily');
    setError('');
  };

  const selectedChild = children.find(c => c.id === assigneeId);
  const isAssigningToParent = user?.id && assigneeId === user.id;

  const handleAddStep = () => {
    const trimmed = newStep.trim();
    if (!trimmed) return;
    setSteps(prev => [...prev, trimmed]);
    setNewStep('');
  };

  const handleRemoveStep = (index) => setSteps(prev => prev.filter((_, i) => i !== index));

  const handleAddReplacement = () => {
    const trimmed = newReplacement.trim();
    if (!trimmed) return;
    setReplacements(prev => [...prev, trimmed]);
    setNewReplacement('');
  };

  const handleRemoveReplacement = (index) => setReplacements(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = () => {
    setError('');

    if (!isParent) {
      setError('Only parents can assign tasks.');
      return;
    }

    if (!assigneeId) {
      setError('Please select who to assign to.');
      return;
    }

    if (!taskType) {
      setError('Please choose what type of task to assign.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a task name or habit goal.');
      return;
    }

    if (taskType === 'build-habit') {
      if (steps.length === 0) {
        setError('Please add at least one step for this habit.');
        return;
      }
    }

    if (taskType === 'break-habit') {
      if (!habitToBreak.trim()) {
        setError('Please describe the habit to break.');
        return;
      }
      if (replacements.length === 0) {
        setError('Please add at least one replacement activity.');
        return;
      }
    }

    const assigneeName = isAssigningToParent ? (user?.name || 'You') : (selectedChild ? selectedChild.name : 'Unknown');

    const newTask = new Task({
      id: generateId(),
      assigneeId,
      assigneeName,
      title: title.trim(),
      notes: notes.trim(),
      taskType,
      ...(taskType === 'build-habit' && { steps }),
      ...(taskType === 'break-habit' && { habitToBreak: (habitToBreak.trim() || title.trim()), replacements }),
      ...(taskType !== 'simple' && { frequency, streak: 0, completedDates: [] }),
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdById: user?.id || null,
      createdByName: user?.name || 'Parent',
      createdByRole: 'parent',
    });

    console.log('[ParentHabitAssignment] Assign submit', { taskType, assigneeName });
    saveTasks([...tasks, newTask]);
    resetForm();
    setSuccess(`Assigned ${taskType || 'task'} to ${assigneeName}.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleToggleTaskStatus = (taskId) => {
    console.log('[ParentHabitAssignment] Toggle status', taskId);
    const updated = tasks.map((t) => {
      const obj = (t && typeof t.toJSON === 'function') ? t.toJSON() : t;
      if (!obj) return Task.from(obj);
      if (obj.id === taskId) obj.status = obj.status === 'done' ? 'pending' : 'done';
      return Task.from(obj);
    });
    saveTasks(updated);
    setTasks(updated);
    const changed = updated.find((t) => t.id === taskId);
    if (changed) {
      setSuccess(`Marked ${changed.title || 'task'} ${changed.status === 'done' ? 'done' : 'not done'}.`);
      setTimeout(() => setSuccess(''), 2500);
    }
  };

  if (!user) {
    return (
      <section className="container">
        <h1>Assign habits & tasks</h1>
        <p className="sub hero">You need to log in first.</p>
      </section>
    );
  }

  if (!isParent) {
    return (
      <section className="container">
        <h1>Assign habits & tasks</h1>
        <p className="sub hero">Only parents can assign tasks from this page.</p>
      </section>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Parent Dashboard — Assign tasks</h1>

      <Toast message={success} type="success" onClose={() => setSuccess('')} />
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>
          Assign to: {isAssigningToParent
            ? `${user?.name || 'You'} (you)`
            : selectedChild
              ? `${selectedChild.name} (${selectedChild.age})`
              : '—'}
        </h2>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Assign to <span aria-hidden="true" className="required-asterisk">*</span></span>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }} required aria-required="true">
            {user?.id && (
              <option value={user.id}>{user.name} (you)</option>
            )}
            {children.map(child => (
              <option key={child.id} value={child.id}>{child.name} ({child.age} years old)</option>
            ))}
          </select>
          {children.length === 0 && (
            <p style={{ margin: '.25rem 0 0', fontSize: '.9rem', color: '#6b7280' }}>
              No children yet — you can still assign tasks to yourself.
            </p>
          )}
        </label>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Type <span aria-hidden="true" className="required-asterisk">*</span></label>
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }} required aria-required="true">
                <option value="">Choose…</option>
                <option value="simple">Simple task</option>
                <option value="build-habit">Build habit</option>
                <option value="break-habit">Break habit</option>
              </select>
            </div>

            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                {taskType === 'simple' ? 'Task name' : (taskType === 'break-habit' ? 'Habit to break' : 'Habit name')}
              </span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }} required aria-required="true" />
            </label>

            {taskType === 'build-habit' && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="text" value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddStep()} placeholder="Add a step…" style={{ flex: 1, padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }} />
                  <button type="button" onClick={handleAddStep} style={{ padding: '0.75rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Add</button>
                </div>
                {steps.length > 0 && (
                  <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {steps.map((s, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{s}</span>
                        <button type="button" onClick={() => handleRemoveStep(i)} style={{ background: '#fee', color: '#b91c1c', border: '1px solid #fcc', borderRadius: '0.25rem' }}>Remove</button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {taskType === 'break-habit' && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="text" value={newReplacement} onChange={(e) => setNewReplacement(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddReplacement()} placeholder="Replacement activity…" style={{ flex: 1, padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }} />
                  <button type="button" onClick={handleAddReplacement} style={{ padding: '0.75rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Add</button>
                </div>
                {replacements.length > 0 && (
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {replacements.map((r, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{r}</span>
                        <button type="button" onClick={() => handleRemoveReplacement(i)} style={{ background: '#fee', color: '#b91c1c', border: '1px solid #fcc', borderRadius: '0.25rem' }}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {taskType !== 'simple' && (
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Frequency <span aria-hidden="true" className="required-asterisk">*</span></span>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }} required aria-required="true">
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays only</option>
                  <option value="weekends">Weekends only</option>
                </select>
              </label>
            )}

            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Notes (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontFamily: 'inherit' }} />
            </label>

            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            {success && <p style={{ color: '#16a34a', marginBottom: '1rem' }}>{success}</p>}

        <button type="button" onClick={handleSubmit} style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', border: 'none', borderRadius: '0.75rem' }}>Assign</button>
      </div>

      {tasks.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Assigned Tasks & Habits</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tasks.map(t => (
              <div key={t.id} style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', background: '#fafafa' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{t.taskType}</span>
                  <h3 style={{ margin: '0.25rem 0' }}>{t.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>For: {t.assigneeName}</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: t.status === 'done' ? '#14532d' : '#6b7280' }}>
                    Status: {t.status === 'done' ? 'Done ✅' : 'Pending'}
                  </p>
                </div>
                {t.notes && <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', fontStyle: 'italic', color: '#6b7280' }}>Note: {t.notes}</p>}
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => handleToggleTaskStatus(t.id)}>
                    {t.status === 'done' ? 'Mark not done' : 'Mark done'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
