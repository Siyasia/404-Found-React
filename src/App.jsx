import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';

import Home from './pages/Home.jsx';
import Profile from './pages/Profile.jsx';
import Features from './pages/Features.jsx';
import Shop from './pages/Shop.jsx';
import BuildHabit from './pages/BuildHabit.jsx';
import BreakHabit from './pages/BreakHabit.jsx';
import ParentHomepage from './Parents/ParentHomepage.jsx';
import ParentDashboard from './Parents/ParentDashboard.jsx';
import ProviderDashboard from './Provider/ProviderDashboard.jsx';
import HabitWizardPage from './pages/HabitWizardPage.jsx'; // Temporary page for testing the Habit Wizard component


import Login from './auth/Login.jsx';
import Signup from './auth/Signup.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* Login / role selection lives at the root URL */}
        <Route path="/" element={<Login />} />

        {/* Main app */}
        <Route path="/home" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/build-habit" element={<BuildHabit />} />
        <Route path="/break-habit" element={<BreakHabit />} />
        <Route path="/habit" element={<HabitWizardPage />} />
        <Route path="/parent" element={<ParentHomepage />} />
        <Route path="/parent/dashboard" element={<ParentDashboard />} />
        <Route path="/provider" element={<ProviderDashboard />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Home />} />

      </Routes>
    </Layout>
  );
}

