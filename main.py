"""
Main FastAPI Application Entry Point
Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_hold_detection import router as hold_detection_router

app = FastAPI(
    title="Cruxly Hold Detection API",
    description="AI-powered climbing hold detection and beta analysis",
    version="1.0.0"
)

# CORS middleware for mobile app access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(hold_detection_router)


@app.get("/")
async def root():
    return {
        "message": "Cruxly Hold Detection API",
        "docs": "/docs",
        "health": "/api/holds/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
