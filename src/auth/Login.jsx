import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';

export default function Login() {

  const navigate = useNavigate();
  const { setUser } = useUser();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('');
  const [childCode, setChildCode] = useState('');
  const [error, setError] = useState('');

  // Profile selection UI removed; always show manual login form

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    const trimmedCode = childCode.trim();

    // ==== CHILD LOGIN FLOW (uses code instead of name/age) ====
    if (role === 'child') {
      if (!trimmedCode) {
        setError('Please enter your child code.');
        return;
      }

      let children = [];
      try {
        const raw = localStorage.getItem('ns.children.v1');
        if (raw) {
          children = JSON.parse(raw) || [];
        }
      } catch {
        children = [];
      }

      const child = children.find((c) => c.code === trimmedCode);

      if (!child) {
        setError('No child account found for that code. Ask your parent to check the code.');
        return;
      }

      const newUser = {
        ...child,      // already has id, name, age, code
        role: 'child',
      };

      setUser(newUser);
      navigate('/home');
      return;
    }

    // ==== NON-CHILD ROLES (user, parent, provider) ====
    if (!role || !email || !password) {
      setError('Please fill in all fields. If you don\'t have an account, please sign up first.');
      return;
    }

    const newUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`,
      password,
      email,
      name: name || 'default',
      age: age || '50',
      role,
      createdAt: new Date().toISOString(),
    };

    setUser(newUser);
    navigate('/home');
  };

  // Removed profile cards and helpers

  return (
    <section className="container" style={{ maxWidth: '960px', paddingTop: '3rem', textAlign: 'center' }}>
      <div className="card" style={{ padding: '2.25rem 2rem', maxWidth: '520px', margin: '0 auto', textAlign: 'left' }}>
          <h1 style={{ marginBottom: '.75rem' }}>Welcome back to Next Steps</h1>
          <p className="sub" style={{ marginTop: 0 }}>
            Choose your role and sign in. Use child code for kid accounts.
          </p>
          <form onSubmit={handleSubmit} style={{ marginTop: '.75rem' }}>
            <label className="auth-label">
              Role <span aria-hidden="true" className="required-asterisk">*</span>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setError('');
                }}
                required
                aria-required="true"
              >
                <option value="">Select a role</option>
                <option value="user">User (14+)</option>
                <option value="child">Child</option>
                <option value="parent">Parent</option>
                <option value="provider">Provider</option>
              </select>
            </label>

            {role !== 'child' && (
              <>
                <label className="auth-label">
                  Email <span aria-hidden="true" className="required-asterisk">*</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    aria-required="true"
                  />
                </label>
                 <label className="auth-label">
                  Password <span aria-hidden="true" className="required-asterisk">*</span>
                  <div className="password-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      aria-describedby="login-password-visibility-toggle"
                      required
                      aria-required="true"
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

            {role === 'child' && (
              <label className="auth-label">
                Child code
                <input
                  type="text"
                  value={childCode}
                  onChange={(e) => setChildCode(e.target.value)}
                  placeholder="Enter the code your parent gave you"
                />
              </label>
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
