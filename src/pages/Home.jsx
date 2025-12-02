import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import {
  canCreateOwnTasks,
  canAssignTasksToChildren,
  canCreateProviderTasks,
  canAcceptProviderTasks,
} from '../roles.js';

const BUILD_KEY = 'ns.buildPlan.v1';
const BREAK_KEY = 'ns.breakPlan.v1';
const TASKS_KEY = 'ns.childTasks.v1';

export default function Home() {
  const { user } = useUser();

  const canCreate = user && canCreateOwnTasks(user);
  const showParentActions = user && canAssignTasksToChildren(user);
  const showProviderActions = user && canCreateProviderTasks(user);
  const showParentApproval = user && canAcceptProviderTasks(user);

  const [buildPlan, setBuildPlan] = useState(null);
  const [breakPlan, setBreakPlan] = useState(null);
  const [tasks, setTasks] = useState([]);

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

  return (
    <section className="container">
      <h1>Next Steps</h1>
      <p className="sub hero">
        This is a placeholder home page. For now, only <strong>Build a Habit</strong> and{' '}
        <strong>Break a Habit</strong> are implemented, plus simple tasks assigned to each user.
      </p>

      {/* Role-based overview card */}
      {user && (
        <div
          className="card"
          style={{ marginTop: '1.5rem', maxWidth: '780px' }}
        >
          {canCreate && (
            <>
              <h2>Your habits</h2>
              <p className="sub">
                Create and manage your own habits and plans from this device.
              </p>
            </>
          )}

          {showParentActions && (
            <>
              <h2 style={{ marginTop: canCreate ? '1.5rem' : 0 }}>
                Parent tools
              </h2>
              <p className="sub">
                Assign tasks to child accounts and track their progress.
              </p>
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
              <p className="sub">
                Create tasks for children (by code) or adults (by name).
              </p>
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
              <p className="sub">
                When providers submit tasks for your children, they will show up in your parent dashboard
                for review and approval.
              </p>
            </>
          )}
        </div>
      )}

      {/* Tasks for the current user */}
      <div
        className="card"
        style={{ marginTop: '1.5rem', maxWidth: '780px' }}
      >
        <h2>Your tasks for today</h2>

        {(!tasksForUser || tasksForUser.length === 0) ? (
          <p className="sub">
            You don&apos;t have any tasks assigned to you yet.
          </p>
        ) : (
          <>
            <p className="sub">
              Here are the tasks assigned to you. Check them off as you finish them.
            </p>
            <ul>
              {tasksForUser.map((task) => {
                const type = task.taskType || 'simple';
                const badgeStyles = {
                  base: {
                    display: 'inline-block',
                    fontSize: '.75rem',
                    padding: '.1rem .4rem',
                    borderRadius: '6px',
                    marginLeft: '.5rem',
                  },
                  simple: { background: '#e5e7eb', color: '#111827' },
                  'build-habit': { background: '#d1fae5', color: '#065f46' },
                  'break-habit': { background: '#fee2e2', color: '#991b1b' },
                };

                const renderBadge = () => {
                  let label = 'Simple Task';
                  if (type === 'build-habit') label = 'Build Habit';
                  if (type === 'break-habit') label = 'Break Habit';
                  const tone = badgeStyles[type] || badgeStyles.simple;
                  return (
                    <span style={{ ...badgeStyles.base, ...tone }}>{label}</span>
                  );
                };

                const renderDetails = () => {
                  if (type === 'build-habit') {
                    const steps = Array.isArray(task.steps) ? task.steps : [];
                    return (
                      <div style={{ fontSize: '.9rem', marginTop: '.25rem', opacity: 0.85 }}>
                        {task.cue && (
                          <div>
                            <strong>Cue:</strong> <em>{task.cue}</em>
                          </div>
                        )}
                        {steps.length > 0 && (
                          <div style={{ marginTop: '.15rem' }}>
                            <strong>Steps:</strong>
                            <ol style={{ marginLeft: '1.25rem', marginTop: '.15rem' }}>
                              {steps.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {task.frequency && (
                          <div style={{ marginTop: '.15rem' }}>
                            <strong>Frequency:</strong> {task.frequency}
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (type === 'break-habit') {
                    const reps = Array.isArray(task.replacements) ? task.replacements : [];
                    return (
                      <div style={{ fontSize: '.9rem', marginTop: '.25rem', opacity: 0.85 }}>
                        {task.habitToBreak && (
                          <div>
                            <strong>Habit to break:</strong> {task.habitToBreak}
                          </div>
                        )}
                        {reps.length > 0 && (
                          <div style={{ marginTop: '.15rem' }}>
                            <strong>Replacements:</strong>{' '}
                            <ul style={{ marginLeft: '1.25rem', marginTop: '.15rem', listStyle: 'disc' }}>
                              {reps.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {task.frequency && (
                          <div style={{ marginTop: '.15rem' }}>
                            <strong>Frequency:</strong> {task.frequency}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                };

                return (
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
                      <strong>{task.title}</strong>
                      {renderBadge()}
                      {task.notes && <> — {task.notes}</>}
                      {task.status === 'done' && ' ✅'}
                      {renderDetails()}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleToggleMyTaskStatus(task.id)}
                    >
                      {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Habits (only for roles that can create their own plans) */}
      {canCreate && (
        <div
          className="card"
          style={{ marginTop: '1.5rem', maxWidth: '780px' }}
        >
          <h2>Your habit plans</h2>

          {!hasAnyPlan && (
            <>
              <p className="sub">
                You don&apos;t have any saved plans yet. Start by creating one:
              </p>
              <ul>
                <li>
                  <Link to="/build-habit">Build a Habit</Link> – create a new habit with tiny steps
                </li>
                <li>
                  <Link to="/break-habit">Break a Habit</Link> – choose a habit to beat and replacements
                </li>
              </ul>
            </>
          )}

          {hasAnyPlan && (
            <>
              {buildPlan && (
                <div style={{ marginTop: '1rem' }}>
                  <h3>Build a Habit</h3>
                  <p>
                    <strong>Habit:</strong> {buildPlan.goal || 'No goal set'}
                  </p>

                  {buildStepsPreview.length > 0 && (
                    <>
                      <p className="sub">First few steps:</p>
                      <ol>
                        {buildStepsPreview.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ol>
                    </>
                  )}

                  <Link to="/build-habit" className="btn btn-ghost" style={{ marginTop: '.5rem' }}>
                    View / edit habit plan
                  </Link>
                </div>
              )}

              {breakPlan && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h3>Break a Habit</h3>
                  <p>
                    <strong>Habit to break:</strong> {breakPlan.habit || 'No habit set'}
                  </p>

                  {breakStepsPreview.length > 0 && (
                    <>
                      <p className="sub">Try these actions:</p>
                      <ol>
                        {breakStepsPreview.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ol>
                    </>
                  )}

                  <Link to="/break-habit" className="btn btn-ghost" style={{ marginTop: '.5rem' }}>
                    View / edit break plan
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}