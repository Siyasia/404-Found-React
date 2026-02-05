import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';

export default function Signup() {
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

  const handleSignUp = async (event) => {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const numericAge = Number(age);
    const trimmedCode = childCode.trim();

    // ==== CHILD SIGNUP (code-only) ====
    if (role === 'child') {
      if (!trimmedCode) {
        setError('Please enter the child code provided by your parent.');
        return;
      }

      let children = [];
      try {
        const raw = localStorage.getItem('ns.children.v1');
        if (raw) children = JSON.parse(raw) || [];
      } catch {
        children = [];
      }

      const child = children.find((c) => c.code === trimmedCode);

      if (!child) {
        setError('No child account found for that code. Ask your parent to check it.');
        return;
      }

      setUser({ ...child, role: 'child' });
      navigate('/home');
      return;
    }

    // ==== NON-CHILD ROLES (user, parent, provider) ====
    if (!trimmedName || !age || !role || !password || !email) {
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

    if ((role === 'user' || role === 'parent') && numericAge < 14) {
      setError(
        'Users and parents must be at least 14 years old. Please adjust the age or choose a different role.'
      );
      return;
    }

    response = await signupAdult(email, password);

    if (response.success === false) {
      setError('Failed to signup. Email may be associated with another account.');
      return;
    }

    // const newUser = {
    //   id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`,
    //   email,
    //   password,
    //   name: (email.split('@')[0] || 'User'),
    //   age: '50',
    //   role: 'user',
    //   createdAt: new Date().toISOString(),
    // };

    setUser(response.user);
    navigate('/home');
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
              <option value="">Select a role…</option>
              <option value="parent">Parent</option>
              <option value="provider">Provider</option>
              <option value="user">User (14+)</option>
              <option value="child">Child</option>
            </select>
          </label>

          {/* Child code (only for child signup) */}
          {role === 'child' && (
            <label className="auth-label">
              Parent-provided child code <span aria-hidden="true" className="required-asterisk">*</span>
              <input
                type="text"
                value={childCode}
                onChange={(e) => setChildCode(e.target.value)}
                placeholder="Enter the code your parent gave you"
                required
                aria-required="true"
              />
            </label>
          )}

          {/* Adult / non-child fields */}
          {role !== 'child' && (
            <>
              <label className="auth-label">
                Name <span aria-hidden="true" className="required-asterisk">*</span>
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
                Email <span aria-hidden="true" className="required-asterisk">*</span>
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
                Age <span aria-hidden="true" className="required-asterisk">*</span>
                <input
                  type="number"
                  min="1"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="enter age of user"
                  required
                  aria-required="true"
                />
              </label>

              <label className="auth-label">
                Password <span aria-hidden="true" className="required-asterisk">*</span>
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
            </>
          )}

          {error && (
            <p style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.95rem' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
            Sign Up
          </button>

          <br />
          <hr />
          <br />

          <div className="container signin">
            <p>
              Already have an account? <a href="/login">Log In</a>.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}