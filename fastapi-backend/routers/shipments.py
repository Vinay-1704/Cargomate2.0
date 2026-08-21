from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session, joinedload

from database import get_db
from auth import get_current_user
import models
from schemas import ShipmentCreate, RatingBody

router = APIRouter()


def _shipment_dict(s: models.Shipment, include_driver: bool = False) -> dict:
    d = {
        "id": s.id,
        "_id": s.id,
        "shipment_id": s.shipment_id,
        "shipper_id": s.shipper_id,
        "from_location": s.from_location,
        "to_location": s.to_location,
        "pickup_pincode": getattr(s, 'pickup_pincode', None),
        "pickup_district": getattr(s, 'pickup_district', None),
        "pickup_state": getattr(s, 'pickup_state', None),
        "delivery_pincode": getattr(s, 'delivery_pincode', None),
        "delivery_district": getattr(s, 'delivery_district', None),
        "delivery_state": getattr(s, 'delivery_state', None),
        "package_type": s.package_type,
        "package_weight": s.package_weight,
        "package_description": s.package_description,
        "vehicle_type": s.vehicle_type,
        "pickup_date": s.pickup_date,
        "special_instructions": s.special_instructions,
        "status": s.status,
        "selected_driver_id": s.selected_driver_id,
        "final_amount": s.final_amount,
        "bid_count": s.bid_count,
        "payment_status": s.payment_status,
        "payment_date": s.payment_date.isoformat() if s.payment_date else None,
        "driver_rating": s.driver_rating,
        "driver_review": s.driver_review,
        "rated_at": s.rated_at.isoformat() if s.rated_at else None,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
        "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
    }
    if s.selected_driver:
        d["driver_name"] = s.selected_driver.name
        d["selected_driver_name"] = s.selected_driver.name
        d["driver_phone"] = s.selected_driver.phone
        d["driver"] = {
            "id": s.selected_driver.id,
            "name": s.selected_driver.name,
            "phone": s.selected_driver.phone,
            "vehicle_type": s.selected_driver.vehicle_type,
            "vehicle_number": s.selected_driver.vehicle_number,
        }

    if s.shipper:
        d["shipper_name"] = s.shipper.name
        d["shipper_phone"] = s.shipper.phone
        d["shipper_id_info"] = {
            "name": s.shipper.name,
            "phone": s.shipper.phone,
        }
    return d


# ─── Create shipment ──────────────────────────────────────────────────────────

