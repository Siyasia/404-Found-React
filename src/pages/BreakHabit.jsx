import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'ns.breakPlan.v1';

export default function BreakHabit() {
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
      } catch (err) {
        console.error('Failed to parse saved break plan', err);
      }
    }
  }, []);

  const startNewPlan = () => {
    if (savedPlan) {
      setHabit(savedPlan.habit || '');
      setReplacements(savedPlan.replacements || []);
      setMicroSteps(savedPlan.microSteps || []);
    } else {
      setHabit('');
      setReplacements([]);
      setMicroSteps([]);
    }
    setNewReplacement('');
    setNewMicroStep('');
    setStep(1);
  };

  const handleAddReplacement = (e) => {
    e.preventDefault();
    const trimmed = newReplacement.trim();
    if (!trimmed) return;
    setReplacements((prev) => [...prev, trimmed]);
    setNewReplacement('');
  };

  const handleRemoveReplacement = (index) => {
    setReplacements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMicroStep = (e) => {
    e.preventDefault();
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

  const progressPercent = (step / 3) * 100;

  return (
    <section className="container">
      <h1>Break a Habit</h1>
      <p className="sub hero">
        Choose a habit to beat, pick healthy replacements, and map out tiny
        steps.
      </p>

      {savedPlan && (
        <div
          className="card"
          style={{ maxWidth: '780px', marginTop: '1.25rem' }}
        >
          <h2>Current break-habit plan</h2>
          <p>
            <strong>Habit to break:</strong> {savedPlan.habit}
          </p>

          {savedPlan.replacements && savedPlan.replacements.length > 0 && (
            <>
              <strong>Replacement ideas:</strong>
              <ul>
                {savedPlan.replacements.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </>
          )}

          {savedPlan.microSteps && savedPlan.microSteps.length > 0 && (
            <>
              <strong>Tiny steps:</strong>
              <ol>
                {savedPlan.microSteps.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ol>
            </>
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
              background: 'linear-gradient(90deg, #f97316, #ef4444)',
              transition: 'width 0.25s ease-out',
            }}
          />
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <>
            <h2>Step 1 of 3 — Name the habit to break</h2>
            <p className="sub">
              Keep it simple and specific. One habit at a time.
            </p>
            <label className="auth-label">
              Habit
              <input
                type="text"
                placeholder="Example: Scrolling on phone in bed"
                value={habit}
                onChange={(e) => setHabit(e.target.value)}
              />
            </label>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!habit.trim()}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <>
            <h2>Step 2 of 3 — Replacement ideas</h2>
            <p className="sub">
              What could you do instead when the urge shows up?
            </p>

            <form
              onSubmit={handleAddReplacement}
              style={{ marginTop: '0.75rem' }}
            >
              <label className="auth-label">
                New replacement
                <input
                  type="text"
                  placeholder="Example: Read a book, stretch, drink water"
                  value={newReplacement}
                  onChange={(e) => setNewReplacement(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: '.5rem' }}
              >
                Add replacement
              </button>
            </form>

            {replacements.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Replacements so far:</strong>
                <ul>
                  {replacements.map((r, idx) => (
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
                      <span>{r}</span>
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
                disabled={replacements.length === 0}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <>
            <h2>Step 3 of 3 — Tiny steps to win</h2>
            <p className="sub">
              Define small, concrete actions you can actually do when the habit
              tries to show up.
            </p>

            <form
              onSubmit={handleAddMicroStep}
              style={{ marginTop: '0.75rem' }}
            >
              <label className="auth-label">
                New tiny step
                <input
                  type="text"
                  placeholder="Example: Put phone in the kitchen at 9pm"
                  value={newMicroStep}
                  onChange={(e) => setNewMicroStep(e.target.value)}
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

            {microSteps.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Tiny steps:</strong>
                <ol>
                  {microSteps.map((m, idx) => (
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
                      <span>{m}</span>
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
              </div>
            )}

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
    </section>
  );
}
