import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
import models
from schemas import TripStatusUpdate, LocationUpdate

router = APIRouter()


# ─── Get driver trips ─────────────────────────────────────────────────────────

@router.get("/api/trips/driver/{driver_id}")
def get_driver_trips(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[TRK] Fetching trips for driver: {driver_id}")

    # Find accepted bids for this driver
    accepted_bids = (
        db.query(models.Bid)
        .filter(models.Bid.driver_id == driver_id, models.Bid.status == "accepted")
        .all()
    )
    print(f"[OK] Found {len(accepted_bids)} accepted bids for driver")

    if not accepted_bids:
        return {"success": True, "trips": [], "count": 0}

    trips = []
    for bid in accepted_bids:
        shipment = db.query(models.Shipment).filter(
            models.Shipment.shipment_id == bid.shipment_id
        ).first()
        if shipment:
            trips.append({
                "id": shipment.id,
                "shipment_id": shipment.shipment_id,
                "shipper_id": shipment.shipper_id,
                "from_location": shipment.from_location,
                "to_location": shipment.to_location,
                "package_type": shipment.package_type,
                "package_weight": shipment.package_weight,
                "package_description": shipment.package_description,
                "vehicle_type": shipment.vehicle_type,
                "pickup_date": shipment.pickup_date,
                "special_instructions": shipment.special_instructions,
                "status": shipment.status or "active",
                "selected_driver_id": shipment.selected_driver_id,
                "final_amount": shipment.final_amount,
                "payment_status": shipment.payment_status,
                "payment_date": shipment.payment_date.isoformat() if shipment.payment_date else None,
                "driver_rating": shipment.driver_rating,
                "createdAt": shipment.created_at.isoformat() if shipment.created_at else None,
                "updatedAt": shipment.updated_at.isoformat() if shipment.updated_at else None,
                # Bid overlay
                "bid_id": bid.bid_id,
                "bid_amount": bid.bid_amount,
                "driver_id": bid.driver_id,
                "driver_name": bid.driver_name,
            })

    print(f"[PKG] Returning {len(trips)} trips with full details")
    return {"success": True, "trips": trips, "count": len(trips)}


# ─── Update trip (shipment) status ────────────────────────────────────────────

@router.put("/api/trips/{trip_id}/status")
def update_trip_status(
    trip_id: int,                   # This is actually the Shipment.id (MongoDB _id equivalent)
    body: TripStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[LOC] Updating shipment status: {trip_id} to: {body.status}")

    shipment = db.query(models.Shipment).filter(models.Shipment.id == trip_id).first()
    if not shipment:
        print(f"[ERR] Shipment not found: {trip_id}")
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.status = body.status

    if body.status == "completed":
        shipment.completed_at = datetime.now(timezone.utc)  # type: ignore[attr-defined]

        # Find accepted bid and create/update Trip record
        accepted_bid = db.query(models.Bid).filter(
            models.Bid.shipment_id == shipment.shipment_id,
            models.Bid.status == "accepted",
        ).first()

        if accepted_bid and accepted_bid.driver_id:
            # Upsert Trip
            existing_trip = db.query(models.Trip).filter(
                models.Trip.shipment_id == shipment.shipment_id
            ).first()

            if existing_trip:
                existing_trip.status = "completed"
                existing_trip.completed_at = datetime.now(timezone.utc)
            else:
                new_trip = models.Trip(
                    trip_id=f"TRIP-{int(time.time() * 1000)}",
                    shipment_id=shipment.shipment_id,
                    driver_id=accepted_bid.driver_id,
                    shipper_id=shipment.shipper_id,
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                )
                db.add(new_trip)

            # Increment driver total_trips
            driver = db.query(models.User).filter(models.User.id == accepted_bid.driver_id).first()
            if driver:
                driver.total_trips = (driver.total_trips or 0) + 1

    db.commit()
    db.refresh(shipment)
    print("[OK] Shipment status updated successfully")
    return {"success": True, "message": "Status updated", "shipment": {
        "id": shipment.id,
        "shipment_id": shipment.shipment_id,
        "status": shipment.status,
        "updatedAt": shipment.updated_at.isoformat() if shipment.updated_at else None,
    }}


# ─── Update driver location ───────────────────────────────────────────────────

@router.put("/api/trips/{trip_id}/location")
def update_trip_location(
    trip_id: str,
    body: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Driver pushes their current GPS coordinates.
    trip_id can be a Trip.trip_id string (TRIP-xxx) or a Shipment.shipment_id (SHIP-xxx).
    """
    print(f"[GPS] Location update for trip: {trip_id} -> ({body.lat}, {body.lon})")

    trip = db.query(models.Trip).filter(
        (models.Trip.trip_id == trip_id) | (models.Trip.shipment_id == trip_id)
    ).first()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip.current_lat = body.lat
    trip.current_lon = body.lon
    trip.last_location_update = datetime.now(timezone.utc)
    db.commit()

    print(f"[OK] Location saved for trip {trip_id}")
    return {
        "success": True,
        "location": {
            "lat": trip.current_lat,
            "lon": trip.current_lon,
            "updated_at": trip.last_location_update.isoformat(),
        },
    }


# ─── Get driver location ─────────────────────────────────────────────────────

@router.get("/api/trips/{trip_id}/location")
def get_trip_location(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Shipper fetches the driver's latest GPS coordinates for a trip.
    trip_id can be a Trip.trip_id string (TRIP-xxx) or a Shipment.shipment_id (SHIP-xxx).
    """
    trip = db.query(models.Trip).filter(
        (models.Trip.trip_id == trip_id) | (models.Trip.shipment_id == trip_id)
    ).first()

    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Also fetch shipment for route info
    shipment = db.query(models.Shipment).filter(
        models.Shipment.shipment_id == trip.shipment_id
    ).first()

    return {
        "success": True,
        "location": {
            "lat": trip.current_lat,
            "lon": trip.current_lon,
            "updated_at": trip.last_location_update.isoformat() if trip.last_location_update else None,
        },
        "route": {
            "from_location": shipment.from_location if shipment else None,
            "to_location": shipment.to_location if shipment else None,
        },
        "trip_id": trip.trip_id,
        "shipment_id": trip.shipment_id,
        "status": trip.status,
    }
