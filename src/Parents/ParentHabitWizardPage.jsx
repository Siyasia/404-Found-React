import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import Toast from '../components/Toast.jsx';
import HabitWizard from '../components/HabitWizard/HabitWizard.jsx';
import { WIZARD_CONFIG } from '../components/HabitWizard/HabitWizard.utils.js';
import { childList } from '../lib/api/children.js';
import { goalList, goalCreate, goalUpdate } from '../lib/api/goals.js';
import {
  actionPlanList,
  actionPlanCreate,
  actionPlanUpdate,
  actionPlanDelete,
} from '../lib/api/actionPlans.js';
import mapWizardPayload from '../lib/api/mapWizardPayload.js';
import { Goal, ActionPlan } from '../models';
import './ParentHomepage.css';

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value);
}

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

function extractCreatedId(response) {
  return normalizeId(
    response?.id ||
      response?.data?.id ||
      response?.goal?.id ||
      response?.data?.goal?.id ||
      response?.actionPlan?.id ||
      response?.data?.actionPlan?.id
  );
}

function buildWizardInitialValues(goal, plans) {
  if (!goal) return null;

  return {
    id: goal.id,
    type: goal.goalType || goal.type || null,
    title: goal.title || '',
    whyItMatters: goal.whyItMatters || '',
    startDate: goal.startDate || '',
    endDate: goal.endDate || '',
    location: goal.location || '',
    triggers: Array.isArray(goal.triggers) ? goal.triggers : [],
    makeItEasier: Array.isArray(goal.makeItEasier) ? goal.makeItEasier : [],
    replacements: Array.isArray(goal.replacements) ? goal.replacements : [],
    rewardGoalTitle: goal.rewardGoalTitle || '',
    rewardGoalCostCoins: goal.rewardGoalCostCoins || '',
    rewardType: goal.rewardType || goal?.meta?.rewardType || 'custom',
    rewardShopItemId: goal.rewardShopItemId || goal?.meta?.rewardShopItemId || '',
    milestoneRewards: Array.isArray(goal.milestoneRewards)
      ? goal.milestoneRewards
      : WIZARD_CONFIG.DEFAULT_MILESTONES,
    assignees: goal.assigneeId ? [String(goal.assigneeId)] : [],
    tasks: plans.map((plan) => ({
      id: plan.id,
      title: plan.title || '',
      cue: plan.cue || '',
      cuePreset: plan.cuePreset || plan?.meta?.cuePreset || '',
      cueLabel: plan.cueLabel || plan?.meta?.cueLabel || '',
      cueDetail: plan.cueDetail || plan?.meta?.cueDetail || '',
      timeOfDay: plan.timeOfDay || plan?.meta?.timeOfDay || '',
      startDate: plan?.schedule?.startDate || plan.startDate || goal.startDate || '',
      endDate: plan?.schedule?.endDate || plan.endDate || goal.endDate || '',
      schedule: plan.schedule || plan.frequency || null,
      completionLog: plan.completionLog || {},
      meta: {
        ...(plan.meta || {}),
        originalActionPlanId: plan.id,
      },
    })),
  };
}

