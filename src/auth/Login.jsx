import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { loginAdult, loginChild } from '../lib/api/authentication.js';
import {createGameProfile, getGameProfile} from "../lib/api/game.js";
import {GameProfile} from "../models/index.js";
import './Auth.css';

export default function Login() {

  const navigate = useNavigate();
  const { setUser } = useUser();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [childCode, setChildCode] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('admin');

  // Profile selection UI removed; always show manual login form
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (activeTab === 'child') {
      const trimmedCode = childCode.trim();

    // Sprint 5 addition: Login uses Username flow for children:
    if (trimmedCode) {
      if (!trimmedCode.includes('#')) {
        setError('You must provide a parent-generated code with a child username Ex: "SwordFish#12345"');
        return;
      }

      if (!childPassword.trim()) {
        setError('Child password is required.');
        return;
      }

      const response = await loginChild(trimmedCode, childPassword);

      if (response.status_code !== 200) {
        setError(response.error || 'No child account found for that username/code. Ask your parent to check it.');
        return;
      }

      const child = response.child;
      setUser({ ...child, role: 'child' });

      try {
        await getGameProfile()
      } catch (error) {
        if (error.status === 404) {
          console.log('No game profile found for child, creating one...');
          await createGameProfile(new GameProfile({id: child.code}));
        }
      }

      setChildPassword('');
      navigate('/home');
      return;
    }
  }

    // ==== ADULT LOGIN FLOW (email + password) ====
    if (!email || !password) {
      setError('Please enter email or username + password, or enter a child code.');
      return;
    }

    const response = await loginAdult(email, password);

    console.log('📨 Login API Response:', response);
    console.log('📊 Response status:', response.status_code);
    console.log('👤 Response user:', response.user);

    if (response.status_code !== 200) {
      const errorMsg = response.error
        || (response.status_code === 400 || response.status_code === 404
          ? 'No account found for that email. Please sign up first.'
          : 'Failed to login. Please try again.');
      setError(errorMsg);
      return;
    }

    setUser(response.user);
    navigate('/home'); // Let RoleHomeRouter decide where to send the user based on their role
    
    {/* // Navigate based on user role - commenting this out for now since RoleHomeRouter will handle it, but keeping the logic here for reference in case we want to do any role-based redirects at login in the future
    const userRole = response.user.role || response.user.type;
    console.log('User logged in with role:', userRole, 'Full user:', response.user);
    
    if (userRole === 'parent') {
      navigate('/parent');
    } else if (userRole === 'provider') {
      navigate('/provider');
    } else {
      navigate('/home');
    } */}

  };

  return (
    <section className="ns-auth-page">
      <div className="ns-auth-shell">
        <aside className="ns-auth-hero">
          <div className="ns-auth-badge">
            <span className="ns-auth-badge-dot" />
            Welcome back
          </div>

          <div className="ns-auth-brand">
            <h1>NextSteps</h1>
            <p>
              Small steps. Big progress. Log in to keep building routines, tracking wins,
              and moving forward.
            </p>
          </div>

          <div className="ns-auth-highlight-grid">
            <div className="ns-auth-highlight">
              <strong>Adult accounts</strong>
              <span>Parents, providers, and users log in here with email or username.</span>
            </div>

            <div className="ns-auth-highlight">
              <strong>Child accounts</strong>
              <span>Children use their username#code and password from their parent.</span>
            </div>

            <div className="ns-auth-highlight">
              <strong>Same real flow</strong>
              <span>This matches your current app instead of inventing extra steps.</span>
            </div>
          </div>

          <div className="ns-auth-journey" aria-hidden="true">
            <div className="ns-auth-journey-line" />
            <div className="ns-auth-step ns-auth-step--1">Log in</div>
            <div className="ns-auth-step ns-auth-step--2">Plan</div>
            <div className="ns-auth-step ns-auth-step--3">Track</div>
            <div className="ns-auth-step ns-auth-step--4">Grow</div>
          </div>
        </aside>

        <div className="ns-auth-card">
          <h2>Log in</h2>
          <p className="ns-auth-card-sub">
            Use the same credentials and flows your app already supports.
          </p>

          <div className="ns-auth-tabs" role="tablist" aria-label="Login type">
            <button
              type="button"
              className={`ns-auth-tab ${activeTab === 'admin' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('admin');
                setError('');
              }}
            >
              Admin Login
            </button>

            <button
              type="button"
              className={`ns-auth-tab ${activeTab === 'child' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('child');
                setError('');
              }}
            >
              Child Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="ns-auth-form">
            {activeTab === 'admin' && (
              <>
                <label className="ns-auth-label">
                  <span>
                    Email or Username <span className="ns-required">*</span>
                  </span>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email or username"
                  />
                </label>

                <label className="ns-auth-label">
                  <span>
                    Password <span className="ns-required">*</span>
                  </span>
                  <div className="ns-auth-password-row">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      aria-describedby="login-password-toggle"
                    />
                    <button
                      type="button"
                      id="login-password-toggle"
                      className="ns-auth-show-btn"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>
              </>
            )}

            {activeTab === 'child' && (
              <>
                <label className="ns-auth-label">
                  <span>
                    Child Login (username#code) <span className="ns-required">*</span>
                  </span>
                  <input
                    type="text"
                    value={childCode}
                    onChange={(e) => setChildCode(e.target.value)}
                    placeholder='Example: SwordFish#12345'
                  />
                </label>

                <label className="ns-auth-label">
                  <span>
                    Child Password <span className="ns-required">*</span>
                  </span>
                  <input
                    type="password"
                    value={childPassword}
                    onChange={(e) => setChildPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </label>

                <p className="ns-auth-helper">
                  Child accounts are created under a parent account and use the
                  parent-generated login code.
                </p>
              </>
            )}

            {error && <p className="ns-auth-error">{error}</p>}

            <button type="submit" className="btn btn-primary ns-auth-submit">
              Continue
            </button>

            <div className="ns-auth-switch">
              Don&apos;t have an account? <Link to="/signup">Sign Up</Link>.
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
