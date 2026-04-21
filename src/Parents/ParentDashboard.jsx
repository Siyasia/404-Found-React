import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import Toast from '../components/Toast.jsx';
import { childList } from '../lib/api/children.js';
import { taskList } from '../lib/api/tasks.js';
import { goalList } from '../lib/api/goals.js';
import { actionPlanList } from '../lib/api/actionPlans.js';
import { Task, Goal, ActionPlan } from '../models';
import ChildrenTab from './dashboard/ChildrenTab.jsx';
import GoalsTab from './dashboard/GoalsTab.jsx';
import ApprovalsTab from './dashboard/ApprovalsTab.jsx';
import './ParentHomepage.css';

const ALLOWED_TABS = new Set(['children', 'goals', 'approvals']);

function extractGoals(response) {
  if (Array.isArray(response?.goals)) return response.goals;
  if (Array.isArray(response?.data?.goals)) return response.data.goals;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function extractPlans(response) {
  if (Array.isArray(response?.plans)) return response.plans;
  if (Array.isArray(response?.data?.plans)) return response.data.plans;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function extractTasks(response) {
  if (Array.isArray(response?.tasks)) return response.tasks;
  if (Array.isArray(response?.data?.tasks)) return response.data.tasks;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [searchParams] = useSearchParams();

  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [actionPlans, setActionPlans] = useState([]);

  const successTimerRef = useRef(null);
  const rawTab = searchParams.get('tab') || 'children';

  const activeTab = useMemo(() => {
    if (!ALLOWED_TABS.has(rawTab)) return 'children';
    return rawTab;
  }, [rawTab]);

  useEffect(() => {
    if (rawTab === 'assign') {
      navigate('/parent/habit-wizard', { replace: true });
      return;
    }

    if (rawTab === 'my-tasks') {
      navigate('/parent', { replace: true });
    }
  }, [navigate, rawTab]);

  const showSuccess = useCallback((message) => {
    setToast(message);

    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }

    successTimerRef.current = window.setTimeout(() => {
      setToast('');
      successTimerRef.current = null;
    }, 2600);
  }, []);

  const loadAll = useCallback(async () => {
    setError('');

    const [childResult, taskResult, goalResult, planResult] = await Promise.allSettled([
      childList(),
      taskList(),
      goalList(),
      actionPlanList(),
    ]);

    let partialFailure = false;

    if (childResult.status === 'fulfilled') {
      const response = childResult.value;
      setChildren(
        response?.status_code === 200 && Array.isArray(response.children)
          ? response.children
          : []
      );
    } else {
      partialFailure = true;
      setChildren([]);
      console.error('[ParentDashboard] childList failed', childResult.reason);
    }

    if (taskResult.status === 'fulfilled') {
      setTasks(extractTasks(taskResult.value).map(Task.from));
    } else {
      partialFailure = true;
      setTasks([]);
      console.error('[ParentDashboard] taskList failed', taskResult.reason);
    }

    if (goalResult.status === 'fulfilled') {
      setGoals(extractGoals(goalResult.value).map(Goal.from));
    } else {
      partialFailure = true;
      setGoals([]);
      console.error('[ParentDashboard] goalList failed', goalResult.reason);
    }

    if (planResult.status === 'fulfilled') {
      setActionPlans(extractPlans(planResult.value).map(ActionPlan.from));
    } else {
      partialFailure = true;
      setActionPlans([]);
      console.error('[ParentDashboard] actionPlanList failed', planResult.reason);
    }

    if (partialFailure) {
      setError('Some parent data could not be loaded.');
    }
  }, []);

  useEffect(() => {
    loadAll();

    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, [loadAll]);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => task?.needsApproval),
    [tasks]
  );

  const sharedData = useMemo(
    () => ({
      children,
      goals,
      actionPlans,
      tasks,
      pendingTasks,
    }),
    [children, goals, actionPlans, tasks, pendingTasks]
  );

  if (user?.role !== ROLE.PARENT) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        Only parents can view this page.
      </div>
    );
  }

  return (
    <div className="dashboard-shell parent-dashboard-page">
      <Toast message={toast} type="success" onClose={() => setToast('')} />
      <Toast message={error} type="error" onClose={() => setError('')} />

      {activeTab === 'children' ? (
        <ChildrenTab
          data={sharedData}
          onRefresh={loadAll}
          user={user}
          showSuccess={showSuccess}
        />
      ) : null}

      {activeTab === 'goals' ? (
        <GoalsTab
          data={sharedData}
          onRefresh={loadAll}
          user={user}
          showSuccess={showSuccess}
        />
      ) : null}

      {activeTab === 'approvals' ? (
        <ApprovalsTab
          data={sharedData}
          onRefresh={loadAll}
          user={user}
          showSuccess={showSuccess}
        />
      ) : null}
    </div>
  );
}
