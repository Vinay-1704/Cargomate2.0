import React, { useState, useEffect } from 'react';
import '../styles/driver-settings.css';

import { API_URL } from '../config';

function DriverSettings({ currentUser }) {
  const [personalInfo, setPersonalInfo] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const [vehicleInfo, setVehicleInfo] = useState({
    vehicleType: '',
    vehicleNumber: '',
    licenseNumber: ''
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setPersonalInfo({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || ''
      });

      setVehicleInfo({
        vehicleType: currentUser.vehicleType || '',
        vehicleNumber: currentUser.vehicleNumber || '',
        licenseNumber: currentUser.licenseNumber || ''
      });
    }
  }, [currentUser]);

  const handlePersonalChange = (e) => {
    setPersonalInfo({
      ...personalInfo,
      [e.target.name]: e.target.value
    });
  };

  const handleVehicleChange = (e) => {
    setVehicleInfo({
      ...vehicleInfo,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...personalInfo,
          ...vehicleInfo
        })
      });

      if (response.ok) {
        alert('Settings saved successfully!');
        window.location.reload();
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="driver-settings-container">
      <div className="settings-header">
        <h1>
          <i className="fas fa-cog"></i> Settings
        </h1>
        <p>Manage your account and preferences</p>
      </div>

      {/* Personal Information */}
      <div className="settings-section">
        <h2>Personal Information</h2>
        
        <div className="settings-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={personalInfo.name}
              onChange={handlePersonalChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={personalInfo.email}
              className="form-input"
              disabled
            />
            <small>Email cannot be changed</small>
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={personalInfo.phone}
              onChange={handlePersonalChange}
              className="form-input"
            />
          </div>
        </div>
      </div>

      {/* Vehicle Information */}
      <div className="settings-section">
        <h2>Vehicle Information</h2>
        
        <div className="settings-form">
          <div className="form-group">
            <label>Vehicle Type</label>
            <select
              name="vehicleType"
              value={vehicleInfo.vehicleType}
              onChange={handleVehicleChange}
              className="form-input"
            >
              <option value="">Select Vehicle Type</option>
              <option value="Small Truck">Small Truck</option>
              <option value="Medium Truck">Medium Truck</option>
              <option value="Large Truck">Large Truck</option>
              <option value="Trailer">Trailer</option>
              <option value="Van">Van</option>
            </select>
          </div>

          <div className="form-group">
            <label>Vehicle Number</label>
            <input
              type="text"
              name="vehicleNumber"
              value={vehicleInfo.vehicleNumber}
              onChange={handleVehicleChange}
              className="form-input"
              placeholder="e.g., AP 35N 15 58"
            />
          </div>

          <div className="form-group">
            <label>License Number</label>
            <input
              type="text"
              name="licenseNumber"
              value={vehicleInfo.licenseNumber}
              onChange={handleVehicleChange}
              className="form-input"
              placeholder="e.g., 1233567889"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-actions">
        <button 
          className="btn-save" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save"></i> Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default DriverSettings;
