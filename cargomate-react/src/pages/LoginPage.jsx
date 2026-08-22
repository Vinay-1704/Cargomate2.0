import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

import { API_URL } from '../config';

function LoginPage() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState('shipper');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    console.log('ðŸ” CargoMate Login Page Loaded');
    console.log('ðŸ” CargoMate Login Ready');
  }, []);

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleUserTypeChange = (type) => {
    setUserType(type);
    console.log('ðŸ”„ Login type selected:', type);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const showError = (message) => {
    setSuccessMessage('');
    setErrorMessage(message);
    setTimeout(() => {
      setErrorMessage('');
    }, 7000);
  };

  const showSuccess = (message) => {
    setErrorMessage('');
    setSuccessMessage(message);
  };

  const handleSuccessfulLogin = (data) => {
    // ── Tab-isolated auth ────────────────────────────────────────────────────
    // sessionStorage is PER TAB — so a driver tab and a shipper tab will never
    // overwrite each other's credentials. localStorage is only used for
    // "Remember Me" convenience (reading on a fresh tab open).
    sessionStorage.setItem('authToken', data.token);
    sessionStorage.setItem('userData', JSON.stringify(data.user));

    if (formData.rememberMe) {
      // Also persist to localStorage so a brand-new tab can restore the session
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));
    } else {
      // Clear any stale "remember me" data from a different account
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
    }

    showSuccess(`Welcome back, ${data.user.name}! Redirecting...`);

    // Redirect based on user role from database
    setTimeout(() => {
      if (data.user.role === 'shipper') {
        console.log('✅ Redirecting to Shipper Dashboard');
        navigate('/shipper-dashboard');
      } else if (data.user.role === 'driver') {
        console.log('✅ Redirecting to Driver Dashboard');
        navigate('/driver-dashboard');
      } else {
        console.error('❌ Unknown user role:', data.user.role);
        showError('Invalid user role. Please contact support.');
      }
    }, 1500);
  };

  const handleDemoLogin = (email, password, selectedRole) => {
    console.log('ðŸŽ­ Using demo login');

    const demoUsers = [
      {
        id: 1,
        name: "John Smith",
        email: "john@customer.com",
        password: "password123",
        role: "shipper"
      },
      {
        id: 2,
        name: "Raj Kumar",
        email: "raj@driver.com",
        password: "password123",
        role: "driver",
        license_number: "MH123456789",
        vehicle_type: "large_truck",
        vehicle_number: "MH 01 AB 1234"
      }
    ];

    // Find user with matching email and password
    const user = demoUsers.find(u =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password
    );

    if (!user) {
      showError('Invalid email or password. Demo accounts:\njohn@customer.com / password123\nraj@driver.com / password123');
      return;
    }

    // Create demo response
    const demoData = {
      success: true,
      token: 'demo-token-' + user.id,
      user: { ...user, password: undefined }
    };

    handleSuccessfulLogin(demoData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = formData.email.trim();
    const password = formData.password;
    const selectedRole = userType;

    console.log('ðŸ” Login attempt:', { email, selectedRole });

    // Validation
    if (!email || !password) {
      showError('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address');
      return;
    }

    // Show loading state
    setIsLoading(true);

    try {
      // Try server connection
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password: password,
          role: selectedRole
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('ðŸ“¡ Server response:', data);

      if (data.success) {
        handleSuccessfulLogin(data);
      } else {
        showError(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('âŒ Server login failed:', error);
      // Fallback to demo mode
      handleDemoLogin(email, password, selectedRole);
    } finally {
      setIsLoading(false);
    }
  };

    return (
    <div className="login-page-container">
      <a href="/" className="back-home">
        <i className="fas fa-arrow-left"></i>
        Back to Home
      </a>

      <div className="login-container">
        <div className="login-header">
          <div className="logo">
            <div className="logo-icon">
              <i className="fas fa-truck"></i>
            </div>
            CargoMate
          </div>
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">Sign in to your account</p>
        </div>

        <div className="user-type-selection">
          <div className="type-buttons">
            <button
              type="button"
              className={`type-btn ${userType === 'shipper' ? 'active' : ''}`}
              data-role="shipper"
              onClick={() => handleUserTypeChange('shipper')}
            >
              <i className="fas fa-user"></i>
              Customer Login
            </button>
            <button
              type="button"
              className={`type-btn ${userType === 'driver' ? 'active' : ''}`}
              data-role="driver"
              onClick={() => handleUserTypeChange('driver')}
            >
              <i className="fas fa-truck"></i>
              Driver Login
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="message error-message" id="errorMessage">
            <i className="fas fa-exclamation-circle"></i>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="message success-message" id="successMessage">
            <i className="fas fa-check-circle"></i>
            <span>{successMessage}</span>
          </div>
        )}

        <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <i className="fas fa-envelope"></i>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <i className="fas fa-lock"></i>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                className="form-input"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePassword}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleInputChange}
              />
              <span>Remember me</span>
            </label>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            <i className="fas fa-sign-in-alt"></i>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="signup-link">
          Don't have an account? <a href="/signup">Sign up here</a>
        </div>
      </div>
    </div>
  );

}

export default LoginPage;