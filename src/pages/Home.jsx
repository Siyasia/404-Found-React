import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ThemeModal from '../Child/ThemeModal.jsx';
import {
  canCreateOwnTasks,
  canAssignTasksToChildren,
  canCreateProviderTasks,
  canAcceptProviderTasks,
} from '../Roles/roles.js';
import { 
  Task, 
  FormedHabit, 
  TASK_TYPE_SIMPLE, 
  TASK_TYPE_BUILD_HABIT, 
  TASK_TYPE_BREAK_HABIT, 
  TASK_STATUS_PENDING, 
  TASK_STATUS_DONE 
} from '../models';
import { taskList, taskUpdate, taskCreate } from '../lib/api/tasks.js';
import { buildHabitDelete, buildHabitList, formedHabitList, breakHabitList, breakHabitDelete } from '../lib/api/habits.js';
import { userUpdate } from '../lib/api/user.js';
import { userGet } from '../lib/api/authentication.js';
import SchedulePicker from '../components/SchedulePicker.jsx';
import { formatScheduleLabel, toLocalISODate, isDueOnDate, getNextDueDate, computeCurrentStreak, computeBestStreak, REPEAT } from '../lib/schedule.js';
import TaskCard from '../components/TaskCard.jsx';

const BUILD_KEY = 'ns.buildPlan.v1';
const BREAK_KEY = 'ns.breakPlan.v1';
const TASKS_KEY = 'ns.childTasks.v1';
const FORMED_KEY = 'ns.habitsFormed.v1';
const TASK_SCHEDULE_KEY = 'ns.taskSchedule.v1';

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
  const [taskCounts, setTaskCounts] = useState({ // default to 0 counts for each type to avoid undefined issues in rendering
    [TASK_TYPE_BUILD_HABIT]: { total: 0, done: 0, pending: 0 },
    [TASK_TYPE_BREAK_HABIT]: { total: 0, done: 0, pending: 0 },
    [TASK_TYPE_SIMPLE]: { total: 0, done: 0, pending: 0 }
  });
  const [tasksLoading, setTasksLoading] = useState(true);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskSchedule, setNewTaskSchedule] = useState({
    repeat: REPEAT.DAILY,
    startDate: toLocalISODate(),
    endDate: '',
  });
  const [newTaskError, setNewTaskError] = useState('');
  const [newTaskSaving, setNewTaskSaving] = useState(false);

  const [formedHabits, setFormedHabits] = useState(null);
  const [formedLoading, setFormedLoading] = useState(true);

  const [themeOpen, setThemeOpen] = useState(false);
  const [themeChoice, setThemeChoice] = useState(user?.theme || 'pink');
  const todayISO = useMemo(() => toLocalISODate(), []);

  function updateTaskCounts() {
    const getCounts = (arr) => {
      const total = arr.length;
      const done = arr.filter((t) => t.status === TASK_STATUS_DONE).length;
      const pending = total - done;
      return { total, done, pending };
    };

    // categorize tasks by type for both list and counts
    setSimpleTasks(tasks.filter((t) => (t.taskType || TASK_TYPE_SIMPLE) === TASK_TYPE_SIMPLE));
    setBuildTasks(tasks.filter((t) => (t.taskType || TASK_TYPE_SIMPLE) === TASK_TYPE_BUILD_HABIT));
    setBreakTasks(tasks.filter((t) => (t.taskType || TASK_TYPE_SIMPLE) === TASK_TYPE_BREAK_HABIT));
    setTaskCounts({
      [TASK_TYPE_SIMPLE]: getCounts(tasks.filter((t) => (t.taskType || TASK_TYPE_SIMPLE) === TASK_TYPE_SIMPLE)),
      [TASK_TYPE_BUILD_HABIT]: getCounts(tasks.filter((t) => (t.taskType || TASK_TYPE_SIMPLE) === TASK_TYPE_BUILD_HABIT)),
      [TASK_TYPE_BREAK_HABIT]: getCounts(tasks.filter((t) => (t.taskType || TASK_TYPE_SIMPLE) === TASK_TYPE_BREAK_HABIT)),
    });
  }

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
          const withSchedules = mergeSchedules(storedTasks.tasks.map((t) => Task.from(t)));
          setTasks(withSchedules);
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

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const log = { ...(task.completionLog || {}) };
    const doneToday = !!log[todayISO] || task.lastCompletedOn === todayISO;
    const status = doneToday ? TASK_STATUS_PENDING : TASK_STATUS_DONE;

    if (doneToday) {
      delete log[todayISO];
    } else {
      log[todayISO] = true;
    }

    const updatedTask = {
      ...task,
      status,
      lastCompletedOn: doneToday ? null : todayISO,
      completionLog: log,
    };

    if (task.schedule) {
      const currentStreak = computeCurrentStreak(updatedTask, todayISO);
      const bestStreak = Math.max(computeBestStreak(updatedTask), task.stats?.bestStreak || 0, currentStreak);
      updatedTask.stats = { ...(task.stats || {}), currentStreak, bestStreak };
    }

    await taskUpdate({
      id: taskId,
      status: updatedTask.status,
      lastCompletedOn: updatedTask.lastCompletedOn,
      completionLog: updatedTask.completionLog,
      stats: updatedTask.stats,
    });

    setTasks((prev) => prev.map((t) => (t.id === taskId ? withTodayStatus(updatedTask) : t)));
  };

  const handleAddSimpleTask = async (event) => {
    event.preventDefault();
    if (newTaskSaving) return;

    const title = newTaskTitle.trim();
    const notes = newTaskNotes.trim();

    if (!title) {
      setNewTaskError('Please enter a task name.');
      return;
    }

    setNewTaskError('');
    setNewTaskSaving(true);

    try {
      const baseTask = new Task({
        assigneeId: user?.id || null,
        assigneeName: user?.name || 'You',
        title,
        notes,
        taskType: TASK_TYPE_SIMPLE,
        status: TASK_STATUS_PENDING,
        createdAt: new Date().toISOString(),
        createdById: user?.id || null,
        createdByName: user?.name || 'You',
        createdByRole: user?.role || 'user',
        schedule: newTaskSchedule,
        completionLog: {},
      });

      const response = await taskCreate(baseTask);
      const payload = typeof baseTask.toJSON === 'function' ? baseTask.toJSON() : baseTask;
      const createdTask = withTodayStatus({
        ...payload,
        ...(response && response.id ? { id: response.id } : {}),
      });

      persistSchedule(createdTask.id, newTaskSchedule);
      setTasks((prev) => [...prev, createdTask]);
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewTaskSchedule({ repeat: 'DAILY', startDate: toLocalISODate(), endDate: '' });
    } catch (err) {
      console.error('Error creating task', err);
      setNewTaskError('Could not add task. Please try again.');
    } finally {
      setNewTaskSaving(false);
    }
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

  const [activeTab, setActiveTab] = useState(TASK_TYPE_SIMPLE); 
  // TASK_TYPE_SIMPLE | TASK_TYPE_BUILD_HABIT | TASK_TYPE_BREAK_HABIT
  const [activeView, setActiveView] = useState('timeline')

  const friendlyFrequency = (freq) => {
    if (!freq) return 'No schedule set';
    if (freq === 'daily') return 'Every day';
    if (freq === 'weekdays') return 'Weekdays';
    if (freq === 'weekends') return 'Weekends';
    return freq;
  };

  const withTodayStatus = (task) => {
    if (!task) return task;
    const log = task.completionLog || {};
    const doneToday = !!log[todayISO] || task.lastCompletedOn === todayISO;
     return Task.from({ ...task, status: doneToday ? TASK_STATUS_DONE : TASK_STATUS_PENDING });
  };

  const loadScheduleCache = () => {
    try {
      return JSON.parse(localStorage.getItem(TASK_SCHEDULE_KEY)) || {};
    } catch {
      return {};
    }
  };

  const persistSchedule = (taskId, schedule) => {
    if (!taskId || !schedule) return;
    const cache = loadScheduleCache();
    cache[taskId] = schedule;
    localStorage.setItem(TASK_SCHEDULE_KEY, JSON.stringify(cache));
  };

  const mergeSchedules = (list) => {
    const cache = loadScheduleCache();
    return (list || []).map((t) => {
      const schedule = t.schedule || cache[t.id] || null;
      return withTodayStatus({ ...t, schedule });
    });
  };

  const scheduleBadges = (task) => {
    if (!task?.schedule) return null;
    const s = task.schedule;
    const badges = [];
    const label = formatScheduleLabel(s);
    if (label) badges.push(label);
    const todayIso = toLocalISODate();
    if (s.startDate && s.startDate > todayIso) {
      badges.push(`Starts ${new Date(`${s.startDate}T00:00:00`).toLocaleDateString()}`);
    }
    if (s.endDate) {
      badges.push(`Ends ${new Date(`${s.endDate}T00:00:00`).toLocaleDateString()}`);
    }

    return (
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginTop: '.2rem' }}>
        {badges.map((text, idx) => (
          <span
            key={`${task.id}-sch-${idx}`}
            style={{
              fontSize: '.7rem',
              padding: '.1rem .4rem',
              borderRadius: '999px',
              background: '#eef2ff',
              color: '#4338ca',
              border: '1px solid #e0e7ff'
            }}
          >
            {text}
          </span>
        ))}
      </div>
    );
  };

  const categorizeTask = (task) => {
    if (!task?.schedule) return { bucket: 'unscheduled', nextDue: null };
    const s = task.schedule;
    const dueToday = isDueOnDate(s, todayISO) && task.lastCompletedOn !== todayISO;
    if (dueToday) return { bucket: 'due', nextDue: todayISO };

    const nextDue = getNextDueDate(s, todayISO);
    if (nextDue) {
      const diffDays = Math.floor((new Date(`${nextDue}T00:00:00`) - new Date(`${todayISO}T00:00:00`)) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) return { bucket: 'upcoming', nextDue };
      return { bucket: 'later', nextDue };
    }
    return { bucket: 'later', nextDue: null };
  };

  const splitTasks = (list) => {
    const due = [];
    const upcoming = [];
    const later = [];

    (list || []).forEach((t) => {
      const info = categorizeTask(t);
      if (info.bucket === 'due') {
        due.push(t);
      } else if (info.bucket === 'upcoming') {
        upcoming.push({ ...t, nextDue: info.nextDue });
      } else if (info.bucket === 'later') {
        later.push({ ...t, nextDue: info.nextDue });
      } else {
        // unscheduled tasks behave like due today if still pending
        if ((t.status || 'pending') !== 'done') {
          due.push(t);
        }
      }
    });

    // Sort 'due' for display: tasks with a timeOfDay first (ascending HH:MM), then untimed tasks.
    // Stable tiebreaker: title, then createdAt timestamp.
    due.sort((a, b) => {
      const ta = a.timeOfDay || null;
      const tb = b.timeOfDay || null;
      if (ta && tb) {
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        // fallthrough to tiebreaker
      } else if (ta && !tb) {
        return -1;
      } else if (!ta && tb) {
        return 1;
      }
      // tie-break by title (locale), then createdAt
      const titleCmp = (a.title || '').localeCompare(b.title || '');
      if (titleCmp !== 0) return titleCmp;
      const ca = new Date(a.createdAt || 0).getTime();
      const cb = new Date(b.createdAt || 0).getTime();
      return ca - cb;
    });

    upcoming.sort((a, b) => new Date(`${a.nextDue}T00:00:00`) - new Date(`${b.nextDue}T00:00:00`));
    later.sort((a, b) => {
      const aDate = a.nextDue ? new Date(`${a.nextDue}T00:00:00`) : new Date(`${todayISO}T00:00:00`).getTime() + 365 * 24 * 60 * 60 * 1000;
      const bDate = b.nextDue ? new Date(`${b.nextDue}T00:00:00`) : new Date(`${todayISO}T00:00:00`).getTime() + 365 * 24 * 60 * 60 * 1000;
      return aDate - bDate;
    });

    return { due, upcoming, later };
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
    <div className="homePage">
      <div className="homeLayout">
        <header className="homeHeader">
          <div className="homeHeaderTop">
            <h1 className="homeTitle">Good {greetingPart}, {user?.name || 'there'}</h1>
            {user?.role === 'child' && (
              <button
                type="button"
                aria-label="Theme settings"
                onClick={() => setThemeOpen(true)}
                className="themeButton"
                title="Settings"
              >
                🎨
              </button>
            )}
          </div>
          <p className="homeSub">Here's what's on your plate today.</p>
        </header>

        <section className="homeLeft">
          <div className="card todayCard">
            <div className="todayHeader">
              <h2 className="sectionTitle">Today</h2>
              <button
                type="button"
                onClick={speakTaskSummary}
                disabled={!supportsTTS}
                className="btn todayReadButton"
              >
                🔊 Read
              </button>
            </div>

            <div className="tabList" aria-label="Task categories">
              <button type="button" className="btn tabButton tabButtonActive" disabled>
                Simple ({taskCounts[TASK_TYPE_SIMPLE].total})
              </button>
            </div>

            <div className="taskList">
              {tasksLoading ? (
                <div className="mutedText">Loading…</div>
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
                  {(() => {
                    const groups = splitTasks(simpleTasks);
                    const renderItem = (task) => (
                      <li key={task.id} className="taskListItem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <TaskCard task={task}>
                            <input
                              type="checkbox"
                              checked={task.status === TASK_STATUS_DONE}
                              onChange={() => handleToggleMyTaskStatus(task.id)}
                              className="taskCheckbox"
                            />
                          </TaskCard>
                        </div>
                        {/* time badge handled inside TaskCard; keep children area for checkbox */}
                      </li>
                    );

                    return (
                      <div className="taskGroup">
                        {groups.due.length > 0 && (
                          <>
                            <div className="taskGroupTitle">Due Today</div>
                            {/* Show timed tasks first, then an "Anytime" divider above untimed tasks */}
                            {(() => {
                              const timed = groups.due.filter(t => t.timeOfDay);
                              const untimed = groups.due.filter(t => !t.timeOfDay);
                              return (
                                <>
                                  {timed.length > 0 && <ul className="taskListGroup">{timed.map(renderItem)}</ul>}
                                  {untimed.length > 0 && (
                                    <>
                                      <div style={{ marginTop: 8, marginBottom: 6, fontSize: 13, color: '#6b7280' }}>Anytime</div>
                                      <ul className="taskListGroup">{untimed.map(renderItem)}</ul>
                                    </>
                                  )}
                                </>
                              )
                            })()}
                          </>
                        )}
                        {groups.upcoming.length > 0 && (
                          <>
                            <div className="taskGroupTitle">Upcoming (next 7 days)</div>
                            <ul className="taskListGroup">{groups.upcoming.map(renderItem)}</ul>
                          </>
                        )}
                        {groups.later.length > 0 && (
                          <>
                            <div className="taskGroupTitle">Starts Later</div>
                            <ul className="taskListGroup">{groups.later.map(renderItem)}</ul>
                          </>
                        )}
                        {groups.due.length === 0 && groups.upcoming.length === 0 && groups.later.length === 0 && (
                          <div className="mutedText">No tasks scheduled.</div>
                        )}
                      </div>
                    );
                  })()}
              </>
            )}
            </div>
          </div>

          {user?.role !== 'child' && (
            <div className="card addTaskCard">
              <div className="addTaskHeader">
                <h2 className="sectionTitle">Add a task</h2>
                <span className="mutedText">Simple tasks for you</span>
              </div>

              <form onSubmit={handleAddSimpleTask} className="addTaskForm">
                <label className="fieldLabel">
                  <span className="fieldTitle">Task name</span>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Example: Read for 20 minutes"
                    className="textInput"
                  />
                </label>

                <label className="fieldLabel">
                  <span className="fieldTitle">Notes (optional)</span>
                  <textarea
                    rows={3}
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                    placeholder="Add details or reminders"
                    className="textInput"
                    style={{ fontFamily: 'inherit' }}
                  />
                </label>

                <div className="scheduleBox">
                  <div className="fieldTitle">Schedule</div>
                  <SchedulePicker value={newTaskSchedule} onChange={setNewTaskSchedule} />
                </div>

                {newTaskError && (
                  <div className="errorText">{newTaskError}</div>
                )}

                <button
                  type="submit"
                  className="btn addTaskButton"
                  disabled={newTaskSaving}
                >
                  {newTaskSaving ? 'Adding…' : 'Add task'}
                </button>
              </form>
            </div>
          )}
        </section>

        <aside className="homeRight">
          <div className="statsGrid">
            <div className="statCard">
              <div className="statLabel">Tasks</div>
              <div className="statValue">{taskCounts[TASK_TYPE_SIMPLE].total}</div>
              <div className="statSub">{taskCounts[TASK_TYPE_SIMPLE].pending} pending</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Build</div>
              <div className="statValue">{taskCounts[TASK_TYPE_BUILD_HABIT].total}</div>
              <div className="statSub">{taskCounts[TASK_TYPE_BUILD_HABIT].pending} pending</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Break</div>
              <div className="statValue">{taskCounts[TASK_TYPE_BREAK_HABIT].total}</div>
              <div className="statSub">{taskCounts[TASK_TYPE_BREAK_HABIT].pending} pending</div>
            </div>
            <div className="statCard statAction">
              {canCreate ? (
                <Link to="/build-habit" className="btn" style={{ width: '100%' }}>
                  + New Plan
                </Link>
              ) : (
                <span className="mutedText">Ready?</span>
              )}
            </div>
          </div>

          {canCreate && (
            <div className="card plansCard">
              <h2 className="sectionTitle">Your Plans</h2>

              <div className="planRow planRowBuild">
                <div>
                  <div className="planTitle"> Build</div>
                  {buildPlan ? (
                    <div className="planSub">{buildPlan.goal || 'No goal'}</div>
                  ) : (
                    <div className="planSub mutedText">Start a habit</div>
                  )}
                </div>
                <div className="planActions">
                  <Link to="/build-habit" className="btn btn-ghost planButton">
                    {buildPlan ? 'Edit' : 'Create'}
                  </Link>
                  {buildPlan && (
                    <button type="button" className="btn planButton" onClick={completeBuildPlan}>
                      Done
                    </button>
                  )}
                </div>
              </div>

              <div className="planRow planRowBreak">
                <div>
                  <div className="planTitle"> Break</div>
                  {breakPlan ? (
                    <div className="planSub">{breakPlan.habit || 'No habit'}</div>
                  ) : (
                    <div className="planSub mutedText">Replace a habit</div>
                  )}
                </div>
                <div className="planActions">
                  <Link to="/break-habit" className="btn btn-ghost planButton">
                    {breakPlan ? 'Edit' : 'Create'}
                  </Link>
                  {breakPlan && (
                    <button type="button" className="btn planButton" onClick={completeBreakPlan}>
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {canCreate && (
            <div className="card masteredCard">
              <h2 className="sectionTitle">Mastered 🏆</h2>

              {formedForUser.length === 0 ? (
                <EmptyState icon="⭐" title="Nothing yet" description="Complete a plan" buttonLabel="Start" buttonLink="/build-habit" />
              ) : (
                <ul className="masteredList">
                  {formedForUser.slice(0, 6).map((h) => (
                    <li key={h.id} className="masteredItem">
                      <div className="masteredTitle">{h.title}</div>
                      <div className="masteredMeta">
                        {h.type === 'build' ? '📈' : '🚫'} {h.completedAt ? new Date(h.completedAt).toLocaleDateString() : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
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
