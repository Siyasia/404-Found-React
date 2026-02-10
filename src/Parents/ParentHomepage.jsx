import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { StatCard, ApprovalCard } from './components/ParentHomeCards.jsx';
import { childList } from '../lib/api/children.js';
import { taskList, taskUpdate, taskListPending } from '../lib/api/tasks.js';
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

function getAssigneeKey(task) {
  const fromTopLevel =
    task?.assigneeId ??
    task?.assignee_id ??
    task?.childId ??
    task?.child_id ??
    task?.assignee?.id ??
    task?.childCode ??
    task?.child_code ??
    task?.meta?.assigneeId ??
    task?.meta?.assignee_id ??
    task?.meta?.childId ??
    task?.meta?.child_id ??
    task?.meta?.childCode ??
    task?.meta?.child_code ??
    null;

  return normalizeId(fromTopLevel);
}

function getTaskType(task) {
  return task?.taskType || task?.type || 'simple';
}

function getFrequency(task) {
  return task?.frequency || task?.repeat || '';
}

function isDueToday(task, now = new Date()) {
  const freq = getFrequency(task) || 'daily';
  const day = now.getDay();
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
  const hasAssignee = Boolean(getAssigneeKey(task));
  const typeValid = !type || ['simple', 'build-habit', 'break-habit'].includes(type);
  const repeatValid = !repeat || ['daily', 'weekdays', 'weekends', 'weekly', 'monthly'].includes(repeat);
  return !hasName || !type || !hasAssignee || !typeValid || !repeatValid;
}

