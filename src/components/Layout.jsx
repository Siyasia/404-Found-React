import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE_LABEL, canCreateOwnTasks } from '../Roles/roles.js';

export default function Layout({ children }) {
  const { user, setUser } = useUser();
  const canCreate = user && canCreateOwnTasks(user);
  const location = useLocation();
  const navigate = useNavigate();

  const onLoginPage = location.pathname === '/';

  const handleLogout = () => {
    setUser(null);       // clears context + localStorage
    navigate('/');       // back to login
  };

  const handleProfile = () => {
    navigate('/profile');
  }

  const roleLabel = user ? ROLE_LABEL[user.role] || user.role : null;

  return (
    <>
      <header className="site-header">
        <div className="container" style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/home" className="brand">
            Next Steps
          </Link>

          <nav className="site-nav">
            <NavLink to="/home" className="nav-link">Home</NavLink>
            <NavLink to="/features" className="nav-link">Features</NavLink>
            {canCreate && (
              <>
                <NavLink to="/build-habit" className="nav-link">Build Habit</NavLink>
                <NavLink to="/break-habit" className="nav-link">Break Habit</NavLink>
              </>
            )}
            <NavLink to="/about" className="nav-link">About</NavLink>
          </nav>

          {user && !onLoginPage && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 500 }}>
                Welcome, {user.name}
                {roleLabel ? ` (${roleLabel})` : ''}
              </span>
              <button
                type="button"
                className ="btn btn-ghost"
                onClick={handleProfile}
                style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem' }}
                >
                Profile
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleLogout}
                style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem' }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <main>{children}</main>
    </>
  );
}
