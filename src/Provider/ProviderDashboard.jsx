import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '../UserContext.jsx';
import { childList } from '../lib/api/children.js';
import { goalList } from '../lib/api/goals.js';
import { actionPlanList } from '../lib/api/actionPlans.js';
import { taskList } from '../lib/api/tasks.js';
import TaskAssignmentPanel from '../components/TaskAssignmentPanel.jsx';

function normalizeId(value) {
  if (value == null) return '';
  return String(value);
}

function getTasksArray(response) {
  if (Array.isArray(response?.data?.tasks)) return response.data.tasks;
  if (Array.isArray(response?.tasks)) return response.tasks;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getChildrenArray(response) {
  if (Array.isArray(response?.data?.children)) return response.data.children;
  if (Array.isArray(response?.children)) return response.children;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getGoalsArray(response) {
  if (Array.isArray(response?.data?.goals)) return response.data.goals;
  if (Array.isArray(response?.goals)) return response.goals;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getPlansArray(response) {
  if (Array.isArray(response?.data?.plans)) return response.data.plans;
  if (Array.isArray(response?.plans)) return response.plans;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getStatusLabel(task) {
  if (task?.needsApproval && String(task?.status || '').toLowerCase() !== 'completed') {
    return 'Waiting for parent approval';
  }

  const status = String(task?.status || '').toLowerCase();
  if (status === 'completed') return 'Completed';
  if (status === 'active') return 'In progress';
  return 'Sent';
}

export default function ProviderDashboard() {
  const { user } = useUser();

  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadProviderData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setLoadError('');

    try {
      const [childResp, taskResp, goalResp, planResp] = await Promise.all([
        childList(),
        taskList({ createdById: user.id }),
        goalList(),
        actionPlanList(),
      ]);

      setChildren(getChildrenArray(childResp));
      setTasks(getTasksArray(taskResp));
      setGoals(getGoalsArray(goalResp));
      setPlans(getPlansArray(planResp));
    } catch (error) {
      console.error('Failed to load provider dashboard:', error);
      setLoadError('Could not load the provider dashboard right now.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProviderData();
  }, [loadProviderData]);

  const assigneeOptions = useMemo(() => {
    return children.map((child) => ({
      id: child.id,
      name: child.name || child.username || 'Child',
      label: child.name || child.username || 'Child',
    }));
  }, [children]);

  const actionPlanOptions = useMemo(() => {
    const childIds = new Set(children.map((child) => normalizeId(child.id)));

    return plans
      .filter((plan) => childIds.has(normalizeId(plan.assigneeId)))
      .map((plan) => {
        const relatedGoal = goals.find(
          (goal) => normalizeId(goal.id) === normalizeId(plan.goalId)
        );
        const assignee =
          children.find((child) => normalizeId(child.id) === normalizeId(plan.assigneeId)) ||
          null;

        return {
          id: plan.id,
          title: plan.title || 'Untitled action plan',
          label: `${plan.title || 'Untitled action plan'}${
            assignee ? ` - ${assignee.name || assignee.username || 'Child'}` : ''
          }`,
          goalId: plan.goalId ?? relatedGoal?.id ?? null,
          notes: relatedGoal?.whyItMatters || '',
        };
      });
  }, [plans, goals, children]);

  const providerTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aTime = new Date(a?.createdAt || a?.sentAt || 0).getTime();
      const bTime = new Date(b?.createdAt || b?.sentAt || 0).getTime();
      return bTime - aTime;
    });
  }, [tasks]);

  const summary = useMemo(() => {
    const pendingApproval = providerTasks.filter(
      (task) => task?.needsApproval && String(task?.status || '').toLowerCase() !== 'completed'
    ).length;
    const completed = providerTasks.filter(
      (task) => String(task?.status || '').toLowerCase() === 'completed'
    ).length;
    const sent = providerTasks.filter(
      (task) =>
        !task?.needsApproval &&
        String(task?.status || '').toLowerCase() !== 'completed'
    ).length;

    return {
      total: providerTasks.length,
      pendingApproval,
      sent,
      completed,
    };
  }, [providerTasks]);

  const handleCreated = useCallback(async () => {
    await loadProviderData();
  }, [loadProviderData]);

  if (!user) {
    return (
      <section className="provider-dashboard" style={{ padding: '1.5rem' }}>
        <h1 className="provider-dashboard__title app-page-title">Provider dashboard</h1>
        <p className="app-helper-text">You need to be logged in first.</p>
      </section>
    );
  }

  return (
    <section className="provider-dashboard" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '18px',
          padding: '1.25rem',
        }}
      >
        <h1 className="provider-dashboard__title app-page-title" style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800 }}>Provider dashboard</h1>
        <p className="app-helper-text" style={{ margin: '0.4rem 0 0', color: '#6b7280' }}>
          Create support tasks for children. Parent approval stays in the parent flow.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '0.9rem',
        }}
      >
        {[
          { label: 'Created', value: summary.total },
          { label: 'Waiting approval', value: summary.pendingApproval },
          { label: 'Sent', value: summary.sent },
          { label: 'Completed', value: summary.completed },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#9ca3af',
                fontWeight: 800,
              }}
            >
              {item.label}
            </div>
            <div style={{ marginTop: '0.45rem', fontSize: '1.8rem', fontWeight: 900 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '18px',
            padding: '1rem',
          }}
        >
          <TaskAssignmentPanel
            mode="parent"
            currentUser={user}
            assigneeOptions={assigneeOptions}
            actionPlanOptions={actionPlanOptions}
            title="Provider task builder"
            submitLabel="Send for approval"
            onCreated={handleCreated}
          />
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '18px',
            padding: '1rem',
          }}
        >
          <h2 className="app-panel-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>How this works</h2>
          <div className="app-helper-text" style={{ marginTop: '0.8rem', color: '#6b7280', lineHeight: 1.6, fontSize: '0.95rem' }}>
            <div>1. Build a provider task for one or more children.</div>
            <div>2. It appears in the parent approval area.</div>
            <div>3. Once approved, the child can work on it in their task flow.</div>
          </div>

          <div
            style={{
              marginTop: '1rem',
              padding: '0.9rem',
              borderRadius: '14px',
              background: '#f9fafb',
              border: '1px solid #eef2f7',
              fontSize: '0.92rem',
              color: '#4b5563',
              lineHeight: 1.55,
            }}
          >
            Providers should not have tasks assigned to themselves. This page is only for creating tasks for others.
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '18px',
          padding: '1rem',
        }}
      >
        <h2 className="app-panel-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Recent provider tasks</h2>

        {loading ? (
          <p style={{ marginTop: '0.9rem', color: '#6b7280' }}>Loading provider tasks...</p>
        ) : loadError ? (
          <p style={{ marginTop: '0.9rem', color: '#dc2626' }}>{loadError}</p>
        ) : providerTasks.length === 0 ? (
          <p style={{ marginTop: '0.9rem', color: '#6b7280' }}>
            No provider tasks yet. Create one above to get started.
          </p>
        ) : (
          <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.75rem' }}>
            {providerTasks.slice(0, 10).map((task, index) => (
              <div
                key={task.id || task.tempId || `provider-task-${index}`}
                style={{
                  border: '1px solid #eef2f7',
                  borderRadius: '14px',
                  background: '#f9fafb',
                  padding: '0.95rem 1rem',
                  display: 'grid',
                  gap: '0.45rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    alignItems: 'start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#111827' }}>
                    {task.title || 'Untitled task'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {getStatusLabel(task)}
                  </div>
                </div>

                <div style={{ color: '#6b7280', fontSize: '0.92rem' }}>
                  For {task.assigneeName || 'Child'}
                </div>

                {task.note ? (
                  <div style={{ color: '#4b5563', fontSize: '0.93rem' }}>{task.note}</div>
                ) : null}

                <div style={{ color: '#9ca3af', fontSize: '0.82rem' }}>
                  Created {new Date(task.createdAt || task.sentAt || Date.now()).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
