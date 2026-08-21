import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/route-optimizer.css';

const API_URL = 'http://localhost:3000/api';

// Fix Leaflet's default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const startIcon = new L.DivIcon({
  html: `<div style="background:#22c55e; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; border:3px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.4);">A</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endIcon = new L.DivIcon({
  html: `<div style="background:#ef4444; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; border:3px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.4);">B</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Helper component to auto-fit map bounds safely
function AutoFitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !map._mapPane) return;
    try {
      if (points && points.length > 0) {
        const bounds = L.latLngBounds(points);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], animate: false });
        }
      }
    } catch (err) {
      console.warn('AutoFitBounds warning:', err);
    }
  }, [map, points]);
  return null;
}

const CITY_PRESETS = [
  'Duvvada (530046)',
  'Jonnavalasa (535004)',
  'Visakhapatnam (530016)',
  'Vijayawada (520001)',
  'Hyderabad (500001)',
  'Chennai (600001)',
  'Mumbai (400001)',
  'Bengaluru (560001)'
];

function RouteOptimizer({ onApplyRoute, currentUser }) {
  const [pickup, setPickup] = useState('Duvvada (530046)');
  const [delivery, setDelivery] = useState('Jonnavalasa (535004)');
  const [vehicleType, setVehicleType] = useState('medium_truck');
  const [fuelPrice, setFuelPrice] = useState('95.5');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [optimizationResult, setOptimizationResult] = useState(null);
  const [selectedRouteType, setSelectedRouteType] = useState('fastest');
  const [routeHistory, setRouteHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Auto-run initial optimization on load
  useEffect(() => {
    handleOptimize();
    if (currentUser?.id) {
      fetchRouteHistory();
    }
  }, []);

  const fetchRouteHistory = async () => {
    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const userId = currentUser?.id || 3;
      const res = await fetch(`${API_URL}/routes/history/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRouteHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error loading route history:', err);
    }
  };

  const handleOptimize = async (e) => {
    if (e) e.preventDefault();
    if (!pickup.trim() || !delivery.trim()) {
      alert('Please enter both pickup and delivery locations');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/routes/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pickup_location: pickup.trim(),
          delivery_location: delivery.trim(),
          vehicle_type: vehicleType,
          fuel_price_per_liter: parseFloat(fuelPrice) || 95.5
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOptimizationResult(data);
        setSelectedRouteType('fastest');
      } else {
        setError(data.detail || 'Failed to optimize route');
      }
    } catch (err) {
      console.error('Route optimization error:', err);
      setError('Network error connecting to routing service');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!optimizationResult || !activeRoute) return;

    setSaving(true);
    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/routes/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pickup_location: optimizationResult.query.pickup_location,
          delivery_location: optimizationResult.query.delivery_location,
          pickup_lat: optimizationResult.query.pickup_coords[0],
          pickup_lon: optimizationResult.query.pickup_coords[1],
          delivery_lat: optimizationResult.query.delivery_coords[0],
          delivery_lon: optimizationResult.query.delivery_coords[1],
          vehicle_type: vehicleType,
          selected_route_type: selectedRouteType,
          distance_km: activeRoute.distance_km,
          duration_mins: activeRoute.duration_mins,
          fuel_liters: activeRoute.fuel_liters,
          fuel_cost: activeRoute.fuel_cost
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Route saved to history successfully!');
        fetchRouteHistory();
      } else {
        alert(data.detail || 'Failed to save route');
      }
    } catch (err) {
      console.error('Save route error:', err);
      alert('Error saving route to history');
    } finally {
      setSaving(false);
    }
  };

  const [realRoadPath, setRealRoadPath] = useState(null);

  const activeRoute = optimizationResult?.routes?.[selectedRouteType];
  const queryInfo = optimizationResult?.query;

  // Client-side OSRM real turn-by-turn road geometry fetch for ultra-smooth maps
  useEffect(() => {
    const fetchOSRMClientPath = async () => {
      if (!queryInfo?.pickup_coords || !queryInfo?.delivery_coords) return;
      const [pLat, pLon] = queryInfo.pickup_coords;
      const [dLat, dLon] = queryInfo.delivery_coords;
      
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pLon},${pLat};${dLon},${dLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          setRealRoadPath(coords);
        } else {
          setRealRoadPath(null);
        }
      } catch (err) {
        console.error("OSRM client route error:", err);
        setRealRoadPath(null);
      }
    };

    fetchOSRMClientPath();
  }, [queryInfo?.pickup_coords, queryInfo?.delivery_coords]);


  return (
    <div className="route-optimizer-container">
      {/* Header Banner */}
      <div className="route-optimizer-header">
        <div>
          <h2>🗺️ AI Route Optimization System</h2>
          <p>Calculate 3 distinct routing strategies: ⚡ Fastest, 📏 Shortest, and ⛽ Lowest Fuel-Cost</p>
        </div>
        <button
          type="button"
          className="btn-history-toggle"
          onClick={() => setShowHistory(!showHistory)}
        >
          📜 {showHistory ? 'Hide Saved History' : `View Saved Routes (${routeHistory.length})`}
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="route-optimizer-grid">
        {/* Left Column: Form Controls */}
        <div className="optimizer-form-card">
          <form onSubmit={handleOptimize}>
            <div className="form-title">
              <i className="fas fa-sliders-h"></i> Route Parameters
            </div>

            {/* Pickup Location */}
            <div className="form-group">
              <label>📍 Pickup Location *</label>
              <input
                type="text"
                placeholder="e.g. Mumbai / Warehouse 4"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                required
              />
              <div className="preset-pills">
                <small>Quick Pick:</small>
                {CITY_PRESETS.slice(0, 4).map(city => (
                  <button key={city} type="button" className="pill" onClick={() => setPickup(city)}>
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Location */}
            <div className="form-group">
              <label>🏁 Delivery Location *</label>
              <input
                type="text"
                placeholder="e.g. Pune / Distribution Hub"
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                required
              />
              <div className="preset-pills">
                <small>Quick Pick:</small>
                {CITY_PRESETS.slice(1, 5).map(city => (
                  <button key={city} type="button" className="pill" onClick={() => setDelivery(city)}>
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Type */}
            <div className="form-group">
              <label>🚛 Vehicle Type (Efficiency Rating)</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="pickup">🛻 Pickup / Minivan (12 km/L)</option>
                <option value="van">🚐 Delivery Van (11 km/L)</option>
                <option value="small_truck">🚚 Small Truck (10 km/L)</option>
                <option value="medium_truck">🚛 Medium Freight Truck (7.5 km/L)</option>
                <option value="large_truck">🚛 Heavy Cargo Truck (5 km/L)</option>
                <option value="trailer">🚛 Multi-Axle Trailer (3.5 km/L)</option>
              </select>
            </div>

            {/* Fuel Price */}
            <div className="form-group">
              <label>⛽ Fuel Price (₹ / Liter)</label>
              <input
                type="number"
                step="0.1"
                placeholder="95.5"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-optimize-submit" disabled={loading}>
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Calculating Routes...
                </>
              ) : (
                <>🚀 Calculate & Optimize Routes</>
              )}
            </button>
          </form>

          {/* History Drawer toggle section */}
          {showHistory && (
            <div className="saved-history-drawer">
              <h4>📜 Saved Route History</h4>
              {routeHistory.length === 0 ? (
                <p className="empty-history">No saved routes yet</p>
              ) : (
                <div className="history-list">
                  {routeHistory.map(item => (
                    <div
                      key={item.id}
                      className="history-item"
                      onClick={() => {
                        setPickup(item.pickup_location);
                        setDelivery(item.delivery_location);
                        setVehicleType(item.vehicle_type);
                      }}
                    >
                      <div className="history-route-title">
                        <strong>{item.pickup_location} → {item.delivery_location}</strong>
                      </div>
                      <div className="history-meta">
                        <span>{item.distance_km} km</span> • <span>₹{item.fuel_cost}</span> • <span className="tag-type">{item.selected_route_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Route Options Cards & Map */}
        <div className="optimizer-results-section">
          {error && (
            <div className="route-error-banner">
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          )}

          {loading && (
            <div className="route-loading-state">
              <div className="loading-hero-banner">
                <div className="pulse-spinner"></div>
                <div>
                  <h3>⚡ Calculating Optimal Turn-by-Turn Routes...</h3>
                  <p>Querying OpenStreetMap & OSRM Driving Engine for <strong>{pickup}</strong> → <strong>{delivery}</strong></p>
                </div>
              </div>

              {/* Skeleton Strategy Cards */}
              <div className="skeleton-cards-grid">
                <div className="skeleton-card">
                  <div className="skeleton-pill">⚡ Fastest Route</div>
                  <div className="skeleton-block"></div>
                  <div className="skeleton-text"></div>
                </div>
                <div className="skeleton-card">
                  <div className="skeleton-pill">📏 Shortest Route</div>
                  <div className="skeleton-block"></div>
                  <div className="skeleton-text"></div>
                </div>
                <div className="skeleton-card">
                  <div className="skeleton-pill">⛽ Lowest Fuel Cost</div>
                  <div className="skeleton-block"></div>
                  <div className="skeleton-text"></div>
                </div>
              </div>

              {/* Skeleton Map Preview */}
              <div className="skeleton-map-placeholder">
                <i className="fas fa-map-marked-alt fa-spin-pulse"></i>
                <p>Generating Highway Geometry & Turn-by-Turn Coordinates...</p>
                <div className="loading-progress-bar">
                  <div className="progress-fill"></div>
                </div>
              </div>
            </div>
          )}

          {!loading && optimizationResult && (
            <>
              {/* 3 Strategy Option Cards */}
              <div className="route-cards-grid">
                {Object.values(optimizationResult.routes).map(route => {
                  const isSelected = selectedRouteType === route.id;
                  return (
                    <div
                      key={route.id}
                      className={`route-card ${isSelected ? 'selected' : ''}`}
                      style={{ borderColor: isSelected ? route.color : 'rgba(255,255,255,0.08)' }}
                      onClick={() => setSelectedRouteType(route.id)}
                    >
                      <div className="route-card-header">
                        <span className="route-label" style={{ color: route.color }}>{route.label}</span>
                        <span className="route-badge" style={{ background: `${route.color}22`, color: route.color, border: `1px solid ${route.color}44` }}>
                          {route.tag}
                        </span>
                      </div>

                      <div className="route-card-metrics">
                        <div className="metric">
                          <small>ETA / Time</small>
                          <strong>{route.duration_text}</strong>
                        </div>
                        <div className="metric">
                          <small>Distance</small>
                          <strong>{route.distance_km} km</strong>
                        </div>
                        <div className="metric">
                          <small>Fuel Cost</small>
                          <strong style={{ color: '#22c55e' }}>₹{route.fuel_cost.toLocaleString()}</strong>
                        </div>
                      </div>

                      <div className="route-card-desc">
                        {route.description}
                      </div>

                      <div className="route-select-indicator">
                        {isSelected ? '✅ Active on Map' : 'Click to Select & View Map'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Route Metrics Bar */}
              {activeRoute && (
                <div className="active-metrics-bar">
                  <div className="bar-item">
                    <span className="bar-icon">⏱️</span>
                    <div>
                      <small>Estimated Duration</small>
                      <strong>{activeRoute.duration_text}</strong>
                    </div>
                  </div>
                  <div className="bar-item">
                    <span className="bar-icon">📏</span>
                    <div>
                      <small>Total Distance</small>
                      <strong>{activeRoute.distance_km} km</strong>
                    </div>
                  </div>
                  <div className="bar-item">
                    <span className="bar-icon">⛽</span>
                    <div>
                      <small>Fuel Needed</small>
                      <strong>{activeRoute.fuel_liters} Liters</strong>
                    </div>
                  </div>
                  <div className="bar-item">
                    <span className="bar-icon">💰</span>
                    <div>
                      <small>Est. Fuel Cost</small>
                      <strong style={{ color: '#22c55e' }}>₹{activeRoute.fuel_cost.toLocaleString()}</strong>
                    </div>
                  </div>
                  <div className="bar-item">
                    <span className="bar-icon">🌱</span>
                    <div>
                      <small>CO₂ Footprint</small>
                      <strong>{activeRoute.co2_kg} kg CO₂</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaflet Map Display */}
              <div className="route-map-container">
                <MapContainer
                  center={queryInfo?.pickup_coords || [19.076, 72.877]}
                  zoom={7}
                  style={{ height: '340px', width: '100%', borderRadius: '12px' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />

                  {queryInfo?.pickup_coords && (
                    <Marker position={queryInfo.pickup_coords} icon={startIcon} />
                  )}

                  {queryInfo?.delivery_coords && (
                    <Marker position={queryInfo.delivery_coords} icon={endIcon} />
                  )}

                  {(realRoadPath || activeRoute?.path) && (
                    <>
                      <Polyline
                        positions={realRoadPath || activeRoute.path}
                        color={activeRoute?.color || '#3b82f6'}
                        weight={6}
                        opacity={0.85}
                      />
                      <AutoFitBounds points={realRoadPath || activeRoute.path} />
                    </>
                  )}
                </MapContainer>
              </div>

              {/* Action Buttons */}
              <div className="route-action-buttons">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSaveRoute}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : '💾 Save Route to History'}
                </button>

                {onApplyRoute && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => onApplyRoute({
                      pickup_location: queryInfo.pickup_location,
                      delivery_location: queryInfo.delivery_location,
                      vehicle_type: vehicleType,
                      distance_km: activeRoute.distance_km,
                      estimated_cost: activeRoute.fuel_cost
                    })}
                  >
                    📦 Use Route for New Shipment
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RouteOptimizer;
