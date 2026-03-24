"""
Hold Detection Model Training Pipeline for Cruxly
Uses YOLOv8 with Roboflow datasets

Installation:
pip install ultralytics roboflow opencv-python pillow --break-system-packages

Usage:
python hold_detection_trainer.py --train
python hold_detection_trainer.py --test path/to/image.jpg
"""

import os
from pathlib import Path
from ultralytics import YOLO
from roboflow import Roboflow
import cv2
import argparse

class HoldDetector:
    def __init__(self, model_path=None):
        """
        Initialize hold detector
        
        Args:
            model_path: Path to trained model weights. If None, uses pretrained YOLOv8n
        """
        if model_path and os.path.exists(model_path):
            self.model = YOLO(model_path)
            print(f"✅ Loaded trained model from {model_path}")
        else:
            self.model = YOLO('yolov8n.pt')  # Start with pretrained nano model
            print("📦 Loaded pretrained YOLOv8n - ready to fine-tune")
    
    def download_dataset(self, api_key, workspace, project, version=1):
        """
        Download dataset from Roboflow
        
        Args:
            api_key: Your Roboflow API key (get from roboflow.com)
            workspace: Roboflow workspace name
            project: Project name
            version: Dataset version
        """
        rf = Roboflow(api_key=api_key)
        project = rf.workspace(workspace).project(project)
        dataset = project.version(version).download("yolov8")
        
        print(f"✅ Dataset downloaded to: {dataset.location}")
        return dataset.location
    
    def train(self, data_yaml_path, epochs=100, imgsz=640, batch=16):
        """
        Train the model on climbing hold dataset
        
        Args:
            data_yaml_path: Path to data.yaml (from Roboflow download)
            epochs: Number of training epochs
            imgsz: Image size for training
            batch: Batch size
        """
        print(f"🚀 Starting training for {epochs} epochs...")
        
        results = self.model.train(
            data=data_yaml_path,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            name='hold_detector',
            patience=20,  # Early stopping
            save=True,
            device='cpu',  # Change to 'cuda' if you have GPU
            
            # Augmentation settings for climbing holds
            hsv_h=0.015,  # Hue variation (helps with different colored holds)
            hsv_s=0.7,    # Saturation
            hsv_v=0.4,    # Value/brightness
            degrees=10,   # Random rotation (walls at different angles)
            translate=0.1,  # Random translation
            scale=0.5,    # Random scaling
            flipud=0.0,   # Don't flip upside down (holds have orientation)
            fliplr=0.5,   # Flip left-right is ok
            mosaic=1.0,   # Mosaic augmentation
        )
        
        print(f"✅ Training complete! Best model saved to: runs/detect/hold_detector/weights/best.pt")
        return results
    
    def detect(self, image_path, conf_threshold=0.25, save_output=True):
        """
        Detect holds in an image
        
        Args:
            image_path: Path to image
            conf_threshold: Confidence threshold (0-1)
            save_output: Whether to save annotated image
        
        Returns:
            List of detected holds with positions and confidence
        """
        results = self.model(image_path, conf=conf_threshold)
        
        holds = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = box.conf[0].item()
                class_id = int(box.cls[0].item())
                class_name = result.names[class_id]
                
                holds.append({
                    'bbox': [x1, y1, x2, y2],
                    'center': [(x1 + x2) / 2, (y1 + y2) / 2],
                    'confidence': confidence,
                    'type': class_name
                })
        
        print(f"✅ Detected {len(holds)} holds")
        
        if save_output:
            annotated = results[0].plot()
            output_path = f"detected_{Path(image_path).name}"
            cv2.imwrite(output_path, annotated)
            print(f"💾 Saved annotated image to: {output_path}")
        
        return holds
    
    def detect_video(self, video_path, conf_threshold=0.25, save_output=True):
        """
        Detect holds in video (for beta analysis)
        
        Args:
            video_path: Path to video file
            conf_threshold: Confidence threshold
            save_output: Whether to save annotated video
        """
        cap = cv2.VideoCapture(video_path)
        
        if save_output:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            out = cv2.VideoWriter('annotated_video.mp4', fourcc, fps, (width, height))
        
        frame_count = 0
        all_holds = []
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            results = self.model(frame, conf=conf_threshold)
            annotated = results[0].plot()
            
            # Extract holds from this frame
            holds = []
            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                holds.append({
                    'frame': frame_count,
                    'bbox': [x1, y1, x2, y2],
                    'confidence': box.conf[0].item(),
                })
            
            all_holds.extend(holds)
            
            if save_output:
                out.write(annotated)
            
            frame_count += 1
            if frame_count % 30 == 0:
                print(f"Processed {frame_count} frames...")
        
        cap.release()
        if save_output:
            out.release()
            print(f"✅ Saved annotated video to: annotated_video.mp4")
        
        return all_holds
    
    def export_to_api_format(self, model_path, format='onnx'):
        """
        Export model for production API use
        
        Args:
            model_path: Path to trained model
            format: Export format ('onnx', 'tflite', 'coreml')
        """
        model = YOLO(model_path)
        model.export(format=format)
        print(f"✅ Exported model to {format} format")


