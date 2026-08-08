# CargoMate FastAPI Backend

Python + FastAPI + PostgreSQL (SQLAlchemy) backend — full replacement for the original Express + MongoDB backend.  
All API endpoints, URL paths, and response shapes are identical — **the React frontend requires zero changes**.

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+ installed and running

---

## Setup

### 1. Create & activate a virtual environment
```powershell
cd fastapi-backend
python -m venv venv
.\venv\Scripts\activate
```

### 2. Install dependencies
```powershell
pip install -r requirements.txt
```

### 3. Configure environment
Edit `.env` and set your PostgreSQL credentials:
```
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/cargomate
```
> The database `cargomate` will be created automatically if it doesn't exist.  
> Make sure the user has CREATE DATABASE / CREATE TABLE privileges.

### 4. Create the PostgreSQL database (first time only)
Open psql and run:
```sql
CREATE DATABASE cargomate;
```

### 5. Start the server
```powershell
uvicorn main:app --reload --port 3000
```

Tables are auto-created on first startup via SQLAlchemy.

---

## API Docs

FastAPI auto-generates interactive docs:
- **Swagger UI**: http://localhost:3000/docs
- **ReDoc**: http://localhost:3000/redoc

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Register user |
| POST | `/api/login` | Login |
| POST | `/api/shipments` | Create shipment |
| GET  | `/api/shipments/available` | List available shipments |
| GET  | `/api/shipments/shipper/{id}` | Shipper's shipments |
| GET  | `/api/shipments/user/{id}` | User's shipments |
| GET  | `/api/shipments/{id}/bids` | Bids on a shipment |
| POST | `/api/shipments/{id}/rating` | Submit driver rating |
| PUT  | `/api/shipments/{id}/payment` | Mark payment done |
| POST | `/api/bids` | Place bid |
| GET  | `/api/bids/driver/{id}` | Driver's bids |
| POST | `/api/bids/{id}/accept` | Accept bid |
| GET  | `/api/trips/driver/{id}` | Driver trip list |
| PUT  | `/api/trips/{id}/status` | Update trip status |
| GET  | `/api/earnings/driver/{id}` | Driver earnings |
| GET  | `/api/driver/{id}/performance` | Driver performance |
| GET  | `/api/messages/{id}` | Get messages |
| POST | `/api/messages/{id}` | Send message |
| POST | `/api/payments/mark-paid` | Mark payment |
| PUT  | `/api/users/{id}` | Update user |
| POST | `/api/admin/migrate-payments` | Migrate payment status |
| GET  | `/api/health` | Health check |
