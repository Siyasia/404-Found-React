import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import HabitWizard from '../components/HabitWizard/HabitWizard.jsx';
import { childList } from '../lib/api/children.js';
import { goalCreate } from '../lib/api/goals.js';
import { actionPlanCreate } from '../lib/api/actionPlans.js';
import mapWizardPayload from '../lib/api/mapWizardPayload.js';

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
      } catch (err) {
        // noop
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (payload) => {
  const mapped = mapWizardPayload(payload);
  const { goal, actionPlans } = mapped;

  if (!goal.assigneeId) {
    throw new Error('Please choose who this goal is for.');
  }

  goal.createdById = user?.id || null;
  goal.createdByName = user?.name || '';
  goal.createdByRole = user?.role || 'user';

  const createdGoal = await goalCreate(goal);
  if (!createdGoal || createdGoal.status_code !== 200) {
    throw new Error(createdGoal?.error || 'Failed to create goal.');
  }

  const goalId = createdGoal.data?.id;

  for (const plan of actionPlans) {
    const nextPlan = {
      ...plan,
      goalId,
      assigneeId: plan.assigneeId ?? goal.assigneeId ?? null,
      createdById: user?.id || null,
      createdByName: user?.name || '',
      createdByRole: user?.role || 'user',
    };

    const createdPlan = await actionPlanCreate(nextPlan);
    if (!createdPlan || createdPlan.status_code !== 200) {
      throw new Error(createdPlan?.error || 'Failed to create action plan.');
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