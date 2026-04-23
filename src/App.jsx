import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RoleHomeRouter from './components/RoleHomeRouter.jsx';
import Profile from './pages/Profile.jsx';
import Features from './pages/Features.jsx';
import Shop from './pages/Shop.jsx';
import ParentHomepage from './Parents/ParentHomepage.jsx';
import ParentDashboard from './Parents/ParentDashboard.jsx';
import ParentHabitWizardPage from './Parents/ParentHabitWizardPage.jsx';
import ProviderDashboard from './Provider/ProviderDashboard.jsx';
import ChildHomepage from './Child/ChildHomepage.jsx';
import HabitWizardPage from './pages/HabitWizardPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Avatar from './pages/Avatar.jsx';
import UserGoalsPage from './pages/UserGoalsPage.jsx';
import Login from './auth/Login.jsx';
import Signup from './auth/Signup.jsx';
import Splash from './auth/Splash.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/home" element={<RoleHomeRouter />} />
        <Route path="/features" element={<Features />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/habit" element={<HabitWizardPage />} />
        <Route path="/habit-wizard" element={<HabitWizardPage />} />
        <Route path="/goals" element={<UserGoalsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />

        <Route path="/parent" element={<ParentHomepage />} />
        <Route path="/parent/dashboard" element={<ParentDashboard />} />
        <Route path="/parent/habit-wizard" element={<ParentHabitWizardPage />} />

        <Route path="/provider" element={<ProviderDashboard />} />
        <Route path="/child" element={<ChildHomepage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/avatar" element={<Avatar />} />
        <Route path="*" element={<RoleHomeRouter />} />
      </Routes>
    </Layout>
  );
}