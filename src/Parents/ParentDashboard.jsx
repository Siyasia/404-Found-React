import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { Task, Goal, ActionPlan } from '../models';
import Toast from '../components/Toast.jsx';
import {taskList, taskUpdate, taskListPending} from '../lib/api/tasks.js';
import { childCreate, childGet, childList, childDelete, childUpdate } from '../lib/api/children.js';
import { Child } from '../models/index.js';
{/* Habit wizard imports */}
import HabitWizard from '../components/HabitWizard/HabitWizard.jsx';
import { WIZARD_CONFIG } from '../components/HabitWizard/HabitWizard.utils.js';
import { goalCreate, goalDelete, goalList, goalUpdate } from '../lib/api/goals.js';
import {
  actionPlanCreate,
  actionPlanDelete,
  actionPlanList,
  actionPlanDeleteByGoal,
} from '../lib/api/actionPlans.js';
import mapWizardPayload from '../lib/api/mapWizardPayload.js';

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
      goals: 'goals',  // Future tab for managing goals, not implemented yet
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

  // new habit system data that lives in goals + action plans.
  const [goals, setGoals] = useState([]);
  const [actionPlans, setActionPlans] = useState([]);
  const [editingGoal, setEditingGoal] = useState(null);

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childError, setChildError] = useState('');
  const [childSuccess, setChildSuccess] = useState('');
  const [childUsername, setChildUsername] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [childPasswordDrafts, setChildPasswordDrafts] = useState({});
  const [childPasswordSavingId, setChildPasswordSavingId] = useState(null);

  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskError, setTaskError] = useState('');
  const [taskSuccess, setTaskSuccess] = useState('');
   const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardKey, setWizardKey] = useState(0); // force-remount wizard after save/edit reset.

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

      // load saved goals + action plans for the new Habit Wizard flow.
      try {
        const gResp = await goalList();
        if (gResp && gResp.status_code === 200) {
          setGoals(Array.isArray(gResp.goals) ? gResp.goals.map(Goal.from) : []);
        }
      } catch (err) {
        console.error('Failed to load goals', err);
      }

      try {
        const apResp = await actionPlanList();
        if (apResp && apResp.status_code === 200) {
          setActionPlans(Array.isArray(apResp.plans) ? apResp.plans.map(ActionPlan.from) : []);
        }
      } catch (err) {
        console.error('Failed to load action plans', err);
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

  //Sprint 5 Change: Adding user name attributes to handleAddChild()
  const handleAddChild = async (e) => {
    e.preventDefault();
    setChildError('');

    const name = childName.trim();
    const ageNumber = Number(childAge);
    const username = childUsername.trim();

    if (!name || !childAge || !username || !childPassword) {
      setChildError('Please enter a name, username, password, and age for the child.');
      return;
    }

    if (username.includes('*') || username.includes('#')) {
      setChildError("Child username cannot contain '*' or '#'.");
      return;
    }

    if (ageNumber <= 0) {
      setChildError('Age must be a positive number.');
      return;
    }

    const newChild = Child.from({
      parentId: user.id,
      name,
      username,
      password: childPassword,
      age: ageNumber,
      code: generateChildCode(children),
      createdAt: new Date().getTime(),
    });

    console.log('[ParentDashboard] Add child submit');
    const result = await childCreate(newChild, childPassword)
    newChild.id = result.id; // Update with ID from backend
    if (result.status_code === 200) {
      const updated = [...children, newChild];
      saveChildren(updated)
      setChildName('');
      setChildUsername('');
      setChildPassword('');
      setChildAge('');
      setChildSuccess(`Child ${name} has been created with the username ${username}#${newChild.code}`);
      setChildUsername('');
      setTimeout(() => setChildSuccess(''), 3000);
    } else {
      setChildError('Failed to add child. Please try again.');
    }
    
  };

  const handleChangeChildPassword = async (child) => {
    const nextPassword = (childPasswordDrafts[child.id] || '').trim();

    setChildError('');

    if (!nextPassword) {
      setChildError(`Please enter a new password for ${child.name}.`);
      return;
    }

    setChildPasswordSavingId(child.id);

    try {
      const result = await childUpdate({ id: child.id, password: nextPassword });

      if (result.status_code === 200) {
        setChildPasswordDrafts((prev) => ({ ...prev, [child.id]: '' }));
        setChildSuccess(`Password updated for ${child.name}.`);
        setTimeout(() => setChildSuccess(''), 3000);
      } else {
        setChildError(result.error || 'Failed to update child password. Please try again.');
      }
    } catch (err) {
      console.error('Failed to update child password', err);
      setChildError('Failed to update child password. Please try again.');
    } finally {
      setChildPasswordSavingId(null);
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

  /* the legacy single-task assign flow is deprecated. want to add it back in later
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
  }; */

  // Handle Habit Wizard submit: map payload, create/update goal, then create action plans.
  // PHASE 3: this saves the new habit system only. It does NOT create legacy Task records.
  const handleWizardSubmit = async (payload) => {
    setTaskError('');
    setWizardSaving(true);

    try {
      const mapped = mapWizardPayload(payload);
      const { goal, actionPlans: mappedPlans } = mapped;

      if (!goal.assigneeId) {
        setTaskError('Please choose who this goal is for before saving.');
        return { success: false };
      }

      // PHASE 3: stamp creator + assignee display metadata before save.
      goal.createdById = user?.id || null;
      goal.createdByName = user?.name || '';
      goal.createdByRole = user?.role || 'parent';

      const assigneeMatch = (children || []).find((c) => String(c.id) === String(goal.assigneeId));
      goal.assigneeName = goal.assigneeName || assigneeMatch?.name || user?.name || '';

      // Defensive validation: all action plans must keep a normalized schedule.
      for (let i = 0; i < mappedPlans.length; i += 1) {
        const plan = mappedPlans[i];
        if (!plan || !plan.schedule || !plan.schedule.repeat) {
          const title = plan?.title || `task #${i + 1}`;
          setTaskError(`Wizard task "${title}" is missing scheduling information. Please set a schedule and try again.`);
          return { success: false };
        }
      }

      let goalId = null;

      if (editingGoal && editingGoal.id) {
        const updateResp = await goalUpdate(editingGoal.id, goal);
        if (!updateResp || updateResp.status_code !== 200) {
          setTaskError(updateResp?.error ? String(updateResp.error) : 'Failed to update goal.');
          return { success: false };
        }

        goalId = updateResp?.data?.id || updateResp?.data?._id || editingGoal.id;

        try {
          await actionPlanDeleteByGoal(goalId);
        } catch (err) {
          console.error('[ParentDashboard] Failed to replace existing action plans during edit', err);
          setTaskError('Failed to replace the previous action plans for this goal.');
          return { success: false };
        }
      } else {
        const createResp = await goalCreate(goal);
        if (!createResp || createResp.status_code !== 200) {
          setTaskError(createResp?.error ? String(createResp.error) : 'Failed to create goal.');
          return { success: false };
        }

        goalId = createResp?.data?.id || createResp?.data?._id || null;
      }

      const createdActionPlanIds = [];

      for (const plan of mappedPlans) {
        const nextPlan = {
          ...plan,
          goalId,
          assigneeId: plan.assigneeId ?? goal.assigneeId ?? null,
          createdById: user?.id || null,
          createdByName: user?.name || '',
          createdByRole: user?.role || 'parent',
        };

        const planAssignee = (children || []).find((c) => String(c.id) === String(nextPlan.assigneeId));
        nextPlan.assigneeName = nextPlan.assigneeName || planAssignee?.name || goal.assigneeName || '';

        const apResp = await actionPlanCreate(nextPlan);
        if (!apResp || apResp.status_code !== 200) {
          console.error('[ParentDashboard] actionPlanCreate failed', apResp);

          // Best-effort rollback for partially-created bundles.
          for (const createdId of createdActionPlanIds) {
            try {
              // eslint-disable-next-line no-await-in-loop
              await actionPlanDelete(createdId);
            } catch {
              // ignore rollback failure
            }
          }

          if (!editingGoal && goalId) {
            try {
              await goalDelete(goalId);
            } catch {
              // ignore rollback failure
            }
          }

          setTaskError(apResp?.error ? String(apResp.error) : 'Failed to create action plan.');
          return { success: false };
        }

        const createdApId = apResp?.id || apResp?.data?.id || apResp?.data?._id || null;
        if (createdApId) createdActionPlanIds.push(createdApId);
      }

      // Refresh new-system state after save.
      try {
        const gResp = await goalList();
        if (gResp && gResp.status_code === 200) {
          setGoals(Array.isArray(gResp.goals) ? gResp.goals.map(Goal.from) : []);
        }
      } catch (err) {
        console.warn('[ParentDashboard] Failed to refresh goals after save', err);
      }

      try {
        const apResp = await actionPlanList();
        if (apResp && apResp.status_code === 200) {
          setActionPlans(Array.isArray(apResp.plans) ? apResp.plans.map(ActionPlan.from) : []);
        }
      } catch (err) {
        console.warn('[ParentDashboard] Failed to refresh action plans after save', err);
      }

      // PHASE 3: clear the wizard draft and reset edit mode after a successful save.
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(WIZARD_CONFIG.DRAFT_STORAGE_KEY);
        }
      } catch {
        // ignore localStorage cleanup failure
      }

      setEditingGoal(null);
      setWizardKey((k) => k + 1);
      setTaskSuccess(editingGoal ? 'Goal updated successfully.' : 'Goal saved successfully.');
      setTimeout(() => setTaskSuccess(''), 3000);
      return { success: true };
    } catch (err) {
      console.error('[ParentDashboard] handleWizardSubmit error', err);
      setTaskError('Unexpected error creating goal.');
      return { success: false };
    } finally {
      setWizardSaving(false);
    }
  };

  // PHASE 3: deleting a goal removes its action plans first, then the goal.
  const handleDeleteGoal = async (goalId) => {
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Delete this goal and all of its action plans?');
    if (!confirmed) return;

    try {
      await actionPlanDeleteByGoal(goalId);
      const resp = await goalDelete(goalId);

      if (!resp || resp.status_code !== 200) {
        alert('Failed to delete goal.');
        return;
      }

      setGoals((prev) => prev.filter((g) => String(g.id) !== String(goalId)));
      setActionPlans((prev) => prev.filter((p) => String(p.goalId) !== String(goalId)));
      if (editingGoal && String(editingGoal.id) === String(goalId)) {
        setEditingGoal(null);
        setWizardKey((k) => k + 1);
      }
      setTaskSuccess('Goal deleted.');
      setTimeout(() => setTaskSuccess(''), 2500);
    } catch (err) {
      console.error('[ParentDashboard] handleDeleteGoal error', err);
      alert('Failed to delete goal.');
    }
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
    const toUpdate = pendingTasks.find((t) => t.id === taskId);
    if (!toUpdate) {
      alert('Task not found. Please refresh and try again.');
      return;
    }
    const child = children.find((c) => c.code == toUpdate.childCode);
    if (!child) {
      alert(
        `No child found with code ${toUpdate.childCode}. Add the child or correct the code before approving.`
      );
      return;
    }

    const data = {
      id: taskId,
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
                <span>
                  Child&apos;s name <span aria-hidden="true" className="required-asterisk">*</span>
                </span>
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
                <span>
                  Child username <span aria-hidden="true" className="required-asterisk">*</span>
                </span>
                <input
                  type="text"
                  value={childUsername}
                  onChange={(e) => setChildUsername(e.target.value)}
                  placeholder="Example: SwordFish"
                  required
                  aria-required="true"
                />
              </label>

              <label className="auth-label">
                <span>
                  Age <span aria-hidden="true" className="required-asterisk">*</span>
                </span>
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

              <label className="auth-label">
                <span>
                  Child password <span aria-hidden="true" className="required-asterisk">*</span>
                </span>
                <input
                  type="password"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  placeholder="Set a password"
                  required
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
              <ul className="notepad-list childrenNotepadList">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className="notepad-list-row childListRow"
                  >
                    <div className="childListInfo">
                      <div className="childPrimaryLine">
                        <strong>{child.name}</strong> — {child.age} years old
                      </div>
                      <div className="childSecondaryLine">
                        Username: <strong>{child.username || '—'}</strong>
                      </div>
                      {child.code && (
                        <div className="childSecondaryLine">
                          Login: <code>{child.username}#{child.code}</code>
                        </div>
                      )}
                    </div>

                    <div className="childListActions">
                      <div className="childPasswordRow">
                        <input
                          type="password"
                          className="childPasswordInput"
                          value={childPasswordDrafts[child.id] || ''}
                          onChange={(e) =>
                            setChildPasswordDrafts((prev) => ({
                              ...prev,
                              [child.id]: e.target.value,
                            }))
                          }
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          className="btn btn-primary childPasswordButton"
                          disabled={childPasswordSavingId === child.id}
                          onClick={() => handleChangeChildPassword(child)}
                        >
                          {childPasswordSavingId === child.id ? 'Saving...' : 'Update password'}
                        </button>
                      </div>

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
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assign' && (
        <div>
          <HabitWizard
            key={wizardKey}
            context="parent"
            availableChildren={children}
            parentUser={user}
            initialValues={editingGoal ? {
              // prefill the wizard when editing an existing goal bundle.
              type: editingGoal.goalType || editingGoal.type || editingGoal.habitType || null,
              title: editingGoal.title || editingGoal.goalTitle || '',
              whyItMatters: editingGoal.whyItMatters || '',
              startDate: editingGoal.startDate || editingGoal.goalStartDate || '',
              endDate: editingGoal.endDate || editingGoal.goalEndDate || '',
              triggers: editingGoal.triggers || [],
              replacements: editingGoal.replacements || [],
              savingFor: editingGoal.savingFor || '',
              rewardGoalTitle: editingGoal.rewardGoalTitle || '',
              rewardGoalCostCoins: editingGoal.rewardGoalCostCoins || '',
              milestoneRewards: editingGoal.milestoneRewards || undefined,
              assignee: editingGoal.assigneeId || editingGoal.assignee || '',
              tasks: (actionPlans || []).filter((p) => String(p.goalId) === String(editingGoal.id)),
            } : null}
            embedded={true}
            onSubmit={handleWizardSubmit}
            saving={wizardSaving}
          />
        </div>
      )}

      {/* Future tab for managing goals directly, outside of the Habit Wizard flow. Not fully implemented yet. */}
      {activeTab === 'goals' && (
        <div className="card">
          <h2>Your goals</h2>

          {goals.length === 0 && (
            <p className="sub">You haven&apos;t created any goals yet. Use the Assign tab to create one.</p>
          )}

          {goals.length > 0 && (
            <ul className="notepad-list">
              {goals
                .slice()
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .map((goal) => (
                  <li key={goal.id} className="notepad-list-row">
                    <div style={{ flex: 1 }}>
                      <strong>{goal.title || goal.goalTitle || 'Untitled goal'}</strong>
                      <div className="muted">
                        For: {goal.assigneeName || goal.assignee || 'Unknown'}
                      </div>
                      <div className="muted">
                        Window: {goal.startDate || ''}
                        {goal.endDate ? ` → ${goal.endDate}` : ''}
                      </div>
                      <div style={{ marginTop: '.5rem' }}>
                        <small>
                          {(actionPlans || []).filter((p) => String(p.goalId) === String(goal.id)).length} action plan(s)
                        </small>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '.5rem' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditingGoal(Goal.from(goal));
                          setTab('assign');
                          setWizardKey((k) => k + 1);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleDeleteGoal(goal.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
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
