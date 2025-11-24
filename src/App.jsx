import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';

import Home from './pages/Home.jsx';
import Features from './pages/Features.jsx';
import About from './pages/About.jsx';
import BuildHabit from './pages/BuildHabit.jsx';
import BreakHabit from './pages/BreakHabit.jsx';
import ParentDashboard from './pages/ParentDashboard.jsx';
import ProviderDashboard from './pages/ProviderDashboard.jsx';

import Login from './auth/Login.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* Login / role selection lives at the root URL */}
        <Route path="/" element={<Login />} />

        {/* Main app */}
        <Route path="/home" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/about" element={<About />} />
        <Route path="/build-habit" element={<BuildHabit />} />
        <Route path="/break-habit" element={<BreakHabit />} />
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/provider" element={<ProviderDashboard />} />
        <Route path="*" element={<Home />} />

      </Routes>
    </Layout>
  );
}

