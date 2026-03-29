import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RoleHomeRouter from './components/RoleHomeRouter.jsx';
import Profile from './pages/Profile.jsx';
import Features from './pages/Features.jsx';
import Shop from './pages/Shop.jsx';
import ParentHomepage from './Parents/ParentHomepage.jsx';
import ParentDashboard from './Parents/ParentDashboard.jsx';
import ProviderDashboard from './Provider/ProviderDashboard.jsx';
import ChildHomepage from './Child/ChildHomepage.jsx';
import HabitWizardPage from './pages/HabitWizardPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Avatar from './pages/Avatar.jsx';
import Login from './auth/Login.jsx';
import Signup from './auth/Signup.jsx';
import Splash from './auth/Splash.jsx';
import { useUser } from './UserContext.jsx';

function PublicEntry() {
  const { user, authReady } = useUser();

  if (!authReady) {
    return (
      <section className="container" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          Loading...
        </div>
      </section>
    );
  }

  // If already logged in, skip splash/login and go home
  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Splash />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* Public auth flow */}
        <Route path="/" element={<PublicEntry />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Main app */}
        <Route path="/home" element={<RoleHomeRouter />} />
        <Route path="/features" element={<Features />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/habit" element={<HabitWizardPage />} />
        <Route path="/habit-wizard" element={<HabitWizardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/parent" element={<ParentHomepage />} />
        <Route path="/parent/dashboard" element={<ParentDashboard />} />
        <Route path="/provider" element={<ProviderDashboard />} />
        <Route path="/child" element={<ChildHomepage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/avatar" element={<Avatar />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
