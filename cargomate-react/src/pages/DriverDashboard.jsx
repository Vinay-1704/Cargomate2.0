import TripChatModal from '../components/TripChatModal';
import ProofOfDeliveryModal from '../components/ProofOfDeliveryModal';
import RouteOptimizer from '../components/RouteOptimizer';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DriverEarnings from '../components/DriverEarnings';
import DriverPerformance from '../components/DriverPerformance';  // ← ADD THIS LINE
import DriverSettings from '../components/DriverSettings';
import DriverSupport from '../components/DriverSupport';
import VehicleStatus from '../components/VehicleStatus';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

import '../styles/driver-dashboard.css';
import '../styles/live-tracking.css';

import { API_URL } from '../config';

function DriverDashboard() {
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [myTrips, setMyTrips] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [invitations, setInvitations] = useState([]);
  
  const [stats, setStats] = useState({
    activeTrips: 0,
    completedToday: 0,
    todayEarnings: 0,
    rating: 'New'
  });
  const [dashboardStats, setDashboardStats] = useState({
  activeTrips: 0,
  completedToday: 0,
  todaysEarnings: 0,
  rating: 'New'
});


  const [showBidModal, setShowBidModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [sharingLocation, setSharingLocation] = useState({});
  const locationIntervals = useRef({});
  const [tripChatModal, setTripChatModal] = useState({
  open: false,
  trip: null
});
  const [podModal, setPodModal] = useState({
  open: false,
  trip: null,
  mode: 'submit'
});

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (currentUser) {
      initializeDashboard();
      loadDriverData();
      
      const bidUpdateInterval = setInterval(checkForBidUpdates, 2000);
      const dataRefreshInterval = setInterval(refreshData, 60000);
      
      return () => {
        clearInterval(bidUpdateInterval);
        clearInterval(dataRefreshInterval);
      };
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && myTrips.length >= 0) {
      updateDashboardStats();
    }
  }, [myTrips, currentUser]);
  

  const checkAuthentication = () => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const userData = sessionStorage.getItem('userData') || localStorage.getItem('userData');
    
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    
    try {
      const user = JSON.parse(userData);
      if (user.role !== 'driver') {
        navigate('/shipper-dashboard');
        return;
      }
      setCurrentUser(user);
      console.log('✅ Driver authenticated:', user.name, 'ID:', user.id);
    } catch (error) {
      sessionStorage.clear();
      localStorage.clear();
      navigate('/login');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  };

  const initializeDashboard = () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.body.className = `${savedTheme}-theme`;
    
    const savedStatus = localStorage.getItem('driverOnlineStatus');
    if (savedStatus === 'true') setIsOnline(true);
  };

  const loadDriverData = async () => {
    if (!currentUser) return;
    
    try {
      console.log('🔄 Loading driver data for:', currentUser.name);
      
      const storedBids = localStorage.getItem(`driverBids_${currentUser.id}`);
      const storedTrips = localStorage.getItem(`driverTrips_${currentUser.id}`);
      
      let bids = storedBids ? JSON.parse(storedBids) : [];
      let trips = storedTrips ? JSON.parse(storedTrips) : [];
      
      try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const [bidsResponse, tripsResponse, invResponse] = await Promise.allSettled([
          fetch(`${API_URL}/bids/driver/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/trips/driver/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/invitations/driver/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        if (bidsResponse.status === 'fulfilled' && bidsResponse.value?.ok) {
          const bidsData = await bidsResponse.value.json();
          bids = bidsData.bids || [];
        }
        
        if (tripsResponse.status === 'fulfilled' && tripsResponse.value?.ok) {
          const tripsData = await tripsResponse.value.json();
          trips = tripsData.trips || [];
        }

        if (invResponse.status === 'fulfilled' && invResponse.value?.ok) {
          const invData = await invResponse.value.json();
          setInvitations(invData.invitations || []);
        }
      } catch (error) {
        console.log('Using stored data');
      }
      
      setMyBids(bids);
      setMyTrips(trips);
      await loadAvailableJobs();
      
    } catch (error) {
     console.error('❌ Error:', error);
    }
  };

  const loadAvailableJobs = async () => {
    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/shipments/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response && response.ok) {
        const data = await response.json();
        setAvailableJobs(data.shipments || []);
        console.log('✅ Loaded jobs:', data.shipments?.length || 0);
      }
    } catch (error) {
      console.error('❌ Error loading jobs:', error);
    }
  };

const updateDashboardStats = () => {
  if (!myTrips || myTrips.length === 0) {
    console.log('⚠️ No trips data available');
    setDashboardStats({
      activeTrips: 0,
      completedToday: 0,
      todaysEarnings: 0,
      rating: 'New'
    });
    return;
  }

  console.log('📊 Total trips:', myTrips.length);
  
  // Calculate ACTIVE trips (not completed or delivered)
  const activeTrips = myTrips.filter(t => 
    t.status !== 'completed' && 
    t.status !== 'delivered' && 
    t.status !== 'cancelled'
  ).length;
  
  console.log('✅ Active trips:', activeTrips);
  
  // Get all completed trips
  const completedTrips = myTrips.filter(t => 
    t.status === 'completed' || t.status === 'delivered'
  );
  
  // For now, show total completed trips (not filtered by date)
  const completedToday = completedTrips.length;
  
  console.log('✅ Total completed:', completedToday);
  
  // Calculate total earnings from completed trips
  const todaysEarnings = completedTrips.reduce((sum, t) => {
    const amount = parseFloat(t.bidamount || t.final_amount || t.finalamount || t.amount || 0);
    console.log(`💰 Trip ${t.shipment_id}: ₹${amount}`);
    return sum + amount;
  }, 0);
  
  console.log('✅ Total earnings: ₹', todaysEarnings);
  
  // Calculate rating
  let rating = 'New';
  if (completedTrips.length > 0) {
    const ratedTrips = completedTrips.filter(t => t.driver_rating || t.rating);
    if (ratedTrips.length > 0) {
      const totalRating = ratedTrips.reduce((sum, t) => 
        sum + (parseFloat(t.driver_rating || t.rating || 0)), 0
      );
      const avgRating = totalRating / ratedTrips.length;
      rating = avgRating > 0 ? avgRating.toFixed(1) : 'New';
    }
  }
  
  console.log('📊 Final stats:', { activeTrips, completedToday, todaysEarnings, rating });
  
  setDashboardStats({
    activeTrips,
    completedToday,
    todaysEarnings,
    rating
  });
};





// Add this useEffect to trigger stats calculation
useEffect(() => {
  if (myTrips && myTrips.length > 0) {
    console.log('🔄 myTrips changed, updating stats...'); // ADD THIS
    updateDashboardStats();
  }
}, [myTrips]);


  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.body.className = `${newTheme}-theme`;
    localStorage.setItem('theme', newTheme);
  };

  const toggleOnlineStatus = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    localStorage.setItem('driverOnlineStatus', newStatus.toString());
  };

  const logout = () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    navigate('/login');
  };

  const switchToSection = (section) => {
    setActiveSection(section);
    if (section === 'available-jobs') loadAvailableJobs();
  };

  const refreshData = () => {
    loadDriverData();
  };

  const checkForBidUpdates = async () => {
    if (!currentUser) return;
    const storedTrips = localStorage.getItem(`driverTrips_${currentUser.id}`);
    if (storedTrips) {
      const trips = JSON.parse(storedTrips);
      if (JSON.stringify(trips) !== JSON.stringify(myTrips)) {
        setMyTrips(trips);
      }
    }
  };

  const openBidModal = (job) => {
    console.log('🔍 Opening bid modal for:', job.shipment_id);
    setSelectedJob(job);
    setBidAmount('');
    setBidMessage('');
    setShowBidModal(true);
  };

  const closeBidModal = () => {
    setShowBidModal(false);
    setSelectedJob(null);
    setBidAmount('');
    setBidMessage('');
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    
    if (!selectedJob) {
      showToast('No job selected', 'error');
      return;
    }
    
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid bid amount', 'error');
      return;
    }

    const bidData = {
      bid_id: `BID-${Date.now()}`,
      shipment_id: selectedJob.shipment_id,
      driver_id: currentUser.id,
      driver_name: currentUser.name,
      driver_rating: currentUser.rating || 4.5,
      vehicle_type: currentUser.vehicle_type,
      vehicle_number: currentUser.vehicle_number,
      license_number: currentUser.license_number,
      bid_amount: amount,
      message: bidMessage || '',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      console.log('📤 Submitting bid:', bidData);
      
      const response = await fetch(`${API_URL}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          shipment_id: selectedJob.shipment_id,
          bid_amount: amount,
          message: bidMessage || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
       console.log('✅ Bid submitted:', data);
        
        storeBidLocally(bidData);
        setMyBids(prev => [...prev, bidData]);
        
       showToast('Bid submitted successfully!', 'success');

        closeBidModal();
        loadAvailableJobs();
      } else {
        const error = await response.json();
       showToast(error.error || 'Failed to submit bid', 'error');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      storeBidLocally(bidData);
      setMyBids(prev => [...prev, bidData]);
      showToast('Bid submitted (offline mode)', 'success');
      closeBidModal();
    }
  };

  const storeBidLocally = (bidData) => {
    const allBids = JSON.parse(localStorage.getItem('allBids') || '[]');
    allBids.push(bidData);
    localStorage.setItem('allBids', JSON.stringify(allBids));
    localStorage.setItem(`driverBids_${currentUser.id}`, JSON.stringify([...myBids, bidData]));
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: <span className="badge badge-warning">Pending</span>,
      active: <span className="badge badge-info">Active</span>,
      in_transit: <span className="badge badge-primary">In Transit</span>,
      completed: <span className="badge badge-success">Completed</span>
    };
    return badges[status] || <span className="badge">{status}</span>;
  };

  // ─── Location sharing functions ────────────────────────────────────
  const sendLocationUpdate = async (shipmentId, lat, lon) => {
    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      await fetch(`${API_URL}/trips/${shipmentId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat, lon }),
      });
      console.log(`[GPS] Location sent: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } catch (err) {
      console.error('[GPS] Failed to send location:', err);
    }
  };

  const startShareLocation = (shipmentId) => {
    if (sharingLocation[shipmentId]) return;

    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    // Send initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => sendLocationUpdate(shipmentId, pos.coords.latitude, pos.coords.longitude),
      (err) => {
        console.error('[GPS] Permission denied or error:', err);
        showToast('Please allow location access', 'error');
      },
      { enableHighAccuracy: true }
    );

    // Then send every 10 seconds
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocationUpdate(shipmentId, pos.coords.latitude, pos.coords.longitude),
        (err) => console.error('[GPS] Error:', err),
        { enableHighAccuracy: true }
      );
    }, 10000);

    locationIntervals.current[shipmentId] = intervalId;
    setSharingLocation((prev) => ({ ...prev, [shipmentId]: true }));
    showToast('Location sharing started!', 'success');
  };

  const stopShareLocation = (shipmentId) => {
    if (locationIntervals.current[shipmentId]) {
      clearInterval(locationIntervals.current[shipmentId]);
      delete locationIntervals.current[shipmentId];
    }
    setSharingLocation((prev) => ({ ...prev, [shipmentId]: false }));
    showToast('Location sharing stopped', 'info');
  };

  // Cleanup all location intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(locationIntervals.current).forEach(clearInterval);
    };
  }, []);

  if (!currentUser) {
    return <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i></div>;
  }
  const markTripAsDelivered = async (tripId) => {
      console.log('Marking delivered trip ID:', tripId);
  if (!tripId) {
    alert("Trip ID is undefined. Cannot mark delivered.");
    return;
  }
  const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
  await fetch(`${API_URL}/trips/${tripId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: "completed" })
  });
  // Refetch trips so UI updates!
  loadDriverData();
};



  return (
    <>
      {/* ===== ADD TOAST CONTAINER HERE ===== */}
    {toasts.map(toast => (
      <Toast
        key={toast.id}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        onClose={() => removeToast(toast.id)}
      />
    ))}
    {/* ===== END TOAST CONTAINER ===== */}
      <header className="header">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>
        <div className="logo">
          <i className="fas fa-truck"></i>
          CargoMate
        </div>
        <div className="header-actions">
          <div className="user-info">
            <div className="user-avatar">{getInitials(currentUser.name)}</div>
            <div className="user-details">
              <h3>{currentUser.name}</h3>
              <p>Driver</p>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
          <button className="theme-toggle" onClick={toggleTheme}>
            <i className={`fas fa-${theme === 'dark' ? 'sun' : 'moon'}`}></i>
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          {['dashboard', 'invitations', 'my-trips', 'available-jobs', 'route-optimizer', 'vehicle-status', 'earnings', 'performance', 'settings', 'support'].map(section => (
            <a
              key={section}
              href="#"
              className={`nav-item ${activeSection === section ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); switchToSection(section); setSidebarOpen(false); }}
            >
              <i className={`fas fa-${
                section === 'dashboard' ? 'tachometer-alt' :
                section === 'invitations' ? 'envelope-open-text' :
                section === 'my-trips' ? 'route' :
                section === 'available-jobs' ? 'search' :
                section === 'route-optimizer' ? 'map-marked-alt' :
                section === 'vehicle-status' ? 'truck' :
                section === 'earnings' ? 'rupee-sign' :
                section === 'performance' ? 'chart-line' :
                section === 'settings' ? 'cog' : 'life-ring'
              }`}></i>
              {section === 'invitations' ? `Invitations (${invitations.length})` : section.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </a>
          ))}
        </nav>

        <main className="main-content">
          {activeSection === 'dashboard' && (
            <div className="section active">
              <div className="section-header">
                <h1>Driver Dashboard</h1>
                <div className="header-buttons">
                  <button 
                    className={`btn ${isOnline ? 'btn-warning' : 'btn-primary'}`}
                    onClick={toggleOnlineStatus}
                  >
                    <i className={`fas fa-${isOnline ? 'pause' : 'play'}`}></i>
                    {isOnline ? 'Go Offline' : 'Go Online'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => switchToSection('available-jobs')}>
                    <i className="fas fa-search"></i> Find Jobs
                  </button>
                </div>
              </div>

              <div className="stats-grid">
  {[
    { icon: 'route', color: 'green', value: dashboardStats.activeTrips, label: 'Active Trips' },
    { icon: 'check-circle', color: 'blue', value: dashboardStats.completedToday, label: 'Completed Today' },
    { icon: 'rupee-sign', color: 'purple', value: `₹${dashboardStats.todaysEarnings.toLocaleString()}`, label: "Today's Earnings" },
    { icon: 'star', color: 'orange', value: dashboardStats.rating, label: 'Rating' }
  ].map((stat, idx) => (

                  <div key={idx} className="stat-card">
                    <div className={`stat-icon ${stat.color}`}><i className={`fas fa-${stat.icon}`}></i></div>
                    <div className="stat-info">
                      <div className="stat-value">{stat.value}</div>
                      <div className="stat-label">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'available-jobs' && (
            <div className="section active">
              <div className="section-header">
                <h1>Available Jobs</h1>
                <button className="btn btn-secondary" onClick={loadAvailableJobs}>
                  <i className="fas fa-sync"></i> Refresh
                </button>
              </div>
              
              <div className="jobs-grid">
                {availableJobs.length > 0 ? (
                  availableJobs.map(job => (
                    <div key={job._id || job.id} className="job-card">
                      <div className="job-header">
                        <h3>#{job.shipment_id}</h3>
                        <span className="badge badge-warning">Open</span>
                      </div>
                      <div className="job-body">
                        <p><strong>Route:</strong> {job.from_location} → {job.to_location}</p>
                        {(job.pickup_pincode || job.delivery_pincode) && (
                          <div style={{ margin: '6px 0', fontSize: '11px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {job.pickup_pincode && <span className="badge badge-success">📍 Pickup Pin: {job.pickup_pincode}</span>}
                            {job.delivery_pincode && <span className="badge badge-primary">🎯 Drop Pin: {job.delivery_pincode}</span>}
                          </div>
                        )}
                        <p><strong>Package:</strong> {job.package_type} ({job.package_weight}kg)</p>
                        <p><strong>Pickup:</strong> {new Date(job.pickup_date).toLocaleDateString()}</p>
                      </div>
                      <div className="job-footer">
                        <button className="btn btn-primary" onClick={() => openBidModal(job)}>
                          <i className="fas fa-gavel"></i> Place Bid
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <i className="fas fa-search"></i>
                    <h3>No Jobs Available</h3>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'invitations' && (
            <div className="section active">
              <div className="section-header">
                <h1>Direct Job Invitations</h1>
                <button className="btn btn-secondary" onClick={loadDriverData}>
                  <i className="fas fa-sync"></i> Refresh
                </button>
              </div>

              <div className="jobs-grid">
                {invitations.length > 0 ? (
                  invitations.map(inv => (
                    <div key={inv.id} className="job-card" style={{ borderLeft: '4px solid #6366f1' }}>
                      <div className="job-header">
                        <h3>#{inv.shipment_id}</h3>
                        <span className="badge badge-primary">Direct Invitation</span>
                      </div>
                      <div className="job-body">
                        {inv.shipment ? (
                          <>
                            <p><strong>Route:</strong> {inv.shipment.from_location} → {inv.shipment.to_location}</p>
                            <p><strong>Package:</strong> {inv.shipment.package_type} ({inv.shipment.package_weight}kg)</p>
                            <p><strong>Required Vehicle:</strong> {inv.shipment.vehicle_type?.replace(/_/g, ' ')}</p>
                            <p><strong>Shipper:</strong> {inv.shipment.shipper_name} ({inv.shipment.shipper_phone})</p>
                          </>
                        ) : (
                          <p>Shipment details loading...</p>
                        )}
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                          Invited on: {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'Recently'}
                        </p>
                      </div>
                      <div className="job-footer">
                        {inv.shipment && (
                          <button className="btn btn-primary" onClick={() => openBidModal(inv.shipment)}>
                            <i className="fas fa-gavel"></i> Place Bid for Invited Job
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <i className="fas fa-envelope-open-text" style={{ fontSize: '48px', color: '#64748b', marginBottom: '12px' }}></i>
                    <h3>No Direct Invitations Yet</h3>
                    <p style={{ color: '#94a3b8' }}>When shippers select you from AI Driver Recommendations, their direct job requests will appear here!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'my-trips' && (
  <div className="section active">
    <div className="section-header">
      <h1>My Trips</h1>
      <button className="btn btn-secondary" onClick={loadDriverData}>
        <i className="fas fa-sync"></i> Refresh
      </button>
    </div>
    <div className="content-card">
       
      {myTrips.length > 0 ? (
        <div className="trips-grid">
          {myTrips.map(trip => (
            
            <div key={trip._id || trip.id} className="trip-card">
              <div className="trip-header">
                <h3 style={{ color: '#4CAF50' }}>#{trip.shipment_id}</h3>
                {getStatusBadge(trip.status)}
              </div>
              
              <div className="trip-details">
                <div className="trip-detail-row">
                  <span className="trip-label">🚚 Route:</span>
                  <span className="trip-value">
                    {trip.from_location} → {trip.to_location}
                  </span>
                </div>
                
                <div className="trip-detail-row">
                  <span className="trip-label">📦 Package:</span>
                  <span className="trip-value">
                    {trip.package_type} ({trip.package_weight}kg)
                  </span>
                </div>
                
                <div className="trip-detail-row">
                  <span className="trip-label">👤 Shipper:</span>
                  <span className="trip-value">{trip.shipper_name || 'Unknown'}</span>
                </div>
                
                <div className="trip-detail-row">
                  <span className="trip-label">💰 Bid Amount:</span>
                  <span className="trip-value">₹{trip.bid_amount}</span>
                </div>
                
                <div className="trip-detail-row">
                  <span className="trip-label">📅 Pickup Date:</span>
                  <span className="trip-value">
                    {trip.pickup_date ? new Date(trip.pickup_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '15px' }}
                onClick={() => {
                  console.log('Opening chat for trip:', trip.shipment_id);
                  setTripChatModal({
                    open: true,
                    trip: trip
                  });
                }}
              >
                <i className="fas fa-comments"></i> Chat with Shipper
              </button>

              {/* Share Location Button */}
              {trip.status === 'active' && (
                <button
                  className={`share-location-btn ${sharingLocation[trip.shipment_id] ? 'sharing' : 'idle'}`}
                  onClick={() =>
                    sharingLocation[trip.shipment_id]
                      ? stopShareLocation(trip.shipment_id)
                      : startShareLocation(trip.shipment_id)
                  }
                >
                  <i className={`fas fa-${sharingLocation[trip.shipment_id] ? 'stop-circle' : 'satellite-dish'}`}></i>
                  {sharingLocation[trip.shipment_id] ? 'Stop Sharing Location' : 'Share Live Location'}
                </button>
              )}
              {sharingLocation[trip.shipment_id] && (
                <div className="location-status-indicator">
                  <div className="dot"></div>
                  Sharing location every 10s
                </div>
              )}

              {/* Proof of Delivery Buttons */}
              {(trip.status === "active" || trip.status === "in_transit") && (
                <button
                  className="btn btn-success"
                  style={{ width: "100%", marginTop: 8 }}
                  onClick={() => setPodModal({ open: true, trip, mode: 'submit' })}
                >
                  <i className="fas fa-camera"></i> 📸 Submit Proof of Delivery
                </button>
              )}
              {(trip.status === "completed" || trip.status === "delivered") && (
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%", marginTop: 8, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                  onClick={() => setPodModal({ open: true, trip, mode: 'view' })}
                >
                  <i className="fas fa-file-invoice"></i> 📄 View Proof of Delivery
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-inbox"></i>
          <h3>No Accepted Trips Yet</h3>
          <p>Accept bids to see your trips here</p>
        </div>
      )}
    </div>
  </div>
)}

{/* Route Optimizer Section */}
{activeSection === 'route-optimizer' && (
  <div className="section active">
    <RouteOptimizer currentUser={currentUser} />
  </div>
)}

{/* Earnings Section - Now Separate */}
{activeSection === 'earnings' && (
  <DriverEarnings currentUser={currentUser} />
)}

{/* Performance Section - Now with Component */}
{activeSection === 'performance' && (
  <DriverPerformance currentUser={currentUser} />
)}

{/* Settings Section */}
{activeSection === 'settings' && (
  <DriverSettings currentUser={currentUser} />
)}

{/* Support Section */}
{activeSection === 'support' && (
  <DriverSupport />
)}

{/* Vehicle Status Section */}
{activeSection === 'vehicle-status' && (
  <VehicleStatus currentUser={currentUser} />
)}



        </main>
      </div>

      {/* FIXED MODAL WITH INLINE STYLES */}
      {showBidModal && selectedJob && (
        <div 
          onClick={closeBidModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(5px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="modal-content bid-modal-card"
            style={{
              borderRadius: '16px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
              zIndex: 100000
            }}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Submit Your Bid</h3>
              <button 
                onClick={closeBidModal}
                className="close-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >✕</button>
            </div>

            <div className="modal-body" style={{ padding: '24px' }}>
              <div className="shipment-info-box" style={{
                marginBottom: '24px',
                padding: '16px',
                borderRadius: '8px',
              }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#22c55e' }}>#{selectedJob.shipment_id}</h4>
                <p style={{ margin: '4px 0' }}>
                  <strong>Route:</strong> {selectedJob.from_location} → {selectedJob.to_location}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>Package:</strong> {selectedJob.package_type} ({selectedJob.package_weight}kg)
                </p>
              </div>

              <form onSubmit={handleSubmitBid}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600'
                  }}>
                    Your Bid Amount (₹) *
                  </label>
                  <input
                    type="number"
                    placeholder="Enter your bid amount"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    required
                    min="100"
                    step="10"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      outline: 'none'
                    }}
                  />
                  <small style={{ fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                    Enter a competitive amount to increase your chances
                  </small>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600'
                  }}>
                    Message to Customer (Optional)
                  </label>
                  <textarea
                    rows="3"
                    placeholder="Tell them why they should choose you..."
                    value={bidMessage}
                    onChange={(e) => setBidMessage(e.target.value)}
                    className="form-textarea"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                  ></textarea>
                </div>

                <div style={{
                  padding: '20px 0 0 0',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}>
                  <button 
                    type="button" 
                    onClick={closeBidModal}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
                    <i className="fas fa-paper-plane"></i> Submit Bid
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Trip Chat Modal */}
{tripChatModal.open && tripChatModal.trip && (
  <div 
    onClick={() => setTripChatModal({ open: false, trip: null })}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      backdropFilter: 'blur(5px)'
    }}
  >
    <TripChatModal
      trip={tripChatModal.trip}
      driver={currentUser}
      onClose={() => setTripChatModal({ open: false, trip: null })}
    />
  </div>
)}

      {/* Proof of Delivery Modal */}
      {podModal.open && (
        <ProofOfDeliveryModal
          trip={podModal.trip}
          mode={podModal.mode}
          onClose={() => setPodModal({ open: false, trip: null, mode: 'submit' })}
          onSuccess={() => loadDriverData()}
        />
      )}

      {/* Mobile Bottom Navigation Tab Bar */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`bottom-nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
          onClick={() => switchToSection('dashboard')}
        >
          <i className="fas fa-tachometer-alt"></i>
          <span>Home</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeSection === 'available-jobs' ? 'active' : ''}`}
          onClick={() => switchToSection('available-jobs')}
        >
          <i className="fas fa-search"></i>
          <span>Jobs</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeSection === 'my-trips' ? 'active' : ''}`}
          onClick={() => switchToSection('my-trips')}
        >
          <i className="fas fa-route"></i>
          <span>Trips</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeSection === 'route-optimizer' ? 'active' : ''}`}
          onClick={() => switchToSection('route-optimizer')}
        >
          <i className="fas fa-map-marked-alt"></i>
          <span>Routes</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeSection === 'earnings' ? 'active' : ''}`}
          onClick={() => switchToSection('earnings')}
        >
          <i className="fas fa-rupee-sign"></i>
          <span>Earnings</span>
        </button>
      </nav>
    </>
  );
}

export default DriverDashboard;