export default function ParentHabitWizardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [searchParams] = useSearchParams();

  const goalIdFromQuery = searchParams.get('goalId') || '';

  const [children, setChildren] = useState([]);
  const [goals, setGoals] = useState([]);
  const [actionPlans, setActionPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [taskError, setTaskError] = useState('');
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);

  const editingGoal = useMemo(() => {
    return goals.find((goal) => normalizeId(goal.id) === normalizeId(goalIdFromQuery)) || null;
  }, [goals, goalIdFromQuery]);

  const plansByGoalId = useMemo(() => {
    const map = new Map();
    actionPlans.forEach((plan) => {
      const goalId = normalizeId(plan.goalId);
      if (!map.has(goalId)) map.set(goalId, []);
      map.get(goalId).push(plan);
    });
    return map;
  }, [actionPlans]);

  const wizardInitialValues = useMemo(() => {
    if (!editingGoal) return null;
    const linkedPlans = plansByGoalId.get(normalizeId(editingGoal.id)) || [];
    return buildWizardInitialValues(editingGoal, linkedPlans);
  }, [editingGoal, plansByGoalId]);

  const assigneeLookup = useMemo(() => {
    const map = new Map();

    if (user?.id) {
      map.set(normalizeId(user.id), {
        id: normalizeId(user.id),
        name: user.name || 'You',
      });
    }

    children.forEach((child) => {
      map.set(normalizeId(child.id), {
        id: normalizeId(child.id),
        name: child.name || 'Unnamed child',
      });
    });

    return map;
  }, [children, user]);

  const resolveAssigneeName = useCallback(
    (assigneeId) => assigneeLookup.get(normalizeId(assigneeId))?.name || 'Unassigned',
    [assigneeLookup]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [childResp, goalResp, planResp] = await Promise.all([
        childList(),
        goalList(),
        actionPlanList(),
      ]);

      setChildren(
        childResp?.status_code === 200 && Array.isArray(childResp.children)
          ? childResp.children
          : []
      );
      setGoals(extractGoals(goalResp).map(Goal.from));
      setActionPlans(extractPlans(planResp).map(ActionPlan.from));
    } catch (err) {
      console.error('[ParentHabitWizardPage] load error', err);
      setError('Failed to load parent wizard data.');
      setChildren([]);
      setGoals([]);
      setActionPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveGoalBundle = async ({
    existingGoalId = '',
    goalPayload,
    incomingPlans,
    existingPlans = [],
  }) => {
    let goalId = normalizeId(existingGoalId);

    if (goalId) {
      const updateResp = await goalUpdate(goalId, goalPayload);
      if (updateResp?.status_code !== 200) {
        return {
          success: false,
          error: updateResp?.error || 'Failed to update goal.',
        };
      }
    } else {
      const createResp = await goalCreate(goalPayload);
      if (createResp?.status_code !== 200) {
        return {
          success: false,
          error: createResp?.error || 'Failed to create goal.',
        };
      }

      goalId = extractCreatedId(createResp);

      if (!goalId) {
        return {
          success: false,
          error: 'Goal was created, but no goal id was returned.',
        };
      }
    }

    const existingById = new Map(existingPlans.map((plan) => [normalizeId(plan.id), plan]));
    const existingByTitle = new Map(
      existingPlans.map((plan) => [String(plan.title || '').trim().toLowerCase(), plan])
    );
    const keptIds = new Set();

    for (const rawPlan of incomingPlans) {
      const planTitle = String(rawPlan?.title || '').trim();
      const titleKey = planTitle.toLowerCase();
      const originalPlanId = normalizeId(rawPlan?.id || rawPlan?.meta?.originalActionPlanId);

      const matchedPlan =
        (originalPlanId && existingById.get(originalPlanId)) ||
        (titleKey ? existingByTitle.get(titleKey) : null) ||
        null;

      const planId = normalizeId(matchedPlan?.id);
      const nextMeta = {
        ...(matchedPlan?.meta || {}),
        ...(rawPlan?.meta || {}),
      };

      delete nextMeta.originalActionPlanId;

      const nextPlan = {
        ...(matchedPlan || {}),
        ...(rawPlan || {}),
        id: planId || undefined,
        goalId,
        assigneeId: goalPayload.assigneeId,
        assigneeName: goalPayload.assigneeName,
        createdById: user?.id || null,
        createdByName: user?.name || '',
        createdByRole: user?.role || 'parent',
        meta: nextMeta,
      };

      if (planId && existingById.has(planId)) {
        keptIds.add(planId);

        const updateResp = await actionPlanUpdate(planId, nextPlan);
        if (updateResp?.status_code !== 200) {
          return {
            success: false,
            error: updateResp?.error || `Failed to update action plan ${planTitle || 'item'}.`,
          };
        }
      } else {
        const createResp = await actionPlanCreate(nextPlan);
        if (createResp?.status_code !== 200) {
          return {
            success: false,
            error: createResp?.error || `Failed to create action plan ${planTitle || 'item'}.`,
          };
        }
      }
    }

    if (existingGoalId) {
      const plansToDelete = existingPlans.filter(
        (plan) => !keptIds.has(normalizeId(plan.id))
      );

      for (const plan of plansToDelete) {
        const deleteResp = await actionPlanDelete(plan.id);
        if (deleteResp?.status_code !== 200) {
          return {
            success: false,
            error:
              deleteResp?.error ||
              `Failed to delete removed action plan ${plan?.title || 'item'}.`,
          };
        }
      }
    }

    return { success: true, goalId };
  };

  const handleWizardSubmit = async (payload) => {
    setTaskError('');
    setWizardSaving(true);

    try {
      const mapped = mapWizardPayload(payload);
      const baseGoal = { ...(mapped?.goal || {}) };
      const incomingPlans = Array.isArray(mapped?.actionPlans) ? mapped.actionPlans : [];

      const payloadAssignees = Array.isArray(payload?.assignees)
        ? payload.assignees.map(normalizeId).filter(Boolean)
        : [];

      const initialAssigneeIds = editingGoal
        ? [normalizeId(editingGoal?.assigneeId || baseGoal?.assigneeId || payloadAssignees[0])]
        : payloadAssignees.length > 0
          ? payloadAssignees
          : normalizeId(baseGoal?.assigneeId)
            ? [normalizeId(baseGoal.assigneeId)]
            : [];

      const assigneeIds = Array.from(new Set(initialAssigneeIds.filter(Boolean)));

      if (assigneeIds.length === 0) {
        setTaskError('Please choose who this goal is for before saving.');
        setWizardSaving(false);
        return { success: false };
      }

      let createdCount = 0;

      for (const assigneeId of assigneeIds) {
        const goalPayload = {
          ...baseGoal,
          assigneeId,
          assigneeName: resolveAssigneeName(assigneeId),
          createdById: user?.id || null,
          createdByName: user?.name || '',
          createdByRole: user?.role || 'parent',
        };

        const existingGoalId = editingGoal ? normalizeId(editingGoal.id) : '';
        const existingPlans = editingGoal
          ? (plansByGoalId.get(normalizeId(editingGoal.id)) || []).slice()
          : [];

        const result = await saveGoalBundle({
          existingGoalId,
          goalPayload,
          incomingPlans,
          existingPlans,
        });

        if (!result.success) {
          setTaskError(result.error || 'Failed to save goal.');
          setWizardSaving(false);
          return { success: false };
        }

        createdCount += 1;

        if (editingGoal) {
          break;
        }
      }

      localStorage.removeItem(WIZARD_CONFIG.DRAFT_STORAGE_KEY);
      await loadData();
      setToast(
        editingGoal
          ? 'Goal updated successfully.'
          : createdCount > 1
            ? `Created ${createdCount} goals.`
            : 'Goal created successfully.'
      );
      setWizardKey((key) => key + 1);
      navigate('/parent/dashboard?tab=goals', { replace: true });
      return { success: true };
    } catch (err) {
      console.error(err);
      setTaskError('Unexpected error saving goal.');
      return { success: false };
    } finally {
      setWizardSaving(false);
    }
  };

  if (!user) {
    return (
      <section className="container" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>You need to log in first.</div>
      </section>
    );
  }

  if (user?.role !== ROLE.PARENT) {
    return (
      <section className="container" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>Only parents can view this page.</div>
      </section>
    );
  }

  return (
  <div className="dashboard-shell parent-wizard-shell">
    <section className="home-page parent-wizard-page">
      <Toast message={toast} type="success" onClose={() => setToast('')} />
      <Toast message={error} type="error" onClose={() => setError('')} />

      <div className="parent-wizard-page__wrap">
        <div className="parent-wizard-page__content">
          {taskError ? (
            <div
              style={{
                color: 'var(--app-danger-text)',
                background: 'var(--app-danger-bg)',
                border: '1px solid var(--app-danger-border)',
                borderRadius: 16,
                padding: '0.85rem 1rem',
                fontWeight: 600,
                marginBottom: '1rem',
              }}
            >
              {taskError}
            </div>
          ) : null}

          {!loading ? (
            <HabitWizard
              key={`${wizardKey}-${goalIdFromQuery || 'new'}`}
              context="parent"
              availableChildren={children}
              onSubmit={handleWizardSubmit}
              initialValues={wizardInitialValues || undefined}
              parentUser={user}
              saving={wizardSaving}
            />
          ) : null}
        </div>
      </div>
    </section>
  </div>
);
}
