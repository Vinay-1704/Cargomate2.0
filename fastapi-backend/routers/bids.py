import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
import models
from schemas import BidCreate

router = APIRouter()


def _bid_dict(b: models.Bid) -> dict:
    return {
        "id": b.id,
        "bid_id": b.bid_id,
        "shipment_id": b.shipment_id,
        "driver_id": b.driver_id,
        "driver_name": b.driver_name,
        "driver_rating": b.driver_rating,
        "vehicle_type": b.vehicle_type,
        "vehicle_number": b.vehicle_number,
        "license_number": b.license_number,
        "bid_amount": b.bid_amount,
        "message": b.message,
        "status": b.status,
        "createdAt": b.created_at.isoformat() if b.created_at else None,
    }


# ─── Place bid ────────────────────────────────────────────────────────────────

@router.post("/api/bids")
def place_bid(
    body: BidCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    driver_id = current_user["id"]
    print(f"[OUT] New bid: shipment={body.shipment_id} driver={driver_id} amount={body.bid_amount}")

    driver = db.query(models.User).filter(models.User.id == driver_id).first()
    if not driver or driver.role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can place bids")

    # Resolve shipment FK
    shipment = db.query(models.Shipment).filter(models.Shipment.shipment_id == body.shipment_id).first()

    bid = models.Bid(
        bid_id=f"BID-{int(time.time() * 1000)}",
        shipment_id=body.shipment_id,
        shipment_ref_id=shipment.id if shipment else None,
        driver_id=driver_id,
        driver_name=driver.name,
        driver_rating=driver.rating or 4.5,
        vehicle_type=driver.vehicle_type,
        vehicle_number=driver.vehicle_number,
        license_number=driver.license_number,
        bid_amount=body.bid_amount,
        message=body.message or "",
        status="pending",
    )
    db.add(bid)
    db.commit()
    db.refresh(bid)

    print(f"[OK] Bid placed: {bid.bid_id} Amount: {body.bid_amount}")
    return {"success": True, "message": "Bid placed successfully", "bid": _bid_dict(bid)}


# ─── Get bids by driver ───────────────────────────────────────────────────────

@router.get("/api/bids/driver/{driver_id}")
def get_driver_bids(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    bids = (
        db.query(models.Bid)
        .filter(models.Bid.driver_id == driver_id)
        .order_by(models.Bid.created_at.desc())
        .all()
    )
    return {"success": True, "bids": [_bid_dict(b) for b in bids]}


# ─── Accept bid ───────────────────────────────────────────────────────────────

@router.post("/api/bids/{bid_id}/accept")
def accept_bid(
    bid_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    bid = db.query(models.Bid).filter(models.Bid.bid_id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    # Accept this bid
    bid.status = "accepted"

    # Update shipment
    shipment = db.query(models.Shipment).filter(
        models.Shipment.shipment_id == bid.shipment_id
    ).first()
    if shipment:
        shipment.status = "active"
        shipment.selected_driver_id = bid.driver_id
        shipment.final_amount = bid.bid_amount

    # Reject all other bids for this shipment
    db.query(models.Bid).filter(
        models.Bid.shipment_id == bid.shipment_id,
        models.Bid.bid_id != bid_id,
    ).update({"status": "rejected"})

    # Create trip record
    trip = models.Trip(
        trip_id=f"TRIP-{int(time.time() * 1000)}",
        shipment_id=bid.shipment_id,
        driver_id=bid.driver_id,
        shipper_id=current_user["id"],
        status="active",
        started_at=datetime.now(timezone.utc),
    )
    db.add(trip)
    db.commit()
    db.refresh(bid)
    db.refresh(trip)

    print(f"[OK] Bid accepted: {bid_id} Trip created: {trip.trip_id}")
    return {
        "success": True,
        "message": "Bid accepted successfully",
        "bid": _bid_dict(bid),
        "trip": {
            "id": trip.id,
            "trip_id": trip.trip_id,
            "shipment_id": trip.shipment_id,
            "driver_id": trip.driver_id,
            "shipper_id": trip.shipper_id,
            "status": trip.status,
            "started_at": trip.started_at.isoformat() if trip.started_at else None,
        },
    }
