import React, { useState, useEffect } from 'react';
import '../styles/vehicle-status.css';

import { API_URL } from '../config';

function VehicleStatus({ currentUser }) {
  const [vehicleInfo, setVehicleInfo] = useState({
    vehicleType: '',
    vehicleNumber: '',
    capacity: '',
    licenseNumber: '',
    registrationDate: ''
  });

  const [vehicleHealth, setVehicleHealth] = useState({
    fuelLevel: 75,
    engineHealth: 'Good',
    tireCondition: 'Good'
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setVehicleInfo({
        vehicleType: currentUser.vehicleType || '',
        vehicleNumber: currentUser.vehicleNumber || '',
        capacity: currentUser.capacity || '',
        licenseNumber: currentUser.licenseNumber || '',
        registrationDate: currentUser.registrationDate || ''
      });
    }
  }, [currentUser]);

  const handleUpdateClick = () => {
    setIsEditing(true);
  };

const handleSave = async () => {
  try {
    const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vehicleType: vehicleInfo.vehicleType,
        vehicleNumber: vehicleInfo.vehicleNumber,
        capacity: vehicleInfo.capacity,
        licenseNumber: vehicleInfo.licenseNumber,
        registrationDate: vehicleInfo.registrationDate
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Updated user data:', data.user);
      
      alert('Vehicle information updated successfully!');
      setIsEditing(false);
      
      // Just stay on the page - data is already in state
    } else {
      alert('Failed to update vehicle information');
    }
  } catch (error) {
    console.error('Error updating vehicle info:', error);
    alert('Error updating vehicle information');
  }
};


  const handleCancel = () => {
    // Reset to original values
    if (currentUser) {
      setVehicleInfo({
        vehicleType: currentUser.vehicleType || '',
        vehicleNumber: currentUser.vehicleNumber || '',
        capacity: currentUser.capacity || '',
        licenseNumber: currentUser.licenseNumber || '',
        registrationDate: currentUser.registrationDate || ''
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="vehicle-status-container">
      <div className="vehicle-header">
        <h1>
          <i className="fas fa-truck"></i> Vehicle Status
        </h1>
        <p>Manage your vehicle information and status</p>
      </div>

      <div className="vehicle-content">
        {/* Vehicle Information Card */}
        <div className="vehicle-info-card">
          <div className="card-header">
            <h2>Vehicle Information</h2>
            <span className="status-badge active">Active</span>
          </div>

          <div className="vehicle-details">
            <div className="detail-row">
              <span className="detail-label">Vehicle Type</span>
              {isEditing ? (
                <select 
                  className="detail-input"
                  value={vehicleInfo.vehicleType}
                  onChange={(e) => setVehicleInfo({...vehicleInfo, vehicleType: e.target.value})}
                >
                  <option value="">Select Type</option>
                  <option>Small Truck</option>
                  <option>Medium Truck</option>
                  <option>Large Truck</option>
                  <option>Trailer</option>
                  <option>Van</option>
                </select>
              ) : (
                <span className="detail-value">
                  {vehicleInfo.vehicleType || <span style={{color: '#888'}}>Not Set</span>}
                </span>
              )}
            </div>

            <div className="detail-row">
              <span className="detail-label">Vehicle Number</span>
              {isEditing ? (
                <input 
                  type="text"
                  className="detail-input"
                  value={vehicleInfo.vehicleNumber}
                  onChange={(e) => setVehicleInfo({...vehicleInfo, vehicleNumber: e.target.value})}
                  placeholder="e.g., AP 35N 15 58"
                />
              ) : (
                <span className="detail-value">
                  {vehicleInfo.vehicleNumber || <span style={{color: '#888'}}>Not Set</span>}
                </span>
              )}
            </div>

            <div className="detail-row">
              <span className="detail-label">Capacity</span>
              {isEditing ? (
                <input 
                  type="text"
                  className="detail-input"
                  value={vehicleInfo.capacity}
                  onChange={(e) => setVehicleInfo({...vehicleInfo, capacity: e.target.value})}
                  placeholder="e.g., 5 tons"
                />
              ) : (
                <span className="detail-value">
                  {vehicleInfo.capacity || <span style={{color: '#888'}}>Not Set</span>}
                </span>
              )}
            </div>

            <div className="detail-row">
              <span className="detail-label">License Number</span>
              {isEditing ? (
                <input 
                  type="text"
                  className="detail-input"
                  value={vehicleInfo.licenseNumber}
                  onChange={(e) => setVehicleInfo({...vehicleInfo, licenseNumber: e.target.value})}
                  placeholder="e.g., 1233567889"
                />
              ) : (
                <span className="detail-value">
                  {vehicleInfo.licenseNumber || <span style={{color: '#888'}}>Not Set</span>}
                </span>
              )}
            </div>

            <div className="detail-row">
              <span className="detail-label">Registration Date</span>
              {isEditing ? (
                <input 
                  type="date"
                  className="detail-input"
                  value={vehicleInfo.registrationDate}
                  onChange={(e) => setVehicleInfo({...vehicleInfo, registrationDate: e.target.value})}
                />
              ) : (
                <span className="detail-value">
                  {vehicleInfo.registrationDate || <span style={{color: '#888'}}>Not Set</span>}
                </span>
              )}
            </div>
          </div>

          <div className="card-actions">
            {isEditing ? (
              <>
                <button className="btn-secondary" onClick={handleCancel}>
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button className="btn-primary" onClick={handleSave}>
                  <i className="fas fa-save"></i> Save Changes
                </button>
              </>
            ) : (
              <button className="btn-update" onClick={handleUpdateClick}>
                <i className="fas fa-edit"></i> Update Details
              </button>
            )}
          </div>
        </div>

        {/* Vehicle Health Card */}
        <div className="vehicle-health-card">
          <div className="card-header">
            <h2>Vehicle Health</h2>
          </div>

          <div className="health-metrics">
            <div className="health-item">
              <div className="health-label">Fuel Level</div>
              <div className="health-bar-container">
                <div 
                  className="health-bar fuel" 
                  style={{ width: `${vehicleHealth.fuelLevel}%` }}
                ></div>
              </div>
              <div className="health-value">{vehicleHealth.fuelLevel}%</div>
            </div>

            <div className="health-item">
              <div className="health-label">Engine Health</div>
              <div className="health-bar-container">
                <div 
                  className="health-bar engine" 
                  style={{ width: '90%' }}
                ></div>
              </div>
              <div className="health-value">{vehicleHealth.engineHealth}</div>
            </div>

            <div className="health-item">
              <div className="health-label">Tire Condition</div>
              <div className="health-bar-container">
                <div 
                  className="health-bar tire" 
                  style={{ width: '85%' }}
                ></div>
              </div>
              <div className="health-value">{vehicleHealth.tireCondition}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VehicleStatus;
