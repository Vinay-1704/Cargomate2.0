from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
import models

router = APIRouter()


@router.get("/api/earnings/driver/{driver_id}")
def get_driver_earnings(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[MON] Fetching earnings for driver: {driver_id}")

    completed_shipments = (
        db.query(models.Shipment)
        .filter(
            models.Shipment.selected_driver_id == driver_id,
            models.Shipment.status == "completed",
        )
        .order_by(models.Shipment.created_at.desc())
        .all()
    )

    total_earnings = sum(s.final_amount or 0 for s in completed_shipments)
    paid_earnings = sum(
        s.final_amount or 0 for s in completed_shipments if s.payment_status == "paid"
    )
    pending_earnings = total_earnings - paid_earnings

    transactions = [
        {
            "_id": s.id,
            "shipment_id": s.shipment_id,
            "from_location": s.from_location,
            "to_location": s.to_location,
            "amount": s.final_amount or 0,
            "completed_at": s.updated_at.isoformat() if s.updated_at else None,
            "payment_status": s.payment_status or "pending",
            "payment_date": s.payment_date.isoformat() if s.payment_date else None,
        }
        for s in completed_shipments
    ]

    return {
        "success": True,
        "earnings": {
            "totalEarnings": total_earnings,
            "paidEarnings": paid_earnings,
            "pendingEarnings": pending_earnings,
            "completedTrips": len(completed_shipments),
            "activeTrips": 0,
        },
        "transactions": transactions,
    }
