import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';

export default function Login() {

  const navigate = useNavigate();
  const { setUser } = useUser();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('');
  const [childCode, setChildCode] = useState('');
  const [error, setError] = useState('');

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
        id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`, // <-- NEW
        password,
        email,
        name: 'default',
        age: '50',  // default age for non-child users
        role,
        createdAt: new Date().toISOString(),
    };

    setUser(newUser);
    navigate('/home');
  };

  return (
    <section className="container" style={{ maxWidth: '520px', paddingTop: '3rem' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <h1>Welcome back to Next Steps</h1>
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
              <option value="user">User (14+)</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
              <option value="provider">Provider</option>
            </select>
          </label>

          {/* Name + age for non-child roles */}
          {role !== 'child' && (
            <>
              <label className="auth-label">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
        <br></br>
        <hr></hr>
        <br></br>

        <div className="container signin">
            <p>Don't have an account? <a href="/signup">Sign Up</a>.</p>
        </div>

        </form>
      </div>
    </section>
  );
}
