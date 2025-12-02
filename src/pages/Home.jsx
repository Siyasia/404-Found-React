import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import {
  canCreateOwnTasks,
  canAssignTasksToChildren,
  canCreateProviderTasks,
  canAcceptProviderTasks,
} from '../Roles/roles.js';
import ThemeModal from '../Child/ThemeModal.jsx';

const BUILD_KEY = 'ns.buildPlan.v1';
const BREAK_KEY = 'ns.breakPlan.v1';
const TASKS_KEY = 'ns.childTasks.v1';

export default function Home() {
  const { user, setUser } = useUser();

  const canCreate = user && canCreateOwnTasks(user);
  const showParentActions = user && canAssignTasksToChildren(user);
  const showProviderActions = user && canCreateProviderTasks(user);
  const showParentApproval = user && canAcceptProviderTasks(user);

  const [buildPlan, setBuildPlan] = useState(null);
  const [breakPlan, setBreakPlan] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeChoice, setThemeChoice] = useState(user?.theme || 'pink');

  useEffect(() => {
    const storedBuild = localStorage.getItem(BUILD_KEY);
    if (storedBuild) {
      try {
        setBuildPlan(JSON.parse(storedBuild));
      } catch {
        setBuildPlan(null);
      }
    }

    const storedBreak = localStorage.getItem(BREAK_KEY);
    if (storedBreak) {
      try {
        setBreakPlan(JSON.parse(storedBreak));
      } catch {
        setBreakPlan(null);
      }
    }

    const storedTasks = localStorage.getItem(TASKS_KEY);
    if (storedTasks) {
      try {
        setTasks(JSON.parse(storedTasks));
      } catch {
        setTasks([]);
      }
    }
  }, []);

  useEffect(() => {
    // keep local selection in sync if user changes (navigation, reload)
    setThemeChoice(user?.theme || 'pink');
  }, [user]);

  const hasAnyPlan = !!buildPlan || !!breakPlan;

  const buildStepsPreview = buildPlan?.steps?.slice(0, 3) || [];
  const breakStepsPreview =
    breakPlan?.microSteps?.slice(0, 3) ||
    breakPlan?.replacements?.slice(0, 3) ||
    [];

  // Tasks assigned to the logged-in user:
  //  - Direct: assigneeId === user.id
  //  - Adult provider tasks by name: targetType === 'adult', no approval, targetName matches user.name
  const tasksForUser =
    user && user.id
      ? tasks.filter((t) => {
          if (t.assigneeId === user.id) return true;

          if (
            !t.assigneeId &&
            !t.needsApproval &&
            t.targetType === 'adult' &&
            t.targetName &&
            user.name &&
            t.targetName.toLowerCase() === user.name.toLowerCase()
          ) {
            return true;
          }

          return false;
        })
      : [];

  const handleToggleMyTaskStatus = (taskId) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'done' ? 'pending' : 'done' }
          : t
      );
      try {
        localStorage.setItem(TASKS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Dashboard header helpers
  const hour = new Date().getHours();
  let greetingPart = 'morning';
  if (hour >= 12 && hour < 17) greetingPart = 'afternoon';
  if (hour >= 17) greetingPart = 'evening';

  const getCounts = (arr) => {
    const total = arr.length;
    const done = arr.filter((t) => t.status === 'done').length;
    const pending = total - done;
    return { total, done, pending };
  };

  const simpleTasks = tasksForUser.filter((t) => (t.taskType || 'simple') === 'simple');
  const buildTasks = tasksForUser.filter((t) => (t.taskType || 'simple') === 'build-habit');
  const breakTasks = tasksForUser.filter((t) => (t.taskType || 'simple') === 'break-habit');

  const simpleCounts = getCounts(simpleTasks);
  const buildCounts = getCounts(buildTasks);
  const breakCounts = getCounts(breakTasks);

  // Tabs state for tasks section
  const [activeTab, setActiveTab] = useState('simple'); // 'simple' | 'build' | 'break'

  const friendlyFrequency = (freq) => {
    if (!freq) return 'No schedule set';
    if (freq === 'daily') return 'Every day';
    if (freq === 'weekdays') return 'Weekdays';
    if (freq === 'weekends') return 'Weekends';
    return freq;
  };

  const daysAgo = (dateStr) => {
    if (!dateStr) return '';
    const created = new Date(dateStr);
    if (Number.isNaN(created.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Added today';
    if (diffDays === 1) return 'Added 1 day ago';
    return `Added ${diffDays} days ago`;
  };

  const saveChildTheme = () => {
    const newTheme = themeChoice || 'pink';
    if (!user) return;
    // Update current user context (applies body class via UserContext)
    setUser({ ...user, theme: newTheme });

    // Persist to children list so code-login picks it up later
    try {
      const raw = localStorage.getItem('ns.children.v1');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const updated = arr.map((c) => {
          if ((user.id && c.id === user.id) || (user.code && c.code === user.code)) {
            return { ...c, theme: newTheme };
          }
          return c;
        });
        localStorage.setItem('ns.children.v1', JSON.stringify(updated));
      }
    } catch {
      // ignore persistence errors for demo
    }

    setThemeOpen(false);
  };

  return (
    <section className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <h1 style={{ marginBottom: '.25rem' }}>Good {greetingPart}, {user?.name || 'there'}</h1>
        {user?.role === 'child' && (
          <button
            type="button"
            aria-label="Theme settings"
            onClick={() => setThemeOpen(true)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '1.15rem',
              opacity: .35,
              padding: '.25rem .35rem',
              borderRadius: '.5rem'
            }}
            title="Settings"
          >
            🎨
          </button>
        )}
      </div>
      <p className="sub hero">Here's what's on your plate today.</p>

      {/* Summary strip */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ fontSize: '.75rem', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280' }}>Tasks today</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{simpleCounts.total}</div>
            <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{simpleCounts.pending} pending · {simpleCounts.done} done</div>
          </div>
          <div style={{ flex: '1 1 220px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ fontSize: '.75rem', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280' }}>Habits to build</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{buildCounts.total}</div>
            <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{buildCounts.pending} pending · {buildCounts.done} done</div>
          </div>
          <div style={{ flex: '1 1 220px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ fontSize: '.75rem', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280' }}>Habits to break</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{breakCounts.total}</div>
            <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{breakCounts.pending} pending · {breakCounts.done} done</div>
          </div>
        </div>
      </div>

      {/* Role-based overview card */}
      {user && (canCreate || showParentActions || showProviderActions || showParentApproval) && (
        <div
          className="card"
          style={{ marginTop: '1.5rem', maxWidth: '780px' }}
        >
          {canCreate && (
            <>
              <h2>Your habits</h2>
            </>
          )}

          {showParentActions && (
            <>
              <h2 style={{ marginTop: canCreate ? '1.5rem' : 0 }}>
                Parent tools
              </h2>
              <Link
                to="/parent"
                className="btn btn-ghost"
                style={{ marginTop: '.75rem' }}
              >
                Open parent dashboard
              </Link>
            </>
          )}

          {showProviderActions && (
            <>
              <h2 style={{ marginTop: (canCreate || showParentActions) ? '1.5rem' : 0 }}>
                Provider tools
              </h2>
              <Link
                to="/provider"
                className="btn btn-ghost"
                style={{ marginTop: '.75rem' }}
              >
                Open provider dashboard
              </Link>
            </>
          )}

          {showParentApproval && (
            <>
              <h2 style={{ marginTop: (canCreate || showParentActions || showProviderActions) ? '1.5rem' : 0 }}>
                Tasks waiting for your approval
              </h2>
            </>
          )}
        </div>
      )}

      {/* Tasks for the current user (tabbed, list-style) */}
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '100%' }}>
        <h2>Your tasks for today</h2>

        {(!tasksForUser || tasksForUser.length === 0) ? (
          <div className="sub" style={{ marginTop: '.5rem' }}>
            You don&apos;t have any tasks assigned yet.
            <div style={{ marginTop: '.25rem' }}>
              If you&apos;re a parent, you can add tasks in the <Link to="/parent">Parent dashboard</Link>.
            </div>
            <div style={{ marginTop: '.25rem' }}>
              You can also start a <Link to="/build-habit">Build habit</Link> or <Link to="/break-habit">Break habit</Link> plan below.
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
              {[
                { key: 'simple', label: 'Simple tasks', count: simpleCounts.total },
                { key: 'build', label: 'Build habits', count: buildCounts.total },
                { key: 'break', label: 'Break habits', count: breakCounts.total },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="btn"
                  style={{
                    padding: '.5rem .75rem',
                    borderRadius: '999px',
                    border: activeTab === tab.key ? '1px solid #4f46e5' : '1px solid #e5e7eb',
                    background: activeTab === tab.key ? '#eef2ff' : 'white',
                    color: '#111827',
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* List by active tab */}
            <div style={{ marginTop: '.75rem' }}>
              {activeTab === 'simple' && (
                <ul>
                  {simpleTasks
                    .slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((task) => (
                      <li key={task.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '.75rem', padding: '.5rem .25rem', borderBottom: '1px solid #f3f4f6'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{task.title}</div>
                          <div style={{ fontSize: '.85rem', color: '#6b7280' }}>
                            {task.notes || '-'}
                            <span style={{ marginLeft: '.5rem', opacity: 0.8 }}>{daysAgo(task.createdAt)}</span>
                          </div>
                        </div>
                        <div>
                          <span style={{
                            display: 'inline-block', fontSize: '.75rem', padding: '.1rem .5rem', borderRadius: '999px',
                            background: task.status === 'done' ? '#d1fae5' : '#dbeafe', color: task.status === 'done' ? '#065f46' : '#1e3a8a'
                          }}>
                            {task.status === 'done' ? 'Done' : 'Pending'}
                          </span>
                        </div>
                        <div>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={task.status === 'done'}
                              onChange={() => handleToggleMyTaskStatus(task.id)}
                            />
                            <span style={{ fontSize: '.9rem' }}>Mark done</span>
                          </label>
                        </div>
                      </li>
                    ))}
                </ul>
              )}

              {activeTab === 'build' && (
                <ul>
                  {buildTasks
                    .slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((task) => {
                      const steps = Array.isArray(task.steps) ? task.steps : [];
                      return (
                        <li key={task.id} style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          gap: '.75rem', padding: '.5rem .25rem', borderBottom: '1px solid #f3f4f6'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{task.title}</div>
                            {task.notes && <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{task.notes}</div>}
                            <div style={{ fontSize: '.8rem', color: '#6b7280', marginTop: '.15rem' }}>{daysAgo(task.createdAt)}</div>
                            {steps.length > 0 && (
                              <div style={{ marginTop: '.35rem' }}>
                                <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#374151' }}>Steps</div>
                                <ol style={{ margin: '.25rem 0 0 1rem', maxHeight: '8rem', overflow: 'auto' }}>
                                  {steps.map((s, idx) => (<li key={idx} style={{ margin: '.1rem 0' }}>{s}</li>))}
                                </ol>
                              </div>
                            )}
                            <div style={{ fontSize: '.85rem', color: '#6b7280', marginTop: '.35rem' }}>
                              Schedule: {friendlyFrequency(task.frequency)}
                            </div>
                          </div>
                          <div>
                            <span style={{
                              display: 'inline-block', fontSize: '.75rem', padding: '.1rem .5rem', borderRadius: '999px',
                              background: task.status === 'done' ? '#d1fae5' : '#dbeafe', color: task.status === 'done' ? '#065f46' : '#1e3a8a'
                            }}>
                              {task.status === 'done' ? 'Done' : 'Pending'}
                            </span>
                          </div>
                          <div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={task.status === 'done'}
                                onChange={() => handleToggleMyTaskStatus(task.id)}
                              />
                              <span style={{ fontSize: '.9rem' }}>Mark done</span>
                            </label>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}

              {activeTab === 'break' && (
                <ul>
                  {breakTasks
                    .slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((task) => {
                      const reps = Array.isArray(task.replacements) ? task.replacements : [];
                      return (
                        <li key={task.id} style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          gap: '.75rem', padding: '.5rem .25rem', borderBottom: '1px solid #f3f4f6'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{task.habitToBreak || task.title}</div>
                            {task.notes && <div style={{ fontSize: '.85rem', color: '#6b7280' }}>{task.notes}</div>}
                            <div style={{ fontSize: '.8rem', color: '#6b7280', marginTop: '.15rem' }}>{daysAgo(task.createdAt)}</div>
                            {reps.length > 0 && (
                              <div style={{ marginTop: '.35rem' }}>
                                <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#374151' }}>Try instead</div>
                                <ul style={{ margin: '.25rem 0 0 1rem', maxHeight: '8rem', overflow: 'auto', listStyle: 'disc' }}>
                                  {reps.map((r, idx) => (<li key={idx} style={{ margin: '.1rem 0' }}>{r}</li>))}
                                </ul>
                              </div>
                            )}
                            <div style={{ fontSize: '.85rem', color: '#6b7280', marginTop: '.35rem' }}>
                              Schedule: {friendlyFrequency(task.frequency)}
                            </div>
                          </div>
                          <div>
                            <span style={{
                              display: 'inline-block', fontSize: '.75rem', padding: '.1rem .5rem', borderRadius: '999px',
                              background: task.status === 'done' ? '#d1fae5' : '#fee2e2', color: task.status === 'done' ? '#065f46' : '#991b1b'
                            }}>
                              {task.status === 'done' ? 'Done' : 'Pending'}
                            </span>
                          </div>
                          <div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={task.status === 'done'}
                                onChange={() => handleToggleMyTaskStatus(task.id)}
                              />
                              <span style={{ fontSize: '.9rem' }}>Mark done</span>
                            </label>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* My plans (two tiles) */}
      {canCreate && (
        <div className="card" style={{ marginTop: '1.5rem', maxWidth: '100%' }}>
          <h2>Your habit plans</h2>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
            {/* Build plan tile */}
            <div style={{ flex: '1 1 340px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
              <h3 style={{ margin: 0 }}>Build a habit</h3>
              {buildPlan ? (
                <>
                  <div style={{ marginTop: '.35rem', fontWeight: 600 }}>{buildPlan.goal || 'No goal set'}</div>
                  {buildStepsPreview.length > 0 ? (
                    <div style={{ marginTop: '.35rem' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#374151' }}>First steps</div>
                      <ol style={{ margin: '.25rem 0 0 1rem' }}>
                        {buildStepsPreview.map((s, idx) => (<li key={idx}>{s}</li>))}
                      </ol>
                    </div>
                  ) : (
                    <div className="sub" style={{ marginTop: '.35rem' }}>No steps added yet.</div>
                  )}
                  <Link to="/build-habit" className="btn btn-ghost" style={{ marginTop: '.5rem' }}>View / edit plan</Link>
                </>
              ) : (
                <>
                  <div className="sub" style={{ marginTop: '.35rem' }}>No build-habit plan yet.</div>
                  <Link to="/build-habit" className="btn" style={{ marginTop: '.5rem' }}>Create build-habit plan</Link>
                </>
              )}
            </div>

            {/* Break plan tile */}
            <div style={{ flex: '1 1 340px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
              <h3 style={{ margin: 0 }}>Break a habit</h3>
              {breakPlan ? (
                <>
                  <div style={{ marginTop: '.35rem', fontWeight: 600 }}>{breakPlan.habit || 'No habit set'}</div>
                  {breakStepsPreview.length > 0 ? (
                    <div style={{ marginTop: '.35rem' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#374151' }}>Try instead</div>
                      <ol style={{ margin: '.25rem 0 0 1rem' }}>
                        {breakStepsPreview.map((s, idx) => (<li key={idx}>{s}</li>))}
                      </ol>
                    </div>
                  ) : (
                    <div className="sub" style={{ marginTop: '.35rem' }}>No replacements added yet.</div>
                  )}
                  <Link to="/break-habit" className="btn btn-ghost" style={{ marginTop: '.5rem' }}>View / edit plan</Link>
                </>
              ) : (
                <>
                  <div className="sub" style={{ marginTop: '.35rem' }}>No break-habit plan yet.</div>
                  <Link to="/break-habit" className="btn" style={{ marginTop: '.5rem' }}>Create break-habit plan</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <ThemeModal
        open={themeOpen}
        theme={themeChoice}
        onSelect={setThemeChoice}
        onClose={() => setThemeOpen(false)}
        onSave={saveChildTheme}
      />
    </section>
  );
}