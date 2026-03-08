import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import HabitWizard from '../components/HabitWizard/HabitWizard.jsx';
import { childList } from '../lib/api/children.js';

export default function HabitWizardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [children, setChildren] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await childList();
        if (!mounted) return;
        if (resp && resp.status_code === 200 && Array.isArray(resp.children)) {
          setChildren(resp.children);
        }
      } catch (err) {
        // noop
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (payload) => {
    // After wizard completes, navigate to the most appropriate home
    if (user?.role === 'parent') navigate('/parent/dashboard');
    else navigate('/home');
  };

  return (
    <div style={{ padding: '1rem' }}>
      <HabitWizard
        context={user?.role === 'parent' ? 'parent' : 'self'}
        availableChildren={children}
        parentUser={user}
        onSubmit={handleSubmit}
      />
    </div>
  );
}