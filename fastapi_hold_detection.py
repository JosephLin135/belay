"""
FastAPI Hold Detection Endpoint for Cruxly
Integrates trained YOLO model with your existing backend

Add this to your existing FastAPI backend
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import cv2
import numpy as np
from ultralytics import YOLO
import io
from PIL import Image
import tempfile
import os

router = APIRouter(prefix="/api/holds", tags=["hold-detection"])

# Load model once at startup
MODEL_PATH = os.getenv("HOLD_DETECTION_MODEL_PATH", "models/hold_detector_best.pt")
try:
    hold_detector_model = YOLO(MODEL_PATH)
    print(f"✅ Hold detection model loaded from {MODEL_PATH}")
except Exception as e:
    print(f"⚠️ Warning: Could not load hold detection model: {e}")
    hold_detector_model = None


class DetectedHold(BaseModel):
    """Single detected hold"""
    id: int
    type: str  # e.g., "hold", "volume", or specific types if trained
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]
    center: List[float]  # [x, y]
    area: float  # Pixel area


class HoldDetectionResponse(BaseModel):
    """Response from hold detection endpoint"""
    success: bool
    holds: List[DetectedHold]
    total_holds: int
    image_width: int
    image_height: int
    processing_time_ms: float


class BetaSequence(BaseModel):
    """Suggested beta sequence"""
    sequence_id: int
    holds: List[int]  # List of hold IDs in order
    difficulty_estimate: str  # e.g., "V3", "V4"
    description: str  # e.g., "Start low, reach high to jug, heel hook"
    estimated_moves: int


@router.post("/detect", response_model=HoldDetectionResponse)
async def detect_holds_in_image(
    file: UploadFile = File(...),
    conf_threshold: float = 0.3,
    return_annotated_image: bool = False
):
    """
    Detect climbing holds in an uploaded image
    
    Args:
        file: Image file (JPG, PNG)
        conf_threshold: Confidence threshold (0-1)
        return_annotated_image: Whether to return annotated image URL
    
    Returns:
        Detected holds with bounding boxes and metadata
    """
    if not hold_detector_model:
        raise HTTPException(status_code=503, detail="Hold detection model not loaded")
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        if len(image_np.shape) == 3 and image_np.shape[2] == 3:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        # Run detection
        import time
        start_time = time.time()
        results = hold_detector_model(image_np, conf=conf_threshold)
        processing_time = (time.time() - start_time) * 1000
        
        # Extract holds
        holds = []
        for idx, box in enumerate(results[0].boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            confidence = box.conf[0].item()
            class_id = int(box.cls[0].item())
            class_name = results[0].names[class_id]
            
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            area = (x2 - x1) * (y2 - y1)
            
            holds.append(DetectedHold(
                id=idx,
                type=class_name,
                confidence=confidence,
                bbox=[x1, y1, x2, y2],
                center=[center_x, center_y],
                area=area
            ))
        
        # Optionally save annotated image to Supabase storage
        # (You'd implement this based on your Supabase setup)
        
        return HoldDetectionResponse(
            success=True,
            holds=holds,
            total_holds=len(holds),
            image_width=image.width,
            image_height=image.height,
            processing_time_ms=processing_time
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


@router.post("/detect-video")
async def detect_holds_in_video(
    file: UploadFile = File(...),
    conf_threshold: float = 0.3,
    sample_every_n_frames: int = 5
):
    """
    Detect holds in a climbing video (for beta analysis)
    
    Args:
        file: Video file (MP4, MOV)
        conf_threshold: Confidence threshold
        sample_every_n_frames: Process every Nth frame to speed up
    
    Returns:
        Holds detected across sampled frames
    """
    if not hold_detector_model:
        raise HTTPException(status_code=503, detail="Hold detection model not loaded")
    
    # Save uploaded video temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
    
    try:
        cap = cv2.VideoCapture(tmp_path)
        frame_count = 0
        all_holds = []
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Sample frames
            if frame_count % sample_every_n_frames == 0:
                results = hold_detector_model(frame, conf=conf_threshold)
                
                for box in results[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    all_holds.append({
                        'frame': frame_count,
                        'bbox': [x1, y1, x2, y2],
                        'confidence': box.conf[0].item(),
                        'center': [(x1 + x2) / 2, (y1 + y2) / 2]
                    })
            
            frame_count += 1
        
        cap.release()
        
        return JSONResponse({
            'success': True,
            'total_frames': frame_count,
            'frames_analyzed': frame_count // sample_every_n_frames,
            'total_holds_detected': len(all_holds),
            'holds': all_holds
        })
    
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


@router.post("/analyze-beta")
async def analyze_beta_from_holds(
    holds: List[DetectedHold],
    user_height_cm: Optional[int] = 170,
    user_ape_index_cm: Optional[int] = 0
):
    """
    Analyze detected holds and suggest beta sequences
    
    This is where you'd integrate Claude API to generate beta suggestions
    based on detected hold positions and user anthropometrics
    
    Args:
        holds: List of detected holds
        user_height_cm: User's height in cm
        user_ape_index_cm: Ape index (wingspan - height)
    
    Returns:
        Suggested beta sequences
    """
    # Sort holds by Y position (bottom to top)
    sorted_holds = sorted(holds, key=lambda h: h.center[1], reverse=True)
    
    # Simple heuristic: suggest low-to-high sequence
    # In production, you'd use Claude API here to analyze spatial relationships
    suggested_sequence = BetaSequence(
        sequence_id=1,
        holds=[h.id for h in sorted_holds[:8]],  # First 8 holds from bottom
        difficulty_estimate="V?",  # Would estimate based on spacing, hold types
        description="Start low on the large holds, work your way up using the crimps on the right",
        estimated_moves=len(sorted_holds[:8])
    )
    
    return {
        'success': True,
        'sequences': [suggested_sequence],
        'user_context': {
            'height_cm': user_height_cm,
            'ape_index_cm': user_ape_index_cm,
            'reach_estimate_cm': user_height_cm + user_ape_index_cm / 2
        }
    }


@router.get("/health")
async def health_check():
    """Check if hold detection service is ready"""
    return {
        'status': 'ready' if hold_detector_model else 'model_not_loaded',
        'model_path': MODEL_PATH,
        'model_loaded': hold_detector_model is not None
    }


# Example: Integrate with your existing Supabase session logging
@router.post("/save-route-analysis")
async def save_route_analysis(
    user_id: str,
    route_name: str,
    holds: List[DetectedHold],
    beta_sequence: Optional[List[int]] = None,
    # current_user = Depends(get_current_user)  # Your existing auth
):
    """
    Save analyzed route to database for future reference
    
    Store in Supabase:
    - route_id
    - user_id
    - detected_holds (JSON)
    - beta_sequence (JSON)
    - created_at
    """
    # Your Supabase integration here
    # supabase.table('analyzed_routes').insert({
    #     'user_id': user_id,
    #     'route_name': route_name,
    #     'holds': [h.dict() for h in holds],
    #     'beta_sequence': beta_sequence
    # }).execute()
    
    return {
        'success': True,
        'message': 'Route analysis saved',
        'route_name': route_name
    }
