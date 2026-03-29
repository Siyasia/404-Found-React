import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { loginAdult, loginChild } from '../lib/api/authentication.js';
import {createGameProfile, getGameProfile} from "../lib/api/game.js";
import {GameProfile} from "../models/index.js";

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

  // Removed profile cards and helpers
  return (
    <section className="container" style={{ maxWidth: '960px', paddingTop: '3rem', textAlign: 'center' }}>
      <div className="card" style={{ padding: '2.25rem 2rem', maxWidth: '520px', margin: '0 auto', textAlign: 'left' }}>
          <h1 style={{ marginBottom: '.75rem' }}>Welcome back to Next Steps</h1>

          {/* styling to create separate tabs for admins vs children accounts */}
          <div className='tabs' style={{ display: 'flex', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="btn"
              style={{ marginTop: '1.25rem', width: '100%', marginLeft: '1rem', marginRight: '0.5rem' }}
            >
              Admin Login
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('child')}
              className="btn"
              style={{ marginTop: '1.25rem', width: '100%', marginLeft: '0.5rem', marginRight: '1rem'  }}
            >
              Child Login
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: '.75rem' }}>

            {/* admin tab (for users, parents, providers) */}
            {activeTab === 'admin' && (
              <>
                <label className="auth-label">
                  <span>
                    Email or Username<span aria-hidden="true" className="required-asterisk">*</span>
                  </span>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email or username"
                  />
                </label>

                <label className="auth-label">
                  <span>
                  Password <span style={{ color: '#b91c1c'}}>*</span>
                  </span>
                  <div className="password-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      aria-describedby="login-password-visibility-toggle"
                    />
                    <button
                      type="button"
                      id="login-password-visibility-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="icon-button"
                      style={{
                        border: '1px solid #ccc',
                        background: 'white',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {showPassword ? ' Hide' : ' Show'}
                    </button>
                  </div>
                </label>
              </>
            )}

            {activeTab === 'child' && (
              <>
                <label className="auth-label">
                  <span>
                    Child Login (username#code) <span style={{ color: '#b91c1c'}}>*</span>
                  </span>
                  <input
                    type="text"
                    value={childCode}
                    onChange={(e) => setChildCode(e.target.value)}
                    placeholder='Example: SwordFish#12345'
                  />
                </label>

                <label className="auth-label">
                  <span>
                    Child Password <span style={{ color: '#b91c1c'}}>*</span>
                  </span>
                  <input
                    type="password"
                    value={childPassword}
                    onChange={(e) => setChildPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </label>
              </>
            )}

            {error && (
              <p style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.9rem' }}>{error}</p>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1.25rem', width: '100%' }}>
              Continue
            </button>

            <div style={{ marginTop: '1.25rem', fontSize: '.85rem' }}>
              <span>Don&apos;t have an account? <a href="/signup">Sign Up</a>.</span>
            </div>

          </form>
      </div>
    </section>
  );
}
