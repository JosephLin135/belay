# Hold Detection Implementation Guide for Cruxly

## 🎯 Goal
Build a production-ready hold detection system that:
1. Detects climbing holds in photos/videos
2. Powers beta analysis features
3. Integrates with your existing React Native/FastAPI/Supabase stack
4. Can be trained/improved over time

---

## 📅 Week-by-Week Timeline

### **Week 1: Data Collection & Model Training**

#### Day 1-2: Get Training Data
**Option A: Use Climb AI Dataset (Recommended & Fastest)**

The Climb AI "Hold Detector" is perfect for Cruxly because:
- ✅ Open source and actively maintained
- ✅ Specifically designed for bouldering gyms
- ✅ Separates holds from volumes (exactly what you need)
- ✅ Already labeled and ready to train

```bash
# 1. Sign up for Roboflow account (free)
#    Go to: roboflow.com

# 2. Get API key from Settings → API

# 3. Quick start with Climb AI dataset
python quickstart_climb_ai.py YOUR_ROBOFLOW_API_KEY

# That's it! The script handles everything:
# - Downloads the dataset
# - Trains the model
# - Tests on sample images
```

**Option B: Collect Your Own Data (For gym-specific accuracy)**
1. Go to your climbing gym
2. Take 300-500 photos:
   - Different walls (vertical, overhang, slab)
   - Different lighting
   - Various hold colors/types
   - Include some climbers on walls
3. Upload to Roboflow
4. Annotate 50-100 images manually
5. Use Roboflow's auto-labeling for the rest
6. Export as YOLOv8 format

#### Day 3-5: Train Model
```bash
# Install dependencies
pip install ultralytics roboflow opencv-python pillow --break-system-packages

# EASIEST: Use the quick-start script
python quickstart_climb_ai.py YOUR_ROBOFLOW_API_KEY

# OR: Manual training with more control
python hold_detection_trainer.py \
  --train \
  --api-key YOUR_API_KEY \
  --workspace climb-ai \
  --project hold-detector-rnvkl \
  --epochs 100

# Test it
python hold_detection_trainer.py \
  --test path/to/climbing_wall.jpg \
  --model runs/detect/hold_detector/weights/best.pt
```

Expected results:
- mAP50: 85-95% (mean Average Precision at 50% IOU threshold)
- Precision: 80-90%
- Recall: 75-85%

#### Day 6-7: Validate & Iterate
```bash
# Test on real gym photos
# If accuracy is low on certain hold types:
# 1. Collect more examples of those holds
# 2. Add them to dataset
# 3. Retrain

# Export model for production
python -c "from ultralytics import YOLO; YOLO('runs/detect/hold_detector/weights/best.pt').export(format='onnx')"
```

---

### **Week 2: Backend Integration**

#### Day 1-2: Add FastAPI Endpoint

1. **Copy model to your backend:**
```bash
# In your FastAPI project directory
mkdir -p models
cp runs/detect/hold_detector/weights/best.pt models/hold_detector_best.pt
```

2. **Update requirements.txt:**
```txt
# Add to your existing requirements.txt
ultralytics==8.0.196
opencv-python-headless==4.8.1.78
pillow==10.1.0
```

3. **Add hold detection router:**
```python
# In your main.py or app.py
from fastapi_hold_detection import router as hold_detection_router

app.include_router(hold_detection_router)
```

4. **Set environment variable:**
```bash
export HOLD_DETECTION_MODEL_PATH="/path/to/models/hold_detector_best.pt"
```

#### Day 3-4: Add Supabase Storage Integration

```python
# Add to fastapi_hold_detection.py

from supabase import create_client

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

@router.post("/detect")
async def detect_holds_in_image(file: UploadFile = File(...)):
    # ... existing detection code ...
    
    # Save annotated image to Supabase storage
    annotated_image_bytes = cv2.imencode('.jpg', annotated_image)[1].tobytes()
    
    file_path = f"hold_detections/{user_id}/{timestamp}.jpg"
    supabase.storage.from_('climbing-images').upload(
        file_path,
        annotated_image_bytes,
        file_options={"content-type": "image/jpeg"}
    )
    
    # Save detection results to database
    supabase.table('hold_detections').insert({
        'user_id': user_id,
        'image_url': file_path,
        'holds': [h.dict() for h in holds],
        'total_holds': len(holds),
        'created_at': datetime.now().isoformat()
    }).execute()
```

#### Day 5-7: Test Backend Endpoints

```bash
# Test locally
uvicorn main:app --reload

# Test hold detection
curl -X POST "http://localhost:8000/api/holds/detect" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_wall.jpg" \
  -F "conf_threshold=0.3"

# Deploy to production (Railway, Render, AWS, etc.)
```

---

### **Week 3: Mobile App Integration**

#### Day 1-2: Add Dependencies to React Native

```bash
# In your Cruxly mobile app
npx expo install expo-image-picker
npx expo install @shopify/react-native-skia
```

#### Day 3-5: Implement Hold Detection Screen

1. Copy `HoldDetectionScreen.tsx` to your app
2. Add to your navigation:

```typescript
// In your navigation config
import HoldDetectionScreen from './screens/HoldDetectionScreen';

<Stack.Screen 
  name="HoldDetection" 
  component={HoldDetectionScreen}
  options={{ title: 'Detect Holds' }}
/>
```

3. Update API URL in component:
```typescript
// Replace in HoldDetectionScreen.tsx
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-api.cruxly.com';
```

#### Day 6-7: Test on Device

