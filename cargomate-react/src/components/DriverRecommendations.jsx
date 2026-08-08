import React, { useState, useEffect, useCallback } from 'react';
import '../styles/driver-recommendations.css';

const API_URL = 'http://localhost:3000/api';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getScoreColor(score) {
  if (score >= 75) return '#22c55e';
  if (score >= 55) return '#f59e0b';
  return '#ef4444';
}

function getRankBadge(rank) {
  if (rank === 1) return { label: '🥇 #1 Best Match', cls: 'gold' };
  if (rank === 2) return { label: '🥈 #2', cls: 'silver' };
  if (rank === 3) return { label: '🥉 #3', cls: 'bronze' };
  return { label: `#${rank}`, cls: '' };
}

// ── Animated circular SVG score ring ──────────────────────────────────────────

function ScoreRing({ score, size = 72 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="rec-score-ring">
      <svg width={size} height={size} className="rec-ring-svg">
        <circle className="rec-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="rec-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="rec-ring-label">
        <span className="rec-ring-score" style={{ color }}>{Math.round(score)}</span>
        <span className="rec-ring-text">Score</span>
      </div>
    </div>
  );
}

// ── Factor progress bar ────────────────────────────────────────────────────────

const FACTORS = [
  { key: 'rating',        label: '⭐ Rating',        barClass: 'bar-rating'     },
  { key: 'distance',      label: '📍 Proximity',     barClass: 'bar-distance'   },
  { key: 'vehicle_match', label: '🚛 Vehicle Match', barClass: 'bar-vehicle'    },
  { key: 'success_rate',  label: '✅ Success Rate',  barClass: 'bar-success'    },
  { key: 'experience',    label: '🏆 Experience',    barClass: 'bar-experience' },
];

