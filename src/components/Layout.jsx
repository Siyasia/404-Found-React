import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE, ROLE_LABEL, canCreateOwnTasks } from '../Roles/roles.js';
import { useFriendRequests } from '../lib/hooks/useFriendRequests.js';

export default function Layout({ children }) {
  const { user, setUser } = useUser();
  const canCreate = user && canCreateOwnTasks(user);
  const isParent = user?.role === ROLE.PARENT;
  const useGame = user?.role === ROLE.USER || user?.role === ROLE.CHILD;
  const showFriendBadge =
    Boolean(user) && user?.role !== ROLE.PROVIDER;
  const { pendingCount } = useFriendRequests(30000, showFriendBadge);
  const location = useLocation();
  const navigate = useNavigate();

  // Treat all auth pages as public/auth screens
  const isAuthPage =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/signup';


  const handleLogout = () => {
    setUser(null);       // clears context and user info
    navigate('/');       // back to login
  };

  const handleProfile = () => {
    navigate('/profile');
  }

  // Only show a role label if user and user.role exist; prevents errors if user is missing
  const roleLabel = user?.role ? ROLE_LABEL[user.role] || user.role : null;
  const homePath = '/home'; // Centralized homepage route that will redirect based on role

  return (
    <> 
    {!isAuthPage && (
      <header className="site-header">
        {/* Hide the header completely on splash/login/signup */}
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to={homePath} className="brand" aria-label="Go to home" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <img
              src="/c4fd8e6f-5ad7-4f61-971d-7f495278396c.png"
              alt="Next Steps logo"
              style={{ height: '32px', width: 'auto', display: 'block' }}
            />
          </Link>

          <nav className="site-nav">
            {isParent ? (
              <>
                <NavLink to="/parent/dashboard?tab=children" className="nav-link">Children</NavLink>
                <NavLink to="/parent/dashboard?tab=assign" className="nav-link">Assign tasks</NavLink>
                <NavLink to="/parent/dashboard?tab=goals" className="nav-link">Goals</NavLink>
                <NavLink to="/calendar" className="nav-link">Calendar</NavLink>
                <NavLink to="/parent/dashboard?tab=approvals" className="nav-link">Approvals</NavLink>
              </>
            ) : (
              <>
                {/* <NavLink to="/features" className="nav-link">Features</NavLink> */}
                {canCreate && (
                  <>
                    <NavLink to="/habit" className="nav-link">Habit Wizard</NavLink>
                    {user?.role === ROLE.USER && (
                      <NavLink to="/goals" className="nav-link">Goals</NavLink>
                    )}
                  </>
                )}
                {useGame && (
                  <>
                    <NavLink to="/shop" className="nav-link">Shop</NavLink>
                    <NavLink to="/avatar" className="nav-link">Avatar</NavLink>
                  </>
                )}
              </>
            )}
          </nav>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }} />

          {user && (
            <div style={{ marginLeft: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 500 }}>
                Welcome, {user.name}
                {roleLabel ? ` (${roleLabel})` : ''}
              </span>
              <button
                type="button"
                className ="btn btn-ghost layout-profile-trigger"
                onClick={handleProfile}
                style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem' }}
                >
                Profile
                {pendingCount > 0 && (
                  <span className="layout-request-badge" aria-label={`${pendingCount} pending friend requests`}>
                    {pendingCount}
                  </span>
                )}
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
      )}

      <main>{children}</main>
    </>
  );
}
