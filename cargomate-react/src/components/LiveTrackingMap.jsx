import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { API_URL } from '../config';

// Fix Leaflet's default icon path issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icon for the truck
const truckIcon = new L.DivIcon({
  html: `
    <div style="background-color: #22c55e; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
      <span style="font-size: 18px;">🚛</span>
    </div>
  `,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Custom icon for start/end points
const pointIcon = (color) => new L.DivIcon({
  html: `
    <div style="background-color: ${color}; border-radius: 50%; width: 24px; height: 24px; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>
  `,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to handle auto-centering the map safely
function MapUpdater({ driverLocation, routeCoords, isFullscreen }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    try {
      const container = map.getContainer();
      if (!container) return;
      const observer = new ResizeObserver(() => {
        if (map && map._mapPane && typeof map.invalidateSize === 'function') {
          map.invalidateSize({ animate: false });
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    } catch (e) {
      console.warn('Map observer warning:', e);
    }
  }, [map]);

  useEffect(() => {
    if (!map || !map._mapPane) return;
    try {
      if (routeCoords && routeCoords.length > 0) {
        const bounds = L.latLngBounds(routeCoords);
        if (driverLocation && driverLocation.lat && driverLocation.lng) {
          bounds.extend([driverLocation.lat, driverLocation.lng]);
        }
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], animate: false });
        }
      } else if (driverLocation && driverLocation.lat && driverLocation.lng) {
        map.setView([driverLocation.lat, driverLocation.lng], 13, { animate: false });
      }
    } catch (err) {
      console.warn('Map bounds fit warning:', err);
    }
  }, [map, driverLocation, routeCoords, isFullscreen]);

  return null;
}

function LiveTrackingMap({ shipment, tripId }) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [waypoints, setWaypoints] = useState({ start: null, end: null });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const intervalRef = useRef(null);

  const defaultCenter = [20.5937, 78.9629]; // Center of India

  // 1. Fetch driver location from backend
  const fetchDriverLocation = useCallback(async () => {
    if (!shipment?.shipment_id) return;

    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const lookupId = tripId || shipment.shipment_id;
      const response = await fetch(`${API_URL}/trips/${lookupId}/location`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.location && data.location.lat && data.location.lon) {
          setDriverLocation({
            lat: data.location.lat,
            lng: data.location.lon,
          });
          setLastUpdate(data.location.updated_at);
          setError(null);
        } else {
          setError('Driver has not shared location yet');
        }
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setError('Unable to fetch location');
    }
  }, [shipment?.shipment_id, tripId]);

  // Poll location every 10 seconds
  useEffect(() => {
    fetchDriverLocation();
    intervalRef.current = setInterval(fetchDriverLocation, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDriverLocation]);

  // 2. Geocode start and end locations
  useEffect(() => {
    const geocode = async (locationStr) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch (err) {
        console.error('Geocoding error for', locationStr, err);
      }
      return null;
    };

    const fetchCoordinates = async () => {
      if (shipment?.from_location && shipment?.to_location) {
        const start = await geocode(shipment.from_location);
        const end = await geocode(shipment.to_location);
        setWaypoints({ start, end });
      }
    };
    
    fetchCoordinates();
  }, [shipment?.from_location, shipment?.to_location]);

  // 3. Fetch Route and ETA using OSRM when we have waypoints (and optionally driver location)
  useEffect(() => {
    const fetchRoute = async () => {
      // Use driver location as start if available, otherwise use original start point
      const currentStart = driverLocation || waypoints.start;
      const currentEnd = waypoints.end;

      if (!currentStart || !currentEnd) return;

      try {
        // OSRM expects lng,lat
        const url = `https://router.project-osrm.org/route/v1/driving/${currentStart.lng},${currentStart.lat};${currentEnd.lng},${currentEnd.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          
          // Convert GeoJSON coords [lng, lat] to Leaflet coords [lat, lng]
          const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
          setRouteCoords(coords);

          // Update distance (meters to km) and ETA (seconds to formatted string)
          const distKm = (route.distance / 1000).toFixed(1);
          setDistance(`${distKm} km`);
          
          const hours = Math.floor(route.duration / 3600);
          const minutes = Math.floor((route.duration % 3600) / 60);
          
          if (hours > 0) {
            setEta(`${hours}h ${minutes}m`);
          } else {
            setEta(`${minutes} mins`);
          }
        }
      } catch (err) {
        console.error('Routing error', err);
      }
    };

    fetchRoute();
  }, [driverLocation, waypoints]);

  return (
    <div className={`live-tracking-wrapper ${isFullscreen ? 'fullscreen' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Info Bar */}
      <div className="tracking-info-bar">
        {eta && (
          <div className="info-chip eta-chip">
            <span className="chip-icon">⏱️</span>
            <div>
              <span className="chip-label">ETA</span>
              <span className="chip-value">{eta}</span>
            </div>
          </div>
        )}
        {distance && (
          <div className="info-chip distance-chip">
            <span className="chip-icon">📍</span>
            <div>
              <span className="chip-label">Distance</span>
              <span className="chip-value">{distance}</span>
            </div>
          </div>
        )}
        <div className="info-chip status-chip">
          <div className={`live-dot ${driverLocation ? 'active' : ''}`}></div>
          <span>{driverLocation ? 'LIVE' : 'WAITING'}</span>
        </div>
      </div>

      {/* Map */}
      <div className="map-container" style={{ flex: 1, minHeight: '260px', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
        <button 
          className="map-expand-btn" 
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? "Close Fullscreen" : "Expand Map"}
        >
          {isFullscreen ? '✖ Close' : '⛶ Expand'}
        </button>
        <MapContainer 
          center={driverLocation ? [driverLocation.lat, driverLocation.lng] : defaultCenter} 
          zoom={5} 
          style={{ width: '100%', height: '100%' }}
        >
          {/* Dark themed map tiles from Carto */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          <MapUpdater driverLocation={driverLocation} routeCoords={routeCoords} />

          {/* Start and End Waypoints */}
          {waypoints.start && !driverLocation && (
             <Marker position={[waypoints.start.lat, waypoints.start.lng]} icon={pointIcon('#3b82f6')} />
          )}
          {waypoints.end && (
             <Marker position={[waypoints.end.lat, waypoints.end.lng]} icon={pointIcon('#ef4444')} />
          )}

          {/* Route Polyline */}
          {routeCoords.length > 0 && (
            <Polyline positions={routeCoords} color="#22c55e" weight={5} opacity={0.8} />
          )}

          {/* Driver marker */}
          {driverLocation && (
            <Marker
              position={[driverLocation.lat, driverLocation.lng]}
              icon={truckIcon}
            />
          )}
        </MapContainer>

        {/* Error overlay */}
        {error && !driverLocation && (
          <div className="map-overlay-message" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(15,23,42,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <div className="overlay-icon" style={{ fontSize: '42px', marginBottom: '12px' }}>📡</div>
            <p style={{ fontWeight: 'bold' }}>{error}</p>
            <small>Location will appear once the driver starts sharing</small>
          </div>
        )}
      </div>

      {/* Last update */}
      {lastUpdate && (
        <div className="last-update-bar" style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
          Last updated: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default LiveTrackingMap;
