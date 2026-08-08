import React, { useState, useEffect } from 'react';
import '../styles/settings.css';

const API_URL = 'http://localhost:3000/api';

function Settings({ currentUser }) {
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setUserInfo({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || ''
      });
    }
  }, [currentUser]);

  const handleInputChange = (e) => {
    setUserInfo({
      ...userInfo,
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
        body: JSON.stringify(userInfo)
      });

      if (response.ok) {
        alert('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.body.setAttribute('data-theme', newTheme);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>
          <i className="fas fa-cog"></i> Settings
        </h1>
        <p>Manage your account and preferences</p>
      </div>

      {/* Account Information Section */}
      <div className="settings-section">
        <h2>Account Information</h2>
        
        <div className="settings-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={userInfo.name}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={userInfo.email}
              onChange={handleInputChange}
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
              value={userInfo.phone}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="settings-section">
        <h2>Preferences</h2>

        <div className="preference-item">
          <div className="preference-info">
            <h3>Theme</h3>
            <p>Switch between light and dark mode</p>
          </div>
          <button className="preference-btn" onClick={handleThemeToggle}>
            <i className="fas fa-palette"></i> Switch Theme
          </button>
        </div>

        <div className="preference-item">
          <div className="preference-info">
            <h3>Notifications</h3>
            <p>Manage your notification preferences</p>
          </div>
          <button className="preference-btn">
            <i className="fas fa-bell"></i> Manage Notifications
          </button>
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

export default Settings;
