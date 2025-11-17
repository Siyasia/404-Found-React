import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';

import Home from './pages/Home.jsx';
import Features from './pages/Features.jsx';
import About from './pages/About.jsx';
import BuildHabit from './pages/BuildHabit.jsx';
import BreakHabit from './pages/BreakHabit.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/about" element={<About />} />
        <Route path="/build-habit" element={<BuildHabit />} />
        <Route path="/break-habit" element={<BreakHabit />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}
