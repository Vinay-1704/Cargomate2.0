import os
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler

from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

# ─── Import all models so SQLAlchemy can create tables ─────────────────────────
from database import engine, Base
import models  # noqa: F401 — registers all models with Base

# ─── Import routers ───────────────────────────────────────────────────────────
from routers import auth, shipments, bids, trips, earnings, performance, messages, admin, recommendations, pod, routes

# ─── Rate limiter (mirrors Express rate-limit config: 500/5min) ───────────────
def _get_real_ip(request: Request) -> str:
    ip = request.client.host if request.client else "127.0.0.1"
    # Skip rate limiting for localhost (mirrors Express `skip`)
    if ip in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
        return "whitelisted"
    return ip

limiter = Limiter(key_func=_get_real_ip, default_limits=["500/5minutes"])

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CargoMate API",
    description="🚛 CargoMate logistics platform — FastAPI + PostgreSQL edition",
    version="2.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS ─────────────────────────────────────────────────────────────────────
allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,http://localhost:5500",
)
allowed_origins = [o.strip() for o in allowed_origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)

# ─── Request logging ──────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"{request.method} {request.url.path}")
    response = await call_next(request)
    return response

# ─── Auto-create tables ───────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    print("🔧 CargoMate FastAPI Backend Starting...")
    Base.metadata.create_all(bind=engine)
    print("[OK] PostgreSQL tables created / verified successfully")
    print("[OK] Middleware configured successfully")

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(shipments.router)
app.include_router(bids.router)
app.include_router(trips.router)
app.include_router(earnings.router)
app.include_router(performance.router)
app.include_router(messages.router)
app.include_router(admin.router)
app.include_router(recommendations.router)
app.include_router(pod.router)
app.include_router(routes.router)

# ─── Health / root ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "🚛 CargoMate API with PostgreSQL!",
        "version": "2.0.0",
        "database": "PostgreSQL",
        "status": "OK",
    }

@app.get("/api/health")
def health():
    return {
        "success": True,
        "message": "Server healthy",
        "database": "PostgreSQL Connected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# ─── 404 handler ──────────────────────────────────────────────────────────────
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"success": False, "error": "Route not found"},
    )

@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    print(f"[ERR] Server error: {exc}")
    response = JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error", "detail": str(exc)},
    )
    # Manually add CORS headers so the browser can read the error
    origin = request.headers.get("origin", "")
    if origin in allowed_origins or "*" in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.middleware("http")
async def catch_all_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        print(f"[ERR] Unhandled exception: {exc}")
        import traceback; traceback.print_exc()
        response = JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )
        origin = request.headers.get("origin", "")
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3000"))
    print(f"[OK] Server running on http://localhost:{port}")
    print(f"📡 API: http://localhost:{port}/api")
    print(f"📘 Docs: http://localhost:{port}/docs")
    print(f"🗄️  Database: PostgreSQL")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
