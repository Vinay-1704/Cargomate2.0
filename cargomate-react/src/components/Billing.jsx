import React, { useState, useEffect } from 'react';
import '../styles/billing.css';

const API_URL = 'http://localhost:3000/api';

function Billing({ currentUser }) {
  const [shipments, setShipments] = useState([]);
  const [billingFilter, setBillingFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalPaid: 0,
    pendingPayment: 0,
    completedCount: 0,
    activeCount: 0
  });

  useEffect(() => {
    if (currentUser && currentUser.id) {
      console.log('🔍 Loading billing for user:', currentUser.id);
      loadBillingData();
    } else {
      console.error('❌ No currentUser provided to Billing component');
      setError('User information not available');
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    calculateStats();
  }, [shipments]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📡 Fetching shipments for shipper:', currentUser.id);
      
      const response = await fetch(`${API_URL}/shipments/shipper/${currentUser.id}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`
        }
      });

      console.log('📥 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded shipments:', data.shipments?.length || 0);
        setShipments(data.shipments || []);
      } else {
        const errorData = await response.json();
        console.error('❌ Error response:', errorData);
        setError(errorData.error || 'Failed to load billing data');
      }
    } catch (error) {
      console.error('❌ Error loading billing data:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalPaid = shipments
      .filter(s => s.status === 'completed' && s.payment_status === 'paid')
      .reduce((sum, s) => sum + (s.final_amount || 0), 0);

    const pendingPayment = shipments
      .filter(s => s.status === 'completed' && s.payment_status === 'pending')
      .reduce((sum, s) => sum + (s.final_amount || 0), 0);

    const completedCount = shipments.filter(s => s.status === 'completed' && s.payment_status === 'paid').length;
    
    const activeCount = shipments.filter(s => s.status === 'active' || s.status === 'in_transit').length;

    setStats({ totalPaid, pendingPayment, completedCount, activeCount });
  };

  const getFilteredShipments = () => {
    if (billingFilter === 'all') return shipments;
    
    // Active: accepted shipments that are NOT yet completed
    if (billingFilter === 'active') {
      return shipments.filter(s => 
        s.status === 'active' || s.status === 'in_transit'
      );
    }
    
    // Pending: completed deliveries waiting for payment
    if (billingFilter === 'pending') {
      return shipments.filter(s => 
        s.status === 'completed' && s.payment_status === 'pending'
      );
    }
    
    // Completed: paid shipments
    if (billingFilter === 'completed') {
      return shipments.filter(s => 
        s.status === 'completed' && s.payment_status === 'paid'
      );
    }
    
    return shipments;
  };

  const handlePayNow = async (shipment) => {
    if (!window.confirm(`Confirm payment of ₹${shipment.final_amount.toLocaleString()} for ${shipment.shipment_id}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/shipments/${shipment._id}/payment`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert(`Payment successful for ${shipment.shipment_id}!`);
        loadBillingData();
      } else {
        const error = await response.json();
        alert(error.error || 'Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please check your connection.');
    }
  };

  const handleDownloadInvoice = (shipment) => {
    alert(`Downloading invoice for ${shipment.shipment_id}`);
  };

  if (loading) {
    return (
      <div className="billing-loading">
        <i className="fas fa-spinner fa-spin"></i>
        <p>Loading billing data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="billing-error">
        <i className="fas fa-exclamation-triangle"></i>
        <h3>Error Loading Billing Data</h3>
        <p>{error}</p>
        <button className="retry-btn" onClick={loadBillingData}>
          <i className="fas fa-redo"></i> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="billing-container">
      <div className="billing-header">
        <h1>
          <i className="fas fa-receipt"></i> Billing & Payments
        </h1>
        <button className="refresh-btn" onClick={loadBillingData}>
          <i className="fas fa-sync"></i> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="billing-stats-grid">
        <div className="billing-stat-card purple">
          <div className="stat-icon">
            <i className="fas fa-wallet"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">₹{stats.totalPaid.toLocaleString()}</div>
            <div className="stat-label">Total Paid</div>
          </div>
        </div>

        <div className="billing-stat-card orange">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">₹{stats.pendingPayment.toLocaleString()}</div>
            <div className="stat-label">Pending Payment</div>
          </div>
        </div>

        <div className="billing-stat-card green">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.completedCount}</div>
            <div className="stat-label">Completed Deliveries</div>
          </div>
        </div>

        <div className="billing-stat-card blue">
          <div className="stat-icon">
            <i className="fas fa-shipping-fast"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeCount}</div>
            <div className="stat-label">Active Shipments</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="billing-filters">
        {['all', 'active', 'pending', 'completed'].map(f => (
          <button
            key={f}
            className={`filter-btn ${billingFilter === f ? 'active' : ''}`}
            onClick={() => setBillingFilter(f)}
          >
            {f === 'all' ? 'All Invoices' : 
             f === 'active' ? 'Active Bills' :
             f === 'pending' ? 'Pending Payment' :
             'Paid Bills'}
          </button>
        ))}
      </div>

      {/* Billing Table */}
      <div className="billing-table-container">
        {getFilteredShipments().length > 0 ? (
          <table className="billing-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Package</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredShipments().map(shipment => (
                <tr key={shipment._id}>
                  <td className="invoice-id">#{shipment.shipment_id}</td>
                  <td className="route-cell">
                    <div className="route-from">
                      <i className="fas fa-map-marker-alt from-icon"></i>
                      {shipment.from_location}
                    </div>
                    <div className="route-to">
                      <i className="fas fa-map-marker-alt to-icon"></i>
                      {shipment.to_location}
                    </div>
                  </td>
                  <td>{shipment.selected_driver_name || 'Not Assigned'}</td>
                  <td className="package-cell">
                    <div>{shipment.package_type}</div>
                    <div className="package-weight">{shipment.package_weight}kg</div>
                  </td>
                  <td>{new Date(shipment.createdAt).toLocaleDateString()}</td>
                  <td className="amount-cell text-right">
                    ₹{shipment.final_amount?.toLocaleString() || 'N/A'}
                  </td>
                  <td className="text-center">
                    {/* For active/in_transit shipments */}
                    {(shipment.status === 'active' || shipment.status === 'in_transit') && (
                      <span className="status-badge active">
                        <i className="fas fa-truck"></i> In Progress
                      </span>
                    )}
                    
                    {/* For completed but unpaid shipments */}
                    {shipment.status === 'completed' && shipment.payment_status === 'pending' && (
                      <span className="status-badge pending">
                        <i className="fas fa-clock"></i> Awaiting Payment
                      </span>
                    )}
                    
                    {/* For completed and paid shipments */}
                    {shipment.status === 'completed' && shipment.payment_status === 'paid' && (
                      <span className="status-badge completed">
                        <i className="fas fa-check"></i> Paid
                      </span>
                    )}
                  </td>
                  <td className="text-center">
                    {/* For active/in_transit - can pay in advance */}
                    {(shipment.status === 'active' || shipment.status === 'in_transit') && (
                      <button
                        className="action-btn pay-btn"
                        onClick={() => handlePayNow(shipment)}
                      >
                        <i className="fas fa-credit-card"></i> Pay Now
                      </button>
                    )}
                    
                    {/* For completed but unpaid - must pay */}
                    {shipment.status === 'completed' && shipment.payment_status === 'pending' && (
                      <button
                        className="action-btn pay-btn"
                        style={{ background: '#FF9800' }}
                        onClick={() => handlePayNow(shipment)}
                      >
                        <i className="fas fa-credit-card"></i> Pay Now
                      </button>
                    )}
                    
                    {/* For paid shipments - download invoice */}
                    {shipment.status === 'completed' && shipment.payment_status === 'paid' && (
                      <button
                        className="action-btn download-btn"
                        onClick={() => handleDownloadInvoice(shipment)}
                      >
                        <i className="fas fa-download"></i> Invoice
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <i className="fas fa-receipt"></i>
            <h3>No Invoices Found</h3>
            <p>You don't have any {billingFilter !== 'all' ? billingFilter : ''} invoices yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Billing;
