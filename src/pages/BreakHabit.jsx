import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { canCreateOwnTasks } from '../Roles/roles.js';
import Toast from '../components/Toast.jsx';
import { breakHabitCreate, breakHabitGet, breakHabitList } from '../lib/api/habits.js';
import { BreakHabit as BreakHabitModel } from '../models';
import SchedulePicker from '../components/SchedulePicker.jsx';
import { toLocalISODate } from '../lib/schedule.js';

const STORAGE_KEY = 'ns.breakPlan.v1';

export default function BreakHabit() {
  const { user } = useUser();
  const canCreate = user && canCreateOwnTasks(user);

  // === Guard: block children / non-creator roles ===
  if (!canCreate) {
    return (
      <section className="container">
        <h1>Break a Habit</h1>
        <p className="sub hero">
          This page is for users and parents to design habit break plans.
          Child accounts can&apos;t create their own plans and will only see
          tasks assigned by a parent.
        </p>
        <p>
          Go back to the <Link to="/home">home page</Link> to see your tasks.
        </p>
      </section>
    );
  }

  // === Normal Break-a-Habit wizard state ===
  const [step, setStep] = useState(1);
  const [habit, setHabit] = useState('');
  const [replacements, setReplacements] = useState([]);
  const [newReplacement, setNewReplacement] = useState('');
  const [microSteps, setMicroSteps] = useState([]);
  const [newMicroStep, setNewMicroStep] = useState('');
  const [schedule, setSchedule] = useState({
    repeat: 'DAILY',
    startDate: toLocalISODate(),
    endDate: '',
  });
  const [savedPlan, setSavedPlan] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function func() {

      const all = await breakHabitList();
      // todo: show all instead of first
      const stored = all.habits[0];
      if (stored) {
        try {
          setSavedPlan(stored);
          setHabit(stored.habit || '');
          setReplacements(stored.replacements || []);
          setMicroSteps(stored.microSteps || []);
          if (stored.schedule) {
            setSchedule({ ...schedule, ...stored.schedule });
          }
        } catch {
          // ignore bad JSON
        }
      } else {
        // fallback to local storage when backend has no schedule yet
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setSavedPlan(parsed);
            setHabit(parsed.habit || '');
            setReplacements(parsed.replacements || []);
            setMicroSteps(parsed.microSteps || []);
            if (parsed.schedule) {
              setSchedule({ ...schedule, ...parsed.schedule });
            }
          } catch {
            // ignore
          }
        }
      }
    } func();
  }, []);

  const handleAddReplacement = () => {
    const trimmed = newReplacement.trim();
    if (!trimmed) return;
    setReplacements((prev) => [...prev, trimmed]);
    setNewReplacement('');
  };

  const handleRemoveReplacement = (index) => {
    setReplacements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMicroStep = () => {
    const trimmed = newMicroStep.trim();
    if (!trimmed) return;
    setMicroSteps((prev) => [...prev, trimmed]);
    setNewMicroStep('');
  };

  const handleRemoveMicroStep = (index) => {
    setMicroSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const plan = new BreakHabitModel({
      account_id: user?.id ?? null,
      habit: habit.trim(),
      replacements,
      microSteps,
      savedOn: new Date().toISOString(),
      schedule,
    });

    breakHabitCreate(
      plan.habit,
      plan.replacements,
      plan.microSteps,
      new Date().getTime(),
    ).then((response) => {
      console.log('[BreakHabit] Saved plan response', response);
    }).catch((error) => {
      console.error('[BreakHabit] Error saving plan', error);
    });

    setSavedPlan(plan);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    setSuccess('Break habit plan saved successfully.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  return (
    <section className="container">
      <h1>Break a Habit</h1>
      <p className="sub hero">
        Choose a habit to break, decide what you&apos;ll do instead, and plan tiny steps for change.
      </p>

      <Toast message={success} type="success" onClose={() => setSuccess('')} />
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

        {/* Step 1: Habit to break */}
        {step === 1 && (
          <>
            <h2>Step 1: Name the habit</h2>
            <p className="sub">
              Describe the habit you want to break as clearly as you can.
            </p>

            <label className="auth-label">
              Habit to break <span aria-hidden="true" className="required-asterisk">*</span>
              <input
                type="text"
                value={habit}
                onChange={(e) => setHabit(e.target.value)}
                placeholder="Example: Scrolling on my phone late at night"
                required
                aria-required="true"
              />
            </label>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!habit.trim()}
              >
                Next: Choose replacements
              </button>
            </div>
          </>
        )}

        {/* Step 2: Replacements */}
        {step === 2 && (
          <>
            <h2>Step 2: Choose replacements</h2>
            <p className="sub">
              What could you do instead of this habit? Aim for 2–4 realistic replacements.
            </p>

            <div className="stacked-input">
              <input
                type="text"
                value={newReplacement}
                onChange={(e) => setNewReplacement(e.target.value)}
                placeholder="Example: Read a book in bed"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddReplacement}
              >
                Add replacement
              </button>
            </div>

            {replacements.length > 0 && (
              <ul style={{ marginTop: '1rem' }}>
                {replacements.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleRemoveReplacement(idx)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
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
                onClick={() => setStep(1)}
              >
                Back
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={replacements.length === 0}
              >
                Next: Plan tiny steps
              </button>
            </div>
          </>
        )}

        {/* Step 3: Micro-steps */}
        {step === 3 && (
          <>
            <h2>Step 3: Plan tiny steps</h2>
            <p className="sub">
              Break this change into tiny, specific actions you can actually do.
            </p>

            <div style={{ margin: '1rem 0' }}>
              <h3 style={{ marginBottom: '0.25rem' }}>Schedule</h3>
              <SchedulePicker value={schedule} onChange={setSchedule} />
            </div>

            <div className="stacked-input">
              <input
                type="text"
                value={newMicroStep}
                onChange={(e) => setNewMicroStep(e.target.value)}
                placeholder="Example: Plug my phone in across the room at 9pm"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddMicroStep}
              >
                Add step
              </button>
            </div>

            {microSteps.length > 0 && (
              <ol style={{ marginTop: '1rem' }}>
                {microSteps.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleRemoveMicroStep(idx)}
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
                onClick={handleSave}
                disabled={
                  !habit.trim() ||
                  replacements.length === 0 ||
                  microSteps.length === 0
                }
              >
                Save plan
              </button>
            </div>
          </>
        )}
      </div>

      {savedPlan && (
        <div
          className="card"
          style={{ marginTop: '1.5rem', maxWidth: '780px' }}
        >
          <h2>Your saved plan</h2>
          <p>
            <strong>Habit to break:</strong> {savedPlan.habit}
          </p>

          {savedPlan.replacements?.length > 0 && (
            <>
              <p className="sub">Replacements:</p>
              <ul>
                {savedPlan.replacements.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {savedPlan.microSteps?.length > 0 && (
            <>
              <p className="sub">Tiny steps:</p>
              <ol>
                {savedPlan.microSteps.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </section>
  );
}