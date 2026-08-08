import requests
import time
import sys

API_URL = "http://localhost:3000/api"
SHIPMENT_ID = "SHIP-1783711935646"

# Login to get token
login_data = {
    "email": "driver@test.com",
    "password": "Driver@123",
    "role": "driver"
}

print("Logging in as driver...")
response = requests.post(f"{API_URL}/login", json=login_data)
if not response.ok:
    print(f"Login failed: {response.text}")
    sys.exit(1)

token = response.json().get("token")
headers = {"Authorization": f"Bearer {token}"}

# Mumbai to Delhi rough path coordinates
# Mumbai: 19.0760, 72.8777
# Surat: 21.1702, 72.8311
# Ahmedabad: 23.0225, 72.5714
# Udaipur: 24.5854, 73.7125
# Jaipur: 26.9124, 75.7873
# Delhi: 28.7041, 77.1025

waypoints = [
    (19.0760, 72.8777),
    (19.5, 72.85),
    (20.0, 72.84),
    (20.5, 72.83),
    (21.1702, 72.8311),
    (21.8, 72.7),
    (22.5, 72.6),
    (23.0225, 72.5714),
    (23.5, 73.0),
    (24.0, 73.4),
    (24.5854, 73.7125),
    (25.5, 74.5),
    (26.2, 75.0),
    (26.9124, 75.7873),
    (27.5, 76.2),
    (28.0, 76.7),
    (28.7041, 77.1025)
]

print("Starting simulation... (Pushing location every 5 seconds)")

for lat, lon in waypoints:
    print(f"Driver is at: {lat}, {lon}")
    res = requests.put(
        f"{API_URL}/trips/{SHIPMENT_ID}/location",
        json={"lat": lat, "lon": lon},
        headers=headers
    )
    if not res.ok:
        print(f"Failed to update location: {res.text}")
    time.sleep(5)

print("Simulation complete! Driver reached Delhi.")
