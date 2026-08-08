from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
import models
from schemas import MarkPaidBody, UserUpdate

router = APIRouter()


# ─── Admin: migrate-payments ──────────────────────────────────────────────────

@router.post("/api/admin/migrate-payments")
def migrate_payments(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    result = (
        db.query(models.Shipment)
        .filter(
            models.Shipment.status == "completed",
            models.Shipment.payment_status != "paid",
        )
        .all()
    )
    count = 0
    for s in result:
        s.payment_status = "paid"
        s.payment_date = now
        count += 1
    db.commit()
    print(f"[OK] Migration complete: {count} shipments updated")
    return {"success": True, "message": "Updated completed shipments", "modified": count}


# ─── Payments: mark-paid ──────────────────────────────────────────────────────

@router.post("/api/payments/mark-paid")
def mark_paid(
    body: MarkPaidBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if body.shipment_id:
        db.query(models.Shipment).filter(
            models.Shipment.shipment_id == body.shipment_id
        ).update({"payment_status": "paid"})
    if body.trip_id:
        db.query(models.Trip).filter(
            models.Trip.trip_id == body.trip_id
        ).update({"payment_status": "paid"})
    db.commit()
    return {"success": True}


# ─── Update user ─────────────────────────────────────────────────────────────

@router.put("/api/users/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[~] Updating user: {user_id}")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(user, field):
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    print("[OK] User updated successfully")

    return {
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "license_number": user.license_number,
            "vehicle_type": user.vehicle_type,
            "vehicle_number": user.vehicle_number,
            "vehicle_capacity": user.vehicle_capacity,
            "vehicleType": user.vehicleType,
            "vehicleNumber": user.vehicleNumber,
            "capacity": user.capacity,
            "licenseNumber": user.licenseNumber,
            "registrationDate": user.registrationDate,
            "rating": user.rating,
            "total_trips": user.total_trips,
            "status": user.status,
            "is_online": user.is_online,
        },
    }
