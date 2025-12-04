import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { canCreateOwnTasks } from '../Roles/roles.js';

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
  const [savedPlan, setSavedPlan] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedPlan(parsed);
        setGoal(parsed.goal || '');
        setCue(parsed.cue || '');
        setSteps(parsed.steps || []);
      } catch {
        // ignore bad JSON
      }
    }
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

  const handleSave = () => {
    const plan = {
      goal: goal.trim(),
      cue: cue.trim(),
      steps,
      savedOn: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    setSavedPlan(plan);
  };

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  return (
    <section className="container">
      <h1>Build a Habit</h1>
      <p className="sub hero">
        Choose a small habit, anchor it to something you already do, and plan tiny steps that make it easy.
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
                onClick={handleSave}
                disabled={
                  !goal.trim() ||
                  !cue.trim() ||
                  steps.length === 0
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
            <strong>Habit goal:</strong> {savedPlan.goal}
          </p>
          {savedPlan.cue && (
            <p>
              <strong>Cue:</strong> {savedPlan.cue}
            </p>
          )}

          {savedPlan.steps?.length > 0 && (
            <>
              <p className="sub">Tiny steps:</p>
              <ol>
                {savedPlan.steps.map((item, idx) => (
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