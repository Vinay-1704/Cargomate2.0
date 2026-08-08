import React, { useState, useEffect } from 'react';
import '../styles/driver-performance.css';

const API_URL = 'http://localhost:3000/api';

function DriverPerformance({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState({
    averageRating: 0,
    totalRatings: 0,
    completedTrips: 0,
    onTimeDeliveries: 0,
    onTimePercentage: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (currentUser?.id) {
      loadPerformanceData();
    }
  }, [currentUser]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/driver/${currentUser.id}/performance`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data.performance);
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="stars-display">
        {[1, 2, 3, 4, 5].map((star) => (
          <i
            key={star}
            className={`fas fa-star ${star <= rating ? 'filled' : 'empty'}`}
          ></i>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="performance-loading">
        <i className="fas fa-spinner fa-spin"></i>
        <p>Loading performance data...</p>
      </div>
    );
  }

  return (
    <div className="performance-container">
      <div className="performance-header">
        <h1>
          <i className="fas fa-chart-line"></i> Performance
        </h1>
        <p>Track your performance metrics and ratings</p>
      </div>

      {/* Stats Cards */}
      <div className="performance-stats">
        <div className="stat-card primary">
          <div className="stat-icon">
            <i className="fas fa-percentage"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{performanceData.completedTrips > 0 ? '100%' : '0%'}</div>
            <div className="stat-label">Trip Completion Rate</div>
            <div className="stat-description">Trips completed successfully</div>
          </div>
        </div>

        <div className="stat-card gold">
          <div className="stat-icon">
            <i className="fas fa-star"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {performanceData.totalRatings > 0 ? performanceData.averageRating.toFixed(1) : 'New'}
            </div>
            <div className="stat-label">Average Rating</div>
            <div className="stat-description">Based on customer feedback</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{performanceData.onTimePercentage}%</div>
            <div className="stat-label">On-Time Delivery</div>
            <div className="stat-description">Deliveries on schedule</div>
          </div>
        </div>
      </div>

      {/* Rating Distribution */}
      {performanceData.totalRatings > 0 && (
        <div className="rating-distribution-card">
          <h2>
            <i className="fas fa-chart-bar"></i> Rating Distribution
          </h2>
          <div className="rating-bars">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = performanceData.ratingDistribution[stars] || 0;
              const percentage = performanceData.totalRatings > 0 
                ? (count / performanceData.totalRatings) * 100 
                : 0;
              
              return (
                <div key={stars} className="rating-bar-row">
                  <div className="rating-label">
                    {stars} <i className="fas fa-star"></i>
                  </div>
                  <div className="rating-bar-container">
                    <div 
                      className="rating-bar-fill" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="rating-count">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      <div className="reviews-section">
        <h2>
          <i className="fas fa-comments"></i> Recent Reviews
        </h2>
        
        {reviews.length > 0 ? (
          <div className="reviews-list">
            {reviews.map((review, index) => (
              <div key={index} className="review-card">
                <div className="review-header">
                  <div className="review-info">
                    <div className="review-shipment">
                      <i className="fas fa-hashtag"></i>
                      {review.shipment_id}
                    </div>
                    <div className="review-date">
                      <i className="fas fa-calendar"></i>
                      {new Date(review.rated_at).toLocaleDateString()}
                    </div>
                  </div>
                  {renderStars(review.driver_rating)}
                </div>
                
                <div className="review-route">
                  <i className="fas fa-map-marker-alt text-green"></i>
                  <span>{review.from_location}</span>
                  <i className="fas fa-arrow-right"></i>
                  <i className="fas fa-map-marker-alt text-red"></i>
                  <span>{review.to_location}</span>
                </div>

                {review.driver_review && (
                  <div className="review-comment">
                    <i className="fas fa-quote-left"></i>
                    <p>{review.driver_review}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-reviews">
            <i className="fas fa-star"></i>
            <h3>No Reviews Yet</h3>
            <p>Customer reviews will appear here after trip completions</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverPerformance;
