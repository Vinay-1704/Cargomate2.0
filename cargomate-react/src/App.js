import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DriverDashboard from './pages/DriverDashboard';
import ShipperDashboard from './pages/ShipperDashboard';

function App() {

  return (
    
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
     
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Protected Routes */}
        <Route path="/driver-dashboard" element={<DriverDashboard />} />
        <Route path="/shipper-dashboard" element={<ShipperDashboard />} />
        
        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
    </Router>
    
  );
}

export default App;
