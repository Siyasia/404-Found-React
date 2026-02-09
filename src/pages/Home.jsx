import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import {
  canCreateOwnTasks,
  canAssignTasksToChildren,
  canCreateProviderTasks,
  canAcceptProviderTasks,
} from '../Roles/roles.js';
import ThemeModal from '../Child/ThemeModal.jsx';
import { Task, FormedHabit } from '../models';
import { taskList, taskUpdate } from '../lib/api/tasks.js';
import { buildHabitDelete, buildHabitList, formedHabitList, breakHabitList, breakHabitDelete } from '../lib/api/habits.js';
import { userUpdate } from '../lib/api/user.js';
import { userGet } from '../lib/api/authentication.js';

const BUILD_KEY = 'ns.buildPlan.v1';
const BREAK_KEY = 'ns.breakPlan.v1';
const TASKS_KEY = 'ns.childTasks.v1';
const FORMED_KEY = 'ns.habitsFormed.v1';

export default function Home() {
  /*
  ----------------------------------------------------------------------------------------------------------------------------------
  Code for utilizing TTS
  ----------------------------------------------------------------------------------------------------------------------------------
  */
  const supportsTTS =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const { user, setUser } = useUser();

  const canCreate = user && canCreateOwnTasks(user);
  const showParentActions = user && canAssignTasksToChildren(user);
  const showProviderActions = user && canCreateProviderTasks(user);
  const showParentApproval = user && canAcceptProviderTasks(user);

  const [buildPlan, setBuildPlan] = useState(null);
  const [breakPlan, setBreakPlan] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [simpleTasks, setSimpleTasks] = useState([]);
  const [buildTasks, setBuildTasks] = useState([]);
  const [breakTasks, setBreakTasks] = useState([]);
  // this absolutely blows but whatever :D
  const [taskCounts, setTaskCounts] = useState({"build": {total: 0, done: 0, pending: 0}, "break": {total: 0, done: 0, pending: 0}, "simple": {total: 0, done: 0, pending: 0}});
  const [tasksLoading, setTasksLoading] = useState(true);

  const [formedHabits, setFormedHabits] = useState(null);
  const [formedLoading, setFormedLoading] = useState(true);

  const [themeOpen, setThemeOpen] = useState(false);
  const [themeChoice, setThemeChoice] = useState(user?.theme || 'pink');

  function updateTaskCounts() {
    const getCounts = (arr) => {
      const total = arr.length;
      const done = arr.filter((t) => t.status === 'done').length;
      const pending = total - done;
      return { total, done, pending };
    };
    setSimpleTasks(tasks.filter((t) => (t.taskType || 'simple') === 'simple'));
    setBuildTasks(tasks.filter((t) => (t.taskType || 'simple') === 'build-habit'));
    setBreakTasks(tasks.filter((t) => (t.taskType || 'simple') === 'break-habit'));
    setTaskCounts({
      "simple": getCounts(tasks.filter((t) => (t.taskType || 'simple') === 'simple')),
      "build": getCounts(tasks.filter((t) => (t.taskType || 'simple') === 'build-habit')),
      "break": getCounts(tasks.filter((t) => (t.taskType || 'simple') === 'break-habit')),
    });
  };

  const buildTaskSummaryText = (name, userTasks) => {
    const safeName = name?.trim() || 'there';
    const count = Array.isArray(userTasks) ? userTasks.length : 0;

    if (count === 0) {
      return `Hey there, ${safeName}. You currently have 0 tasks assigned to you.`;
    }

    const mostRecent = [...userTasks]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .map((t) => {
        const title = (t.title || 'Untitled task').trim();
        const who = (t.createdByName || 'someone').trim();
        return `${title}, assigned by ${who}`;
      });

    const recentLine =
      mostRecent.length === 1
        ? `Looks like the most recent is ${mostRecent[0]}.`
        : `Looks like the most recent are ${mostRecent.join('. ')}.`;

    return `Hey there, ${safeName}. You currently have ${count} task${count === 1 ? '' : 's'} assigned to you. ${recentLine}`;
  };

  const speakTaskSummary = () => {
    if (!supportsTTS) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const text = buildTaskSummaryText(user?.name, tasks);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  };

  /*
  ----------------------------------------------------------------------------------------------------------------------------------
  Local storage loads
  ----------------------------------------------------------------------------------------------------------------------------------
  */
  useEffect(() => {
    async function func() {
      setUser(await userGet());
      const storedBuild = (await buildHabitList()).habits?.[0] || null;
      setBuildPlan(storedBuild);

      const storedBreak = (await breakHabitList()).habits?.[0] || null;
      setBreakPlan(storedBreak);

      // fetch tasks + formed habits from API with robust checks and error handling
      setTasksLoading(true);
      try {
        const storedTasks = await taskList();
        console.log('Fetched tasks from API:', storedTasks);
        const okStatus = (s) => s === 200 || s === '200';
        if (
          storedTasks &&
          (okStatus(storedTasks.status_code) || okStatus(storedTasks.status)) &&
          Array.isArray(storedTasks.tasks)
        ) {
          // storedTasks.tasks may already contain Task instances from the response wrapper
          setTasks(storedTasks.tasks.map((t) => Task.from(t)));
        } else {
          // mark as loaded but empty on error or no data
          setTasks([]);
        }
      } catch (err) {
        // network/parsing error: mark loaded but empty and log for debugging
        console.error('Error fetching tasks:', err);
        setTasks([]);
      } finally {
        setTasksLoading(false);
      }

      setFormedLoading(true);
      try {
        const storedFormed = await formedHabitList();
        console.log('Fetched formed habits from API:', storedFormed);
        const okStatus = (s) => s === 200 || s === '200';
        // response wrapper for formed habits exposes `.habits` (ListHabitResponse)
        if (
          storedFormed &&
          (okStatus(storedFormed.status_code) || okStatus(storedFormed.status)) &&
          Array.isArray(storedFormed.habits)
        ) {
          setFormedHabits(storedFormed.habits.map((h) => FormedHabit.from(h)));
        } else if (storedFormed && Array.isArray(storedFormed.data)) {
          // some API helpers occasionally place results under `data`
          setFormedHabits(storedFormed.data.map((h) => FormedHabit.from(h)));
        } else {
          setFormedHabits([]);
        }
      } catch (err) {
        console.error('Error fetching formed habits:', err);
        setFormedHabits([]);
      } finally {
        setFormedLoading(false);
      }
    } func();

  }, []);

  useEffect(() => {
    setThemeChoice(user?.theme || 'pink');
  }, [user]);

  // Recompute derived task lists and counts whenever the raw `tasks` array changes.
  useEffect(() => {
    try {
      updateTaskCounts();
    } catch (err) {
      // defensive: ensure UI doesn't crash if update logic throws
      console.error('Error updating task counts:', err);
    }
  }, [tasks]);

  const buildStepsPreview = buildPlan?.steps?.slice(0, 3) || [];
  const breakStepsPreview =
    breakPlan?.steps?.slice(0, 3) ||
    breakPlan?.replacements?.slice(0, 3) ||
    [];

  const handleToggleMyTaskStatus = async (taskId) => {

    let task = tasks.find((t) => t.id === taskId);
    let updatedTask = structuredClone(task);
    updatedTask.status = updatedTask.status === 'done' ? 'pending' : 'done';

    await taskUpdate({ id: taskId, status: updatedTask.status })

    setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
  };

  /*
  ----------------------------------------------------------------------------------------------------------------------------------
  Habits formed helpers (complete + delete)
  ----------------------------------------------------------------------------------------------------------------------------------
  */
  const saveFormedHabits = (updated) => {
    setFormedHabits(updated);

  };

  const deleteBuildPlan = async () => {
    await buildHabitDelete(buildPlan.id)
    setBuildPlan(null);
  };

  const deleteBreakPlan = async () => {
    await breakHabitDelete(breakPlan.id)
    setBreakPlan(null);
  };

  const completeBuildPlan = async () => {
    if (!buildPlan) return;
    const entry = new FormedHabit({
      id: crypto.randomUUID ? crypto.randomUUID() : `formed-${Date.now()}`,
      userId: user?.id || null,
      type: 'build',
      title: buildPlan.goal || 'Build habit plan',
      details: buildPlan,
      completedAt: new Date().toISOString(),
    });

    const updated = [entry, ...(Array.isArray(formedHabits) ? formedHabits : [])];
    saveFormedHabits(updated);
    // todo: update habit in database and make it formed
    await deleteBuildPlan();
  };

  const completeBreakPlan = async () => {
    if (!breakPlan) return;
    const entry = new FormedHabit({
      id: crypto.randomUUID ? crypto.randomUUID() : `formed-${Date.now()}`,
      userId: user?.id || null,
      type: 'break',
      title: breakPlan.habit || 'Break habit plan',
      details: breakPlan,
      completedAt: new Date().toISOString(),
    });

    const updated = [entry, ...(Array.isArray(formedHabits) ? formedHabits : [])];
    saveFormedHabits(updated);
    // todo: update habit in database and make it formed
    await deleteBreakPlan();
  };

  /*
  ----------------------------------------------------------------------------------------------------------------------------------
  Dashboard header helpers
  ----------------------------------------------------------------------------------------------------------------------------------
  */
  const hour = new Date().getHours();
  let greetingPart = 'morning';
  if (hour >= 12 && hour < 17) greetingPart = 'afternoon';
  if (hour >= 17) greetingPart = 'evening';





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

    // applyTheme(newTheme);
    userUpdate({ id: user.id, theme: newTheme }).then((updated) => {
      setUser(updated);
    });

    setThemeOpen(false);
  };

  const formedForUser = (Array.isArray(formedHabits) ? formedHabits : []).filter(
    (h) => !h.userId || h.userId === user?.id
  );

  const roleEmoji = user?.role === 'child'
    ? '⭐'
    : user?.role === 'user'
      ? '🍎'
      : '';

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '24px', 
      minHeight: 'calc(100vh - 64px)',
      display: 'grid',
      placeItems: 'center',
    }}>
      
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: 'auto auto auto',
        gap: '16px',
        width: '100%',
        alignContent: 'start'
      }}>
        
        {/* ROW 1: Header (spans full width) */}
        <div style={{ gridColumn: '1 / -1', minHeight: '96px', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '8px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>
              Good {greetingPart}, {user?.name || 'there'}
            </h1>
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
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Here's what's on your plate today.</p>
        </div>

        {/* ROW 2: TODAY CARD (col 1) + STATS GRID (col 2) */}

        {/* TODAY Card - col 1, row 2 */}
        <div style={{ 
          gridColumn: '1', 
          gridRow: '2',
          background: 'white', 
          border: '1px solid rgba(0,0,0,0.06)', 
          borderRadius: '16px', 
          padding: '16px', 
          display: 'flex', 
          flexDirection: 'column',
          maxHeight: '320px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Today</h2>
            <button
              type="button"
              onClick={speakTaskSummary}
              disabled={!supportsTTS}
              style={{
                padding: '.3rem .5rem',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                background: 'white',
                cursor: supportsTTS ? 'pointer' : 'not-allowed',
                fontWeight: 500,
                fontSize: '.8rem',
              }}
            >
              🔊 Read
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '.4rem', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[
              { key: 'simple', label: 'Simple', count: taskCounts.simple.total },
              { key: 'build', label: 'Build', count: taskCounts.build.total },
              { key: 'break', label: 'Break', count: taskCounts.break.total },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="btn"
                style={{
                  padding: '.35rem .6rem',
                  borderRadius: '999px',
                  border: activeTab === tab.key ? '1px solid #4f46e5' : '1px solid #e5e7eb',
                  background: activeTab === tab.key ? '#eef2ff' : 'white',
                  color: '#111827',
                  fontSize: '.85rem',
                }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Task list - scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {tasksLoading ? (
              <div style={{ color: '#6b7280', fontSize: '.9rem' }}>Loading…</div>
            ) : tasks.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No tasks"
                description="Create a habit plan"
                buttonLabel="Build"
                buttonLink="/build-habit"
              />
            ) : (
              <>
                {activeTab === 'simple' && (
                  <ul style={{ paddingLeft: 0, margin: 0 }}>
                    {simpleTasks
                      .slice(0, 8)
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map((task) => (
                        <li key={task.id} style={{
                          display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.35rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '.9rem'
                        }}>
                          <input
                            type="checkbox"
                            checked={task.status === 'done'}
                            onChange={() => handleToggleMyTaskStatus(task.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1 }}>
                            {task.title}
                          </div>
                          <span style={{ fontSize: '.7rem', padding: '.05rem .3rem', borderRadius: '4px', background: task.status === 'done' ? '#d1fae5' : '#dbeafe', color: task.status === 'done' ? '#065f46' : '#1e3a8a' }}>
                            {task.status === 'done' ? '✓' : '◇'}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}

                {activeTab === 'build' && (
                  <ul style={{ paddingLeft: 0, margin: 0 }}>
                    {buildTasks
                      .slice(0, 6)
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map((task) => (
                        <li key={task.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '.5rem', padding: '.35rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '.9rem'
                        }}>
                          <input type="checkbox" checked={task.status === 'done'} onChange={() => handleToggleMyTaskStatus(task.id)} style={{ cursor: 'pointer', marginTop: '.2rem' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1, fontWeight: 500 }}>{task.title}</div>
                            <div style={{ fontSize: '.8rem', color: '#6b7280' }}>{friendlyFrequency(task.frequency)}</div>
                          </div>
                        </li>
                      ))}
                </ul>
              )}

              {activeTab === 'break' && (
                <ul style={{ paddingLeft: 0, margin: 0 }}>
                  {breakTasks
                    .slice(0, 6)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((task) => (
                      <li key={task.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '.5rem', padding: '.35rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '.9rem'
                      }}>
                        <input type="checkbox" checked={task.status === 'done'} onChange={() => handleToggleMyTaskStatus(task.id)} style={{ cursor: 'pointer', marginTop: '.2rem' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1, fontWeight: 500 }}>{task.habitToBreak || task.title}</div>
                          <div style={{ fontSize: '.8rem', color: '#6b7280' }}>{friendlyFrequency(task.frequency)}</div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
          </div>
        </div>

        {/* STATS GRID - col 2, row 2 (2x2 tiles) */}
        <div style={{ 
          gridColumn: '2', 
          gridRow: '2',
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px',
          height: 'fit-content'
        }}>
          {/* Tasks tile */}
          <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '12px', height: '92px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '12px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Tasks</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>{taskCounts.simple.total}</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{taskCounts.simple.pending} pending</div>
          </div>

          {/* Build habits tile */}
          <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '12px', height: '92px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '12px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Build</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>{taskCounts.build.total}</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{taskCounts.build.pending} pending</div>
          </div>

          {/* Break habits tile */}
          <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '12px', height: '92px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '12px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Break</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>{taskCounts.break.total}</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{taskCounts.break.pending} pending</div>
          </div>

          {/* Quick action tile */}
          <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '12px', height: '92px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {canCreate ? (
              <Link to="/build-habit" className="btn" style={{ padding: '.4rem .6rem', fontSize: '.85rem', whiteSpace: 'nowrap' }}>
                + New Plan
              </Link>
            ) : (
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Ready?</span>
            )}
          </div>
        </div>

        {/* ROW 3: PLANS + MASTERED (col 2) */}

        {/* YOUR PLANS Card - col 2, row 3 */}
        {canCreate && (
          <div style={{ 
            gridColumn: '2', 
            gridRow: '3',
            background: 'white', 
            border: '1px solid rgba(0,0,0,0.06)', 
            borderRadius: '16px', 
            padding: '16px', 
            display: 'flex', 
            flexDirection: 'column' 
          }}>
            <h2 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>Your Plans</h2>

            {/* Build Plan Row */}
            <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '12px', marginBottom: '12px', borderLeft: '3px solid #4f46e5', minHeight: '88px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.95rem' }}>📈 Build</div>
                {buildPlan ? (
                  <div style={{ fontSize: '.85rem', color: '#6b7280', marginTop: '4px' }}>{buildPlan.goal || 'No goal'}</div>
                ) : (
                  <div style={{ fontSize: '.85rem', color: '#9ca3af', marginTop: '4px' }}>Start a habit</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '.4rem', marginTop: '8px' }}>
                <Link to="/build-habit" className="btn btn-ghost" style={{ padding: '.3rem .5rem', fontSize: '.75rem', flex: 1, textAlign: 'center' }}>
                  {buildPlan ? 'Edit' : 'Create'}
                </Link>
                {buildPlan && (
                  <button type="button" className="btn" style={{ padding: '.3rem .5rem', fontSize: '.75rem' }} onClick={completeBuildPlan}>
                    Done
                  </button>
                )}
              </div>
            </div>

            {/* Break Plan Row */}
            <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '12px', borderLeft: '3px solid #dc2626', minHeight: '88px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.95rem' }}>🚫 Break</div>
                {breakPlan ? (
                  <div style={{ fontSize: '.85rem', color: '#6b7280', marginTop: '4px' }}>{breakPlan.habit || 'No habit'}</div>
                ) : (
                  <div style={{ fontSize: '.85rem', color: '#9ca3af', marginTop: '4px' }}>Replace a habit</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '.4rem', marginTop: '8px' }}>
                <Link to="/break-habit" className="btn btn-ghost" style={{ padding: '.3rem .5rem', fontSize: '.75rem', flex: 1, textAlign: 'center' }}>
                  {breakPlan ? 'Edit' : 'Create'}
                </Link>
                {breakPlan && (
                  <button type="button" className="btn" style={{ padding: '.3rem .5rem', fontSize: '.75rem' }} onClick={completeBreakPlan}>
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MASTERED Card - col 2, row 4 (after Plans) */}
        {canCreate && (
          <div style={{ 
            gridColumn: '2', 
            background: 'white', 
            border: '1px solid rgba(0,0,0,0.06)', 
            borderRadius: '16px', 
            padding: '16px',
            maxHeight: '240px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 style={{ margin: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 600 }}>Mastered 🏆</h2>

            {formedForUser.length === 0 ? (
              <EmptyState icon="⭐" title="Nothing yet" description="Complete a plan" buttonLabel="Start" buttonLink="/build-habit" />
            ) : (
              <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {formedForUser.slice(0, 6).map((h) => (
                  <li key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '.85rem' }}>
                    <div style={{ fontWeight: 600 }}>{h.title}</div>
                    <div style={{ fontSize: '.75rem', color: '#6b7280' }}>
                      {h.type === 'build' ? '📈' : '🚫'} {h.completedAt ? new Date(h.completedAt).toLocaleDateString() : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <ThemeModal
        open={themeOpen}
        theme={themeChoice}
        onSelect={setThemeChoice}
        onClose={() => setThemeOpen(false)}
        onSave={saveChildTheme}
      />
    </div>
  );
}