import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './Components/Layout.jsx';

import Home from './Pages/Home.jsx';
import Features from './Pages/Features.jsx';
import About from './Pages/About.jsx';
import BuildHabit from './Pages/BuildHabit.jsx';
import BreakHabit from './Pages/BreakHabit.jsx';
import ParentDashboard from './Parents/ParentDashboard.jsx';
import ProviderDashboard from './Provider/ProviderDashboard.jsx';
import Profile from './Pages/Profile.jsx';

import Login from './Auth/Login.jsx';
import Signup from './Auth/Signup.jsx';

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
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Home />} />

      </Routes>
    </Layout>
  );
}

