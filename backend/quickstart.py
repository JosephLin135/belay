#!/usr/bin/env python3
"""
Quick Start: Train Hold Detection with Climb AI Dataset
========================================================

This script gets you up and running with hold detection in minutes.

BEFORE YOU START:
1. Sign up for free at roboflow.com
2. Get your API key from roboflow.com/settings/api
3. Install dependencies: pip install ultralytics roboflow opencv-python --break-system-packages

USAGE:
    python quickstart_climb_ai.py YOUR_ROBOFLOW_API_KEY
"""

import sys
import os
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        print("""
╔═══════════════════════════════════════════════════════════════╗
║     CRUXLY HOLD DETECTION - CLIMB AI QUICK START             ║
╚═══════════════════════════════════════════════════════════════╝

ERROR: Missing Roboflow API key

USAGE:
    python quickstart_climb_ai.py YOUR_ROBOFLOW_API_KEY

STEPS:
1. Get free account: roboflow.com
2. Get API key: roboflow.com/settings/api
3. Run: python quickstart_climb_ai.py rf_xxxxxxxxxxxxx

WHAT THIS DOES:
✓ Downloads Climb AI's "Hold Detector" open-source dataset
✓ Trains a YOLOv8 model on your machine
✓ Tests detection on sample images
✓ Saves trained model ready for production
""")
        sys.exit(1)
    
    api_key = sys.argv[1]
    
    print("""
╔═══════════════════════════════════════════════════════════════╗
║              STARTING HOLD DETECTION TRAINING                 ║
╚═══════════════════════════════════════════════════════════════╝

Dataset: Climb AI "Hold Detector"
- Bouldering gym specific images
- Separates holds from volumes
- Open source, actively maintained
- Perfect for Cruxly's use case

Timeline:
├─ Step 1: Download dataset (2-5 minutes)
├─ Step 2: Train model (1-3 hours on CPU, 20-40 min on GPU)
└─ Step 3: Test & validate (5 minutes)

Starting in 3 seconds...
""")
    
    import time
    time.sleep(3)
    
    # Import training module
    try:
        from hold_detection_trainer import HoldDetector
    except ImportError:
        print("❌ Error: hold_detection_trainer.py not found in current directory")
        print("Make sure hold_detection_trainer.py is in the backend/ folder")
        sys.exit(1)
    
    print("\n" + "="*70)
    print("STEP 1: DOWNLOADING DATASET")
    print("="*70)
    
    detector = HoldDetector()
    
    try:
        dataset_path = detector.download_dataset(
            api_key=api_key,
            workspace="climb-ai",
            project="hold-detector-rnvkl",
            version=1
        )
        print(f"\n✅ Dataset downloaded successfully to: {dataset_path}")
    except Exception as e:
        print(f"\n❌ Failed to download dataset: {e}")
        print("\nTroubleshooting:")
        print("1. Check your API key is correct")
        print("2. Verify internet connection")
        print("3. Try visiting: https://universe.roboflow.com/climb-ai/hold-detector-rnvkl")
        sys.exit(1)
    
    print("\n" + "="*70)
    print("STEP 2: TRAINING MODEL")
    print("="*70)
    print("\nThis will take 1-3 hours on CPU (or 20-40 minutes with GPU)")
    print("You can grab coffee/go climbing while this runs! 🧗‍♂️\n")
    
    try:
        detector.train(
            data_yaml_path=f"{dataset_path}/data.yaml",
            epochs=100,  # Can reduce to 50 for faster testing
            imgsz=640,
            batch=16
        )
        print("\n✅ Training complete!")
        print(f"Model saved to: runs/detect/hold_detector/weights/best.pt")
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        sys.exit(1)
    
    print("\n" + "="*70)
    print("STEP 3: TESTING MODEL")
    print("="*70)
    
    # Check if there are any test images in the dataset
    test_images_dir = Path(dataset_path) / "test" / "images"
    if test_images_dir.exists():
        test_images = list(test_images_dir.glob("*.jpg"))[:3]  # Test on first 3 images
        
        if test_images:
            print(f"\nTesting on {len(test_images)} sample images...\n")
            
            trained_detector = HoldDetector("runs/detect/hold_detector/weights/best.pt")
            
            for img_path in test_images:
                print(f"Testing: {img_path.name}")
                holds = trained_detector.detect(str(img_path))
                print(f"  → Detected {len(holds)} holds\n")
    
    print("\n" + "="*70)
    print("🎉 SUCCESS! YOUR MODEL IS READY")
    print("="*70)
    
    print("""
NEXT STEPS:

1. Test on your own climbing photos:
   python hold_detection_trainer.py \\
     --test path/to/your/climbing_wall.jpg \\
     --model runs/detect/hold_detector/weights/best.pt

2. Integrate with FastAPI backend:
   - Copy best.pt to your backend: models/hold_detector_best.pt
   - Use the hold_detection_api.py endpoints
   - Deploy to production

3. Add to Cruxly mobile app:
   - Use components/hold-detection-overlay.tsx
   - Point API_URL to your backend

MODEL PERFORMANCE TIPS:
- If detection accuracy is low: train longer (--epochs 200)
- If detections are too sensitive: increase conf_threshold
- If missing holds: decrease conf_threshold
- To improve on YOUR gym: add your own photos to dataset

COST: $0 (everything is open source!)

Questions? Check HOLD_DETECTION_IMPLEMENTATION_GUIDE.md
""")

if __name__ == "__main__":
    main()
