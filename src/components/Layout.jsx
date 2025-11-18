import React from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function Layout({ children }) {
  const year = new Date().getFullYear();

  const navLinkClass = ({ isActive }) =>
    'nav-link' + (isActive ? ' nav-link-active' : '');

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <img
              src="/assets/images/ns-logo-128.png"
              alt="Next Steps logo"
              className="brand-logo"
            />
            <span className="brand-text">Next Steps</span>
          </Link>

          <nav className="nav">
            <NavLink to="/" className={navLinkClass} end>
              Home
            </NavLink>
            <NavLink to="/features" className={navLinkClass}>
              Features
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <NavLink to="/build-habit" className={navLinkClass}>
              Build a Habit
            </NavLink>
            <NavLink to="/break-habit" className={navLinkClass}>
              Break a Habit
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <small>© {year} Next Steps</small>
        </div>
      </footer>
    </>
  );
}

