"""
Recommendation Engine — Scoring Service
Computes a weighted 0-100 compatibility score for each driver against a shipment.

Factors & Weights:
  Rating             30%  — normalised from 0-5 stars
  Distance           25%  — km from driver's last known location to pickup point
  Vehicle Match      20%  — exact type match = 1.0, else 0.0
  Success Rate       15%  — completed trips / total trips
  Experience         10%  — total completed trips (capped at 50)
"""

import math
from typing import Optional


# ── Haversine distance ─────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometres between two lat/lon points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Factor scorers (each returns 0.0 – 1.0) ───────────────────────────────────

def score_rating(rating: Optional[float]) -> float:
    """5-star rating → normalised 0-1."""
    r = rating or 0.0
    return min(max(r, 0.0), 5.0) / 5.0


def score_distance(driver_lat: Optional[float], driver_lon: Optional[float],
                   pickup_lat: Optional[float], pickup_lon: Optional[float]) -> float:
    """Closer driver scores higher. Max useful range = 500 km."""
    if None in (driver_lat, driver_lon, pickup_lat, pickup_lon):
        return 0.3  # neutral penalty when location unknown
    dist = haversine_km(driver_lat, driver_lon, pickup_lat, pickup_lon)
    return 1.0 - min(dist, 500.0) / 500.0


def score_vehicle_match(driver_vehicle: Optional[str], required_vehicle: Optional[str]) -> float:
    """Exact match = 1.0, no match = 0.0, unknown = 0.5."""
    if not driver_vehicle or not required_vehicle:
        return 0.5
    return 1.0 if driver_vehicle.lower().strip() == required_vehicle.lower().strip() else 0.0


def score_success_rate(completed_trips: int, total_trips: int) -> float:
    """Ratio of completed trips to total trips."""
    if total_trips == 0:
        return 0.5  # new driver — neutral
    return min(completed_trips / total_trips, 1.0)


def score_experience(total_trips: int) -> float:
    """More trips = more experienced. Capped at 50 trips for full score."""
    return min(total_trips, 50) / 50.0


# ── Main scoring function ──────────────────────────────────────────────────────

WEIGHTS = {
    "rating": 0.30,
    "distance": 0.25,
    "vehicle_match": 0.20,
    "success_rate": 0.15,
    "experience": 0.10,
}


def compute_driver_score(
    *,
    rating: Optional[float],
    driver_lat: Optional[float],
    driver_lon: Optional[float],
    pickup_lat: Optional[float],
    pickup_lon: Optional[float],
    driver_vehicle: Optional[str],
    required_vehicle: Optional[str],
    completed_trips: int,
    total_trips: int,
) -> dict:
    """
    Returns a dict with the overall score (0-100) and individual factor scores.
    """
    factors = {
        "rating": score_rating(rating),
        "distance": score_distance(driver_lat, driver_lon, pickup_lat, pickup_lon),
        "vehicle_match": score_vehicle_match(driver_vehicle, required_vehicle),
        "success_rate": score_success_rate(completed_trips, total_trips),
        "experience": score_experience(total_trips),
    }

    overall = sum(factors[k] * WEIGHTS[k] for k in factors) * 100

    # Round factor scores to percentages for display
    factor_scores = {k: round(v * 100, 1) for k, v in factors.items()}
    factor_scores["overall"] = round(overall, 1)

    return factor_scores
