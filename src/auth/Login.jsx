import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/home');
  };


  return (
    <section className="container" style={{ maxWidth: '480px', paddingTop: '3rem' }}>
        <h1>Get Started</h1>

        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '1.5rem', width: '100%' }}
          onClick={handleStart}
        >
          Start
        </button>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
      </div>
    </section>
  );
}

