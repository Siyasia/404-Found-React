import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { canCreateOwnTasks } from '../Roles/roles.js';
import Toast from '../components/Toast.jsx';
import { buildHabitCreate, buildHabitList, buildHabitDelete } from '../lib/api/habits.js';
import { BuildHabit as BuildHabitModel } from '../models';
import SchedulePicker from '../components/SchedulePicker.jsx';
import { toLocalISODate } from '../lib/schedule.js';

const STORAGE_KEY = 'ns.buildPlan.v1';

export default function BuildHabit() {
  const { user } = useUser();
  const canCreate = user && canCreateOwnTasks(user);

  // === Guard: block children / non-creator roles ===
  if (!canCreate) {
    return (
      <section className="container">
        <h1>Build a Habit</h1>
        <p className="sub hero">
          This page is for users and parents to design habit plans.
          Child accounts can&apos;t create their own habits and will
          only see tasks assigned by a parent.
        </p>
        <p>
          Go back to the <Link to="/home">home page</Link> to see your tasks.
        </p>
      </section>
    );
  }

  // === Normal Build-a-Habit wizard state ===
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [cue, setCue] = useState('');
  const [steps, setSteps] = useState([]);
  const [newStep, setNewStep] = useState('');
  const [schedule, setSchedule] = useState({
    repeat: 'DAILY',
    startDate: toLocalISODate(),
    endDate: '',
  });
  const [rewardChoice, setRewardChoice] = useState('coins');
  const [rewardText, setRewardText] = useState('');
  const [savedPlans, setSavedPlans] = useState([]);
  const [success, setSuccess] = useState('');
  const [notice, setNotice] = useState('');

  const resetForm = () => {
    setStep(1);
    setGoal('');
    setCue('');
    setSteps([]);
    setNewStep('');
    setSchedule({ repeat: 'DAILY', startDate: toLocalISODate(), endDate: '' });
    setRewardChoice('coins');
    setRewardText('');
  };

  useEffect(() => {
    async function func() {

      const all = await buildHabitList();
      const remotePlans = Array.isArray(all?.habits) ? all.habits.slice(0, 5) : [];

      if (remotePlans.length > 0) {
        setSavedPlans(remotePlans);
        return;
      }

      // fallback to local storage when backend has no schedule yet
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const plans = Array.isArray(parsed) ? parsed : [parsed];
          const sliced = plans.slice(0, 5);
          setSavedPlans(sliced);
        } catch {
          // ignore
        }
      }
    } func();
  }, []);

  const handleAddStep = () => {
    const trimmed = newStep.trim();
    if (!trimmed) return;
    setSteps((prev) => [...prev, trimmed]);
    setNewStep('');
  };

  const handleRemoveStep = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const plan = new BuildHabitModel({
      account_id: user?.id ?? null,
      goal: goal.trim(),
      cue: cue.trim(),
      steps,
      savedOn: new Date().toISOString(),
      schedule,
      reward:
        rewardChoice === 'custom'
          ? rewardText.trim()
          : '50 coins bonus on completion',
    });

    // Call backend API (best-effort) and persist locally as a fallback
    await buildHabitCreate(
      plan.goal,
      plan.cue,
      plan.steps,
      new Date().getTime(),
    ).then((response) => {
      console.log('[BuildHabit] Saved plan response', response);
    }).catch((error) => {
      console.error('[BuildHabit] Error saving plan', error);
    });

    setSavedPlans((prev) => {
      const next = [plan, ...prev].slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSuccess('Habit plan saved successfully.');
    resetForm();
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadPlanForEdit = (plan) => {
    const safeSchedule = plan?.schedule || {};
    setGoal(plan?.goal || '');
    setCue(plan?.cue || '');
    setSteps(plan?.steps || []);
    setNewStep('');
    setSchedule({
      repeat: safeSchedule.repeat || 'DAILY',
      startDate: safeSchedule.startDate || toLocalISODate(),
      endDate: safeSchedule.endDate || '',
    });
    const reward = plan?.reward || '';
    if (!reward || reward.includes('50 coins')) {
      setRewardChoice('coins');
      setRewardText('');
    } else {
      setRewardChoice('custom');
      setRewardText(reward);
    }
    setStep(1);
  };

  const handleDelete = async (index, plan) => {
    try {
      if (plan?.id) {
        await buildHabitDelete(plan.id);
      }
    } catch (err) {
      console.error('[BuildHabit] Error deleting plan', err);
    } finally {
      setSavedPlans((prev) => {
        const next = prev.filter((_, i) => i !== index);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setNotice('Deleted habit plan');
      setTimeout(() => setNotice(''), 2200);
    }
  };

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  return (
    <section className="container">
      <h1>Build a Habit</h1>
      <p className="sub hero">
        Choose a small habit, anchor it to something you already do, and plan tiny steps that make it easy.
      </p>

      <Toast message={success} type="success" onClose={() => setSuccess('')} />
      <Toast message={notice} type="info" onClose={() => setNotice('')} />
      <div
        className="card"
        style={{ marginTop: '1.5rem', maxWidth: '780px' }}
      >
        {/* content */}
        {/* Progress bar */}
        <div className="progress" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="progress-label">
          Step {step} of {totalSteps}
        </p>

        {/* Step 1: Name the habit */}
        {step === 1 && (
          <>
            <h2>Step 1: Name the habit</h2>
            <p className="sub">
              Describe the habit you want to build in one clear sentence.
            </p>

            <label className="auth-label">
              Habit goal <span aria-hidden="true" className="required-asterisk">*</span>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Example: Read for 10 minutes every night"
                required
                aria-required="true"
              />
            </label>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!goal.trim()}
              >
                Next: Choose a cue
              </button>
            </div>
          </>
        )}

        {/* Step 2: Choose a cue/anchor */}
        {step === 2 && (
          <>
            <h2>Step 2: Choose a cue</h2>
            <p className="sub">
              Pick something you already do every day that will remind you to start this habit.
            </p>

            <label className="auth-label">
              Cue / anchor <span aria-hidden="true" className="required-asterisk">*</span>
              <input
                type="text"
                value={cue}
                onChange={(e) => setCue(e.target.value)}
                placeholder="Example: After I brush my teeth..."
                required
                aria-required="true"
              />
            </label>

            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(1)}
              >
                Back
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={!cue.trim()}
              >
                Next: Plan tiny steps
              </button>
            </div>
          </>
        )}

        {/* Step 3: Tiny steps */}
        {step === 3 && (
          <>
            <h2>Step 3: Plan tiny steps</h2>
            <p className="sub">
              Break this habit into tiny, specific actions you can actually do every time the cue happens.
            </p>

            <div style={{ margin: '1rem 0' }}>
              <h3 style={{ marginBottom: '0.25rem' }}>Schedule</h3>
              <SchedulePicker value={schedule} onChange={setSchedule} />
            </div>

            <div className="stacked-input">
              <input
                type="text"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                placeholder="Example: Open my book and read one page"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddStep}
              >
                Add step
              </button>
            </div>

            {steps.length > 0 && (
              <ol style={{ marginTop: '1rem' }}>
                {steps.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleRemoveStep(idx)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(2)}
              >
                Back
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(4)}
                disabled={
                  !goal.trim() ||
                  !cue.trim() ||
                  steps.length === 0
                }
              >
                Next: Rewards
              </button>
            </div>
          </>
        )}

        {/* Step 4: Rewards */}
        {step === 4 && (
          <>
            <h2>Step 4: Pick a reward</h2>
            <p className="sub">
              You automatically earn 20 coins for each completed habit step. Choose a bigger reward for finishing the habit—if you skip choosing, you will get 50 coins instead.
            </p>

            <div className="stacked-input" style={{ alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="rewardChoice"
                  value="coins"
                  checked={rewardChoice === 'coins'}
                  onChange={() => setRewardChoice('coins')}
                />
                <span>Keep coin bonus (50 coins on completion)</span>
              </label>
            </div>

            <div className="stacked-input" style={{ alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                <input
                  type="radio"
                  name="rewardChoice"
                  value="custom"
                  checked={rewardChoice === 'custom'}
                  onChange={() => setRewardChoice('custom')}
                />
                <span style={{ flex: 1 }}>Set a custom reward</span>
              </label>
            </div>

            {rewardChoice === 'custom' && (
              <label className="auth-label" style={{ marginTop: '0.75rem' }}>
                Describe your reward
                <input
                  type="text"
                  value={rewardText}
                  onChange={(e) => setRewardText(e.target.value)}
                  placeholder="Example: Movie night, new book, extra screen time"
                />
              </label>
            )}

            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStep(3)}
              >
                Back
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={rewardChoice === 'custom' && !rewardText.trim()}
              >
                Save plan
              </button>
            </div>
          </>
        )}
      </div>

      {savedPlans.length > 0 && (
        <div
          className="card"
          style={{ marginTop: '1.5rem', maxWidth: '780px' }}
        >
          <h2>Your saved plans (max 5)</h2>
          <p className="sub">Newest first.</p>
          {savedPlans.map((plan, planIdx) => (
            <div
              key={`plan-${planIdx}-${plan.goal}`}
              style={{
                padding: '0.75rem 0',
                borderTop: planIdx === 0 ? 'none' : '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <p><strong>Habit goal:</strong> {plan.goal}</p>
                  {plan.cue && (
                    <p><strong>Cue:</strong> {plan.cue}</p>
                  )}
                  {plan.schedule?.startDate && (
                    <p className="sub">Starts {plan.schedule.startDate}{plan.schedule.endDate ? `, ends ${plan.schedule.endDate}` : ''}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => loadPlanForEdit(plan)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleDelete(planIdx, plan)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {plan.steps?.length > 0 && (
                <>
                  <p className="sub">Tiny steps:</p>
                  <ol>
                    {plan.steps.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}