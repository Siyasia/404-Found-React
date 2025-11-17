import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'ns.buildPlan.v1';

export default function BuildHabit() {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [steps, setSteps] = useState([]);
  const [newStep, setNewStep] = useState('');
  const [reward, setReward] = useState('');
  const [savedPlan, setSavedPlan] = useState(null);

  // Load existing plan (if any)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedPlan(parsed);
      } catch (err) {
        console.error('Failed to parse saved build plan', err);
      }
    }
  }, []);

  const startNewPlan = () => {
    if (savedPlan) {
      setGoal(savedPlan.goal || '');
      setSteps(savedPlan.steps || []);
      setReward(savedPlan.reward || '');
    } else {
      setGoal('');
      setSteps([]);
      setReward('');
    }
    setNewStep('');
    setStep(1);
  };

  const handleAddStep = (e) => {
    e.preventDefault();
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
      steps,
      reward: reward.trim(),
      savedOn: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    setSavedPlan(plan);
  };

  const progressPercent = (step / 3) * 100;

  return (
    <section className="container">
      <h1>Build a Habit</h1>
      <p className="sub hero">
        Pick one goal, add tiny steps, and decide how you’ll celebrate.
      </p>

      {savedPlan && (
        <div
          className="card"
          style={{ maxWidth: '780px', marginTop: '1.25rem' }}
        >
          <h2>Current habit plan</h2>
          <p>
            <strong>Goal:</strong> {savedPlan.goal}
          </p>
          {savedPlan.steps && savedPlan.steps.length > 0 && (
            <>
              <strong>Steps:</strong>
              <ol>
                {savedPlan.steps.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ol>
            </>
          )}
          {savedPlan.reward && (
            <p>
              <strong>Reward:</strong> {savedPlan.reward}
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={startNewPlan}
          >
            Edit this plan
          </button>
        </div>
      )}

      <div
        className="card"
        style={{ maxWidth: '780px', marginTop: '1.25rem' }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: '6px',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #38bdf8, #4ade80)',
              transition: 'width 0.25s ease-out',
            }}
          />
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <>
            <h2>Step 1 of 3 — Name the habit</h2>
            <p className="sub">
              Choose one clear, specific habit to build.
            </p>
            <label className="auth-label">
              Habit / goal
              <input
                type="text"
                placeholder="Example: Read 10 minutes before bed"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!goal.trim()}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <>
            <h2>Step 2 of 3 — Add tiny steps</h2>
            <p className="sub">
              Break the habit into tiny, doable actions.
            </p>

            <form onSubmit={handleAddStep} style={{ marginTop: '0.75rem' }}>
              <label className="auth-label">
                New step
                <input
                  type="text"
                  placeholder="Example: Put book on pillow after dinner"
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: '.5rem' }}
              >
                Add step
              </button>
            </form>

            {steps.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Steps so far:</strong>
                <ol>
                  {steps.map((s, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '.5rem',
                        alignItems: 'center',
                        marginTop: '.25rem',
                      }}
                    >
                      <span>{s}</span>
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
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.5rem' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={steps.length === 0}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <>
            <h2>Step 3 of 3 — Choose a reward</h2>
            <p className="sub">
              Decide how you’ll celebrate after a streak or milestone.
            </p>
            <label className="auth-label">
              Reward (optional)
              <input
                type="text"
                placeholder="Example: Friday movie, extra screen time, etc."
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </label>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.5rem' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!goal.trim() || steps.length === 0}
              >
                Save plan
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