```bash
# Test on iOS
npx expo run:ios

# Test on Android
npx expo run:android

# Or use Expo Go
npx expo start
```

---

### **Week 4: AI Beta Analysis Integration**

#### Add Claude API for Beta Suggestions

```python
# In fastapi_hold_detection.py

from anthropic import Anthropic

anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

@router.post("/analyze-beta-ai")
async def analyze_beta_with_ai(
    holds: List[DetectedHold],
    user_height_cm: int,
    user_ape_index_cm: int,
    route_angle: str  # "vertical", "overhang", "slab"
):
    """Use Claude to generate intelligent beta suggestions"""
    
    # Format holds data for Claude
    holds_description = "\n".join([
        f"Hold {h.id}: at position ({h.center[0]:.0f}, {h.center[1]:.0f}), "
        f"type: {h.type}, confidence: {h.confidence:.2f}"
        for h in holds
    ])
    
    prompt = f"""You are an expert climbing coach. Analyze these detected holds and suggest beta.

Route Details:
- Wall angle: {route_angle}
- Total holds detected: {len(holds)}

Detected Holds (x, y coordinates):
{holds_description}

Climber Profile:
- Height: {user_height_cm}cm
- Ape index: {user_ape_index_cm}cm
- Effective reach: ~{user_height_cm + user_ape_index_cm/2}cm

Provide:
1. A suggested sequence (which holds to use in order)
2. Key beta tips (body position, footwork, etc.)
3. Difficulty estimate (V-grade)
4. Notes for shorter/taller climbers if relevant
"""
    
    response = anthropic.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    
    beta_text = response.content[0].text
    
    return {
        'success': True,
        'beta_analysis': beta_text,
        'holds_analyzed': len(holds)
    }
```

---

## 🚀 Production Deployment Checklist

### Backend (FastAPI)
- [ ] Model file deployed to server
- [ ] Environment variables set (MODEL_PATH, ANTHROPIC_API_KEY)
- [ ] Supabase storage bucket created
- [ ] Database table for hold_detections created
- [ ] HTTPS enabled
- [ ] Rate limiting on detection endpoints (prevent abuse)
- [ ] Image size limits enforced (max 10MB)

### Mobile App
- [ ] Image picker permissions configured
- [ ] Camera permissions configured
- [ ] API URL configured for production
- [ ] Error handling for offline mode
- [ ] Loading states for slow networks
- [ ] Image compression before upload

### Database Schema (Supabase)

```sql
-- Table: hold_detections
CREATE TABLE hold_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    image_url TEXT,
    holds JSONB,  -- Array of detected holds
    total_holds INTEGER,
    beta_analysis TEXT,  -- AI-generated beta
    route_name TEXT,
    route_grade TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_hold_detections_user_id ON hold_detections(user_id);
CREATE INDEX idx_hold_detections_created_at ON hold_detections(created_at);
```

---

## 💰 Cost Estimates

### Training (One-time)
- Roboflow Free Tier: $0
- Compute (CPU training): $0 (use your laptop)
- GPU rental (optional, Google Colab): $10/month

### Production (Monthly)
- FastAPI hosting (Render/Railway): $7-20/month
- Supabase storage: ~$0.02/GB
- Claude API: ~$0.003 per beta analysis
  - 1000 beta requests/month = ~$3
- Total: **~$15-30/month** for 1000 active users

---

## 📊 Success Metrics

Track these in your analytics:

```python
# Add to your analytics
{
  'hold_detection_accuracy': 0.92,  # % of holds correctly detected
  'avg_detection_time_ms': 450,
  'beta_requests_per_week': 150,
  'user_satisfaction_rating': 4.5,  # 1-5 stars
  'photos_processed': 2500,
}
```

---

## 🐛 Common Issues & Solutions

### Issue: Low detection accuracy
**Solution:**
- Collect more training data from YOUR gym specifically
- Increase training epochs to 200
- Adjust confidence threshold (lower = more detections, more false positives)

### Issue: Slow inference on mobile
**Solution:**
- Process on backend, not on-device
- Compress images before upload
- Use ONNX or TFLite quantized model

### Issue: Wrong beta suggestions
**Solution:**
- Improve prompt engineering for Claude
- Add more context (wall angle, hold types)
- Collect user feedback to refine prompts

---

## 🎓 Next Steps After MVP

1. **Hold Type Classification**
   - Train model to detect: jug, crimp, sloper, pinch, pocket
   - Better beta based on hold types

2. **Route Difficulty Estimation**
   - Train regression model on hold spacing → V-grade
   - Use community-labeled routes as training data

3. **Video Analysis**
   - Detect holds across video frames
   - Track body position relative to holds
   - Suggest technique improvements

4. **Community Features**
   - Users can rate beta quality
   - Share beta sequences
   - Crowdsource route difficulty ratings

---

## 📚 Resources

- [YOLOv8 Documentation](https://docs.ultralytics.com/)
- [Roboflow Datasets](https://universe.roboflow.com/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Claude API Docs](https://docs.anthropic.com/)
- [Expo Image Picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)

---

## ✅ You're Ready to Launch When...

- [ ] Model achieves >85% accuracy on test set
- [ ] Backend endpoint returns results in <2 seconds
- [ ] Mobile app can upload and display results
- [ ] AI beta suggestions are coherent and useful
- [ ] 5+ beta testers have successfully used it
- [ ] Error handling works (bad images, no internet, etc.)

**Estimated time to MVP: 3-4 weeks part-time**

Good luck! 🧗‍♂️