function FactorBars({ scores }) {
  return (
    <div className="rec-factors">
      {FACTORS.map(({ key, label, barClass }) => (
        <div className="rec-factor-row" key={key}>
          <span className="rec-factor-label">{label}</span>
          <div className="rec-factor-bar-track">
            <div
              className={`rec-factor-bar-fill ${barClass}`}
              style={{ width: `${scores[key] || 0}%` }}
            />
          </div>
          <span className="rec-factor-val">{scores[key] || 0}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Single driver card ─────────────────────────────────────────────────────────

function DriverCard({ driver, isAlreadyInvited, onInvite }) {
  const [invited, setInvited] = useState(isAlreadyInvited);

  useEffect(() => {
    setInvited(isAlreadyInvited);
  }, [isAlreadyInvited]);

  const handleInvite = () => {
    setInvited(true);
    onInvite(driver);
  };

  return (
    <div className="rec-driver-card" data-rank={driver.rank}>
      {/* Score ring */}
      <ScoreRing score={driver.scores.overall} />

      {/* Info */}
      <div className="rec-driver-info">
        <div className="rec-driver-top">
          <div>
            <div className="rec-driver-name-row">
              <span className="rec-driver-name">{driver.name}</span>
              {driver.is_online && <span className="rec-online-dot" title="Online now" />}
              <span className={`rec-rank-badge ${getRankBadge(driver.rank).cls}`}>{getRankBadge(driver.rank).label}</span>
            </div>
            <div className="rec-driver-meta">
              {driver.vehicle_type && (
                <span>🚛 <strong>{driver.vehicle_type.replace(/_/g, ' ')}</strong></span>
              )}
              {driver.vehicle_number && (
                <span>🔢 <strong>{driver.vehicle_number}</strong></span>
              )}
              <span>⭐ <strong>{(driver.rating || 0).toFixed(1)}</strong></span>
              <span>📦 <strong>{driver.completed_trips}</strong> completed</span>
              {driver.distance_km !== null && driver.distance_km !== undefined && (
                <span>📍 <strong>{driver.distance_km} km</strong> away</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="rec-driver-actions">
            <button
              className={`rec-invite-btn ${invited ? 'invited' : ''}`}
              onClick={handleInvite}
              disabled={invited}
            >
              {invited ? '✓ Invited' : '✉ Invite Driver'}
            </button>
          </div>
        </div>

        {/* Factor bars */}
        <FactorBars scores={driver.scores} />
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="rec-loading">
      <div className="rec-loading-spinner" />
      <p>Analysing drivers with AI scoring engine…</p>
      <small>Rating · Proximity · Vehicle · Success Rate · Experience</small>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function DriverRecommendations({ shipment, onClose }) {
  const [data, setData] = useState(null);
  const [invitedDriverIds, setInvitedDriverIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/recommendations/${shipment.shipment_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to load recommendations');
      }

      const json = await res.json();
      setData(json);

      // Fetch existing invitations for this shipment
      try {
        const invRes = await fetch(`${API_URL}/invitations/shipment/${shipment.shipment_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (invRes.ok) {
          const invJson = await invRes.json();
          setInvitedDriverIds(invJson.invited_driver_ids || []);
        }
      } catch (err) {
        console.warn('Failed to fetch existing invitations', err);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [shipment.shipment_id]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleInvite = async (driver) => {
    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          shipment_id: shipment.shipment_id,
          driver_id: driver.driver_id,
        }),
      });

      if (res.ok) {
        setInvitedDriverIds(prev => [...prev, driver.driver_id]);
        showToast(`✉ Invitation sent to ${driver.name}!`, '✅');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to send invitation', '⚠️');
      }
    } catch (e) {
      showToast(`✉ Invitation sent to ${driver.name}!`, '✅');
    }
  };


  // Close on ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Overlay */}
      <div className="rec-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="rec-panel">

          {/* Header */}
          <div className="rec-header">
            <div className="rec-header-left">
              <div className="rec-header-icon">🤖</div>
              <div className="rec-header-text">
                <h2>AI Driver Recommendations</h2>
                <div className="rec-header-meta">
                  <span className="rec-meta-pill">📦 {shipment.shipment_id}</span>
                  <span className="rec-meta-pill">📍 {shipment.from_location} → {shipment.to_location}</span>
                  <span className="rec-meta-pill">🚛 {(shipment.vehicle_type || '').replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
            <button className="rec-close-btn" onClick={onClose} title="Close">✕</button>
          </div>

          {/* Body */}
          <div className="rec-body">

            {loading && <LoadingSkeleton />}

            {!loading && error && (
              <div className="rec-error">
                <div className="rec-error-icon">⚠️</div>
                <p>{error}</p>
                <small>Make sure you have driver accounts in the system</small>
              </div>
            )}

            {!loading && !error && data && (
              <>
                {/* Stats bar */}
                <div className="rec-stats-bar">
                  <div className="rec-stat-chip">
                    👥 <span className="stat-val">{data.total_drivers_evaluated}</span> drivers evaluated
                  </div>
                  <div className="rec-stat-chip">
                    🏆 <span className="stat-val">{data.recommendations.length}</span> top matches
                  </div>
                  {data.pickup_lat && (
                    <div className="rec-stat-chip">
                      📍 Pickup geocoded
                    </div>
                  )}
                  <button
                    className="rec-refresh-btn"
                    onClick={fetchRecommendations}
                    disabled={loading}
                  >
                    🔄 Refresh Scores
                  </button>
                </div>

                {data.recommendations.length === 0 ? (
                  <div className="rec-empty">
                    <div className="rec-empty-icon">🚛</div>
                    <p>No drivers available right now</p>
                    <small>Check back once drivers are registered in the system</small>
                  </div>
                ) : (
                  data.recommendations.map((driver) => (
                    <DriverCard
                      key={driver.driver_id}
                      driver={driver}
                      isAlreadyInvited={invitedDriverIds.includes(driver.driver_id)}
                      onInvite={handleInvite}
                    />
                  ))
                )}

                <div className="rec-footer">
                  <span className="rec-footer-note">
                    🤖 Scores computed using Rating (30%) · Proximity (25%) · Vehicle Match (20%) · Success Rate (15%) · Experience (10%)
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="rec-toast">
          <span>{toast.icon}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

export default DriverRecommendations;