def quick_start_guide():
    """Step-by-step guide for first-time users"""
    print("""
╔═══════════════════════════════════════════════════════════════╗
║          CRUXLY HOLD DETECTION - QUICK START GUIDE            ║
╚═══════════════════════════════════════════════════════════════╝

STEP 1: Get a Roboflow Account (Free)
--------------------------------------
1. Go to roboflow.com and sign up
2. Go to Settings → API to get your API key

STEP 2: Download a Dataset
---------------------------
Using the Climb AI "Hold Detector" dataset (recommended):

Dataset Details:
  Workspace: climb-ai
  Project: hold-detector-rnvkl
  Features: Separates holds from volumes
  Images: Bouldering gym specific
  License: Open Source

Alternative datasets available:
- "Climbing Holds and Volumes" by Blackcreed
- "Climbing Holds Detector" by Gabriel Murry

STEP 3: Train Your Model
-------------------------
detector = HoldDetector()
dataset_path = detector.download_dataset(
    api_key="YOUR_API_KEY",
    workspace="climb-ai",
    project="hold-detector-rnvkl",
    version=1
)

# Train (will take 1-3 hours on CPU, faster with GPU)
detector.train(f"{dataset_path}/data.yaml", epochs=100)

STEP 4: Test It
---------------
detector = HoldDetector('runs/detect/hold_detector/weights/best.pt')
holds = detector.detect('path/to/climbing_wall.jpg')
print(holds)

STEP 5: Integrate with FastAPI
-------------------------------
See integration example below
""")


def main():
    parser = argparse.ArgumentParser(description='Cruxly Hold Detection Trainer')
    parser.add_argument('--guide', action='store_true', help='Show quick start guide')
    parser.add_argument('--train', action='store_true', help='Train model')
    parser.add_argument('--test', type=str, help='Test on image path')
    parser.add_argument('--test-video', type=str, help='Test on video path')
    parser.add_argument('--api-key', type=str, help='Roboflow API key')
    parser.add_argument('--workspace', type=str, default='climb-ai')
    parser.add_argument('--project', type=str, default='hold-detector-rnvkl')
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--model', type=str, help='Path to trained model weights')
    
    args = parser.parse_args()
    
    if args.guide:
        quick_start_guide()
        return
    
    detector = HoldDetector(args.model)
    
    if args.train:
        if not args.api_key:
            print("❌ Error: --api-key required for training")
            print("Get your API key from roboflow.com/settings")
            return
        
        # Download dataset
        dataset_path = detector.download_dataset(
            api_key=args.api_key,
            workspace=args.workspace,
            project=args.project
        )
        
        # Train
        detector.train(f"{dataset_path}/data.yaml", epochs=args.epochs)
    
    elif args.test:
        holds = detector.detect(args.test)
        print(f"\n📊 Detection Results:")
        for i, hold in enumerate(holds):
            print(f"  Hold {i+1}: {hold['type']}, confidence: {hold['confidence']:.2f}, center: {hold['center']}")
    
    elif args.test_video:
        holds = detector.detect_video(args.test_video)
        print(f"\n📊 Detected {len(holds)} holds across video")
    
    else:
        print("Use --guide to see quick start guide")
        print("Use --train to train a model")
        print("Use --test IMAGE_PATH to test detection")


if __name__ == "__main__":
    main()
