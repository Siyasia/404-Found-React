import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { canCreateOwnTasks } from '../roles.js';

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
  const [savedPlan, setSavedPlan] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedPlan(parsed);
        setHabit(parsed.habit || '');
        setReplacements(parsed.replacements || []);
        setMicroSteps(parsed.microSteps || []);
      } catch {
        // ignore bad JSON
      }
    }
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
    const plan = {
      habit: habit.trim(),
      replacements,
      microSteps,
      savedOn: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    setSavedPlan(plan);
  };

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  return (
    <section className="container">
      <h1>Break a Habit</h1>
      <p className="sub hero">
        Choose a habit to break, decide what you&apos;ll do instead, and plan tiny steps for change.
      </p>

      <div
        className="card"
        style={{ marginTop: '1.5rem', maxWidth: '780px' }}
      >
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
              Habit to break
              <input
                type="text"
                value={habit}
                onChange={(e) => setHabit(e.target.value)}
                placeholder="Example: Scrolling on my phone late at night"
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