import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { Task } from '../models';
import ParentHabitAssignment from './ParentHabitAssignment.jsx';
import Toast from '../components/Toast.jsx';
import {taskList, taskUpdate, taskListPending} from '../lib/api/tasks.js';
import { childCreate, childGet, childList, childDelete } from '../lib/api/children.js';
import { Child } from '../models/index.js';

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
  const [searchParams, setSearchParams] = useSearchParams();

const normalizeTab = (tab) => {
    if (!tab) return 'children';
    const key = tab.toLowerCase().replaceAll('-', '');
    const map = {
      children: 'children',
      assign: 'assign',
      mytasks: 'my-tasks',
      approvals: 'approvals',
    };
    return map[key] || 'children';
  };

  const initialTab = normalizeTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isNarrow1000, setIsNarrow1000] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1000 : false);

  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childError, setChildError] = useState('');
  const [childSuccess, setChildSuccess] = useState('');

  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskError, setTaskError] = useState('');
  const [taskSuccess, setTaskSuccess] = useState('');

  useEffect( () => {
    async function func(){
      try {
        const storedChildren = await childList();
        
        if (storedChildren.status_code === 200) {
          // setChildren(JSON.parse(storedChildren));
          setChildren(storedChildren.children);
        }
      } catch (err) {
        console.error('Failed to load children', err);
      }

      try {

        const storedTasks = await taskList();
        if (storedTasks.status_code === 200) {
          setTasks(storedTasks.tasks);
        }
      } catch (err) {
        console.error('Failed to load tasks', err);
      }

      try {
        const pending = await taskListPending();
        if (pending.status_code === 200) {
          setPendingTasks(pending.tasks);
        }
      } catch (err) {
        console.error('Failed to load pending tasks', err);
      }
  } func();
  }, []);

  // Keep tab in sync with URL (?tab=children|assign|my-tasks|approvals)
  useEffect(() => {
    const tab = normalizeTab(searchParams.get('tab'));
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    const onResize = () => setIsNarrow1000(typeof window !== 'undefined' ? window.innerWidth <= 1000 : false);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const setTab = (tab) => {
    const next = normalizeTab(tab);
    setActiveTab(next);
    setSearchParams(next ? { tab: next } : {});
  };

  useEffect(() => {
    if (!taskAssigneeId && user?.id) {
      setTaskAssigneeId(user.id);
    }
  }, [user, taskAssigneeId]);

  const saveChildren = (list) => {
    setChildren(list);
  };

  const saveTasks = (list) => {
    setTasks(list);
  };

  const handleAddChild = async (e) => {
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

    const newChild = Child.from({
      parentId: user.id,
      name,
      age: ageNumber,
      code: generateChildCode(children),
      createdAt: new Date().getTime(),
    });

    console.log('[ParentDashboard] Add child submit');
    const result = await childCreate(newChild)
    newChild.id = result.id; // Update with ID from backend
    if (result.status_code === 200) {
      const updated = [...children, newChild];
      saveChildren(updated)
      setChildName('');
      setChildAge('');
      setChildSuccess(`${newChild.name} added. Code: ${newChild.code}`);
      setTimeout(() => setChildSuccess(''), 3000);
    } else {
      setChildError('Failed to add child. Please try again.');
    }
    
  };

  const handleRemoveChild = async (id) => {
    const updatedChildren = children.filter((c) => c.id !== id);
    const result = await childDelete(id);
    if (result.status_code === 200) {
      saveChildren(updatedChildren);
      const updatedTasks = tasks.filter((t) => t.assigneeId !== id);
      saveTasks(updatedTasks);
    } else {
      alert('Failed to remove child. Please try again. Status code: ' + result.status_code);
    }
  };

  const handleAssignTask = async (e) => {
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

    let assignee;
    if (user && user.id === taskAssigneeId) {
        assignee = user;
    } else {
      let result = await childGet(taskAssigneeId)
      if (result.status_code === 200) {
        assignee = result.child;
      }
      else {
        setTaskError('Selected assignee not found. Please refresh and try again.');
      }
    }

    const newTask = new Task({
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
    });

    const updated = [...tasks, newTask];
    saveTasks(updated);
    setTaskTitle('');
    setTaskNotes('');
  };

  const handleToggleTaskStatus = (taskId) => {
    console.log('[ParentDashboard] Toggle status', taskId);
    setTasks((prev) => {
      const updated = prev.map((t) => {
        const obj = (t && typeof t.toJSON === 'function') ? t.toJSON() : t;
        if (!obj) return Task.from(obj);
        if (obj.id === taskId) obj.status = obj.status === 'done' ? 'pending' : 'done';
        return Task.from(obj);
      });
      saveTasks(updated);
      const changed = updated.find((t) => t.id === taskId);
      if (changed) {
        setTaskSuccess(`Marked ${changed.title || 'task'} ${changed.status === 'done' ? 'done' : 'not done'}.`);
        setTimeout(() => setTaskSuccess(''), 2500);
      }
      return updated;
    });
  };

  const providerPendingTasks = pendingTasks.filter(
    (t) => t.needsApproval && t.createdByRole === 'provider'
  );

  const handleApproveProviderTask = async (taskId) => {
    const toUpdate = tasks.find((t) => t.id === taskId);
    if (!toUpdate) {
      alert('Task not found. Please refresh and try again.');
      return;
    }
    const child = children.find((c) => c.code === toUpdate.childCode);
    if (!child) {
      alert(
        `No child found with code ${toUpdate.childCode}. Add the child or correct the code before approving.`
      );
      return;
    }

    const data = {
      taskId,
      assigneeId: child.id,
      assigneeName: child.name,
      needsApproval: false,
      approvedByParentId: user?.id,
      approvedAt: new Date().getTime(),
    }

    Object.assign(toUpdate, data);
    const response = await taskUpdate(data);
    if (response.status_code === 200) {
      setTasks(prev => prev.map(t => {
        return t.taskId === taskId ? toUpdate : t;
      }));
      console.log('[ParentDashboard] Approved provider task response', response);
    } else {
      console.error('[ParentDashboard] Error approving provider task', response);
      alert('Failed to approve task. Please try again. Status code: ' + response.status_code);
    }
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
  const childIdSet = new Set(children.map((c) => String(c.id)));
  const childCodeSet = new Set(children.map((c) => c.code).filter(Boolean));
  const tasksForChildren = tasks.filter((t) => {
    const assigneeId = t.assigneeId;
    const assigneeCode = t.childCode;
    const idMatch = assigneeId && childIdSet.has(String(assigneeId));
    const codeMatch = assigneeCode && childCodeSet.has(assigneeCode);
    return idMatch || codeMatch;
  });

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

  const outerShell = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  };

  const outerGrid = { display: 'flex', flexDirection: 'column', gap: '16px' };

  const mainAreaStyle = {
    display: 'grid',
    gap: '16px',
  };

  return (
    <section className="container" style={outerShell}>
      <Toast message={childSuccess} type="success" onClose={() => setChildSuccess('')} />
      <Toast message={taskSuccess} type="success" onClose={() => setTaskSuccess('')} />

      <div style={outerGrid}>
        <main style={{ ...mainAreaStyle, maxWidth: '1200px', width: '100%' }}>

      {activeTab === 'children' && (
        <div className="childrenGrid">
          <div className="card addChildCard">
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

          <div className="card childrenListCard notepadCard">
            <h2>Your children</h2>

            {children.length === 0 && (
              <p className="sub">You haven&apos;t added any child accounts yet.</p>
            )}

            {children.length > 0 && (
              <ul className="notepad-list">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className="notepad-list-row"
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
                      onClick={async () => {
                        console.log('Removed child', child.id);
                        await handleRemoveChild(child.id);
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assign' && (
        <div>
          <ParentHabitAssignment
            embed
            parentChildren={children}
            parentTasks={tasks}
            onTasksChange={saveTasks}
            compactList
            listMaxHeight={520}
          />
        </div>
      )}

      {activeTab === 'my-tasks' && (
        <div className="parentTasksLayout">
          <section className="card parentTasksCard">
            <h2>Tasks you&apos;ve created</h2>

            {tasks.filter((t) => t.createdByRole === 'parent').length === 0 && (
              <p className="sub">
                You haven&apos;t created any tasks yet. Use the Assign tab to create one,
                or approve tasks from providers below.
              </p>
            )}

            {tasks.filter((t) => t.createdByRole === 'parent').length > 0 && (
              <div className="parentTasksScroll">
                {tasks
                  .filter((t) => t.createdByRole === 'parent')
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((task) => (
                    <div className="taskRow" key={task.id}>
                      <div className="taskMeta">
                        <div className="taskTitle">{task.title}</div>
                        <div className="taskSub">For {getAssigneeLabel(task)}{task.notes ? ` — ${task.notes}` : ''}{task.status === 'done' ? ' · Done ✅' : ''}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleToggleTaskStatus(task.id)}
                      >
                        {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </section>

          <section className="card parentTasksCard">
            <h2>Tasks for your children</h2>

            {tasksForChildren.length === 0 ? (
              <p className="sub">
                None of your children have tasks yet, or they haven't been assigned any.
              </p>
            ) : (
              <div className="parentTasksScroll">
                {tasksForChildren
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((task) => {
                    const child = children.find((c) => String(c.id) === String(task.assigneeId)) ||
                      children.find((c) => c.code && c.code === task.childCode);
                    const childName = child ? child.name : task.assigneeName || 'Unknown child';
                    const typeLabel = (task.taskType || 'simple')
                      .replace('build-habit', 'Build habit')
                      .replace('break-habit', 'Break habit')
                      .replace('simple', 'Task');
                    const detail = task.habitToBreak || task.title;
                    return (
                      <div className="taskRow" key={task.id}>
                        <div className="taskMeta">
                          <div className="taskTitle">{detail}</div>
                          <div className="taskSub">
                            {typeLabel} • For {childName}
                            {task.notes ? ` — ${task.notes}` : ''}
                            {task.status === 'done' ? ' · Done ✅' : ' · Pending'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleToggleTaskStatus(task.id)}
                        >
                          {task.status === 'done' ? 'Mark not done' : 'Mark done'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'approvals' && (
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
      )}
        </main>
      </div>
    </section>
  );
}
