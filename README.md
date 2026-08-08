# 🚛 CargoMate 2.0 — Digital Freight Exchange & Fleet Management System

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.111-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![OSRM](https://img.shields.io/badge/Routing-OSRM_Engine-32CD32?style=for-the-badge&logo=openstreetmap)](https://project-osrm.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**CargoMate 2.0** is a full-stack, enterprise-grade digital freight matching and fleet management platform. It connects **Shippers** (cargo owners) with **Drivers & Transporters** in real time, featuring AI-powered turn-by-turn route optimization, a digital Proof of Delivery (POD) verification gate with instant payment lock, live GPS tracking, automated PDF invoice generation, and a high-contrast theme engine.

---

## 🌟 Key Features & Capabilities

### 1. 🚛 Shipper Operations Dashboard
- **Shipment Lifecycle Management**: Post cargo requirements with package details, target vehicle preference, weight, and pickup/delivery windows.
- **Driver Bidding & Recommendations**: Receive competitive driver bids and smart driver recommendation scores.
- **Track Vehicles UI**: Live Leaflet GPS vehicle tracking map with speed, ETA, distance, and direct driver chat.
- **Billing & Invoice Settlement**: Comprehensive billing dashboard with invoice status filters (Paid, Pending, In Progress).

### 2. 🚚 Driver & Transporter Dashboard
- **Available Job Marketplace**: Browse active freight postings filtered by route and package type.
- **Bid Submission**: Place custom fare bids on shipments.
- **Active Trip Terminal**: Live location broadcast feed with trip completion tools.
- **Earnings & Performance Analytics**: Detailed revenue charts, completed trip metrics, and customer rating breakdown.

### 3. 🗺️ Real Turn-by-Turn Route Optimization System (OSRM Engine)
Calculates and visualizes 3 distinct routing strategies with exact highway geometry (NH16, NH44, state highways):
- ⚡ **Fastest Route**: Prefers multi-lane expressways with minimal traffic delays (Minimum ETA).
- 📏 **Shortest Route**: Direct turn-by-turn road path minimizing overall mileage (Minimum Distance km).
- ⛽ **Lowest Fuel-Cost Route**: Eco-cruising velocity path optimizing vehicle km/L fuel efficiency (Minimum Fuel Cost ₹).
- **Vehicle Efficiency Ratings**: Configurable fuel consumption for 6 vehicle classes (`pickup`, `small_truck`, `van`, `medium_truck`, `large_truck`, `trailer`).
- **Eco Metrics**: Calculates fuel volume needed (Liters), total fuel cost (₹), and estimated CO₂ footprint (kg).

### 4. 📄 Digital Proof of Delivery (POD) Module & Payment Lock-Step
- **Driver Photo Upload**: Drivers submit live delivery proof photos upon arrival.
- **Shipper HTML5 Canvas Signature**: Shippers inspect photos and sign directly on an interactive canvas pad.
- **Payment Verification Gate**: Shippers complete payment during signature verification, automatically setting shipment & trip statuses to `paid` and `completed`.
- **Automated PDF Generator**: Generates official PDF certificates via ReportLab (`GET /api/pod/{pod_id}/pdf`) embedded with delivery photos, customer signatures, timestamps, and freight payment details.

### 5. 🔒 Tab Session Isolation
- Replaced global token pollution with isolated `sessionStorage` token management (`sessionStorage.getItem('authToken') || localStorage.getItem('authToken')`), enabling multi-tab testing for Shippers and Drivers simultaneously without 403 access contamination.

### 6. ☀️ Universal Light / Dark Theme Engine
- Includes a master high-contrast Light Theme engine (`body.light-theme`) ensuring flawless readability on all dashboards, cards, tables, inputs, and navigation drawers.

---

## 🏗️ Tech Stack

### **Frontend (`cargomate-react`)**
- **Framework**: React 18
- **Map & GIS**: React Leaflet, Leaflet, OpenStreetMap, OSRM Routing API
- **Styling**: Modern Vanilla CSS Design System with custom dark/light tokens
- **Routing**: React Router DOM (v6)

### **Backend (`fastapi-backend`)**
- **Framework**: Python 3.10+, FastAPI (v0.111)
- **Database ORM**: PostgreSQL, SQLAlchemy 2.0
- **PDF Engine**: ReportLab 4.2
- **Authentication**: JWT (JSON Web Tokens), Passlib (Bcrypt)
- **Rate Limiting**: SlowAPI

---

## 📁 Project Structure

```
CargoMate2.0/
├── cargomate-react/               # React 18 Frontend Application
│   ├── src/
│   │   ├── components/            # React Components
│   │   │   ├── RouteOptimizer.jsx        # Real Turn-by-Turn Route Engine
│   │   │   ├── ProofOfDeliveryModal.jsx  # Photo Upload, Canvas Signature & Payment
│   │   │   ├── LiveTrackingMap.jsx       # Real-time Leaflet Tracking Map
│   │   │   ├── Billing.jsx               # Invoices & Billing Stats
│   │   │   └── ...
│   │   ├── pages/                 # Main Dashboard Views
│   │   │   ├── ShipperDashboard.jsx
│   │   │   ├── DriverDashboard.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── styles/                # CSS Modular Stylesheets & Light Theme Engine
│   │   └── App.jsx
│   └── package.json
│
├── fastapi-backend/               # FastAPI Python Backend Service
│   ├── routers/                   # API Endpoints
│   │   ├── routes.py              # OSRM Route Optimization & History
│   │   ├── pod.py                 # Proof of Delivery & ReportLab PDF Engine
│   │   ├── shipments.py           # Shipment CRUD & Driver Ratings
│   │   ├── trips.py               # Active Trips & Live Location Broadcast
│   │   ├── bids.py                # Driver Bidding
│   │   └── auth.py                # JWT Auth & User Management
│   ├── models.py                  # SQLAlchemy Database Models
│   ├── schemas.py                 # Pydantic Request/Response Schemas
│   ├── database.py                # PostgreSQL Connection Setup
│   ├── main.py                    # FastAPI Entrypoint & Router Registry
│   └── requirements.txt
│
└── .gitignore
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js** v18+
- **Python** v3.10+
- **PostgreSQL** Database running locally or remote

---

### 1. Backend Setup (`fastapi-backend`)

1. Navigate to the backend directory:
   ```bash
   cd fastapi-backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure your `.env` environment variables:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/cargomate_db
   JWT_SECRET=your_super_secret_jwt_key
   ```

5. Start the FastAPI development server:
   ```bash
   python -m uvicorn main:app --reload --port 3000
   ```
   *Backend running at:* **`http://localhost:3000`**  
   *Interactive Swagger API Docs at:* **`http://localhost:3000/docs`**

---

### 2. Frontend Setup (`cargomate-react`)

1. Navigate to the frontend directory:
   ```bash
   cd cargomate-react
   ```

2. Install Node packages:
   ```bash
   npm install
   ```

3. Launch the React development server:
   ```bash
   $env:PORT=3001; npm start
   ```
   *Frontend running at:* **`http://localhost:3001`**

---

## 📡 API Reference Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new Shipper or Driver user |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT token |
| `POST` | `/api/routes/optimize` | Calculate 3 OSRM turn-by-turn road routes with ETA & fuel costs |
| `POST` | `/api/routes/save` | Save optimized route calculation to PostgreSQL history |
| `GET` | `/api/routes/history/{user_id}` | Retrieve user's route calculation history |
| `POST` | `/api/pod/submit` | Driver submits delivery photo & receiver details |
| `PUT` | `/api/pod/{pod_id}/verify` | Shipper signs canvas & completes payment lock |
| `GET` | `/api/pod/{pod_id}/pdf` | Generate ReportLab PDF Proof of Delivery Certificate |
| `PUT` | `/api/trips/{trip_id}/location` | Broadcast driver live GPS coordinates |

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👨‍💻 Author & Repository

- **GitHub Repository**: [Vinay-1704/Cargomate2.0](https://github.com/Vinay-1704/Cargomate2.0.git)
- **Developer**: Vinay
