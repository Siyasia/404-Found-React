import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { childList } from '../lib/api/children.js';
import { taskList, taskUpdate, taskListPending, taskCreate } from '../lib/api/tasks.js';
import { Task } from '../models';
import Toast from '../components/Toast.jsx';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

function normalizeId(val) {
  return val === undefined || val === null ? null : String(val);
}

function getTaskType(task) {
  return task?.taskType || task?.type || 'simple';
}

function getAssigneeId(task) {
  return task?.assigneeId || task?.childId || null;
}

function getFrequency(task) {
  return task?.frequency || task?.repeat || '';
}

function isDueToday(task, now = new Date()) {
  const freq = getFrequency(task) || 'daily';
  const day = now.getDay(); // 0=Sun
  if (freq === 'daily') return true;
  if (freq === 'weekdays') return day >= 1 && day <= 5;
  if (freq === 'weekends') return day === 0 || day === 6;
  if (freq === 'weekly') return true;
  if (freq === 'monthly') return true;
  return false;
}

function completedToday(task, todayIso) {
  const dates = Array.isArray(task?.completedDates) ? task.completedDates : [];
  return dates.some((d) => {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.toISOString().slice(0, 10) === todayIso;
  });
}

function isMalformed(task) {
  const hasName = Boolean(task?.title || task?.name);
  const type = getTaskType(task);
  const repeat = getFrequency(task);
  const hasAssignee = Boolean(getAssigneeId(task));
  const typeValid = !type || ['simple', 'build-habit', 'break-habit'].includes(type);
  const repeatValid = !repeat || ['daily', 'weekdays', 'weekends', 'weekly', 'monthly'].includes(repeat);
  return !hasName || !type || !hasAssignee || !typeValid || !repeatValid;
}

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        borderRadius: '999px',
        padding: '6px 12px',
        border: active ? '2px solid rgba(79,70,229,.65)' : '1px solid rgba(148,163,184,.8)',
        background: active ? 'rgba(79,70,229,.08)' : 'rgba(255,255,255,.55)',
        color: '#0f172a',
        fontWeight: 700,
        fontSize: '0.9rem',
        lineHeight: '1.1rem',
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, number, detail, onClick }) {
  return (
    <button
      type="button"
      className="card"
      onClick={onClick}
      style={{
        padding: '12px 14px',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        border: '1px solid rgba(226,232,240,.9)',
        background: 'rgba(255,255,255,.65)',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: '0.75rem', letterSpacing: '0.04em', fontWeight: 800, color: '#64748b' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: '2rem', lineHeight: '2.25rem', fontWeight: 800, marginTop: '4px' }}>
        {number}
      </div>
      <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '2px' }}>{detail}</div>
    </button>
  );
}

function EmptyState({ title, description }) {
  return (
    <div style={{ padding: '10px 0', color: '#64748b' }}>
      <div style={{ fontWeight: 700, color: '#334155', marginBottom: '2px' }}>{title}</div>
      <div style={{ fontSize: '0.95rem' }}>{description}</div>
    </div>
  );
}