export default function ParentHomepage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('your');
  const [activeTabRight, setActiveTabRight] = useState('your');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

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
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const todayIso = todayString();
  const userId = useMemo(() => normalizeId(user?.id), [user]);
  const childKeys = useMemo(() => {
    const ids = new Set();
    children.forEach((c) => {
      const idKey = normalizeId(c.id);
      const codeKey = normalizeId(c.code);
      if (idKey) ids.add(idKey);
      if (codeKey) ids.add(codeKey);
    });
    return ids;
  }, [children]);

  const childNameByKey = useMemo(() => {
    const map = {};
    children.forEach((c) => {
      const name = c.name || 'Child';
      const idKey = normalizeId(c.id);
      const codeKey = normalizeId(c.code);
      if (idKey) map[idKey] = name;
      if (codeKey) map[codeKey] = name;
    });
    return map;
  }, [children]);

  const getAssigneeName = (task) => {
    const direct = task?.assigneeName || task?.assignee_name || task?.assignee?.name;
    const byKey = childNameByKey[getAssigneeKey(task)];
    const byMeta = task?.meta?.assigneeName || task?.meta?.assignee_name;
    return direct || byKey || byMeta || 'Child';
  };

  const tasksForChildren = useMemo(
    () => tasks.filter((t) => childKeys.has(getAssigneeKey(t))),
    [tasks, childKeys]
  );

  const providerPendingApprovals = useMemo(
    () => pendingTasks.filter((t) => t.needsApproval && t.createdByRole === 'provider'),
    [pendingTasks]
  );

  const parentTasks = useMemo(
    () => tasks.filter((t) => getAssigneeKey(t) && userId && getAssigneeKey(t) === userId),
    [tasks, userId]
  );

  const pendingSimpleTasks = useMemo(
    () =>
      tasksForChildren.filter(
        (t) => !t.needsApproval && getTaskType(t) === 'simple' && t.status !== 'done'
      ),
    [tasksForChildren]
  );

  const habitsDueToday = useMemo(
    () =>
      tasksForChildren.filter(
        (t) =>
          !t.needsApproval &&
          getTaskType(t) !== 'simple' &&
          isDueToday(t) &&
          !completedToday(t, todayIso)
      ),
    [tasksForChildren, todayIso]
  );

  const kidsNeedingAttention = useMemo(() => {
    const list = children.map((child) => {
      const kidTasks = tasksForChildren.filter(
        (t) => getAssigneeKey(t) === normalizeId(child.id) || getAssigneeKey(t) === normalizeId(child.code)
      );
      const kidPending = kidTasks.filter(
        (t) => !t.needsApproval && getTaskType(t) === 'simple' && t.status !== 'done'
      ).length;
      const kidHabitsDue = kidTasks.filter(
        (t) =>
          !t.needsApproval && getTaskType(t) !== 'simple' && isDueToday(t) && !completedToday(t, todayIso)
      ).length;
      return { child, pending: kidPending, habitsDue: kidHabitsDue, total: kidPending + kidHabitsDue };
    });

    return list
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [children, tasksForChildren, todayIso]);

  const malformedTasks = useMemo(() => tasks.filter(isMalformed), [tasks]);

  async function handleToggleTaskStatus(taskId) {
    try {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const current = Task.from(t);
          const nextStatus = current.status === 'done' ? 'pending' : 'done';
          return Task.from({ ...current.toJSON(), status: nextStatus });
        })
      );

      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const current = Task.from(task);
        const updated = Task.from({ ...current.toJSON(), status: current.status === 'done' ? 'pending' : 'done' });
        await taskUpdate(updated.toJSON());
      }
      setToast('Task updated.');
    } catch (err) {
      console.error('[ParentHomepage] toggle task error', err);
      setError('Could not update task status.');
    }
  }

  async function handleToggleHabitCompleted(taskId) {
    try {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const current = Task.from(t);
          const dates = Array.isArray(current.completedDates) ? [...current.completedDates] : [];
          const already = completedToday(current, todayIso);
          const nextDates = already
            ? dates.filter((d) => d && d.slice(0, 10) !== todayIso)
            : [...dates, todayIso];
          return Task.from({ ...current.toJSON(), completedDates: nextDates });
        })
      );

      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const current = Task.from(task);
        const dates = Array.isArray(current.completedDates) ? [...current.completedDates] : [];
        const already = completedToday(current, todayIso);
        const nextDates = already
          ? dates.filter((d) => d && d.slice(0, 10) !== todayIso)
          : [...dates, todayIso];
        const updated = Task.from({ ...current.toJSON(), completedDates: nextDates });
        await taskUpdate(updated.toJSON());
      }
      setToast('Habit progress saved.');
    } catch (err) {
      console.error('[ParentHomepage] toggle habit error', err);
      setError('Could not update habit.');
    }
  }

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

  const panelStyle = {
    height: '240px',
    minHeight: '220px',
    overflow: 'hidden',
    padding: '14px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div className="parent-shell">
      <Toast message={toast} type="success" onClose={() => setToast('')} />
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px',
          minHeight: 'calc(100vh - 64px)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gridTemplateRows: 'auto auto auto',
            gap: '16px',
            width: '100%',
            alignContent: 'start',
          }}
        >
          <div
            className="card"
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              padding: '16px 18px',
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="pill" style={{ marginBottom: '10px' }}>
                {formatDate()}
              </div>
              <h1 style={{ margin: 0, fontSize: '28px', lineHeight: '34px' }}>
                {greeting}, {user?.name || 'Parent'}
              </h1>
              <p className="sub" style={{ margin: '6px 0 0', fontSize: '15px' }}>
                Here&apos;s what needs your attention today.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-parent-secondary"
                onClick={() => navigate('/parent/dashboard?tab=approvals')}
              >
                Approvals
              </button>
              <button
                type="button"
                className="btn btn-parent-primary"
                onClick={() => navigate('/parent/dashboard')}
                style={{ minWidth: '180px' }}
              >
                Open dashboard
              </button>
            </div>
          </div>

          <div
            className="card"
            style={{
              gridColumn: '1',
              gridRow: '2',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minHeight: '220px',
              maxHeight: '260px',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Today for your family</h2>
              <span style={{ fontSize: '.9rem', color: '#64748b' }}>{formatDate()}</span>
            </div>
            <ApprovalCard
              variant="banner"
              pendingCount={providerPendingApprovals.length}
              onClick={() => navigate('/parent/dashboard?tab=approvals')}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', overflow: 'hidden' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', maxHeight: '180px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '.85rem', color: '#64748b', fontWeight: 600 }}>Pending tasks</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
                  {pendingSimpleTasks.slice(0, 3).map((t) => (
                    <li key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>For {getAssigneeName(t)}</div>
                      </div>
                      <button type="button" className="btn btn-ghost" onClick={() => handleToggleTaskStatus(t.id)}>Done</button>
                    </li>
                  ))}
                  {pendingSimpleTasks.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>No pending tasks.</li>
                  )}
                </ul>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', maxHeight: '180px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '.85rem', color: '#64748b', fontWeight: 600 }}>Habits due today</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
                  {habitsDueToday.slice(0, 3).map((t) => (
                    <li key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>For {getAssigneeName(t)}</div>
                      </div>
                      <button type="button" className="btn btn-ghost" onClick={() => handleToggleHabitCompleted(t.id)}>Done today</button>
                    </li>
                  ))}
                  {habitsDueToday.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>No habits due.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div
            style={{
              gridColumn: '2',
              gridRow: '2',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
            }}
          >
            <StatCard
              label="Children"
              number={children.length}
              detail={`${children.length} connected`}
              icon="👧"
              color="#7a9bb8"
              gradient="linear-gradient(135deg, rgba(122, 155, 184, 0.06), rgba(122, 155, 184, 0.02))"
              compact
              onClick={() => navigate('/parent/dashboard?tab=children')}
            />
            <StatCard
              label="Pending tasks"
              number={pendingSimpleTasks.length}
              detail="Simple tasks to review"
              icon="✅"
              color="#2d8c8a"
              gradient="linear-gradient(135deg, rgba(45, 140, 138, 0.08), rgba(45, 140, 138, 0.02))"
              compact
              onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
            />
            <StatCard
              label="Habits due"
              number={habitsDueToday.length}
              detail="Scheduled today"
              icon="⏳"
              color="#475569"
              gradient="linear-gradient(135deg, rgba(148, 163, 184, 0.08), rgba(148, 163, 184, 0.02))"
              compact
              onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
            />
            <StatCard
              label="Approvals"
              number={providerPendingApprovals.length}
              detail="Provider requests"
              icon="📥"
              color="#334155"
              gradient="linear-gradient(135deg, rgba(51, 65, 85, 0.08), rgba(51, 65, 85, 0.02))"
              compact
              onClick={() => navigate('/parent/dashboard?tab=approvals')}
            />
          </div>

          <div className="card" style={{ gridColumn: '1', gridRow: '3', ...panelStyle }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className={`btn ${activeTab === 'your' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('your')}
              >
                Your tasks
              </button>
              <button
                type="button"
                className={`btn ${activeTab === 'habits' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('habits')}
              >
                Habits
              </button>
              <div style={{ marginLeft: 'auto', fontSize: '.9rem', color: '#6b7280' }}>
                {providerPendingApprovals.length > 0
                  ? `${providerPendingApprovals.length} approvals`
                  : 'No approvals'}
              </div>
            </div>

            <div style={{ overflow: 'auto', flex: 1 }}>
              {activeTab === 'your' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {parentTasks.slice(0, 4).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.title || t.name}
                        </div>
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{t.notes || ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '.85rem', color: '#6b7280' }}>
                          {t.status === 'done' ? 'Done' : 'Pending'}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleToggleTaskStatus(t.id)}
                        >
                          {t.status === 'done' ? 'Undo' : 'Mark done'}
                        </button>
                      </div>
                    </li>
                  ))}
                  {parentTasks.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>No tasks for you yet.</li>
                  )}
                </ul>
              )}

              {activeTab === 'habits' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {parentTasks
                    .filter((t) => getTaskType(t) !== 'simple')
                    .slice(0, 6)
                    .map((t) => (
                      <li
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{t.title}</div>
                          <div style={{ fontSize: '.85rem', color: '#6b7280' }}>
                            {t.frequency || 'daily'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleToggleHabitCompleted(t.id)}
                        >
                          {completedToday(t, todayIso) ? 'Undo today' : 'Done today'}
                        </button>
                      </li>
                    ))}
                  {parentTasks.filter((t) => getTaskType(t) !== 'simple').length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>No habits yet.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="card" style={{ gridColumn: '2', gridRow: '3', ...panelStyle }}>
            <div
              style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}
            >
              <button
                type="button"
                className={`btn ${activeTabRight === 'your' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTabRight('your')}
              >
                Kids
              </button>
              <button
                type="button"
                className={`btn ${activeTabRight === 'habits' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTabRight('habits')}
              >
                Habits
              </button>
            </div>

            <div style={{ overflow: 'auto', flex: 1 }}>
              {activeTabRight === 'your' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {kidsNeedingAttention.map(({ child, pending, habitsDue }) => (
                    <li
                      key={child.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{child.name}</div>
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>
                          {pending} tasks · {habitsDue} habits
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => navigate('/parent/dashboard?tab=children')}
                      >
                        View
                      </button>
                    </li>
                  ))}

                  {pendingSimpleTasks.length > 0 && (
                    <li style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', color: '#0f172a', fontWeight: 700 }}>
                      Pending tasks
                    </li>
                  )}

                  {pendingSimpleTasks.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{t.title}</div>
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>For {getAssigneeName(t)}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleToggleTaskStatus(t.id)}
                      >
                        Mark done
                      </button>
                    </li>
                  ))}

                  {kidsNeedingAttention.length === 0 && pendingSimpleTasks.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>All caught up.</li>
                  )}
                </ul>
              )}

              {activeTabRight === 'habits' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {habitsDueToday.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{t.title}</div>
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>For {getAssigneeName(t)}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleToggleHabitCompleted(t.id)}
                      >
                        Done today
                      </button>
                    </li>
                  ))}
                  {habitsDueToday.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>No habits due today.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {malformedTasks.length > 0 && (
            <div
              className="card"
              style={{
                gridColumn: '1 / -1',
                border: '1px solid var(--parent-border)',
                background: 'rgba(122, 155, 184, 0.08)',
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

          {error && (
            <p style={{ color: '#b91c1c', marginTop: '0.75rem', gridColumn: '1 / -1' }}>{error}</p>
          )}
          {loading && <p className="sub" style={{ marginTop: '0.5rem', gridColumn: '1 / -1' }}>Loading…</p>}
        </div>
      </div>
    </div>
  );
}
