import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import HabitWizard from '../components/HabitWizard/HabitWizard.jsx';
import { childList } from '../lib/api/children.js';
import { goalCreate } from '../lib/api/goals.js';
import { actionPlanCreate } from '../lib/api/actionPlans.js';
import mapWizardPayload from '../lib/api/mapWizardPayload.js';
import { buildActiveRewardFromPayload, setActiveReward } from '../lib/api/reward.js';

export default function HabitWizardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [children, setChildren] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await childList();
        if (!mounted) return;
        if (resp && resp.status_code === 200 && Array.isArray(resp.children)) {
          setChildren(resp.children);
        }
      } catch {
        // noop
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (payload) => {
    const mapped = mapWizardPayload(payload);
    const { goal, actionPlans } = mapped;

    const assignees = Array.isArray(payload?.assignees)
      ? [...new Set(payload.assignees.map((id) => String(id)).filter(Boolean))]
      : payload?.assignee
        ? [String(payload.assignee)]
        : [];

    if (assignees.length === 0) {
      throw new Error('Please choose at least one person for this goal.');
    }

    const allPeople = [
      { id: String(user?.id || ''), name: user?.name || 'You', role: user?.role || 'user' },
      ...children.map((child) => ({
        id: String(child.id),
        name: child.name,
        role: 'child',
      })),
    ];

    for (const assigneeId of assignees) {
      const person = allPeople.find((entry) => entry.id === String(assigneeId));

      const nextGoal = {
        ...goal,
        assigneeId,
        assigneeName: person?.name ?? null,
        createdById: user?.id || null,
        createdByName: user?.name || '',
        createdByRole: user?.role || 'user',
      };

      const createdGoal = await goalCreate(nextGoal);
      if (!createdGoal || createdGoal.status_code !== 200) {
        throw new Error(createdGoal?.error || `Failed to create goal for ${person?.name ?? assigneeId}.`);
      }

      const goalId = createdGoal.id;

      for (const plan of actionPlans) {
        const nextPlan = {
          ...plan,
          goalId,
          assigneeId,
          assigneeName: person?.name ?? null,
          createdById: user?.id || null,
          createdByName: user?.name || '',
          createdByRole: user?.role || 'user',
        };

        const createdPlan = await actionPlanCreate(nextPlan);
        if (!createdPlan || createdPlan.status_code !== 200) {
          throw new Error(createdPlan?.error || `Failed to create action plan for ${person?.name ?? assigneeId}.`);
        }
      }

      const activeReward = buildActiveRewardFromPayload(payload);
      if (activeReward && String(assigneeId) === String(user?.id)) {
        await setActiveReward(activeReward);
      }
    }

    if (user?.role === 'parent') navigate('/parent/dashboard');
    else navigate('/home');
  };

  return (
    <div style={{ padding: '1rem' }}>
      <HabitWizard
        context={user?.role === 'parent' ? 'parent' : 'self'}
        availableChildren={children}
        parentUser={user}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
