/**
 * useHoldDetection Hook
 * 
 * React hook for hold detection with loading states and error handling.
 * Integrates with the hold detection service.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  detectHolds,
  detectHoldsFromUrl,
  analyzeBeta,
  analyzeWithAI,
  detectAndAnalyze,
  type DetectedHold,
  type HoldDetectionResponse,
  type BetaAnalysisResponse,
  type AIBetaResponse,
} from '@/lib/hold-detection';

interface UseHoldDetectionState {
  // Loading states
  isDetecting: boolean;
  isAnalyzing: boolean;
  
  // Results
  detection: HoldDetectionResponse | null;
  holds: DetectedHold[];
  betaAnalysis: AIBetaResponse | null;
  
  // Error state
  error: string | null;
}

interface UseHoldDetectionReturn extends UseHoldDetectionState {
  // Actions
  detect: (imageUri: string, confThreshold?: number) => Promise<HoldDetectionResponse | null>;
  detectFromUrl: (imageUrl: string, confThreshold?: number) => Promise<HoldDetectionResponse | null>;
  getAIBeta: (options?: AIBetaOptions) => Promise<AIBetaResponse | null>;
  detectAndGetBeta: (imageUri: string, options?: FullAnalysisOptions) => Promise<void>;
  saveToSupabase: (routeId: string, imageUrl: string) => Promise<string | null>;
  reset: () => void;
}

interface AIBetaOptions {
  holds?: DetectedHold[];
  userHeightCm?: number;
  userApeIndexCm?: number;
  routeAngle?: 'vertical' | 'overhang' | 'slab';
}

interface FullAnalysisOptions extends AIBetaOptions {
  confThreshold?: number;
}

export function useHoldDetection(): UseHoldDetectionReturn {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detection, setDetection] = useState<HoldDetectionResponse | null>(null);
  const [holds, setHolds] = useState<DetectedHold[]>([]);
  const [betaAnalysis, setBetaAnalysis] = useState<AIBetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Detect holds in a local image
   */
  const detect = useCallback(async (
    imageUri: string,
    confThreshold: number = 0.3
  ): Promise<HoldDetectionResponse | null> => {
    setIsDetecting(true);
    setError(null);
    
    try {
      const result = await detectHolds(imageUri, confThreshold);
      setDetection(result);
      setHolds(result.holds);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Detection failed';
      setError(message);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  /**
   * Detect holds from a remote URL
   */
  const detectFromUrl = useCallback(async (
    imageUrl: string,
    confThreshold: number = 0.3
  ): Promise<HoldDetectionResponse | null> => {
    setIsDetecting(true);
    setError(null);
    
    try {
      const result = await detectHoldsFromUrl(imageUrl, confThreshold);
      setDetection(result);
      setHolds(result.holds);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Detection failed';
      setError(message);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  /**
   * Get AI beta suggestions for currently detected holds
   */
  const getAIBeta = useCallback(async (
    options?: AIBetaOptions
  ): Promise<AIBetaResponse | null> => {
    const holdsToAnalyze = options?.holds || holds;
    
    if (holdsToAnalyze.length === 0) {
      setError('No holds detected. Please detect holds first.');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await analyzeWithAI(
        holdsToAnalyze,
        options?.userHeightCm ?? 170,
        options?.userApeIndexCm ?? 0,
        options?.routeAngle ?? 'vertical'
      );
      setBetaAnalysis(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beta analysis failed';
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [holds]);

  /**
   * Full pipeline: detect holds and get AI beta in one call
   */
  const detectAndGetBeta = useCallback(async (
    imageUri: string,
    options?: FullAnalysisOptions
  ): Promise<void> => {
    setIsDetecting(true);
    setError(null);

    try {
      const { detection: detectionResult, beta } = await detectAndAnalyze(imageUri, {
        confThreshold: options?.confThreshold,
        userHeightCm: options?.userHeightCm,
        userApeIndexCm: options?.userApeIndexCm,
        routeAngle: options?.routeAngle,
      });

      setDetection(detectionResult);
      setHolds(detectionResult.holds);
      
      if (beta) {
        setBetaAnalysis(beta);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
    } finally {
      setIsDetecting(false);
      setIsAnalyzing(false);
    }
  }, []);

  /**
   * Save detection results to Supabase
   */
  const saveToSupabase = useCallback(async (
    routeId: string,
    imageUrl: string
  ): Promise<string | null> => {
    if (!detection) {
      setError('No detection results to save');
      return null;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Must be logged in to save');
        return null;
      }

      // Insert hold detection record
      const { data, error: insertError } = await supabase
        .from('hold_detections')
        .insert({
          user_id: user.id,
          route_id: routeId,
          image_url: imageUrl,
          holds: holds,
          total_holds: detection.total_holds,
          processing_time_ms: detection.processing_time_ms,
          image_width: detection.image_width,
          image_height: detection.image_height,
          beta_analysis: betaAnalysis?.beta_analysis || null,
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      // Update the route with hold detection reference
      await supabase
        .from('routes')
        .update({
          hold_detection_id: data.id,
          holds_detected: holds,
        })
        .eq('id', routeId);

      return data.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setError(message);
      return null;
    }
  }, [detection, holds, betaAnalysis]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setIsDetecting(false);
    setIsAnalyzing(false);
    setDetection(null);
    setHolds([]);
    setBetaAnalysis(null);
    setError(null);
  }, []);

  return {
    // State
    isDetecting,
    isAnalyzing,
    detection,
    holds,
    betaAnalysis,
    error,
    
    // Actions
    detect,
    detectFromUrl,
    getAIBeta,
    detectAndGetBeta,
    saveToSupabase,
    reset,
  };
}

export default useHoldDetection;
