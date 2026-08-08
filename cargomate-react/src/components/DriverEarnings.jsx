import React, { useState, useEffect } from 'react';
import '../styles/driver-earnings.css';

const API_URL = 'http://localhost:3000/api';

function DriverEarnings({ currentUser }) {
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0,
    completedTrips: 0,
    activeTrips: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (currentUser && currentUser.id) {
      loadEarningsData();
    }
  }, [currentUser]);

  const loadEarningsData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/earnings/driver/${currentUser.id}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEarnings(data.earnings);
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTransactions = () => {
    if (filter === 'all') return transactions;
    if (filter === 'paid') return transactions.filter(t => t.payment_status === 'paid');
    if (filter === 'pending') return transactions.filter(t => t.payment_status === 'pending');
    return transactions;
  };

  if (loading) {
    return (
      <div className="earnings-loading">
        <i className="fas fa-spinner fa-spin"></i>
        <p>Loading earnings data...</p>
      </div>
    );
  }

  return (
    <div className="earnings-container">
      <div className="earnings-header">
        <h1>
          <i className="fas fa-wallet"></i> My Earnings
        </h1>
        <button className="refresh-btn" onClick={loadEarningsData}>
          <i className="fas fa-sync"></i> Refresh
        </button>
      </div>

      {/* Earnings Stats */}
      <div className="earnings-stats-grid">
        <div className="earnings-stat-card green">
          <div className="stat-icon">
            <i className="fas fa-rupee-sign"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">₹{earnings.totalEarnings.toLocaleString()}</div>
            <div className="stat-label">Total Earnings</div>
          </div>
        </div>

        <div className="earnings-stat-card blue">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">₹{earnings.paidEarnings.toLocaleString()}</div>
            <div className="stat-label">Paid Amount</div>
          </div>
        </div>

        <div className="earnings-stat-card orange">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">₹{earnings.pendingEarnings.toLocaleString()}</div>
            <div className="stat-label">Pending Payment</div>
          </div>
        </div>

        <div className="earnings-stat-card purple">
          <div className="stat-icon">
            <i className="fas fa-route"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{earnings.completedTrips}</div>
            <div className="stat-label">Completed Trips</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="earnings-filters">
        {['all', 'paid', 'pending'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} Transactions
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="earnings-table-container">
        {getFilteredTransactions().length > 0 ? (
          <table className="earnings-table">
            <thead>
              <tr>
                <th>Trip ID</th>
                <th>Route</th>
                <th>Completed Date</th>
                <th>Payment Date</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredTransactions().map(transaction => (
                <tr key={transaction._id}>
                  <td className="trip-id">#{transaction.shipment_id}</td>
                  <td className="route-cell">
                    <div className="route-from">
                      <i className="fas fa-map-marker-alt from-icon"></i>
                      {transaction.from_location}
                    </div>
                    <div className="route-to">
                      <i className="fas fa-map-marker-alt to-icon"></i>
                      {transaction.to_location}
                    </div>
                  </td>
                  <td>{new Date(transaction.completed_at).toLocaleDateString()}</td>
                  <td>
                    {transaction.payment_date 
                      ? new Date(transaction.payment_date).toLocaleDateString() 
                      : '-'}
                  </td>
                  <td className="amount-cell text-right">
                    ₹{transaction.amount.toLocaleString()}
                  </td>
                  <td className="text-center">
                    {transaction.payment_status === 'paid' ? (
                      <span className="status-badge paid">
                        <i className="fas fa-check"></i> Paid
                      </span>
                    ) : (
                      <span className="status-badge pending">
                        <i className="fas fa-clock"></i> Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <i className="fas fa-receipt"></i>
            <h3>No Transactions Found</h3>
            <p>Complete deliveries to see your earnings here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverEarnings;
