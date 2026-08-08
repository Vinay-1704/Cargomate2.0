"""
Geocoding service — converts a location string to lat/lon using
Nominatim (OpenStreetMap) with a simple in-process cache.
"""

import httpx
from typing import Optional, Tuple

_cache: dict[str, Optional[Tuple[float, float]]] = {}


async def geocode(location: str) -> Optional[Tuple[float, float]]:
    """Return (lat, lon) for a location string, or None on failure."""
    key = location.strip().lower()
    if key in _cache:
        return _cache[key]

    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": location, "format": "json", "limit": 1}
        headers = {"User-Agent": "CargoMate-Recommendation/1.0"}

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params, headers=headers)
            data = response.json()

        if data:
            result = (float(data[0]["lat"]), float(data[0]["lon"]))
            _cache[key] = result
            return result
    except Exception as e:
        print(f"[GEOCODE] Error for '{location}': {e}")

    _cache[key] = None
    return None
