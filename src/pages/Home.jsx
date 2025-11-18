import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const BUILD_KEY = 'ns.buildPlan.v1';
const BREAK_KEY = 'ns.breakPlan.v1';

export default function Home() {
  const [buildPlan, setBuildPlan] = useState(null);
  const [breakPlan, setBreakPlan] = useState(null);

  useEffect(() => {
    // Load Build a Habit plan
    const storedBuild = localStorage.getItem(BUILD_KEY);
    if (storedBuild) {
      try {
        setBuildPlan(JSON.parse(storedBuild));
      } catch {
        setBuildPlan(null);
      }
    }

    // Load Break a Habit plan
    const storedBreak = localStorage.getItem(BREAK_KEY);
    if (storedBreak) {
      try {
        setBreakPlan(JSON.parse(storedBreak));
      } catch {
        setBreakPlan(null);
      }
    }
  }, []);

  const hasAnyPlan = !!buildPlan || !!breakPlan;

  // Helper: get a few actions to show
  const buildStepsPreview = buildPlan?.steps?.slice(0, 3) || [];
  const breakStepsPreview =
    breakPlan?.microSteps?.slice(0, 3) ||
    breakPlan?.replacements?.slice(0, 3) ||
    [];

  return (
    <section className="container">
      <h1>Next Steps</h1>
      <p className="sub hero">
        This is a placeholder home page. For now, only <strong>Build a Habit</strong> and{' '}
        <strong>Break a Habit</strong> are implemented, but you can see their actions below.
      </p>

      {/* Today / Actions card */}
      <div
        className="card"
        style={{ marginTop: '1.5rem', maxWidth: '780px' }}
      >
        <h2>Today from your plans</h2>

        {!hasAnyPlan && (
          <>
            <p className="sub">
              You don&apos;t have any saved plans yet. Start by creating one:
            </p>
            <ul>
              <li>
                <Link to="/build-habit">Build a Habit</Link> – create a new habit with tiny steps
              </li>
              <li>
                <Link to="/break-habit">Break a Habit</Link> – choose a habit to beat and replacements
              </li>
            </ul>
          </>
        )}

        {hasAnyPlan && (
          <>
            {/* Build a Habit section */}
            {buildPlan && (
              <div style={{ marginTop: '1rem' }}>
                <h3>Build a Habit</h3>
                <p>
                  <strong>Habit:</strong> {buildPlan.goal || 'No goal set'}
                </p>

                {buildStepsPreview.length > 0 && (
                  <>
                    <p className="sub">First few steps:</p>
                    <ol>
                      {buildStepsPreview.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ol>
                  </>
                )}

                <Link to="/build-habit" className="btn btn-ghost" style={{ marginTop: '.5rem' }}>
                  View / edit habit plan
                </Link>
              </div>
            )}

            {/* Break a Habit section */}
            {breakPlan && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3>Break a Habit</h3>
                <p>
                  <strong>Habit to break:</strong> {breakPlan.habit || 'No habit set'}
                </p>

                {breakStepsPreview.length > 0 && (
                  <>
                    <p className="sub">Try these actions:</p>
                    <ol>
                      {breakStepsPreview.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ol>
                  </>
                )}

                <Link to="/break-habit" className="btn btn-ghost" style={{ marginTop: '.5rem' }}>
                  View / edit break plan
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

