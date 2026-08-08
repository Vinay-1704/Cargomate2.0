from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
import models

router = APIRouter()


@router.get("/api/driver/{driver_id}/performance")
def get_driver_performance(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[CHT] Fetching performance for driver: {driver_id}")

    # All completed shipments for driver
    all_completed = (
        db.query(models.Shipment)
        .filter(
            models.Shipment.selected_driver_id == driver_id,
            models.Shipment.status == "completed",
        )
        .all()
    )
    print(f"[PKG] Found {len(all_completed)} completed shipments for driver")

    # Rated shipments
    rated = [s for s in all_completed if s.driver_rating is not None]
    rated_sorted = sorted(rated, key=lambda s: s.rated_at or s.updated_at, reverse=True)

    total_ratings = len(rated)
    avg_rating = (
        round(sum(s.driver_rating for s in rated) / total_ratings, 1) if total_ratings > 0 else 0.0
    )

    # Rating distribution
    dist = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for s in rated:
        key = int(s.driver_rating)
        if key in dist:
            dist[key] += 1

    completed_trips = len(all_completed)

    reviews = [
        {
            "shipment_id": s.shipment_id,
            "from_location": s.from_location,
            "to_location": s.to_location,
            "driver_rating": s.driver_rating,
            "driver_review": s.driver_review or "",
            "rated_at": s.rated_at.isoformat() if s.rated_at else (s.updated_at.isoformat() if s.updated_at else None),
        }
        for s in rated_sorted
    ]

    performance = {
        "averageRating": avg_rating,
        "totalRatings": total_ratings,
        "completedTrips": completed_trips,
        "onTimeDeliveries": completed_trips,
        "onTimePercentage": 100 if completed_trips > 0 else 0,
        "ratingDistribution": dist,
    }

    print(f"[OK] Performance data computed. Reviews: {len(reviews)}")
    return {"success": True, "performance": performance, "reviews": reviews}
