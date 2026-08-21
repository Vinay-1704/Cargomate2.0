from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text,
    DateTime, Enum, ForeignKey, Numeric
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    shipper = "shipper"
    driver = "driver"

class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    blocked = "blocked"

class ShipmentStatus(str, enum.Enum):
    pending_bids = "pending_bids"
    active = "active"
    in_transit = "in_transit"
    delivered = "delivered"
    completed = "completed"
    cancelled = "cancelled"

class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"

class BidStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"

class TripStatus(str, enum.Enum):
    active = "active"
    in_transit = "in_transit"
    completed = "completed"
    cancelled = "cancelled"

class PackageType(str, enum.Enum):
    electronics = "electronics"
    furniture = "furniture"
    clothing = "clothing"
    food_items = "food items"
    books_documents = "books/documents"
    machinery = "machinery"
    other = "other"

class VehicleType(str, enum.Enum):
    small_truck = "small_truck"
    medium_truck = "medium_truck"
    large_truck = "large_truck"
    trailer = "trailer"
    pickup = "pickup"
    van = "van"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="shipper")

    # Driver-specific fields
    license_number = Column(String(100), nullable=True)
    vehicle_type = Column(String(50), nullable=True)
    vehicle_number = Column(String(50), nullable=True)
    vehicle_capacity = Column(String(50), nullable=True)

    # CamelCase aliases (kept for compatibility)
    vehicleType = Column(String(50), nullable=True)
    vehicleNumber = Column(String(50), nullable=True)
    capacity = Column(String(50), nullable=True)
    licenseNumber = Column(String(100), nullable=True)
    registrationDate = Column(String(50), nullable=True)

    # Stats
    rating = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    total_trips = Column(Integer, default=0)
    completed_trips = Column(Integer, default=0)  # for success rate calculation

    # Driver base / last known location (used by recommendation engine)
    driver_lat = Column(Float, nullable=True)
    driver_lon = Column(Float, nullable=True)
    driver_location_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Status
    status = Column(String(20), default="active")
    is_online = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    shipments_as_shipper = relationship("Shipment", foreign_keys="Shipment.shipper_id", back_populates="shipper")
    shipments_as_driver = relationship("Shipment", foreign_keys="Shipment.selected_driver_id", back_populates="selected_driver")
    bids = relationship("Bid", back_populates="driver")
    trips_as_driver = relationship("Trip", foreign_keys="Trip.driver_id", back_populates="driver")
    trips_as_shipper = relationship("Trip", foreign_keys="Trip.shipper_id", back_populates="shipper")


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(String(50), unique=True, nullable=False, index=True)
    shipper_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    from_location = Column(String(500), nullable=False)
    to_location = Column(String(500), nullable=False)

    # Structured Location & Pincode Precision Fields
    pickup_pincode = Column(String(10), nullable=True)
    pickup_district = Column(String(100), nullable=True)
    pickup_state = Column(String(100), nullable=True)
    delivery_pincode = Column(String(10), nullable=True)
    delivery_district = Column(String(100), nullable=True)
    delivery_state = Column(String(100), nullable=True)

    package_type = Column(String(50), nullable=False)
    package_weight = Column(Float, nullable=False)
    package_description = Column(Text, nullable=False)
    vehicle_type = Column(String(50), nullable=False)
    pickup_date = Column(String(50), nullable=False)
    special_instructions = Column(Text, default="")

    status = Column(String(30), default="pending_bids", index=True)
    selected_driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    final_amount = Column(Float, nullable=True)
    bid_count = Column(Integer, default=0)

    payment_status = Column(String(20), default="pending")
    payment_date = Column(DateTime(timezone=True), nullable=True)

    # Rating fields
    driver_rating = Column(Float, nullable=True)
    driver_review = Column(Text, default="")
    rated_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    shipper = relationship("User", foreign_keys=[shipper_id], back_populates="shipments_as_shipper")
    selected_driver = relationship("User", foreign_keys=[selected_driver_id], back_populates="shipments_as_driver")
    bids = relationship("Bid", back_populates="shipment", foreign_keys="Bid.shipment_ref_id")


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    bid_id = Column(String(50), unique=True, nullable=False, index=True)
    shipment_id = Column(String(50), nullable=False, index=True)      # String FK to Shipment.shipment_id
    shipment_ref_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)  # Integer FK for ORM relationship
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    driver_name = Column(String(255), nullable=True)
    driver_rating = Column(Float, nullable=True)
    vehicle_type = Column(String(50), nullable=True)
    vehicle_number = Column(String(50), nullable=True)
    license_number = Column(String(100), nullable=True)

    bid_amount = Column(Float, nullable=False)
    message = Column(Text, default="")
    status = Column(String(20), default="pending", index=True)
    estimated_delivery_time = Column(String(100), default="")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    driver = relationship("User", back_populates="bids")
    shipment = relationship("Shipment", back_populates="bids", foreign_keys=[shipment_ref_id])


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(String(50), unique=True, nullable=False, index=True)
    shipment_id = Column(String(50), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shipper_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    status = Column(String(20), default="active")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    rating = Column(Float, nullable=True)
    review = Column(Text, default="")
    notes = Column(Text, default="")
    payment_status = Column(String(20), default="pending")

    # Live tracking fields
    current_lat = Column(Float, nullable=True)
    current_lon = Column(Float, nullable=True)
    last_location_update = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    driver = relationship("User", foreign_keys=[driver_id], back_populates="trips_as_driver")
    shipper = relationship("User", foreign_keys=[shipper_id], back_populates="trips_as_shipper")


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    invitation_id = Column(String(50), unique=True, nullable=False, index=True)
    shipment_id = Column(String(50), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    shipper_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    driver = relationship("User", foreign_keys=[driver_id])
    shipper = relationship("User", foreign_keys=[shipper_id])


class ProofOfDelivery(Base):
    __tablename__ = "proof_of_delivery"

    id = Column(Integer, primary_key=True, index=True)
    pod_id = Column(String(50), unique=True, nullable=False, index=True)
    shipment_id = Column(String(50), nullable=False, index=True)
    trip_id = Column(String(50), nullable=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shipper_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Driver submits
    delivery_photo = Column(Text, nullable=False)       # base64 image
    receiver_name = Column(String(255), nullable=False)
    driver_notes = Column(Text, default="")
    
    # Shipper verifies
    signature_data = Column(Text, nullable=True)         # base64 PNG signature
    shipper_notes = Column(Text, default="")

    status = Column(String(30), default="pending_verification")  # pending_verification | verified | rejected
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    driver = relationship("User", foreign_keys=[driver_id])
    shipper_rel = relationship("User", foreign_keys=[shipper_id])


class RouteHistory(Base):
    __tablename__ = "route_history"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    pickup_location = Column(String(500), nullable=False)
    delivery_location = Column(String(500), nullable=False)
    pickup_lat = Column(Float, nullable=True)
    pickup_lon = Column(Float, nullable=True)
    delivery_lat = Column(Float, nullable=True)
    delivery_lon = Column(Float, nullable=True)

    vehicle_type = Column(String(50), nullable=False, default="medium_truck")
    selected_route_type = Column(String(50), nullable=False, default="fastest")  # fastest | shortest | lowest_fuel

    distance_km = Column(Float, nullable=False)
    duration_mins = Column(Float, nullable=False)
    fuel_liters = Column(Float, nullable=False)
    fuel_cost = Column(Float, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])


