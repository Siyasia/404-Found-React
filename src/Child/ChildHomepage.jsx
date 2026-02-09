import React, { useEffect, useRef, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import ThemeModal from './ThemeModal.jsx';
import { useUser } from '../UserContext.jsx';
import { Task } from '../models';
import { taskList, taskUpdate } from '../lib/api/tasks.js';
import { userGet } from '../lib/api/authentication.js';
import { userUpdate } from '../lib/api/user.js';

const okStatus = (status) => status === 200 || status === '200';

export default function ChildHome() {
  const supportsTTS =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const { user, setUser } = useUser();

  const [tasks, setTasks] = useState([]);
  const [simpleTasks, setSimpleTasks] = useState([]);
  const [buildTasks, setBuildTasks] = useState([]);
  const [breakTasks, setBreakTasks] = useState([]);
  const [taskCounts, setTaskCounts] = useState({
    build: { total: 0, done: 0, pending: 0 },
    break: { total: 0, done: 0, pending: 0 },
    simple: { total: 0, done: 0, pending: 0 },
  });
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('simple');
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeChoice, setThemeChoice] = useState(user?.theme || 'pink');
  const fetchedOnce = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;

    const controller = new AbortController();
    let active = true;

    async function fetchData() {
      setTasksLoading(true);
      try {
        const fetchedUser = await userGet({ signal: controller.signal });
        if (active && fetchedUser) {
          setUser(fetchedUser);
          setThemeChoice(fetchedUser.theme || 'pink');
        }

        const storedTasks = await taskList({ signal: controller.signal });
        if (
          active &&
          storedTasks &&
          (okStatus(storedTasks.status_code) || okStatus(storedTasks.status)) &&
          Array.isArray(storedTasks.tasks)
        ) {
          setTasks(storedTasks.tasks.map((t) => Task.from(t)));
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('Error fetching child tasks:', err);
        }
      } finally {
        if (active) setTasksLoading(false);
      }
    }

    fetchData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [user?.id, setUser]);

  useEffect(() => {
    setThemeChoice(user?.theme || 'pink');
  }, [user]);
  useEffect(() => {
    const getCounts = (arr) => {
      const total = arr.length;
      const done = arr.filter((t) => t.status === 'done').length;
      const pending = total - done;
      return { total, done, pending };
    };

    const simple = tasks.filter((t) => (t.taskType || 'simple') === 'simple');
    const build = tasks.filter((t) => (t.taskType || 'simple') === 'build-habit');
    const breaking = tasks.filter((t) => (t.taskType || 'simple') === 'break-habit');

    setSimpleTasks(simple);
    setBuildTasks(build);
    setBreakTasks(breaking);
    setTaskCounts({
      simple: getCounts(simple),
      build: getCounts(build),
      break: getCounts(breaking),
    });
  }, [tasks]);

  const friendlyFrequency = (freq) => {
    if (!freq) return 'No schedule set';
    if (freq === 'daily') return 'Every day';
    if (freq === 'weekdays') return 'Weekdays';
    if (freq === 'weekends') return 'Weekends';
    return freq;
  };

  const speakTaskSummary = () => {
    if (!supportsTTS) return;

    window.speechSynthesis.cancel();

    const name = (user?.name || 'there').trim();
    const count = tasks.length;
    const line = count === 1 ? 'You have 1 task today.' : `You have ${count} tasks today.`;
    const utterance = new SpeechSynthesisUtterance(`Hey ${name}. ${line}`);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleMyTaskStatus = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, status: task.status === 'done' ? 'pending' : 'done' };
    await taskUpdate({ id: taskId, status: updatedTask.status });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
  };

  const saveChildTheme = () => {
    const newTheme = themeChoice || 'pink';
    if (!user) return;

    userUpdate({ id: user.id, theme: newTheme }).then((updated) => {
      setUser(updated);
    });

    setThemeOpen(false);
  };

  const hour = new Date().getHours();
  let greetingPart = 'morning';
  if (hour >= 12 && hour < 17) greetingPart = 'afternoon';
  if (hour >= 17) greetingPart = 'evening';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gridAutoRows: 'auto',
          gap: '16px',
          alignContent: 'start',
        }}
      >
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '96px',
          }}
        >
          <div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Child dashboard</p>
            <h1 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 700 }}>
              Good {greetingPart}, {user?.name || 'there'}
            </h1>
          </div>

          <button
            type="button"
            aria-label="Open theme settings"
            onClick={() => setThemeOpen(true)}
            style={{
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(120deg,#fdf2f8,#eef2ff)',
              borderRadius: '12px',
              padding: '.55rem .75rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(0,0,0,.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '.45rem',
              color: '#111827',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🎨</span>
            <span>Theme</span>
          </button>
        </div>

        <div
          style={{
            gridColumn: '1',
            gridRow: '2',
            background: 'white',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '360px',
            maxHeight: '520px',
          }}
        >
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

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {tasks.length === 0 && !tasksLoading ? (
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
                        <li
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '.5rem',
                            padding: '.35rem 0',
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '.9rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.status === 'done'}
                            onChange={() => handleToggleMyTaskStatus(task.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <div
                            style={{
                              flex: 1,
                              textDecoration: task.status === 'done' ? 'line-through' : 'none',
                              opacity: task.status === 'done' ? 0.6 : 1,
                            }}
                          >
                            {task.title}
                          </div>
                          <span
                            style={{
                              fontSize: '.7rem',
                              padding: '.05rem .3rem',
                              borderRadius: '4px',
                              background: task.status === 'done' ? '#d1fae5' : '#dbeafe',
                              color: task.status === 'done' ? '#065f46' : '#1e3a8a',
                            }}
                          >
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
                        <li
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '.5rem',
                            padding: '.35rem 0',
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '.9rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.status === 'done'}
                            onChange={() => handleToggleMyTaskStatus(task.id)}
                            style={{ cursor: 'pointer', marginTop: '.2rem' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                opacity: task.status === 'done' ? 0.6 : 1,
                                fontWeight: 500,
                              }}
                            >
                              {task.title}
                            </div>
                            <div style={{ fontSize: '.8rem', color: '#6b7280' }}>
                              {friendlyFrequency(task.frequency)}
                            </div>
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
                        <li
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '.5rem',
                            padding: '.35rem 0',
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '.9rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.status === 'done'}
                            onChange={() => handleToggleMyTaskStatus(task.id)}
                            style={{ cursor: 'pointer', marginTop: '.2rem' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                opacity: task.status === 'done' ? 0.6 : 1,
                                fontWeight: 500,
                              }}
                            >
                              {task.habitToBreak || task.title}
                            </div>
                            <div style={{ fontSize: '.8rem', color: '#6b7280' }}>
                              {friendlyFrequency(task.frequency)}
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </div>
          {tasksLoading && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>Syncing…</div>
          )}
        </div>

        <div
          style={{
            gridColumn: '2',
            gridRow: '2',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            height: 'fit-content',
          }}
        >
          <StatTile label="Tasks" value={taskCounts.simple.total} sub={`${taskCounts.simple.pending} pending`} />
          <StatTile label="Build" value={taskCounts.build.total} sub={`${taskCounts.build.pending} pending`} />
          <StatTile label="Break" value={taskCounts.break.total} sub={`${taskCounts.break.pending} pending`} />
          <div
            style={{
              background: 'white',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '16px',
              padding: '12px',
              height: '92px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 6px 16px rgba(0,0,0,.04)',
            }}
          >
            <div style={{ fontSize: '12px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>
              Theme
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setThemeOpen(true)}
              style={{
                padding: '.4rem .65rem',
                fontSize: '.85rem',
                width: 'fit-content',
                background: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
                color: '#fff',
                border: 'none',
              }}
            >
              Open
            </button>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Personalize your space</div>
          </div>
        </div>

        <div
          style={{
            gridColumn: '2',
            gridRow: '3',
            background: '#f9fafb',
            border: '2px dashed #d1d5db',
            borderRadius: '14px',
            minHeight: '180px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '8px',
            padding: '20px',
            color: '#4b5563',
            fontSize: '0.95rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>Rewards & Games</h3>
          <p style={{ margin: 0, color: '#6b7280', maxWidth: '360px', lineHeight: 1.45 }}>
            Earn points, unlock mini-games, and celebrate streaks. This space is reserved for upcoming rewards.
          </p>
        </div>
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

function StatTile({ label, value, sub }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: '16px',
        padding: '12px',
        height: '92px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(0,0,0,.04)',
      }}
    >
      <div style={{ fontSize: '12px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{sub}</div>
    </div>
  );
}
