from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    role: str
    license_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_capacity: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str
    role: str


# ─── User ─────────────────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_capacity: Optional[str] = None
    vehicleType: Optional[str] = None
    vehicleNumber: Optional[str] = None
    capacity: Optional[str] = None
    licenseNumber: Optional[str] = None
    registrationDate: Optional[str] = None
    is_online: Optional[bool] = None

    model_config = {"extra": "allow"}


# ─── Shipment ─────────────────────────────────────────────────────────────────

class ShipmentCreate(BaseModel):
    from_location: str
    to_location: str
    pickup_pincode: Optional[str] = None
    pickup_district: Optional[str] = None
    pickup_state: Optional[str] = None
    delivery_pincode: Optional[str] = None
    delivery_district: Optional[str] = None
    delivery_state: Optional[str] = None
    package_type: str
    package_weight: float
    package_description: str
    vehicle_type: str
    pickup_date: str
    special_instructions: Optional[str] = ""

    model_config = {"extra": "allow"}


class RatingBody(BaseModel):
    rating: float
    review: Optional[str] = ""


# ─── Bid ──────────────────────────────────────────────────────────────────────

class BidCreate(BaseModel):
    shipment_id: str
    bid_amount: float
    message: Optional[str] = ""


# ─── Trip ─────────────────────────────────────────────────────────────────────

class TripStatusUpdate(BaseModel):
    status: str


class LocationUpdate(BaseModel):
    lat: float
    lon: float


# ─── Message ──────────────────────────────────────────────────────────────────

class MessageBody(BaseModel):
    message: str
    sender_role: str


# ─── Payment ──────────────────────────────────────────────────────────────────

class MarkPaidBody(BaseModel):
    shipment_id: Optional[str] = None
    trip_id: Optional[str] = None


# ─── Driver Recommendations ───────────────────────────────────────────────────

class FactorScores(BaseModel):
    rating: float
    distance: float
    vehicle_match: float
    success_rate: float
    experience: float
    overall: float


class DriverRecommendation(BaseModel):
    driver_id: int
    name: str
    email: str
    phone: str
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    rating: float
    total_trips: int
    completed_trips: int
    is_online: bool
    scores: FactorScores
    distance_km: Optional[float] = None
    rank: int


class RecommendationResponse(BaseModel):
    shipment_id: str
    from_location: str
    required_vehicle: str
    pickup_lat: Optional[float] = None
    pickup_lon: Optional[float] = None
    recommendations: List[DriverRecommendation]
    total_drivers_evaluated: int


class DriverLocationUpdate(BaseModel):
    lat: float
    lon: float


class InvitationCreate(BaseModel):
    shipment_id: str
    driver_id: int


# ─── Proof of Delivery ───────────────────────────────────────────────────────

class PODDriverSubmit(BaseModel):
    shipment_id: str
    trip_id: Optional[str] = None
    delivery_photo: str        # base64 encoded image
    receiver_name: str
    driver_notes: Optional[str] = ""


class PODShipperVerify(BaseModel):
    signature_data: str        # base64 PNG of signature
    shipper_notes: Optional[str] = ""


# ─── Route Optimization ──────────────────────────────────────────────────────

class RouteOptimizeRequest(BaseModel):
    pickup_location: str
    delivery_location: str
    vehicle_type: Optional[str] = "medium_truck"
    fuel_price_per_liter: Optional[float] = 95.5


class RouteSaveRequest(BaseModel):
    pickup_location: str
    delivery_location: str
    pickup_lat: float
    pickup_lon: float
    delivery_lat: float
    delivery_lon: float
    vehicle_type: str
    selected_route_type: str  # fastest | shortest | lowest_fuel
    distance_km: float
    duration_mins: float
    fuel_liters: float
    fuel_cost: float