@router.post("/api/shipments", status_code=201)
def create_shipment(
    body: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    import time
    shipment = models.Shipment(
        shipment_id=f"SHIP-{int(time.time() * 1000)}",
        shipper_id=current_user["id"],
        from_location=body.from_location,
        to_location=body.to_location,
        pickup_pincode=body.pickup_pincode,
        pickup_district=body.pickup_district,
        pickup_state=body.pickup_state,
        delivery_pincode=body.delivery_pincode,
        delivery_district=body.delivery_district,
        delivery_state=body.delivery_state,
        package_type=body.package_type,
        package_weight=body.package_weight,
        package_description=body.package_description,
        vehicle_type=body.vehicle_type,
        pickup_date=body.pickup_date,
        special_instructions=body.special_instructions or "",
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    print(f"[OK] Shipment created: {shipment.shipment_id}")
    return {"success": True, "message": "Shipment created successfully", "shipment": _shipment_dict(shipment)}


# ─── Available shipments ──────────────────────────────────────────────────────

@router.get("/api/shipments/available")
def get_available_shipments(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    shipments = (
        db.query(models.Shipment)
        .options(joinedload(models.Shipment.shipper))
        .filter(models.Shipment.status == "pending_bids")
        .all()
    )
    result = []
    for s in shipments:
        d = _shipment_dict(s)
        d["shipper_id"] = {
            "name": s.shipper.name if s.shipper else None,
            "phone": s.shipper.phone if s.shipper else None,
        }
        result.append(d)
    return {"success": True, "shipments": result}


# ─── Shipments by shipper (billing view) ─────────────────────────────────────

@router.get("/api/shipments/shipper/{shipper_id}")
def get_shipments_by_shipper(
    shipper_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[PKG] Fetching shipments for shipper: {shipper_id}")
    shipments = (
        db.query(models.Shipment)
        .options(joinedload(models.Shipment.selected_driver))
        .filter(models.Shipment.shipper_id == shipper_id)
        .order_by(models.Shipment.created_at.desc())
        .all()
    )
    result = []
    for s in shipments:
        d = _shipment_dict(s)
        d["selected_driver_name"] = s.selected_driver.name if s.selected_driver else None
        result.append(d)
    print(f"[OK] Found {len(result)} shipments for shipper")
    return {"success": True, "shipments": result, "count": len(result)}


# ─── Shipments by user ────────────────────────────────────────────────────────

@router.get("/api/shipments/user/{user_id}")
def get_shipments_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[PKG] Fetching shipments for user: {user_id}")
    shipments = (
        db.query(models.Shipment)
        .options(joinedload(models.Shipment.selected_driver))
        .filter(models.Shipment.shipper_id == user_id)
        .order_by(models.Shipment.created_at.desc())
        .all()
    )
    print(f"[OK] Found {len(shipments)} shipments")
    return {"success": True, "shipments": [_shipment_dict(s) for s in shipments]}


# ─── Get bids for shipment ────────────────────────────────────────────────────

@router.get("/api/shipments/{shipment_id}/bids")
def get_shipment_bids(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    bids = (
        db.query(models.Bid)
        .options(joinedload(models.Bid.driver))
        .filter(models.Bid.shipment_id == shipment_id)
        .order_by(models.Bid.bid_amount.asc(), models.Bid.created_at.asc())
        .all()
    )
    result = []
    for b in bids:
        bd = {
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
        if b.driver:
            bd["driver_id"] = {
                "name": b.driver.name,
                "phone": b.driver.phone,
                "rating": b.driver.rating,
                "vehicle_type": b.driver.vehicle_type,
                "vehicle_number": b.driver.vehicle_number,
                "vehicle_capacity": b.driver.vehicle_capacity,
                "license_number": b.driver.license_number,
            }
        result.append(bd)
    print(f"[OK] Found {len(result)} bids for shipment {shipment_id}")
    return {"success": True, "bids": result}


# ─── Submit rating ────────────────────────────────────────────────────────────

@router.post("/api/shipments/{shipment_id}/rating")
def submit_rating(
    shipment_id: str,
    body: RatingBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not body.rating or body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    # Find shipment by integer ID or string shipment_id
    query = db.query(models.Shipment)
    if shipment_id.isdigit():
        shipment = query.filter(
            (models.Shipment.id == int(shipment_id)) | (models.Shipment.shipment_id == shipment_id)
        ).first()
    else:
        shipment = query.filter(models.Shipment.shipment_id == shipment_id).first()

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.driver_rating = body.rating
    shipment.driver_review = body.review or ""
    shipment.rated_at = datetime.now(timezone.utc)

    # Recalculate assigned driver's average rating in users table
    if shipment.selected_driver_id:
        driver = db.query(models.User).filter(models.User.id == shipment.selected_driver_id).first()
        if driver:
            # Fetch all rated shipments for this driver
            driver_shipments = db.query(models.Shipment).filter(
                models.Shipment.selected_driver_id == driver.id,
                models.Shipment.driver_rating.isnot(None)
            ).all()
            
            ratings = [s.driver_rating for s in driver_shipments if s.driver_rating is not None]
            if body.rating not in ratings:
                ratings.append(body.rating)
            
            driver.total_ratings = len(ratings)
            driver.rating = round(sum(ratings) / len(ratings), 1) if ratings else body.rating

    db.commit()
    db.refresh(shipment)

    print(f"[OK] Rating {body.rating}⭐ submitted for shipment: {shipment.shipment_id}")
    return {"success": True, "shipment": _shipment_dict(shipment)}


# ─── Mark payment ─────────────────────────────────────────────────────────────

@router.put("/api/shipments/{shipment_id}/payment")
def mark_payment(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    shipment = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.payment_status = "paid"
    shipment.payment_date = datetime.now(timezone.utc)
    db.commit()
    db.refresh(shipment)
    return {"success": True, "shipment": _shipment_dict(shipment)}
