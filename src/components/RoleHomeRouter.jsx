// Adding RoleHomeRouter centralizes homepage routing in one place.
// This page basically replaces the scattered role-based redirect logic we currently have across Login, Signup, Layout, and App. 
// Instead of each file deciding where a user should land, /home becomes the single smart entry point that checks thelogged-in user's role and renders the correct homepage.
//  This is better because it keeps routing consistent, reduces duplication, and makes future homepage or role changes much easier to maintain. 
// Now, if we add a new role or change homepage logic, we can only update RoleHomeRouter.jsx

import { Navigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import Home from '../pages/Home.jsx';
import ChildHomepage from '../Child/ChildHomepage.jsx';
import ParentHomepage from '../Parents/ParentHomepage.jsx';
import ProviderDashboard from '../Provider/ProviderDashboard.jsx';

{/* Now the routing logic is:
user exists → go straight to homepage
no user yet, auth still loading → show loading
no user, auth finished → send to login 
*/}

export default function RoleHomeRouter() {
  const { user, authReady } = useUser();

// If we already have a user in context, route immediately instead of waiting on authReady.
// This prevents recently logged-in users from getting stuck on the loading card.
  if (user) {
    switch (user.role) {
      case ROLE.CHILD:
        return <ChildHomepage />;
      case ROLE.PARENT:
        return <ParentHomepage />;
      case ROLE.PROVIDER:
        return <ProviderDashboard />;
      case ROLE.USER:
      default:
        return <Home />;
    }
  }

  // Show loading state only while auth is still being checked and no user has been resolved yet.
  if (!authReady) {
    return (
      <section className="container" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          Loading your dashboard...
        </div>
      </section>
    );
  }

  // If auth has finished and there is still no user, send them to login.
  return <Navigate to="/login" replace />;
}