/**
 * Hold Detection Service
 * 
 * API client for communicating with the FastAPI hold detection backend.
 * Handles image upload, hold detection, and beta analysis.
 */

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

// API URL - configure in app.config.js or .env
const API_URL = 
  process.env.EXPO_PUBLIC_HOLD_DETECTION_API_URL || 
  Constants?.expoConfig?.extra?.HOLD_DETECTION_API_URL || 
  'http://localhost:8081';

export interface DetectedHold {
  id: number;
  type: string;  // e.g., "hold", "volume"
  confidence: number;
  bbox: [number, number, number, number];  // [x1, y1, x2, y2]
  center: [number, number];  // [x, y]
  area: number;
}

export interface HoldDetectionResponse {
  success: boolean;
  holds: DetectedHold[];
  total_holds: number;
  image_width: number;
  image_height: number;
  processing_time_ms: number;
}

export interface BetaSequence {
  sequence_id: number;
  holds: number[];  // List of hold IDs in order
  difficulty_estimate: string;
  description: string;
  estimated_moves: number;
}

export interface BetaAnalysisResponse {
  success: boolean;
  sequences: BetaSequence[];
  user_context: {
    height_cm: number;
    ape_index_cm: number;
    reach_estimate_cm: number;
  };
}

export interface AIBetaResponse {
  success: boolean;
  beta_analysis: string;
  holds_analyzed: number;
}

/**
 * Detect climbing holds in an image
 * 
 * @param imageUri - Local file URI of the image
 * @param confThreshold - Confidence threshold (0-1), default 0.3
 * @returns Detection results with hold positions
 */
export async function detectHolds(
  imageUri: string,
  confThreshold: number = 0.3
): Promise<HoldDetectionResponse> {
  try {
    // Create form data for upload
    const formData = new FormData();
    
    // Get file extension
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
    
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: `climbing_wall.${fileExt}`,
    } as any);

    const response = await fetch(`${API_URL}/api/holds/detect?conf_threshold=${confThreshold}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Detection failed: ${response.status} - ${errorText}`);
    }

    const data: HoldDetectionResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Hold detection error:', error);
    throw error;
  }
}

/**
 * Detect holds from a remote image URL
 * Downloads the image first, then sends for detection
 * 
 * @param imageUrl - Remote URL of the image
 * @param confThreshold - Confidence threshold (0-1)
 * @returns Detection results
 */
export async function detectHoldsFromUrl(
  imageUrl: string,
  confThreshold: number = 0.3
): Promise<HoldDetectionResponse> {
  try {
    // Download the image to a temporary file
    const fileName = `temp_hold_detect_${Date.now()}.jpg`;
    const localUri = `${FileSystem.cacheDirectory}${fileName}`;
    
    const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
    
    if (downloadResult.status !== 200) {
      throw new Error(`Failed to download image: ${downloadResult.status}`);
    }
    
    // Now detect holds in the local file
    const result = await detectHolds(localUri, confThreshold);
    
    // Clean up temp file
    try {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    } catch {
      // Ignore cleanup errors
    }
    
    return result;
  } catch (error) {
    console.error('Hold detection from URL error:', error);
    throw error;
  }
}

/**
 * Analyze detected holds and generate beta suggestions
 * 
 * @param holds - Array of detected holds
 * @param userHeightCm - User's height in centimeters
 * @param userApeIndexCm - User's ape index (wingspan - height)
 * @returns Beta sequence suggestions
 */
export async function analyzeBeta(
  holds: DetectedHold[],
  userHeightCm: number = 170,
  userApeIndexCm: number = 0
): Promise<BetaAnalysisResponse> {
  try {
    const response = await fetch(`${API_URL}/api/holds/analyze-beta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        holds,
        user_height_cm: userHeightCm,
        user_ape_index_cm: userApeIndexCm,
      }),
    });

    if (!response.ok) {
      throw new Error(`Beta analysis failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Beta analysis error:', error);
    throw error;
  }
}

/**
 * Get AI-powered beta suggestions using Claude
 * 
 * @param holds - Array of detected holds
 * @param userHeightCm - User's height
 * @param userApeIndexCm - User's ape index
 * @param routeAngle - Wall angle: "vertical", "overhang", or "slab"
 * @returns AI-generated beta text
 */
export async function analyzeWithAI(
  holds: DetectedHold[],
  userHeightCm: number = 170,
  userApeIndexCm: number = 0,
  routeAngle: 'vertical' | 'overhang' | 'slab' = 'vertical'
): Promise<AIBetaResponse> {
  try {
    const response = await fetch(`${API_URL}/api/holds/analyze-beta-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        holds,
        user_height_cm: userHeightCm,
        user_ape_index_cm: userApeIndexCm,
        route_angle: routeAngle,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI beta analysis failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI beta analysis error:', error);
    throw error;
  }
}

/**
 * Check if the hold detection API is available
 * 
 * @returns Health check status
 */
export async function checkApiHealth(): Promise<{
  status: string;
  model_loaded: boolean;
}> {
  try {
    const response = await fetch(`${API_URL}/api/holds/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      return { status: 'unavailable', model_loaded: false };
    }

    return await response.json();
  } catch (error) {
    console.error('API health check error:', error);
    return { status: 'unavailable', model_loaded: false };
  }
}

/**
 * Full pipeline: detect holds and get AI beta
 * Convenience function that chains detection and AI analysis
 * 
 * @param imageUri - Image URI (local or remote)
 * @param options - Optional parameters
 * @returns Combined detection and beta results
 */
export async function detectAndAnalyze(
  imageUri: string,
  options?: {
    confThreshold?: number;
    userHeightCm?: number;
    userApeIndexCm?: number;
    routeAngle?: 'vertical' | 'overhang' | 'slab';
  }
): Promise<{
  detection: HoldDetectionResponse;
  beta: AIBetaResponse | null;
}> {
  const {
    confThreshold = 0.3,
    userHeightCm = 170,
    userApeIndexCm = 0,
    routeAngle = 'vertical',
  } = options || {};

  // Step 1: Detect holds
  const isRemote = imageUri.startsWith('http');
  const detection = isRemote
    ? await detectHoldsFromUrl(imageUri, confThreshold)
    : await detectHolds(imageUri, confThreshold);

  // Step 2: Get AI beta if holds were detected
  let beta: AIBetaResponse | null = null;
  if (detection.success && detection.holds.length > 0) {
    try {
      beta = await analyzeWithAI(
        detection.holds,
        userHeightCm,
        userApeIndexCm,
        routeAngle
      );
    } catch (error) {
      console.error('AI analysis failed, continuing without beta:', error);
    }
  }

  return { detection, beta };
}

export default {
  detectHolds,
  detectHoldsFromUrl,
  analyzeBeta,
  analyzeWithAI,
  checkApiHealth,
  detectAndAnalyze,
};
