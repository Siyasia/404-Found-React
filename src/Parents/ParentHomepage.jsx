import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { ActionCard, StatCard, ApprovalCard } from './components/ParentHomeCards.jsx';
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

  const childIds = useMemo(() => new Set(children.map((c) => c.id)), [children]);
  const todayIso = todayString();

  const tasksForChildren = useMemo(
    () => tasks.filter((t) => childIds.has(getAssigneeId(t))),
    [tasks, childIds]
  );

  const providerPendingApprovals = useMemo(
    () => pendingTasks.filter((t) => t.needsApproval && t.createdByRole === 'provider'),
    [pendingTasks]
  );

  const parentTasks = useMemo(
    () => tasks.filter((t) => getAssigneeId(t) && user?.id && getAssigneeId(t) === user.id),
    [tasks, user]
  );
  const parentPending = useMemo(
    () => parentTasks.filter((t) => t.status !== 'done'),
    [parentTasks]
  );

  const handleToggleTaskStatus = async (taskId) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextStatus = target.status === 'done' ? 'pending' : 'done';
    const payload = { id: taskId, status: nextStatus };
    const resp = await taskUpdate(payload);
    if (resp.status_code === 200) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? Task.from({ ...t, status: nextStatus }) : t)));
      setToast(`Marked ${target.title || 'task'} ${nextStatus === 'done' ? 'done' : 'not done'}.`);
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
      setTasks((prev) => prev.map((t) => (t.id === taskId ? Task.from({ ...t, completedDates: newDates }) : t)));
      setToast(already ? 'Marked not done for today.' : 'Marked done for today.');
      setTimeout(() => setToast(''), 2500);
    } else {
      setError('Failed to update habit.');
    }
  };

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

  const malformedTasks = useMemo(() => tasks.filter(isMalformed), [tasks]);

  const childTasksById = useMemo(() => {
    const map = {};
    children.forEach((c) => {
      map[c.id] = tasksForChildren.filter((t) => getAssigneeId(t) === c.id);
    });
    return map;
  }, [children, tasksForChildren]);

  const panelStyle = {
    height: '300px',
    minHeight: '300px',
    overflow: 'hidden',
    padding: '16px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  };

  const kidsNeedingAttention = useMemo(() => {
    const list = children.map((child) => {
      const kidTasks = tasksForChildren.filter((t) => getAssigneeId(t) === child.id);
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
    });

    return list
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [children, tasksForChildren, todayIso]);

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

  return (
    <div className="parent-shell">
      <Toast message={toast} type="success" onClose={() => setToast('')} />
      <div
        className="parent-home"
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 0 1.25rem' }}
      >
        <div className="hero-row" style={{ marginBottom: '1rem', padding: '0.75rem 0' }}>
          <div style={{ textAlign: 'left', gridColumn: '1 / span 8' }}>
            <div
              className="pill"
              style={{
                display: 'inline-block',
                marginBottom: '12px',
              }}
            >
              {formatDate()}
            </div>
            <h1 style={{ marginBottom: '8px', fontSize: '36px', lineHeight: '44px' }}>
              {greeting}, {user?.name || 'Parent'}
            </h1>
            <p className="sub" style={{ fontSize: '16px', lineHeight: '24px', margin: 0 }}>
              Here&apos;s what needs your attention today.
            </p>
          </div>

          <div
            style={{
              gridColumn: '9 / span 4',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'baseline',
            }}
          >
            <button
              type="button"
              className="btn btn-parent-primary"
              onClick={() => navigate('/parent/dashboard')}
              style={{ width: '200px', height: '40px', alignSelf: 'baseline' }}
            >
              Open dashboard
            </button>
          </div>
        </div>

        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, rgba(122,155,184,0.35), rgba(45,140,138,0.35))',
            borderRadius: '999px',
            margin: '0 0 0.75rem',
            opacity: 0.6,
            maxWidth: '520px',
          }}
        />

        {malformedTasks.length > 0 && (
          <div
            className="card"
            style={{
              marginBottom: '1rem',
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

        <div style={{ marginBottom: '1rem' }}>
          <ApprovalCard
            variant="banner"
            pendingCount={providerPendingApprovals.length}
            onClick={() => navigate('/parent/dashboard?tab=approvals')}
          />
        </div>

        <div className="kpi-grid kpi-small-right" style={{ marginBottom: '1rem' }}>
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
            label="Habits due today"
            number={habitsDueToday.length}
            detail="Scheduled habits"
            icon="⏳"
            color="#475569"
            gradient="linear-gradient(135deg, rgba(148, 163, 184, 0.08), rgba(148, 163, 184, 0.02))"
            compact
            onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
          />
        </div>

        <div
          className="row-panels"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '1rem',
            alignItems: 'start',
          }}
        >
          <div className="card" style={panelStyle}>
            <div
              style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}
            >
              <button
                type="button"
                className={`btn ${activeTab === 'your' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('your')}
              >
                Your tasks
              </button>
              <button
                type="button"
                className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('pending')}
              >
                Pending
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

              {activeTab === 'pending' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {parentPending.slice(0, 6).map((t) => (
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
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{t.notes || ''}</div>
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
                  {parentPending.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>No pending tasks.</li>
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

          <div className="card" style={panelStyle}>
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
                className={`btn ${activeTabRight === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTabRight('pending')}
              >
                Pending
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
                  {kidsNeedingAttention.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>All caught up.</li>
                  )}
                </ul>
              )}

              {activeTabRight === 'pending' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
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
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>For {t.assigneeName}</div>
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
                  {pendingSimpleTasks.length === 0 && (
                    <li style={{ padding: '4px 0', color: '#6b7280' }}>No pending tasks.</li>
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
                        <div style={{ fontSize: '.85rem', color: '#6b7280' }}>For {t.assigneeName}</div>
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
        </div>

        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '1rem' }}>
          <ActionCard
            title="Assign a new task"
            description="Create a simple task or habit for your child."
            cta="Assign"
            onClick={() => navigate('/parent/dashboard?tab=assign')}
          />
          <ActionCard
            title="View provider requests"
            description="Approve tasks submitted by providers."
            cta="Review"
            onClick={() => navigate('/parent/dashboard?tab=approvals')}
          />
          <ActionCard
            title="Manage children"
            description="Add, edit, or remove child profiles."
            cta="Manage"
            onClick={() => navigate('/parent/dashboard?tab=children')}
          />
        </div>

        <div className="card" style={{ padding: '1rem 1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Recent tasks</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/parent/dashboard?tab=my-tasks')}
            >
              Open tasks
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
            {tasks
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.title}</div>
                    <div style={{ fontSize: '.85rem', color: '#6b7280' }}>
                      {t.assigneeName} · {getTaskType(t)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleToggleTaskStatus(t.id)}
                  >
                    {t.status === 'done' ? 'Undo' : 'Mark done'}
                  </button>
                </li>
              ))}
            {tasks.length === 0 && (
              <li style={{ padding: '6px 0', color: '#6b7280' }}>No tasks yet.</li>
            )}
          </ul>
        </div>

        {error && (
          <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>
        )}
        {loading && <p className="sub" style={{ marginTop: '0.5rem' }}>Loading…</p>}
      </div>
    </div>
  );
}
