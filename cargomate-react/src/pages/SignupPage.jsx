import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/signup.css';


import { API_URL } from '../config';

function SignupPage() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState('shipper');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    license_number: '',
    vehicle_type: '',
    vehicle_number: '',
    vehicle_capacity: '',
    terms: false
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    console.log('📝 CargoMate Signup Page Loaded');
    console.log('📝 CargoMate Signup Ready');
  }, []);

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleUserTypeChange = (type) => {
    setUserType(type);
    console.log('🔄 Registration type selected:', type);
  };

  const handleInputChange = (e) => {
    let { name, value, type, checked } = e.target;

    // Real-time input formatting
    if (name === 'phone') {
      value = value.replace(/\D/g, '');
      if (value.length > 10) value = value.substring(0, 10);
    } else if (name === 'name') {
      value = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (name === 'vehicle_number') {
      value = value.toUpperCase();
      value = value.replace(/[^A-Z0-9\s]/g, '');
      // Auto-format vehicle number
      if (value.length > 0 && !value.includes(' ')) {
        if (value.length >= 2) {
          value = value.substring(0, 2) + ' ' + value.substring(2);
        }
        if (value.length >= 6) {
          value = value.substring(0, 6) + ' ' + value.substring(6);
        }
        if (value.length >= 9) {
          value = value.substring(0, 9) + ' ' + value.substring(9);
        }
      }
      if (value.length > 15) value = value.substring(0, 15);
    }

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

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanPhone = phone.replace(/\D/g, '');
    return phoneRegex.test(cleanPhone);
  };

  const validateVehicleNumber = (vehicleNumber) => {
    const cleaned = vehicleNumber.trim().toUpperCase();
    const hasLetters = /[A-Z]/.test(cleaned);
    const hasNumbers = /[0-9]/.test(cleaned);
    const validLength = cleaned.length >= 6 && cleaned.length <= 15;
    const notAllLetters = !/^[A-Z\s]+$/.test(cleaned);
    const notAllNumbers = !/^[0-9\s]+$/.test(cleaned);
    return hasLetters && hasNumbers && validLength && notAllLetters && notAllNumbers;
  };

  const validateForm = (userData, selectedRole) => {
    const { name, email, phone, password, terms } = userData;

    // Required fields validation
    if (!name || !email || !phone || !password) {
      showError('Please fill in all required fields');
      return false;
    }

    // Name validation
    if (name.length < 2) {
      showError('Name must be at least 2 characters long');
      return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(name)) {
      showError('Name should only contain letters and spaces');
      return false;
    }

    // Email validation
    if (!validateEmail(email)) {
      showError('Please enter a valid email address');
      return false;
    }

    // Phone validation
    if (!validatePhone(phone)) {
      showError('Please enter a valid 10-digit phone number');
      return false;
    }

    // Password validation
    if (password.length < 6) {
      showError('Password must be at least 6 characters long');
      return false;
    }

    // Terms validation
    if (!terms) {
      showError('Please accept the terms and conditions');
      return false;
    }

    // Validate driver specific fields
    if (selectedRole === 'driver') {
      const { license_number, vehicle_type, vehicle_number, vehicle_capacity } = userData;

      if (!license_number || !vehicle_type || !vehicle_number || !vehicle_capacity) {
        showError('Please fill in all driver details');
        return false;
      }

      // License number validation
      if (license_number.length < 10) {
        showError('Please enter a valid license number (at least 10 characters)');
        return false;
      }

      // Vehicle number validation
      if (!validateVehicleNumber(vehicle_number)) {
        showError('Please enter a valid vehicle number (e.g., AP 98 AB 5657)');
        return false;
      }

      // Vehicle capacity validation
      if (vehicle_capacity.length < 3) {
        showError('Please enter valid vehicle capacity (e.g., 5 tons, 500 kg)');
        return false;
      }
    }

    return true;
  };

  const handleSuccessfulRegistration = (data) => {
    // Store authentication data
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userData', JSON.stringify(data.user));

    showSuccess(`Account created successfully! Welcome ${data.user.name}!`);

    // Redirect based on user role
    setTimeout(() => {
      if (data.user.role === 'shipper') {
        console.log('✅ New customer redirecting to dashboard');
        navigate('/shipper-dashboard');
      } else if (data.user.role === 'driver') {
        console.log('✅ New driver redirecting to dashboard');
        navigate('/driver-dashboard');
      }
    }, 1500);
  };

  const handleDemoRegistration = (userData) => {
    console.log('🎭 Using demo registration');

    // Check if email already exists
    const existingEmails = ['john@customer.com', 'raj@driver.com'];
    if (existingEmails.includes(userData.email)) {
      showError('This email is already registered in demo mode. Please use a different email.');
      return;
    }

    // Create demo user
    const demoUser = {
      id: Math.floor(Math.random() * 1000) + 100,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      role: userData.role,
      created_at: new Date().toISOString()
    };

    // Add vehicle details for drivers
    if (userData.role === 'driver') {
      demoUser.license_number = userData.license_number;
      demoUser.vehicle_type = userData.vehicle_type;
      demoUser.vehicle_number = userData.vehicle_number;
      demoUser.vehicle_capacity = userData.vehicle_capacity;
    }

    // Create demo response
    const demoData = {
      success: true,
      token: 'demo-token-' + demoUser.id,
      user: demoUser
    };

    handleSuccessfulRegistration(demoData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedRole = userType;

    // Prepare user data
    const userData = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      password: formData.password,
      role: selectedRole,
      terms: formData.terms
    };

    // Add driver specific fields
    if (selectedRole === 'driver') {
      userData.license_number = formData.license_number.trim();
      userData.vehicle_type = formData.vehicle_type;
      userData.vehicle_number = formData.vehicle_number.trim().toUpperCase();
      userData.vehicle_capacity = formData.vehicle_capacity.trim();
    }

    console.log('📝 Registration data:', userData);

    // Validate form
    if (!validateForm(userData, selectedRole)) {
      return;
    }

    // Show loading state
    setIsLoading(true);

    try {
      // Try server connection
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Registration response:', data);

      if (data.success) {
        handleSuccessfulRegistration(data);
      } else {
        showError(data.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Server registration failed:', error);
      // Fallback to demo mode
      handleDemoRegistration(userData);
    } finally {
      setIsLoading(false);
    }
  };

    return (
    <div className="signup-page-container">
      <a href="/" className="back-home">
        <i className="fas fa-arrow-left"></i>
        Back to Home
      </a>

      <div className="signup-container">
        <div className="signup-header">
          <div className="logo">
            <div className="logo-icon">
              <i className="fas fa-truck"></i>
            </div>
            CargoMate
          </div>
          <h2 className="signup-title">Create Account</h2>
          <p className="signup-subtitle">Join the transportation network</p>
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
              Customer
            </button>
            <button
              type="button"
              className={`type-btn ${userType === 'driver' ? 'active' : ''}`}
              data-role="driver"
              onClick={() => handleUserTypeChange('driver')}
            >
              <i className="fas fa-truck"></i>
              Driver
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

        <form id="signupForm" className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <div className="input-wrapper">
              <i className="fas fa-user"></i>
              <input
                type="text"
                id="name"
                name="name"
                className="form-input"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

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
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <div className="input-wrapper">
              <i className="fas fa-phone"></i>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="form-input"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={handleInputChange}
                required
                maxLength="10"
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
                placeholder="Create a password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength="6"
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

          {/* Driver Specific Fields */}
          <div className={`driver-fields ${userType === 'driver' ? 'show' : ''}`} id="driverFields">
            <div className="form-group">
              <label htmlFor="license_number">License Number</label>
              <div className="input-wrapper">
                <i className="fas fa-id-card"></i>
                <input
                  type="text"
                  id="license_number"
                  name="license_number"
                  className="form-input"
                  placeholder="Enter license number"
                  value={formData.license_number}
                  onChange={handleInputChange}
                  required={userType === 'driver'}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="vehicle_type">Vehicle Type</label>
              <div className="input-wrapper">
                <i className="fas fa-truck"></i>
                <select
                  id="vehicle_type"
                  name="vehicle_type"
                  className="form-select"
                  value={formData.vehicle_type}
                  onChange={handleInputChange}
                  required={userType === 'driver'}
                >
                  <option value="">Select vehicle type</option>
                  <option value="small_truck">Small Truck (up to 1 ton)</option>
                  <option value="medium_truck">Medium Truck (1-3 tons)</option>
                  <option value="large_truck">Large Truck (3-7 tons)</option>
                  <option value="trailer">Trailer (7+ tons)</option>
                  <option value="pickup">Pickup Truck</option>
                  <option value="van">Van/Mini Truck</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="vehicle_number">Vehicle Number</label>
              <div className="input-wrapper">
                <i className="fas fa-hashtag"></i>
                <input
                  type="text"
                  id="vehicle_number"
                  name="vehicle_number"
                  className="form-input"
                  placeholder="e.g., AP 98 AB 5657"
                  value={formData.vehicle_number}
                  onChange={handleInputChange}
                  maxLength="15"
                  required={userType === 'driver'}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="vehicle_capacity">Vehicle Capacity</label>
              <div className="input-wrapper">
                <i className="fas fa-weight-hanging"></i>
                <input
                  type="text"
                  id="vehicle_capacity"
                  name="vehicle_capacity"
                  className="form-input"
                  placeholder="e.g., 5 tons, 500 kg"
                  value={formData.vehicle_capacity}
                  onChange={handleInputChange}
                  required={userType === 'driver'}
                />
              </div>
            </div>
          </div>

          <div className="terms-group">
            <label className="terms-checkbox">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                checked={formData.terms}
                onChange={handleInputChange}
                required
              />
              <span>
                I agree to the <a href="#" className="terms-link">Terms of Service</a>
                {' '}and <a href="#" className="terms-link">Privacy Policy</a>
              </span>
            </label>
          </div>

          <button type="submit" className="signup-btn" id="signupBtn" disabled={isLoading}>
            <i className="fas fa-user-plus"></i>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="login-link">
          Already have an account? <a href="/login">Sign in here</a>
        </div>
      </div>
    </div>
  );

}

export default SignupPage;
