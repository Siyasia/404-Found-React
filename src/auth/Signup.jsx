import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { signupAdult } from '../lib/api/authentication.js';
import {createGameProfile} from "../lib/api/game.js";
import {GameProfile} from "../models/index.js";
import './auth.css';

export default function Signup() {
  const navigate = useNavigate();
  const { setUser } = useUser();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');

  async function makeGameProfile (userId) {
    console.log('Creating game profile for new user...');
    const profile = new GameProfile({id: userId, coins: 0, inventory: []});
    const gameProfileResponse = await createGameProfile(profile);
    if (gameProfileResponse.status_code !== 200) {
      console.error('Failed to create game profile:', gameProfileResponse);
    } else {
      console.log('Game profile created successfully:', gameProfileResponse.id);
    }
  }

  const handleSignUp = async (event) => {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();

    // ==== ADULT ROLES (user, parent, provider) ====
    if (!trimmedName || !role || !password || !email) {
      setError('Please fill in all fields.');
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError(
        'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.'
      );
      return;
    }
/*
    if ((role === 'user' || role === 'parent') && numericAge < 14) {
      setError(
        'Users and parents must be at least 14 years old. Please adjust the age or choose a different role.'
      );
      return;
    }*/

    /*Changing to accept Usernames (Sprint 5)*/
    const response = await signupAdult('50', name, role, email, password, username);

    console.log('📨 Signup API Response:', response);
    console.log('📊 Response status:', response.status_code);
    console.log('👤 Response user:', response.user);

    if (response.status_code !== 200 || !response.user) {
      // Extract error message from backend response
      const errorMsg = response.error 
        || (typeof response.data === 'object' && response.data?.error) 
        || (typeof response.data === 'object' && response.data?.detail)
        || 'Failed to signup. Email may be associated with another account.';
      setError(errorMsg);
      return;
    }

    setUser(response.user);
    await makeGameProfile(response.user.id);
    navigate('/home'); // Let RoleHomeRouter decide where to send the user based on their role

    {/* // Navigate based on user role
    const userRole = response.user.role;
    console.log('User signed up with role:', userRole, 'Full user:', response.user);
    
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
            Create your account
          </div>

          <div className="ns-auth-brand">
            <h1>NextSteps</h1>
            <p>
              Set up your account and start building routines, tracking progress,
              and supporting growth one step at a time.
            </p>
          </div>

          <div className="ns-auth-highlight-grid">
            <div className="ns-auth-highlight">
              <strong>Choose a role</strong>
              <span>Sign up as a parent, provider, or individual user.</span>
            </div>

            <div className="ns-auth-highlight">
              <strong>Child accounts later</strong>
              <span>Children are created inside a parent account after sign up.</span>
            </div>

            <div className="ns-auth-highlight">
              <strong>Secure start</strong>
              <span>Use a strong password so the account is ready for real use.</span>
            </div>
          </div>

          <div className="ns-auth-journey" aria-hidden="true">
            <div className="ns-auth-journey-line" />
            <div className="ns-auth-step ns-auth-step--1">Join</div>
            <div className="ns-auth-step ns-auth-step--2">Set up</div>
            <div className="ns-auth-step ns-auth-step--3">Track</div>
            <div className="ns-auth-step ns-auth-step--4">Grow</div>
          </div>
        </aside>

        <div className="ns-auth-card">
          <h2>Sign up</h2>
          <p className="ns-auth-card-sub">
            Adults can create accounts here. Child accounts are added later by a parent.
          </p>

          <form onSubmit={handleSignUp} className="ns-auth-form">
            <label className="ns-auth-label">
              <span>
                Role <span className="ns-required">*</span>
              </span>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setError('');
                }}
                required
              >
                <option value="">Select a role…</option>
                <option value="parent">Parent</option>
                <option value="provider">Provider</option>
                <option value="user">User (14+)</option>
              </select>
            </label>

            {role === 'user' && (
              <label className="ns-auth-label">
                <span>
                  Username <span className="ns-required">*</span>
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Pick a username"
                  required
                />
              </label>
            )}

            <div className="ns-auth-field-grid">
              <label className="ns-auth-label">
                <span>
                  Name <span className="ns-required">*</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </label>

              <label className="ns-auth-label">
                <span>
                  Email <span className="ns-required">*</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </label>
            </div>

            <label className="ns-auth-label">
              <span>
                Password <span className="ns-required">*</span>
              </span>
              <div className="ns-auth-password-row">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                />
                <button
                  type="button"
                  className="ns-auth-show-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <p className="ns-auth-password-note">
              Your password must be at least 8 characters long and include at least one
              uppercase letter, one lowercase letter, and one number.
            </p>

            {error && <p className="ns-auth-error">{error}</p>}

            <button type="submit" className="btn btn-primary ns-auth-submit">
              Sign Up
            </button>

            <div className="ns-auth-footnote">
              Parents create child accounts later from the Children page after logging in.
            </div>

            <div className="ns-auth-switch">
              Already have an account? <Link to="/login">Log In</Link>.
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
