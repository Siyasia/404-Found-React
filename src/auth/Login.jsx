import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useUser();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('');
  const [childCode, setChildCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const numericAge = Number(age);
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
    if (!trimmedName || !age || !role) {
      setError('Please fill in your name, age, and role to continue.');
      return;
    }

    if ((role === 'user' || role === 'parent') && numericAge < 15) {
      setError(
        'Users and parents must be at least 15 years old. Please adjust the age or choose a different role.'
      );
      return;
    }

    const newUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`, // <-- NEW
      name: trimmedName,
      age: numericAge,
      role,
      createdAt: new Date().toISOString(),
    };

    setUser(newUser);
    navigate('/home');
  };

  return (
    <section className="container" style={{ maxWidth: '520px', paddingTop: '3rem' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <h1>Welcome to Next Steps</h1>
        <p className="sub hero" style={{ marginTop: '0.5rem' }}>
          Choose how you&apos;re using this device and we&apos;ll set things up for you.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Role selection first so the form can adapt */}
          <label className="auth-label">
            Role
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setError('');
              }}
            >
              <option value="">Select a role</option>
              <option value="user">User (15+)</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
              <option value="provider">Provider</option>
            </select>
          </label>

          {/* Name + age for non-child roles */}
          {role !== 'child' && (
            <>
              <label className="auth-label">
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                />
              </label>

              <label className="auth-label">
                Age
                <input
                  type="number"
                  min="1"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="How old are you?"
                />
              </label>
            </>
          )}

          {/* Child code for child role */}
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
            <p style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.95rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: '1.5rem', width: '100%' }}
          >
            Continue
          </button>
        </form>
      </div>
    </section>
  );
}
