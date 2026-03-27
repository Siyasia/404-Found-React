import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { signupAdult } from '../lib/api/authentication.js';
import {createGameProfile} from "../lib/api/game.js";
import {GameProfile} from "../models/index.js";

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

    // Navigate based on user role
    const userRole = response.user.role;
    console.log('User signed up with role:', userRole, 'Full user:', response.user);
    
    if (userRole === 'parent') {
      navigate('/parent');
    } else if (userRole === 'provider') {
      navigate('/provider');
    } else {
      navigate('/home');
    }
  };

  return (
    <section className="container" style={{ maxWidth: '520px', paddingTop: '3rem' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <h1>Welcome to Next Steps</h1>
        <p className="sub hero" style={{ marginTop: '0.5rem' }}>
          Create your account to get started. Children accounts can be created under a parent once logged in.
        </p>

        <form onSubmit={handleSignUp}>
          {/* Role choice (always visible) */}
          <label className="auth-label">
            <span>
            Role<span aria-hidden="true" className="required-asterisk">*</span>
            </span>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setError('');
              }}
              required
              aria-required="true"
            >
              <option value="">Select a role…</option>
              <option value="parent">Parent</option>
              <option value="provider">Provider</option>
              <option value="user">User (14+)</option>
            </select>
          </label>

          {role === 'user' && (
            <label className="auth-label">
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Pick a username"
                required
              />
            </label>
          )}

          <label className="auth-label">
                <span>
                Name<span aria-hidden="true" className="required-asterisk">*</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="enter name of user"
                  required
                  aria-required="true"
                />
              </label>

              <label className="auth-label">
                <span>
                Email<span aria-hidden="true" className="required-asterisk">*</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="enter email address"
                  required
                  aria-required="true"
                />
              </label>

              <label className="auth-label">
                <span>
                Password<span aria-hidden="true" className="required-asterisk">*</span>
                </span>
                <div className="password-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    aria-required="true"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? ' Hide' : ' Show'}
                  </button>
                </div>
              </label>

              <div className="passwordRequirement" id="passwordRequirement">
                Your password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.
              </div>

          {error && (
            <p style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.95rem' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
            Sign Up
          </button>

          <div
            style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#64748b',
              fontSize: '0.95rem',
            }}
          >
            <span aria-hidden="true" style={{ color: 'inherit' }}>*</span>{' '}
            Parents create children from their "Children" page.
          </div>

          <div className="container signin" style={{ marginTop: '0.75rem' }}>
            <p>
              Already have an account? <a href="/login">Log In</a>.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
