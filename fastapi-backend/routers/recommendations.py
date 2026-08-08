"""
Recommendations Router
======================
GET  /api/recommendations/{shipment_id}   — Top 5 driver recommendations
PUT  /api/drivers/location                — Driver updates their base location
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth import get_current_user
import models
import schemas
from services.recommendation_engine import compute_driver_score, haversine_km
from services.geocoder import geocode

router = APIRouter(prefix="/api", tags=["recommendations"])


# ── GET top-5 recommended drivers for a shipment ──────────────────────────────

@router.get("/recommendations/{shipment_id}", response_model=schemas.RecommendationResponse)
async def get_recommendations(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # 1. Load the shipment
    shipment = (
        db.query(models.Shipment)
        .filter(models.Shipment.shipment_id == shipment_id)
        .first()
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Only the shipment owner can fetch recommendations
    if shipment.shipper_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # 2. Geocode the pickup location (async, cached)
    pickup_coords = await geocode(shipment.from_location)
    pickup_lat = pickup_coords[0] if pickup_coords else None
    pickup_lon = pickup_coords[1] if pickup_coords else None

    # 3. Pull all active drivers from DB
    drivers = (
        db.query(models.User)
        .filter(
            models.User.role == "driver",
            models.User.status == "active",
        )
        .all()
    )

    print(f"[REC] Evaluating {len(drivers)} drivers for shipment {shipment_id}")

    # 4. Compute score for each driver
    scored = []
    for driver in drivers:
        # Try to use driver's last known live position from trips (most recent)
        last_trip = (
            db.query(models.Trip)
            .filter(
                models.Trip.driver_id == driver.id,
                models.Trip.current_lat.isnot(None),
            )
            .order_by(models.Trip.last_location_update.desc())
            .first()
        )

        d_lat = last_trip.current_lat if last_trip else driver.driver_lat
        d_lon = last_trip.current_lon if last_trip else driver.driver_lon

        # Count completed trips from DB
        completed_count = (
            db.query(func.count(models.Trip.id))
            .filter(
                models.Trip.driver_id == driver.id,
                models.Trip.status == "completed",
            )
            .scalar()
        ) or 0

        total_count = (
            db.query(func.count(models.Trip.id))
            .filter(models.Trip.driver_id == driver.id)
            .scalar()
        ) or driver.total_trips or 0

        factor_scores = compute_driver_score(
            rating=driver.rating,
            driver_lat=d_lat,
            driver_lon=d_lon,
            pickup_lat=pickup_lat,
            pickup_lon=pickup_lon,
            driver_vehicle=driver.vehicle_type or driver.vehicleType,
            required_vehicle=shipment.vehicle_type,
            completed_trips=completed_count,
            total_trips=total_count,
        )

        # Compute actual distance_km for display
        dist_km = None
        if d_lat and d_lon and pickup_lat and pickup_lon:
            dist_km = round(haversine_km(d_lat, d_lon, pickup_lat, pickup_lon), 1)

        scored.append({
            "driver": driver,
            "scores": factor_scores,
            "distance_km": dist_km,
            "completed_trips": completed_count,
            "total_trips": total_count,
        })

    # 5. Sort by overall score descending, take top 5
    scored.sort(key=lambda x: x["scores"]["overall"], reverse=True)
    top5 = scored[:5]

    # 6. Build response
    recommendations = []
    for rank, item in enumerate(top5, start=1):
        d = item["driver"]
        s = item["scores"]
        recommendations.append(
            schemas.DriverRecommendation(
                driver_id=d.id,
                name=d.name,
                email=d.email,
                phone=d.phone,
                vehicle_type=d.vehicle_type or d.vehicleType,
                vehicle_number=d.vehicle_number or d.vehicleNumber,
                rating=d.rating or 0.0,
                total_trips=item["total_trips"],
                completed_trips=item["completed_trips"],
                is_online=d.is_online or False,
                scores=schemas.FactorScores(
                    rating=s["rating"],
                    distance=s["distance"],
                    vehicle_match=s["vehicle_match"],
                    success_rate=s["success_rate"],
                    experience=s["experience"],
                    overall=s["overall"],
                ),
                distance_km=item["distance_km"],
                rank=rank,
            )
        )

    if recommendations:
        print(f"[REC] Top driver: {recommendations[0].name} score={recommendations[0].scores.overall}")

    return schemas.RecommendationResponse(
        shipment_id=shipment_id,
        from_location=shipment.from_location,
        required_vehicle=shipment.vehicle_type,
        pickup_lat=pickup_lat,
        pickup_lon=pickup_lon,
        recommendations=recommendations,
        total_drivers_evaluated=len(drivers),
    )


# ── PUT driver updates their own base location ────────────────────────────────

@router.put("/drivers/location")
def update_driver_location(
    body: schemas.DriverLocationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can update location")

    driver = db.query(models.User).filter(models.User.id == current_user["id"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    from datetime import datetime, timezone
    driver.driver_lat = body.lat
    driver.driver_lon = body.lon
    driver.driver_location_updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "message": "Driver location updated"}


# ── POST create invitation ───────────────────────────────────────────────────

@router.post("/invitations")
def create_invitation(
    body: schemas.InvitationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    import time
    invitation_id = f"INV-{int(time.time() * 1000)}"

    # Check if invitation already exists
    existing = (
        db.query(models.Invitation)
        .filter(
            models.Invitation.shipment_id == body.shipment_id,
            models.Invitation.driver_id == body.driver_id,
        )
        .first()
    )
    if existing:
        return {"success": True, "message": "Driver already invited", "invitation_id": existing.invitation_id}

    invitation = models.Invitation(
        invitation_id=invitation_id,
        shipment_id=body.shipment_id,
        driver_id=body.driver_id,
        shipper_id=current_user["id"],
        status="pending",
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return {"success": True, "message": "Invitation sent to driver", "invitation_id": invitation_id}


# ── GET invitations for driver ────────────────────────────────────────────────

@router.get("/invitations/driver/{driver_id}")
def get_driver_invitations(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    invitations = (
        db.query(models.Invitation)
        .filter(models.Invitation.driver_id == driver_id)
        .order_by(models.Invitation.created_at.desc())
        .all()
    )

    result = []
    for inv in invitations:
        shipment = (
            db.query(models.Shipment)
            .filter(models.Shipment.shipment_id == inv.shipment_id)
            .first()
        )
        shipper = (
            db.query(models.User)
            .filter(models.User.id == inv.shipper_id)
            .first()
        )

        shipment_dict = None
        if shipment:
            shipment_dict = {
                "shipment_id": shipment.shipment_id,
                "from_location": shipment.from_location,
                "to_location": shipment.to_location,
                "package_type": shipment.package_type,
                "package_weight": shipment.package_weight,
                "package_description": shipment.package_description,
                "vehicle_type": shipment.vehicle_type,
                "pickup_date": shipment.pickup_date,
                "status": shipment.status,
                "shipper_name": shipper.name if shipper else "Shipper",
                "shipper_phone": shipper.phone if shipper else "",
            }

        result.append({
            "id": inv.id,
            "invitation_id": inv.invitation_id,
            "shipment_id": inv.shipment_id,
            "driver_id": inv.driver_id,
            "shipper_id": inv.shipper_id,
            "status": inv.status,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "shipment": shipment_dict,
        })

    return {"success": True, "invitations": result}


# ── GET invited driver IDs for shipment ──────────────────────────────────────

@router.get("/invitations/shipment/{shipment_id}")
def get_shipment_invitations(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    invitations = (
        db.query(models.Invitation)
        .filter(models.Invitation.shipment_id == shipment_id)
        .all()
    )
    invited_driver_ids = [inv.driver_id for inv in invitations]
    return {"success": True, "invited_driver_ids": invited_driver_ids}

