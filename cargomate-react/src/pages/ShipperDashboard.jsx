import TrackingModal from '../components/TrackingModal';
import LiveTrackingMap from '../components/LiveTrackingMap';
import DriverRecommendations from '../components/DriverRecommendations';
import ProofOfDeliveryModal from '../components/ProofOfDeliveryModal';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import RatingModal from '../components/RatingModal';
import Billing from '../components/Billing';
import Settings from '../components/Settings';
import Support from '../components/Support';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

import '../styles/shipper-dashboard.css';


function ShipperDashboard() {
  const navigate = useNavigate();
const { toasts, showToast, removeToast } = useToast();  // ADD
  
  // Core state
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [userShipments, setUserShipments] = useState([]);
  const [filteredShipments, setFilteredShipments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal states
  const [modalState, setModalState] = useState({
    bidsModal: false,
    tripDetailModal: false,
    chatModal: false,
    ratingModal: false,
    selectedShipment: null,
    currentBids: []
  });

  const [ratingModal, setRatingModal] = useState({ show: false, shipment: null });


  // Form state
  const [shipmentForm, setShipmentForm] = useState({
    fromLocation: '',
    toLocation: '',
    packageType: '',
    packageWeight: '',
    packageDescription: '',
    vehicleType: '',
    pickupDate: '',
    deliveryDate: '',
    handlingInstructions: ''
  });

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  // Rating state
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  // Stats
  const [stats, setStats] = useState({
    activeShipments: 0,
    pendingBids: 0,
    totalDelivered: 0,
    totalSpent: 0
  });
  const [trackingModal, setTrackingModal] = useState({
  open: false,
  shipment: null,
  driver: null
});

  // AI Recommendations panel state
  const [recModal, setRecModal] = useState({ open: false, shipment: null });

  // Proof of Delivery modal state
  const [podModal, setPodModal] = useState({ open: false, shipment: null, mode: 'verify' });


  // Authentication
  useEffect(() => {
    checkAuthentication();
  }, []);

  // Initialize after auth
  // Initialize after auth
useEffect(() => {
  if (currentUser) {
    initializeDashboard();
    loadUserData();
    
    // ✅ DISABLE auto-refresh when tracking modal is open
    if (!trackingModal.open) {
      // Real-time updates
      const updateInterval = setInterval(checkForUpdates, 2000);
      const refreshInterval = setInterval(refreshData, 60000);
      
      return () => {
        clearInterval(updateInterval);
        clearInterval(refreshInterval);
      };
    }
  }
}, [currentUser, trackingModal.open]); // ✅ ADD trackingModal.open as dependency


  // Update stats when shipments change
 // Add this DEBUG useEffect
useEffect(() => {
  console.log('🔍 Modal state changed:', {
    bidsModal: modalState.bidsModal,
    hasBids: modalState.currentBids?.length || 0
  });
}, [modalState.bidsModal, modalState.currentBids]);


  // Save shipments to localStorage
  useEffect(() => {
    if (currentUser && userShipments.length >= 0) {
      saveDemoShipments();
    }
  }, [userShipments, currentUser]);
  // ✅ ADD THE NEW useEffect HERE:
useEffect(() => {
  if (userShipments && userShipments.length > 0) {
    console.log('Calculating stats for shipments:', userShipments);
    
    const activeShipments = userShipments.filter(s => s.status === 'active' || s.status === 'intransit').length;
    const pendingBids = userShipments.filter(s => s.status === 'pendingbids').length;
    const totalDelivered = userShipments.filter(s => s.status === 'delivered' || s.status === 'completed').length;
    
    // FIX: Calculate total spent from paid/completed shipments
    const totalSpent = userShipments
      .filter(s => (s.status === 'completed' || s.status === 'delivered') && s.payment_status === 'paid')
      .reduce((sum, s) => sum + (s.final_amount || s.finalamount || 0), 0);
    
    console.log('Active:', activeShipments);
    console.log('Pending Bids:', pendingBids);
    console.log('Delivered:', totalDelivered);
    console.log('Total Spent:', totalSpent);  // Add this log
    
    setStats({
      activeShipments: activeShipments,
      pendingBids: pendingBids,
      totalDelivered: totalDelivered,
      totalSpent: totalSpent  // ← FIXED!
    });
  }
}, [userShipments]);


  const checkAuthentication = () => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const userData = sessionStorage.getItem('userData') || localStorage.getItem('userData');
    
    if (!token || !userData) {
      console.log('❌ No authentication found');
      navigate('/login');
      return;
    }
    
    try {
      const user = JSON.parse(userData);
      
      if (user.role !== 'shipper') {
        console.log('❌ User is not a shipper');
        navigate('/driver-dashboard');
        return;
      }
      
      setCurrentUser(user);
      console.log('✅ Shipper authenticated:', user.name, 'ID:', user.id);
    } catch (error) {
      console.error('❌ Error parsing user data:', error);
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
    
    // Set minimum pickup date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    
    setShipmentForm(prev => ({ ...prev, pickupDate: minDate }));
  };

  const loadUserData = async () => {
    if (!currentUser) return;
    
    try {
     console.log('🔄 Loading user shipments for:', currentUser.name, 'ID:', currentUser.id);
      
      let shipments = getDemoShipments();
      
      try {
        const response = await fetch(`http://localhost:3000/api/shipments/user/${currentUser.id}`, {
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}` }
        }).catch(() => null);
        
        if (response && response.ok) {
          const data = await response.json();
          shipments = data.shipments || [];
           console.log('✅ Loaded from server:', shipments.length, 'shipments');
        }
      } catch (error) {
        console.log('🔄 Using demo mode');
      }
      
      setUserShipments(shipments);
      setFilteredShipments(shipments);
      
    } catch (error) {
      console.error('❌ Error loading shipments:', error);
      setUserShipments([]);
      setFilteredShipments([]);
    }
  };

  const getDemoShipments = () => {
    const existingDemo = localStorage.getItem(`demoShipments_${currentUser.id}`);
    return existingDemo ? JSON.parse(existingDemo) : [];
  };

  const saveDemoShipments = () => {
    if (!currentUser) return;
    localStorage.setItem(`demoShipments_${currentUser.id}`, JSON.stringify(userShipments));
    console.log('💾 Saved shipments for user:', currentUser.id, 'Count:', userShipments.length);
  };

  const updateDashboardStats = () => {
    const activeShipments = userShipments.filter(s => 
      s.status === 'active' || s.status === 'in_transit' || s.status === 'at_destination'
    ).length;
    
    const pendingBids = userShipments.filter(s => s.status === 'pending_bids').length;
    
    const totalDelivered = userShipments.filter(s => 
      s.status === 'delivered' || s.status === 'completed'
    ).length;
    
    const totalSpent = userShipments
      .filter(s => s.status === 'delivered' || s.status === 'completed')
      .reduce((sum, s) => sum + (s.final_amount || 0), 0);
    
    setStats({
      activeShipments,
      pendingBids,
      totalDelivered,
      totalSpent
    });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.body.className = `${newTheme}-theme`;
    localStorage.setItem('theme', newTheme);
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
    
    if (section === 'my-shipments') {
      setFilteredShipments(userShipments);
    }
  };

  const refreshData = () => {
    loadUserData();
    console.log('🔄 Data refreshed');
  };

  const checkForUpdates = () => {
    // Check for bid updates from localStorage
    if (!currentUser) return;
    
    const storedShipments = getDemoShipments();
    if (JSON.stringify(storedShipments) !== JSON.stringify(userShipments)) {
      setUserShipments(storedShipments);
      console.log('🔔 Shipment updates detected');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShipmentForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!shipmentForm.fromLocation || !shipmentForm.toLocation || 
        !shipmentForm.packageType || !shipmentForm.packageWeight) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    
    const newShipment = {
      id: Date.now(),
      shipment_id: Date.now(),
      shipper_id: currentUser.id,
      shipper_name: currentUser.name,
      shipper_email: currentUser.email,
      shipper_phone: currentUser.phone,
      from_location: shipmentForm.fromLocation,
      to_location: shipmentForm.toLocation,
      package_type: shipmentForm.packageType,
      package_weight: parseFloat(shipmentForm.packageWeight),
      package_description: shipmentForm.packageDescription,
      vehicle_type: shipmentForm.vehicleType,
      pickup_date: shipmentForm.pickupDate,
      delivery_date: shipmentForm.deliveryDate,
      handling_instructions: shipmentForm.handlingInstructions,
      status: 'pending_bids',
      bids_count: 0,
      created_at: new Date().toISOString()
    };
    
    try {
      const response = await fetch('http://localhost:3000/api/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(newShipment)
      }).catch(() => null);
      
      if (response && response.ok) {
       console.log('✅ Shipment created on server');
      }
    } catch (error) {
      console.log('🎭 Saving shipment locally');
    }
    
    setUserShipments(prev => [...prev, newShipment]);
    
    // Reset form
    setShipmentForm({
      fromLocation: '',
      toLocation: '',
      packageType: '',
      packageWeight: '',
      packageDescription: '',
      vehicleType: '',
      pickupDate: '',
      deliveryDate: '',
      handlingInstructions: ''
    });
    
    showToast(' Shipment created successfully!', 'success');
    switchToSection('my-shipments');
  };
const viewBids = async (shipment) => {
  try {
    console.log('📋 Loading bids for shipment:', shipment.shipment_id);
    
    const response = await fetch(
      `http://localhost:3000/api/shipments/${shipment.shipment_id}/bids`,
      {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch bids');
    }

    const data = await response.json();
    console.log('✅ Fetched bids:', data.bids);
    console.log('🔍 First bid structure:', data.bids[0]); // ADD THIS LINE
    
    
    const sortedBids = (data.bids || []).sort((a, b) => a.bidamount - b.bidamount);

    // FIX: Use functional setState
    setModalState(prevState => ({
      ...prevState,
      bidsModal: true,
      selectedShipment: shipment,
      currentBids: sortedBids
    }));

     console.log('✅ Modal should open with', sortedBids.length, 'bids');


  } catch (error) {
    console.error('❌ Error loading bids:', error);
    showToast('Failed to load bids. Please try again.', 'error');
  }
};

const acceptBid = async (bid) => {
   console.log('🔍 Accept bid called with:', bid); // Debug log
  
  // Defensive checks
  if (!bid) {
    showToast('Error: Bid data is missing', 'error');
    return;
  }
  
  const bidAmount = bid.bid_amount || bid.bidamount || 0;
  const driverName = bid.driver_id?.name || bid.drivername || 'this driver';
  const bidId = bid.bid_id || bid.bidid || bid._id;
  
  if (!bidId) {
    showToast('Error: Cannot identify bid', 'error');
    return;
  }
  
  const confirmed = window.confirm(
   `Accept bid of ₹${bidAmount.toLocaleString()} from ${driverName}?`
  );
  
  if (!confirmed) return;

  try {
    const response = await fetch(
      `http://localhost:3000/api/bids/${bidId}/accept`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
       shipment_id: modalState.selectedShipment?.shipment_id

        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to accept bid');
    }

    showToast('Bid accepted successfully!', 'success');
    
    // Close modal
    setModalState(prev => ({ ...prev, bidsModal: false }));
    
    // Reload the page to refresh all data
    setTimeout(() => {
      window.location.reload();
    }, 500);
    
  } catch (error) {
    console.error('❌ Error accepting bid:', error);
    showToast(`Failed to accept bid: ${error.message}`, 'error');
  }
};



  const filterShipmentsByStatus = (status) => {
    setStatusFilter(status);
    
    if (status === '') {
      setFilteredShipments(userShipments);
    } else {
      setFilteredShipments(userShipments.filter(s => s.status === status));
    }
  };

  const openRatingModal = (shipment) => {
    setRatingModal({ show: true, shipment });
  };

const handleRatingSuccess = () => {
  loadUserData();
};


  const submitRating = () => {
    if (rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }
    
    const updatedShipments = userShipments.map(s => 
      s.id === modalState.selectedShipment.id
        ? { ...s, driver_rating: rating, rating_comment: ratingComment, status: 'completed' }
        : s
    );
    
    setUserShipments(updatedShipments);
    
    // Update driver's trip with rating
    const driverId = modalState.selectedShipment.selected_driver_id;
    const driverTripsKey = `driverTrips_${driverId}`;
    const driverTrips = JSON.parse(localStorage.getItem(driverTripsKey) || '[]');
    const updatedTrips = driverTrips.map(t => 
      t.shipment_id === modalState.selectedShipment.id
        ? { ...t, rating, rating_comment: ratingComment, status: 'completed' }
        : t
    );
    localStorage.setItem(driverTripsKey, JSON.stringify(updatedTrips));
    
    setModalState({ ...modalState, ratingModal: false });
    showToast('✅ Thank you for your feedback!', 'success');
    refreshData();
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending_bids: <span className="badge badge-warning">Pending Bids</span>,
      active: <span className="badge badge-info">Active</span>,
      in_transit: <span className="badge badge-primary">In Transit</span>,
      at_destination: <span className="badge badge-primary">At Destination</span>,
      delivered: <span className="badge badge-success">Delivered</span>,
      completed: <span className="badge badge-success">Completed</span>,
      cancelled: <span className="badge badge-error">Cancelled</span>
    };
    return badges[status] || <span className="badge">{status}</span>;
  };

  const getVehicleTypeText = (type) => {
    const types = {
      small_truck: 'Small Truck',
      medium_truck: 'Medium Truck',
      large_truck: 'Large Truck',
      trailer: 'Trailer',
      pickup: 'Pickup Truck',
      van: 'Van'
    };
    return types[type] || type;
  };

  if (!currentUser) {
    return <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i></div>;
  }

  return (
    <>
      {/* TOAST CONTAINER */}
      {toasts.map(toast => (
        <Toast key={toast.id} message={toast.message} type={toast.type} 
               duration={toast.duration} onClose={() => removeToast(toast.id)} />
      ))}
      {/* Header */}
      <header className="header">
        <div className="logo">
          <i className="fas fa-truck"></i>
          CargoMate
        </div>
        <div className="header-actions">
          <div className="user-info">
            <div className="user-avatar">{getInitials(currentUser.name)}</div>
            <div className="user-details">
              <h3>{currentUser.name}</h3>
              <p>Shipper</p>
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

      {/* Dashboard Layout */}
      <div className="dashboard-layout">
        {/* Sidebar */}
        <nav className="sidebar">
          {[
            { key: 'dashboard', icon: 'tachometer-alt', label: 'Dashboard' },
            { key: 'create-shipment', icon: 'plus-circle', label: 'Create Shipment' },
            { key: 'my-shipments', icon: 'boxes', label: 'My Shipments' },
            { key: 'track-vehicles', icon: 'truck', label: 'Track Vehicles' },
            { key: 'billing', icon: 'file-invoice-dollar', label: 'Billing' },
            { key: 'reports', icon: 'chart-bar', label: 'Reports' },
            { key: 'settings', icon: 'cog', label: 'Settings' },
            { key: 'support', icon: 'life-ring', label: 'Support' }
          ].map(nav => (
            <a
              key={nav.key}
              href="#"
              className={`nav-item ${activeSection === nav.key ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); switchToSection(nav.key); }}
            >
              <i className={`fas fa-${nav.icon}`}></i>
              {nav.label}
            </a>
          ))}
        </nav>

        {/* Main Content */}
        <main className="main-content">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div className="section active">
              <div className="section-header">
                <h1>Shipper Dashboard</h1>
                <div className="header-buttons">
                  <button className="btn btn-primary" onClick={() => switchToSection('create-shipment')}>
                    <i className="fas fa-plus"></i>
                    New Shipment
                  </button>
                  <button className="btn btn-secondary">
                    <i className="fas fa-download"></i>
                    Export Data
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon green">
                    <i className="fas fa-shipping-fast"></i>
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.activeShipments}</div>
                    <div className="stat-label">Active Shipments</div>
                    <div className="stat-change">
                      {stats.activeShipments > 0 ? `${stats.activeShipments} in progress` : 'Create your first shipment'}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.pendingBids}</div>
                    <div className="stat-label">Pending Bids</div>
                    <div className="stat-change">
                      {stats.pendingBids > 0 ? `${stats.pendingBids} awaiting driver selection` : 'No pending bids'}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon blue">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.totalDelivered}</div>
                    <div className="stat-label">Total Delivered</div>
                    <div className="stat-change">
                      {stats.totalDelivered > 0 ? `${stats.totalDelivered} completed` : 'No deliveries yet'}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon purple">
                    <i className="fas fa-rupee-sign"></i>
                  </div>
                  <div className="stat-info">
                   <div className="stat-value">₹{stats.totalSpent.toLocaleString()}</div>
                    <div className="stat-label">Total Spent</div>
                    <div className="stat-change">
                      {stats.totalSpent > 0 ? 'Total logistics cost' : 'Complete shipments to see total'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Shipments */}
              <div className="content-card">
                <div className="card-header">
                  <h2>Recent Shipments</h2>
                  <button className="btn btn-link" onClick={refreshData}>Refresh</button>
                </div>
                <div className="table-container">
                  {userShipments.length > 0 ? (
                    <table className="shipments-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Route</th>
                          <th>Package</th>
                          <th>Status</th>
                          <th>Bids</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userShipments.slice(0, 5).map(shipment => (
                          <tr key={shipment.id}>
  <td>#{shipment.shipment_id}</td>
  <td>{shipment.from_location} → {shipment.to_location}</td>
  <td>{shipment.package_type} ({shipment.package_weight}kg)</td>
  <td>{getStatusBadge(shipment.status)}</td>
  <td>{shipment.bids_count || 0}</td>
  <td className="actions-cell">
    {shipment.status === 'pending_bids' && (
      <>
        <button className="btn btn-sm btn-primary" onClick={() => viewBids(shipment)}>
          View Bids
        </button>
        <button
          className="btn btn-sm"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}
          onClick={() => setRecModal({ open: true, shipment })}
          title="AI-powered driver scoring"
        >
          🤖 AI Recommend
        </button>
      </>
    )}
    {shipment.status === 'active' && (
      <button 
        className="btn-track"
        onClick={() => {
          setTrackingModal({
            open: true,
            shipment: shipment,
            driver: shipment.selected_driver_id
          });
        }}
      >
         Track & Chat
      </button>
    )}
    {shipment.status === 'delivered' && (
      <>
        <button
          className="btn btn-sm btn-success"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', fontWeight: 600, padding: '5px 12px', borderRadius: '6px' }}
          onClick={() => setPodModal({ open: true, shipment, mode: 'verify' })}
        >
          ✍️ Verify & Sign POD
        </button>
        {!shipment.driver_rating && (
          <button className="btn btn-sm btn-outline" style={{ marginTop: 4 }} onClick={() => openRatingModal(shipment)}>
            Rate Driver
          </button>
        )}
      </>
    )}
    {shipment.status === 'completed' && (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          className="btn btn-sm"
          style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', fontSize: 12 }}
          onClick={() => setPodModal({ open: true, shipment, mode: 'view' })}
        >
          📄 View Proof
        </button>
        {!shipment.driver_rating && (
          <button className="btn btn-sm btn-success" onClick={() => openRatingModal(shipment)}>
            Rate Driver
          </button>
        )}
      </div>
    )}
  </td>
</tr>

                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      <i className="fas fa-box-open"></i>
                      <h3>No Shipments Yet</h3>
                      <p>Create your first shipment to get started</p>
                      <button className="btn btn-primary" onClick={() => switchToSection('create-shipment')}>
                        Create Shipment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create Shipment Section */}
          {activeSection === 'create-shipment' && (
            <div className="section active">
              <div className="section-header">
                <h1>Create New Shipment</h1>
                <p>Fill in the details for your cargo shipment</p>
              </div>

              <div className="content-card">
                <form onSubmit={handleCreateShipment} className="shipment-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="fromLocation">From Location *</label>
                      <input
                        type="text"
                        id="fromLocation"
                        name="fromLocation"
                        className="form-input"
                        placeholder="Enter pickup location"
                        value={shipmentForm.fromLocation}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="toLocation">To Location *</label>
                      <input
                        type="text"
                        id="toLocation"
                        name="toLocation"
                        className="form-input"
                        placeholder="Enter destination"
                        value={shipmentForm.toLocation}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="packageType">Package Type *</label>
                      <select
                        id="packageType"
                        name="packageType"
                        className="form-input"
                        value={shipmentForm.packageType}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select package type</option>
                        <option value="electronics">Electronics</option>
                        <option value="furniture">Furniture</option>
                        <option value="clothing">Clothing</option>
                        <option value="food items">Food Items</option>
                        <option value="books/documents">Books/Documents</option>
                        <option value="machinery">Machinery</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="packageWeight">Weight (kg) *</label>
                      <input
                        type="number"
                        id="packageWeight"
                        name="packageWeight"
                        className="form-input"
                        placeholder="Enter weight"
                        value={shipmentForm.packageWeight}
                        onChange={handleInputChange}
                        required
                        min="0.1"
                        step="0.1"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="packageDescription">Package Description *</label>
                    <textarea
                      id="packageDescription"
                      name="packageDescription"
                      className="form-textarea"
                      placeholder="Describe your package in detail"
                      rows="3"
                      value={shipmentForm.packageDescription}
                      onChange={handleInputChange}
                      required
                    ></textarea>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="vehicleType">Preferred Vehicle *</label>
                      <select
                        id="vehicleType"
                        name="vehicleType"
                        className="form-input"
                        value={shipmentForm.vehicleType}
                        onChange={handleInputChange}
                        required
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
                    <div className="form-group">
                      <label htmlFor="pickupDate">Pickup Date *</label>
                      <input
                        type="date"
                        id="pickupDate"
                        name="pickupDate"
                        className="form-input"
                        value={shipmentForm.pickupDate}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="handlingInstructions">Special Handling Instructions</label>
                    <textarea
                      id="handlingInstructions"
                      name="handlingInstructions"
                      className="form-textarea"
                      placeholder="Any special requirements or handling instructions"
                      rows="2"
                      value={shipmentForm.handlingInstructions}
                      onChange={handleInputChange}
                    ></textarea>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => switchToSection('dashboard')}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <i className="fas fa-check"></i>
                      Create Shipment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* My Shipments Section */}
          {activeSection === 'my-shipments' && (
            <div className="section active">
              <div className="section-header">
                <h1>My Shipments</h1>
                <p>Manage all your shipments and track their progress</p>
              </div>

              <div className="content-card">
                <div className="card-header">
                  <h2>All Shipments</h2>
                  <select 
                    className="filter-select" 
                    value={statusFilter}
                    onChange={(e) => filterShipmentsByStatus(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="pending_bids">Pending Bids</option>
                    <option value="active">Active</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {filteredShipments.length > 0 ? (
                  <div className="shipments-grid">
                    {filteredShipments.map(shipment => (
                      <div key={shipment.id} className="shipment-card">
                        <div className="shipment-header">
                          <h3>#{shipment.shipment_id}</h3>
                          {getStatusBadge(shipment.status)}
                        </div>
                        <div className="shipment-body">
                          <p><strong>Route:</strong> {shipment.from_location} → {shipment.to_location}</p>
                          <p><strong>Package:</strong> {shipment.package_type} ({shipment.package_weight}kg)</p>
                          <p><strong>Vehicle:</strong> {getVehicleTypeText(shipment.vehicle_type)}</p>
                          <p><strong>Pickup:</strong> {new Date(shipment.pickup_date).toLocaleDateString()}</p>
                          {shipment.bids_count > 0 && (
                            <p><strong>Bids:</strong> {shipment.bids_count} received</p>
                          )}
                          {shipment.selected_driver_name && (
                            <p><strong>Driver:</strong> {shipment.selected_driver_name}</p>
                          )}
                          {shipment.final_amount && (
                             <p><strong>Amount:</strong> ₹{shipment.final_amount.toLocaleString()}</p>
                          )}
                          {shipment.driver_rating && (
                            <p><strong>Rating:</strong> {'⭐'.repeat(shipment.driver_rating)} ({shipment.driver_rating}/5)</p>
                          )}
                        </div>
                        <div className="shipment-footer">
                          {shipment.status === 'pending_bids' && (
                            <button className="btn btn-primary" onClick={() => viewBids(shipment)}>
                              <i className="fas fa-eye"></i>
                              View Bids
                            </button>
                          )}
                         {shipment.status === 'completed' && !shipment.driver_rating && (
  <button className="btn btn-warning" onClick={() => openRatingModal(shipment)}>
    <i className="fas fa-star"></i>
    Rate Driver
  </button>
)}

                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <i className="fas fa-box-open"></i>
                    <h3>No Shipments Found</h3>
                    <p>Create your first shipment to see it here</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Billing Section */}
{activeSection === 'billing' && (
  <Billing currentUser={currentUser} />
)}

{/* Settings Section */}
{activeSection === 'settings' && (
  <Settings currentUser={currentUser} />
)}

{/* Support Section */}
{activeSection === 'support' && (
  <Support />
)}

{/* ── Track Vehicles Section ─────────────────────────────────────── */}
{activeSection === 'track-vehicles' && (
  <div className="section active">
    <div className="section-header">
      <h1>Track Vehicles</h1>
      <button className="btn btn-secondary" onClick={loadUserData}>
        <i className="fas fa-sync"></i> Refresh
      </button>
    </div>

    {(() => {
      const activeShipments = userShipments.filter(s => s.status === 'active' || s.status === 'in_transit');

      if (activeShipments.length === 0) {
        return (
          <div className="content-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <i className="fas fa-truck" style={{ fontSize: 56, color: '#64748b', marginBottom: 16 }}></i>
            <h3 style={{ color: '#e2e8f0', marginBottom: 8 }}>No Active Shipments</h3>
            <p style={{ color: '#94a3b8' }}>Once a driver accepts your shipment and starts delivering, live tracking will appear here.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => switchToSection('create-shipment')}>
              <i className="fas fa-plus"></i> Create Shipment
            </button>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary strip */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="content-card" style={{ flex: '1 1 180px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚛</div>
              <div><div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>{activeShipments.length}</div><div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Active Vehicles</div></div>
            </div>
            <div className="content-card" style={{ flex: '1 1 180px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📍</div>
              <div><div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>{activeShipments.filter(s => s.status === 'in_transit').length || activeShipments.length}</div><div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>In Transit</div></div>
            </div>
            <div className="content-card" style={{ flex: '1 1 180px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💬</div>
              <div><div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>Live</div><div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Chat Enabled</div></div>
            </div>
          </div>

          {/* Vehicle cards */}
          {activeShipments.map((shipment) => (
            <div key={shipment.shipment_id} className="content-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(34,197,94,0.2)' }}>
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(22,163,74,0.06))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🚛</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 15 }}>#{shipment.shipment_id}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{shipment.from_location} → {shipment.to_location}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#22c55e', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block' }}></span>
                    LIVE
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: 12, padding: '6px 14px' }}
                    onClick={() => setTrackingModal({ open: true, shipment, driver: shipment.selected_driver_id })}
                  >
                    <i className="fas fa-expand"></i> Full View
                  </button>
                </div>
              </div>

              {/* Card body: shipment info + map + mini chat */}
              <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 300px', gap: 0, minHeight: 340 }}>
                {/* Left: shipment details */}
                <div style={{ padding: '16px 20px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Shipment Info</div>
                  {[
                    { label: 'Package', value: `${shipment.package_type} (${shipment.package_weight}kg)` },
                    { label: 'Vehicle', value: (shipment.vehicle_type || '').replace(/_/g, ' ') },
                    { label: 'Pickup', value: shipment.pickup_date ? new Date(shipment.pickup_date).toLocaleDateString() : '—' },
                    { label: 'Status', value: shipment.status?.toUpperCase() },
                    { label: 'Driver', value: shipment.driver_name || shipment.selected_driver_name || (typeof shipment.driver === 'object' && shipment.driver?.name) || 'Assigned' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>{item.label}</span>
                      <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, textAlign: 'right', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                    <button
                      className="btn btn-sm"
                      style={{ width: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setTrackingModal({ open: true, shipment, driver: shipment.selected_driver_id })}
                    >
                      📍 Track & Chat Full Screen
                    </button>
                  </div>
                </div>

                {/* Center: live map */}
                <div style={{ position: 'relative', minHeight: 340 }}>
                  <LiveTrackingMap shipment={shipment} />
                  <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', color: '#22c55e', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                    📍 Live GPS Feed
                  </div>
                </div>

                {/* Right: mini chat */}
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#22c55e', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    💬 Quick Chat
                  </div>
                  <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#64748b', textAlign: 'center', fontSize: 13 }}>
                    <i className="fas fa-comments" style={{ fontSize: 32, marginBottom: 10, color: '#475569' }}></i>
                    <p style={{ margin: '0 0 12px 0' }}>Open full view for live chat with driver</p>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setTrackingModal({ open: true, shipment, driver: shipment.selected_driver_id })}
                    >
                      💬 Open Chat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    })()}
  </div>
)}

{/* Reports - still under development */}
{activeSection === 'reports' && (
  <div className="section active">
    <div className="section-header">
      <h1>Reports</h1>
    </div>
    <div className="content-card">
      <p>This section is under development.</p>
    </div>
  </div>
)}

        </main>
      </div>

      {/* Bids Modal */}
      {/* Bids Modal - FIXED VERSION */}
{modalState.bidsModal && (
  <div 
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999
    }}
    onClick={() => setModalState(prev => ({ ...prev, bidsModal: false }))}
  >
    <div 
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '20px', borderBottom: '1px solid #ddd' }}>
        <h2 style={{ margin: 0, color: '#333' }}>
          Bids for Shipment #{modalState.selectedShipment?.shipment_id}
        </h2>
        <button 
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666'
          }}
          onClick={() => setModalState(prev => ({ ...prev, bidsModal: false }))}
        >
          
        </button>
      </div>
      
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px', color: '#666' }}>
         <p><strong>Route:</strong> {modalState.selectedShipment?.from_location} → {modalState.selectedShipment?.to_location}</p>
          <p><strong>Package:</strong> {modalState.selectedShipment?.package_type} ({modalState.selectedShipment?.package_weight}kg)</p>
        </div>

      {modalState.currentBids && modalState.currentBids.length > 0 ? (
  <div>
    {modalState.currentBids.map((bid, index) => (
      <div 
        key={bid.bid_id || bid._id || index}
        style={{
          border: index === 0 ? '2px solid #32cd32' : '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '15px',
          backgroundColor: index === 0 ? '#f0fff0' : 'white',
          position: 'relative'
        }}
      >
        {index === 0 && (
          <div style={{
            position: 'absolute',
            top: '-10px',
            right: '10px',
            background: '#32cd32',
            color: 'white',
            padding: '5px 15px',
            borderRadius: '15px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            Best Bid
          </div>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#32cd32',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 'bold',
            marginRight: '15px'
          }}>
            {bid.driver_id?.name ? bid.driver_id.name.charAt(0).toUpperCase() : 'D'}
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: '#333' }}>
              {bid.driver_id?.name || 'Unknown Driver'}
            </strong>
            <div style={{ color: '#666', fontSize: '14px' }}>
              ⭐ {bid.driver_id?.rating || 'New Driver'}
            </div>
            {bid.driver_id?.phone && (
              <div style={{ color: '#666', fontSize: '12px' }}>
               📞 {bid.driver_id.phone}
              </div>
            )}
          </div>
        </div>

        <div style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#32cd32',
          marginBottom: '15px'
        }}>
          ₹{(bid.bid_amount || 0).toLocaleString()}
        </div>

        <div style={{ marginBottom: '15px', color: '#666' }}>
          <strong>Message:</strong>
          <p style={{ margin: '5px 0 0 0' }}>
            {bid.message || 'No message provided'}
          </p>
        </div>

        {bid.estimated_delivery_time && (
          <div style={{ marginBottom: '15px', color: '#666' }}>
            <strong>Estimated Delivery:</strong> {bid.estimated_delivery_time}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '15px',
          borderTop: '1px solid #eee'
        }}>
          <small style={{ color: '#999' }}>
            Submitted: {bid.createdAt 
              ? new Date(bid.createdAt).toLocaleString() 
              : 'Unknown'}
          </small>
          
          {bid.status === 'pending' && (
            <button
              style={{
                backgroundColor: '#32cd32',
                color: 'white',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              onClick={() => acceptBid(bid)}
            >
              Accept Bid
            </button>
          )}
          
          {bid.status === 'accepted' && (
            <span style={{
              backgroundColor: '#32cd32',
              color: 'white',
              padding: '5px 15px',
              borderRadius: '5px',
              fontSize: '14px'
            }}>
            ✓ Accepted
            </span>
          )}
        </div>
      </div>
    ))}
  </div>
) : (
  <div style={{
    textAlign: 'center',
    padding: '40px',
    color: '#999'
  }}>
    <i className="fas fa-clipboard-list" style={{ fontSize: '48px', marginBottom: '20px' }}></i>
    <h3 style={{ color: '#666' }}>No Bids Yet</h3>
    <p>Drivers will place bids soon</p>
  </div>
)}

      </div>
    </div>
  </div>
)}

{/* New Rating Modal Component */}
{ratingModal.show && (
  <RatingModal
    shipment={ratingModal.shipment}
    onClose={() => setRatingModal({ show: false, shipment: null })}
    onSuccess={() => loadUserData()}
  />
)}

      {trackingModal.open && (
  <TrackingModal 
    shipment={trackingModal.shipment}
    driver={trackingModal.driver}
    onClose={() => setTrackingModal({ open: false, shipment: null, driver: null })}
  />
)}

{/* AI Driver Recommendations Panel */}
{recModal.open && recModal.shipment && (
  <DriverRecommendations
    shipment={recModal.shipment}
    onClose={() => setRecModal({ open: false, shipment: null })}
  />
)}

{/* Proof of Delivery Modal */}
{podModal.open && podModal.shipment && (
  <ProofOfDeliveryModal
    shipment={podModal.shipment}
    mode={podModal.mode}
    onClose={() => setPodModal({ open: false, shipment: null, mode: 'verify' })}
    onSuccess={() => loadUserData()}
  />
)}

    </>
  );
}

export default ShipperDashboard;