export default function ParentHomepage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [todayTab, setTodayTab] = useState('tasks'); // tasks | habits | approvals
  const [familyTab, setFamilyTab] = useState('kids'); // kids | pending | habits
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftChildId, setDraftChildId] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [childResp, taskResp, pendingResp] = await Promise.all([
          childList(),
          taskList(),
          taskListPending(),
        ]);

        if (childResp.status_code === 200 && Array.isArray(childResp.children)) {
          setChildren(childResp.children);
        }

        if (taskResp.status_code === 200 && Array.isArray(taskResp.tasks)) {
          setTasks(taskResp.tasks.map(Task.from));
        } else {
          setError('Failed to load tasks.');
        }

        if (pendingResp.status_code === 200 && Array.isArray(pendingResp.tasks)) {
          setPendingTasks(pendingResp.tasks.map(Task.from));
        }
      } catch (err) {
        console.error('[ParentHomepage] load error', err);
        setError('Failed to load data from server.');
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userId = useMemo(() => normalizeId(user?.id), [user]);
  const childIds = useMemo(() => new Set(children.map((c) => normalizeId(c.id))), [children]);
  const todayIso = todayString();

  const assigneeOptions = useMemo(() => {
    const options = [];
    if (userId) {
      options.push({ value: userId, name: user?.name || 'Me (parent)', type: 'parent' });
    }
    children.forEach((child) => {
      options.push({ value: normalizeId(child.id), name: child.name, type: 'child' });
    });
    return options;
  }, [children, user?.name, userId]);

  useEffect(() => {
    if (!draftChildId) {
      if (userId) return setDraftChildId(userId);
      if (children.length > 0) return setDraftChildId(normalizeId(children[0]?.id));
    }
    return undefined;
  }, [draftChildId, userId, children]);

  const tasksForKids = useMemo(
    () => tasks.filter((t) => childIds.has(normalizeId(getAssigneeId(t)))),
    [tasks, childIds]
  );

  // Include tasks/habits assigned to kids AND to the parent.
  const tasksForToday = useMemo(
    () =>
      tasks.filter((t) => {
        const assigneeKey = normalizeId(getAssigneeId(t));
        if (!assigneeKey) return false;
        return childIds.has(assigneeKey) || (userId && assigneeKey === userId);
      }),
    [tasks, childIds, userId]
  );

  const providerPendingApprovals = useMemo(
    () => pendingTasks.filter((t) => t.needsApproval && t.createdByRole === 'provider'),
    [pendingTasks]
  );

  const pendingSimpleTasks = useMemo(
    () =>
      tasksForToday.filter(
        (t) => !t.needsApproval && getTaskType(t) === 'simple' && t.status !== 'done'
      ),
    [tasksForToday]
  );

  const habitsDueToday = useMemo(
    () =>
      tasksForToday.filter(
        (t) =>
          !t.needsApproval &&
          getTaskType(t) !== 'simple' &&
          isDueToday(t) &&
          !completedToday(t, todayIso)
      ),
    [tasksForToday, todayIso]
  );

  const malformedTasks = useMemo(() => tasks.filter(isMalformed), [tasks]);

  const kidsNeedingAttention = useMemo(() => {
    const list = children
      .map((child) => {
        const kidTasks = tasksForKids.filter((t) => normalizeId(getAssigneeId(t)) === normalizeId(child.id));
        const kidPending = kidTasks.filter(
          (t) => !t.needsApproval && getTaskType(t) === 'simple' && t.status !== 'done'
        ).length;
        const kidHabitsDue = kidTasks.filter(
          (t) =>
            !t.needsApproval &&
            getTaskType(t) !== 'simple' &&
            isDueToday(t) &&
            !completedToday(t, todayIso)
        ).length;
        return {
          child,
          pending: kidPending,
          habitsDue: kidHabitsDue,
          total: kidPending + kidHabitsDue,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return list.slice(0, 4);
  }, [children, tasksForKids, todayIso]);

  const handleToggleTaskStatus = async (taskId) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextStatus = target.status === 'done' ? 'pending' : 'done';
    const payload = { id: taskId, status: nextStatus };
    const resp = await taskUpdate(payload);
    if (resp.status_code === 200) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? Task.from({ ...t, status: nextStatus }) : t))
      );
      setToast(`Marked ${(target.title || target.name || 'task')} ${nextStatus === 'done' ? 'done' : 'not done'}.`);
      setTimeout(() => setToast(''), 2500);
    } else {
      setError('Failed to update task status.');
    }
  };

  const handleToggleHabitCompleted = async (taskId) => {
    const today = todayString();
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const dates = Array.isArray(target.completedDates) ? [...target.completedDates] : [];
    const already = completedToday(target, today);
    const newDates = already
      ? dates.filter((d) => {
          const parsed = new Date(d);
          if (Number.isNaN(parsed.getTime())) return true;
          return parsed.toISOString().slice(0, 10) !== today;
        })
      : [...dates, today];

    const payload = { id: taskId, completedDates: newDates };
    const resp = await taskUpdate(payload);
    if (resp.status_code === 200) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? Task.from({ ...t, completedDates: newDates }) : t))
      );
      setToast(already ? 'Marked not done for today.' : 'Marked done for today.');
      setTimeout(() => setToast(''), 2500);
    } else {
      setError('Failed to update habit.');
    }
  };

  const quickReview = () => {
    if (todayTab === 'approvals') return navigate('/parent/dashboard?tab=approvals');
    return navigate('/parent/dashboard?tab=my-tasks');
  };

  const handleQuickAssign = async (e) => {
    e.preventDefault();
    setError('');
    if (!draftChildId) {
      setError('Please choose who to assign the task to.');
      return;
    }
    const title = draftTitle.trim();
    if (!title) {
      setError('Please enter a task name.');
      return;
    }

    const assigneeId = normalizeId(draftChildId);
    const isParentTarget = userId && assigneeId === userId;
    const targetChild = children.find((c) => normalizeId(c.id) === assigneeId);
    const assigneeName = isParentTarget ? (user?.name || 'You') : targetChild?.name || 'Unknown';

    const newTask = new Task({
      assigneeId,
      assigneeName,
      title,
      notes: draftNotes.trim(),
      taskType: 'simple',
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdById: user?.id || null,
      createdByName: user?.name || 'Parent',
      createdByRole: 'parent',
    });

    try {
      setAssigning(true);
      const resp = await taskCreate(newTask);
      if (resp.status_code === 200) {
        const withId = resp.id ? Task.from({ ...newTask.toJSON(), id: resp.id }) : newTask;
        setTasks((prev) => [...prev, withId]);
        setToast(`Assigned to ${assigneeName}.`);
        setTimeout(() => setToast(''), 2500);
        setDraftTitle('');
        setDraftNotes('');
      } else {
        setError('Failed to assign task. Please try again.');
      }
    } catch (err) {
      console.error('[ParentHomepage] quick assign error', err);
      setError('Failed to assign task. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (!user) {
    return (
      <section className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1>Parent home</h1>
        <p className="sub hero">You need to log in first.</p>
      </section>
    );
  }

  if (user?.role !== ROLE.PARENT) {
    return (
      <section className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1>Parent home</h1>
        <p className="sub hero">Only parents can view this page.</p>
      </section>
    );
  }

  const pageMaxWidth = { maxWidth: '1200px', margin: '0 auto', padding: '0 0 1.25rem' };

  const sectionGap = '16px';

  // --- Layout helpers (reduce wasted whitespace + add per-card scrolling) ---
  // Using clamp keeps it responsive while still giving the cards consistent height.
  const cardBase = {
    padding: '0.9rem 1.0rem',
    border: '1px solid rgba(226,232,240,.9)',
    background: 'rgba(255,255,255,.65)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  };

  const cardHeights = {
    // Align with the “User” home feel: compact top row, slightly taller second row.
    top: 'clamp(240px, 34vh, 280px)',
    mid: 'clamp(240px, 40vh, 320px)',
  };

  const cardHeader = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flex: '0 0 auto',
  };

  const cardBody = {
    marginTop: '12px',
    overflowY: 'auto',
    flex: '1 1 auto',
    minHeight: 0,
    maxHeight: '100%',
    paddingRight: '6px',
    scrollbarGutter: 'stable',
  };

  return (
    <div className="parent-shell">
      <Toast message={toast} type="success" onClose={() => setToast('')} />
      <div
        className="parent-home"
        style={{
          ...pageMaxWidth,
          display: 'flex',
          flexDirection: 'column',
          gap: sectionGap,
        }}
      >
        {/* HERO */}
        <div className="hero-row" style={{ padding: '0.35rem 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'end' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>
                {formatDate()}
              </div>
              <h1 style={{ marginBottom: '6px', fontSize: '30px', lineHeight: '36px' }}>
                {greeting}, {user?.name || 'Parent'}
              </h1>
              <p className="sub" style={{ fontSize: '15px', lineHeight: '22px', margin: 0 }}>
                Here&apos;s what needs your attention today.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn btn-parent-secondary"
                onClick={() => navigate('/parent/dashboard?tab=approvals')}
                style={{ height: '38px' }}
              >
                Approvals
              </button>
              <button
                type="button"
                className="btn btn-parent-primary"
                onClick={() => navigate('/parent/dashboard')}
                style={{ width: '180px', height: '38px' }}
              >
                Open dashboard
              </button>
            </div>
          </div>
        </div>

        {malformedTasks.length > 0 && (
          <div
            className="card"
            style={{
              border: '1px solid rgba(122, 155, 184, 0.35)',
              background: 'rgba(122, 155, 184, 0.08)',
              padding: '1rem 1.1rem',
            }}
          >
            <h2 style={{ marginBottom: '0.35rem' }}>Malformed habit data</h2>
            <p className="sub" style={{ marginBottom: '0.75rem' }}>
              We found data we cannot parse. Please manage these in the dashboard.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-parent-primary"
                onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
              >
                Fix in dashboard
              </button>
              <button
                type="button"
                className="btn btn-parent-secondary"
                onClick={() => setTasks((prev) => prev.filter((t) => !isMalformed(t)))}
              >
                Hide malformed items
              </button>
            </div>
          </div>
        )}

        {/* TOP GRID (like user home) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          {/* TODAY */}
          <div
            className="card"
            style={{
              ...cardBase,
              height: cardHeights.top,
              maxHeight: cardHeights.top,
              overflow: 'hidden',
            }}
          >
            <div style={cardHeader}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Today</h2>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={quickReview}
                style={{ height: '34px' }}
              >
                Review
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', flex: '0 0 auto' }}>
              <Chip active={todayTab === 'tasks'} onClick={() => setTodayTab('tasks')}>
                Tasks ({pendingSimpleTasks.length})
              </Chip>
              <Chip active={todayTab === 'habits'} onClick={() => setTodayTab('habits')}>
                Habits ({habitsDueToday.length})
              </Chip>
              <Chip active={todayTab === 'approvals'} onClick={() => setTodayTab('approvals')}>
                Approvals ({providerPendingApprovals.length})
              </Chip>
            </div>

            <div style={cardBody}>
              {todayTab === 'tasks' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {pendingSimpleTasks.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(226,232,240,.8)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <input
                          type="checkbox"
                          aria-label={`Mark ${t.title || t.name} done`}
                          checked={false}
                          onChange={() => handleToggleTaskStatus(t.id)}
                        />
                        <span style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.title || t.name}
                          </div>
                          <div style={{ fontSize: '.85rem', color: '#64748b' }}>
                            For {t.assigneeName || 'child'}
                          </div>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
                        style={{ height: '34px' }}
                      >
                        View
                      </button>
                    </li>
                  ))}
                  {pendingSimpleTasks.length === 0 && (
                    <li>
                      <EmptyState
                        title="No tasks to review"
                        description="Your kids are all caught up on simple tasks."
                      />
                    </li>
                  )}
                </ul>
              )}

              {todayTab === 'habits' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {habitsDueToday.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(226,232,240,.8)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <input
                          type="checkbox"
                          aria-label={`Mark ${t.title || t.name} done for today`}
                          checked={false}
                          onChange={() => handleToggleHabitCompleted(t.id)}
                        />
                        <span style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.title || t.name}
                          </div>
                          <div style={{ fontSize: '.85rem', color: '#64748b' }}>
                            For {t.assigneeName || 'child'} · {t.frequency || 'daily'}
                          </div>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
                        style={{ height: '34px' }}
                      >
                        View
                      </button>
                    </li>
                  ))}
                  {habitsDueToday.length === 0 && (
                    <li>
                      <EmptyState
                        title="No habits due"
                        description="No scheduled habits are due today."
                      />
                    </li>
                  )}
                </ul>
              )}

              {todayTab === 'approvals' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {providerPendingApprovals.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(226,232,240,.8)',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.title || t.name}
                        </div>
                        <div style={{ fontSize: '.85rem', color: '#64748b' }}>
                          For {t.assigneeName || 'child'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => navigate('/parent/dashboard?tab=approvals')}
                        style={{ height: '34px' }}
                      >
                        Review
                      </button>
                    </li>
                  ))}
                  {providerPendingApprovals.length === 0 && (
                    <li>
                      <EmptyState
                        title="No approvals"
                        description="Nothing is waiting for your approval right now."
                      />
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT SIDE STATS + CTA */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              height: cardHeights.top,
              gridAutoRows: '1fr',
              minHeight: 0,
            }}
          >
            <MiniStat
              label="Approvals"
              number={providerPendingApprovals.length}
              detail={providerPendingApprovals.length === 1 ? 'pending request' : 'pending requests'}
              onClick={() => navigate('/parent/dashboard?tab=approvals')}
            />
            <MiniStat
              label="Kids"
              number={children.length}
              detail={children.length === 1 ? 'connected child' : 'connected children'}
              onClick={() => navigate('/parent/dashboard?tab=children')}
            />
            <MiniStat
              label="Tasks"
              number={pendingSimpleTasks.length}
              detail="to review"
              onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
            />
            <MiniStat
              label="Habits"
              number={habitsDueToday.length}
              detail="due today"
              onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
            />
          </div>
        </div>

        {/* SECOND ROW */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          {/* QUICK ASSIGN (UI like user home) */}
          <div
            className="card"
            style={{
              ...cardBase,
              height: cardHeights.mid,
            }}
          >
            <div style={cardHeader}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Assign a task</h2>
              <div style={{ fontSize: '.85rem', color: '#64748b' }}>Quick draft (opens full screen)</div>
            </div>

            <form onSubmit={handleQuickAssign} style={cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px' }}>
                <div>
                  <label htmlFor="quick-title" style={{ fontWeight: 800, display: 'block', marginBottom: '6px' }}>
                    Task name
                  </label>
                  <input
                    id="quick-title"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Example: Read for 20 minutes"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(226,232,240,.9)' }}
                  />
                </div>

                <div>
                  <label htmlFor="quick-child" style={{ fontWeight: 800, display: 'block', marginBottom: '6px' }}>
                    Assign to
                  </label>
                  <select
                    id="quick-child"
                    value={draftChildId}
                    onChange={(e) => setDraftChildId(e.target.value)}
                    disabled={assigneeOptions.length === 0}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(226,232,240,.9)', background: 'rgba(255,255,255,.85)' }}
                  >
                    {assigneeOptions.length === 0 && <option value="">No available assignees</option>}
                    {assigneeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.name} {opt.type === 'child' ? '(child)' : '(me)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label htmlFor="quick-notes" style={{ fontWeight: 800, display: 'block', marginBottom: '6px' }}>
                  Notes (optional)
                </label>
                <textarea
                  id="quick-notes"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Add details or reminders"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(226,232,240,.9)', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-parent-primary"
                style={{ width: '100%', height: '44px', marginTop: '12px' }}
                disabled={assigneeOptions.length === 0 || assigning}
              >
                {assigning ? 'Assigning…' : 'Assign task'}
              </button>
            </form>
          </div>

          {/* FAMILY PANEL */}
          <div
            className="card"
            style={{
              ...cardBase,
              height: cardHeights.mid,
            }}
          >
            <div style={cardHeader}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Your family</h2>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/parent/dashboard?tab=children')}
                style={{ height: '34px' }}
              >
                Manage
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', flex: '0 0 auto' }}>
              <Chip active={familyTab === 'kids'} onClick={() => setFamilyTab('kids')}>
                Kids
              </Chip>
              <Chip active={familyTab === 'pending'} onClick={() => setFamilyTab('pending')}>
                Pending
              </Chip>
              <Chip active={familyTab === 'habits'} onClick={() => setFamilyTab('habits')}>
                Habits
              </Chip>
            </div>

            <div style={cardBody}>
              {familyTab === 'kids' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {kidsNeedingAttention.map(({ child, pending, habitsDue }) => (
                    <li
                      key={child.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(226,232,240,.8)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800 }}>{child.name}</div>
                        <div style={{ fontSize: '.85rem', color: '#64748b' }}>
                          {pending} tasks · {habitsDue} habits
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => navigate('/parent/dashboard?tab=children')}
                        style={{ height: '34px' }}
                      >
                        View
                      </button>
                    </li>
                  ))}
                  {kidsNeedingAttention.length === 0 && (
                    <li>
                      <EmptyState title="All caught up" description="No kids need attention right now." />
                    </li>
                  )}
                </ul>
              )}

              {familyTab === 'pending' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {pendingSimpleTasks.slice(0, 5).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(226,232,240,.8)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || t.name}
                        </div>
                        <div style={{ fontSize: '.85rem', color: '#64748b' }}>For {t.assigneeName || 'child'}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleToggleTaskStatus(t.id)}
                        style={{ height: '34px' }}
                      >
                        Mark done
                      </button>
                    </li>
                  ))}
                  {pendingSimpleTasks.length === 0 && (
                    <li>
                      <EmptyState title="No pending tasks" description="Nothing is waiting right now." />
                    </li>
                  )}
                </ul>
              )}

              {familyTab === 'habits' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {habitsDueToday.slice(0, 5).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(226,232,240,.8)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || t.name}
                        </div>
                        <div style={{ fontSize: '.85rem', color: '#64748b' }}>For {t.assigneeName || 'child'}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleToggleHabitCompleted(t.id)}
                        style={{ height: '34px' }}
                      >
                        Done today
                      </button>
                    </li>
                  ))}
                  {habitsDueToday.length === 0 && (
                    <li>
                      <EmptyState title="No habits" description="No habits are due today." />
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
        {loading && (
          <p className="sub" style={{ marginTop: '0.5rem' }}>
            Loading…
          </p>
        )}
      </div>
    </div>
  );
}
