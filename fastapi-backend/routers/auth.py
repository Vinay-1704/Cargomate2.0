from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user
import models
from schemas import UserRegister, UserLogin

router = APIRouter()


def _user_public(user: models.User) -> dict:
    """Return safe user dict (no password)."""
    base = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
    }
    if user.role == "driver":
        base.update({
            "license_number": user.license_number,
            "vehicle_type": user.vehicle_type,
            "vehicle_number": user.vehicle_number,
            "vehicle_capacity": user.vehicle_capacity,
            "rating": user.rating,
            "total_trips": user.total_trips,
        })
    return base


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/api/register", status_code=201)
def register(body: UserRegister, db: Session = Depends(get_db)):
    print(f"[KEY] Registration attempt: {body.email} {body.role}")

    if not all([body.name, body.email, body.phone, body.password, body.role]):
        raise HTTPException(status_code=400, detail="All fields are required")

    existing = db.query(models.User).filter(models.User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if body.role == "driver":
        if not all([body.license_number, body.vehicle_type, body.vehicle_number, body.vehicle_capacity]):
            raise HTTPException(status_code=400, detail="All driver fields required")

    user = models.User(
        name=body.name,
        email=body.email.lower(),
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=body.role,
        license_number=body.license_number,
        vehicle_type=body.vehicle_type,
        vehicle_number=body.vehicle_number,
        vehicle_capacity=body.vehicle_capacity,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"id": user.id, "email": user.email, "role": user.role})
    print(f"[OK] User registered: {user.email}")

    return {
        "success": True,
        "message": "Registration successful!",
        "token": token,
        "user": _user_public(user),
    }


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/api/login")
def login(body: UserLogin, db: Session = Depends(get_db)):
    print(f"[KEY] Login attempt: {body.email} {body.role}")

    if not all([body.email, body.password, body.role]):
        raise HTTPException(status_code=400, detail="All fields required")

    user = db.query(models.User).filter(
        models.User.email == body.email.lower(),
        models.User.role == body.role,
    ).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"id": user.id, "email": user.email, "role": user.role})
    print(f"[OK] Login successful: {user.email}")

    return {
        "success": True,
        "message": "Login successful!",
        "token": token,
        "user": _user_public(user),
    }
