import React from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';

export default function Splash() {
  return (
    <section className="ns-splash-page">
      <div className="ns-splash-shell">
        <div className="ns-splash-glow ns-splash-glow--one" />
        <div className="ns-splash-glow ns-splash-glow--two" />
        <div className="ns-splash-glow ns-splash-glow--three" />

        <div className="ns-splash-badge">
          <span className="ns-splash-badge-dot" />
          A gentle place to begin
        </div>

        <div className="ns-splash-logo-wrap" aria-hidden="true">
          <div className="ns-splash-logo-ring" />
          <img
            src="/c4fd8e6f-5ad7-4f61-971d-7f495278396c.png"
            alt=""
            className="ns-splash-logo"
          />
        </div>

        <div className="ns-splash-copy">
          <h1>NextSteps</h1>
          <p className="ns-splash-tagline">Small steps. Big progress.</p>
          <p className="ns-splash-subtext">
            Build routines, track progress, and celebrate everyday wins with a calm,
            supportive system.
          </p>
        </div>

        <div className="ns-splash-path" aria-hidden="true">
          <div className="ns-splash-path-line" />

          <div className="ns-splash-chip ns-splash-chip--left">
            <span>✓</span>
            Build habits
          </div>

          <div className="ns-splash-chip ns-splash-chip--right">
            <span>★</span>
            Celebrate wins
          </div>

          <div className="ns-splash-chip ns-splash-chip--bottom">
            <span>↗</span>
            Track progress
          </div>

          <div className="ns-splash-step ns-splash-step--1">
            Start
            <small>one step</small>
          </div>

          <div className="ns-splash-step ns-splash-step--2">
            Build
            <small>small habits</small>
          </div>

          <div className="ns-splash-step ns-splash-step--3">
            Grow
            <small>steady progress</small>
          </div>

          <div className="ns-splash-step ns-splash-step--4">
            Bloom
            <small>daily wins</small>
          </div>
        </div>

        <div className="ns-splash-actions">
          <Link to="/login" className="ns-splash-action-btn ns-splash-action-btn--login">
            <span className="ns-splash-action-icon">→</span>
            Log In
          </Link>

          <Link to="/signup" className="ns-splash-action-btn ns-splash-action-btn--signup">
            <span className="ns-splash-action-icon">★</span>
            Sign Up
          </Link>
        </div>
      </div>
    </section>
  );
}
