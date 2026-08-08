import React, { useState } from 'react';
import '../styles/rating-modal.css';

const API_URL = 'http://localhost:3000/api';

function RatingModal({ shipment, onClose, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    setSubmitting(true);

    try {
      const targetId = shipment.id || shipment.shipment_id || shipment._id;
      const response = await fetch(`${API_URL}/shipments/${targetId}/rating`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating,
          review: review.trim()
        })
      });

      if (response.ok) {
        alert('Rating submitted successfully!');
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Rating submission error:', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rating-modal-overlay" onClick={onClose}>
      <div className="rating-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="rating-modal-header">
          <h2>Rate Your Delivery Experience</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rating-modal-body">
            {/* Shipment Info */}
            <div className="shipment-info">
              <div className="info-item">
                <i className="fas fa-hashtag"></i>
                <span>{shipment.shipment_id}</span>
              </div>
              <div className="info-item">
                <i className="fas fa-user"></i>
                <span>
    Driver: {
      shipment.selected_driver_id?.name || 
      shipment.selected_driver_name || 
      'Driver Information Unavailable'
    }
  </span>
              </div>
              <div className="info-item">
                <i className="fas fa-route"></i>
                <span>{shipment.from_location} → {shipment.to_location}</span>
              </div>
            </div>

            {/* Star Rating */}
            <div className="rating-section">
              <label>How was your delivery experience?</label>
              <div className="stars-container">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= (hoveredRating || rating) ? 'active' : ''}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                  >
                    <i className={`fas fa-star`}></i>
                  </button>
                ))}
              </div>
              <div className="rating-text">
                {rating === 0 && 'Select a rating'}
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </div>
            </div>

            {/* Review Text */}
            <div className="review-section">
              <label>Share your feedback (optional)</label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Tell us about your experience with this delivery..."
                rows="4"
                maxLength="500"
              />
              <div className="char-count">{review.length}/500</div>
            </div>
          </div>

          <div className="rating-modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={submitting || rating === 0}
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Submitting...
                </>
              ) : (
                <>
                  <i className="fas fa-check"></i> Submit Rating
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RatingModal;
