/**
 * HoldDetectionOverlay Component
 * 
 * Renders detected holds as bounding boxes overlaid on climbing wall images.
 * Can be used standalone or composed with other image components.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
} from 'react-native';
import type { DetectedHold } from '@/lib/hold-detection';

interface HoldDetectionOverlayProps {
  /** Array of detected holds from the API */
  holds: DetectedHold[];
  /** Original image width (from detection response) */
  imageWidth: number;
  /** Original image height (from detection response) */
  imageHeight: number;
  /** Display width of the image container */
  displayWidth: number;
  /** Display height of the image container */
  displayHeight: number;
  /** Show hold IDs as labels */
  showLabels?: boolean;
  /** Show confidence percentages */
  showConfidence?: boolean;
  /** Callback when a hold is tapped */
  onHoldPress?: (hold: DetectedHold) => void;
  /** Selected hold ID (for highlighting) */
  selectedHoldId?: number;
  /** Custom color for hold boxes (default: lime green) */
  boxColor?: string;
  /** Custom color for selected hold */
  selectedColor?: string;
}

/**
 * Get color based on hold confidence
 */
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return '#22C55E'; // Green - high confidence
  if (confidence >= 0.5) return '#F59E0B'; // Orange - medium confidence
  return '#EF4444'; // Red - low confidence
};

/**
 * Get color based on hold type
 */
const getHoldTypeColor = (type: string): string => {
  const typeColors: Record<string, string> = {
    hold: '#22C55E',    // Green for regular holds
    volume: '#3B82F6',  // Blue for volumes
    jug: '#10B981',     // Emerald for jugs
    crimp: '#F59E0B',   // Orange for crimps
    sloper: '#8B5CF6',  // Purple for slopers
    pinch: '#EC4899',   // Pink for pinches
    pocket: '#06B6D4',  // Cyan for pockets
  };
  return typeColors[type.toLowerCase()] || '#22C55E';
};

export default function HoldDetectionOverlay({
  holds,
  imageWidth,
  imageHeight,
  displayWidth,
  displayHeight,
  showLabels = true,
  showConfidence = false,
  onHoldPress,
  selectedHoldId,
  boxColor,
  selectedColor = '#FF6B00',
}: HoldDetectionOverlayProps) {
  // Calculate scale factors
  const scaleX = displayWidth / imageWidth;
  const scaleY = displayHeight / imageHeight;

  return (
    <View style={[styles.container, { width: displayWidth, height: displayHeight }]}>
      {holds.map((hold) => {
        const [x1, y1, x2, y2] = hold.bbox;
        const isSelected = selectedHoldId === hold.id;
        
        // Scale coordinates to display size
        const scaledX = x1 * scaleX;
        const scaledY = y1 * scaleY;
        const scaledWidth = (x2 - x1) * scaleX;
        const scaledHeight = (y2 - y1) * scaleY;
        
        // Determine box color
        const color = isSelected
          ? selectedColor
          : boxColor || getHoldTypeColor(hold.type);
        
        return (
          <TouchableOpacity
            key={hold.id}
            style={[
              styles.holdBox,
              {
                left: scaledX,
                top: scaledY,
                width: scaledWidth,
                height: scaledHeight,
                borderColor: color,
                backgroundColor: isSelected
                  ? `${color}40`  // 25% opacity when selected
                  : `${color}20`, // 12% opacity normally
              },
            ]}
            onPress={() => onHoldPress?.(hold)}
            activeOpacity={0.7}
            disabled={!onHoldPress}
          >
            {/* Hold label */}
            {showLabels && (
              <View style={[styles.labelContainer, { backgroundColor: color }]}>
                <Text style={styles.labelText}>
                  {hold.id + 1}
                  {showConfidence && ` (${Math.round(hold.confidence * 100)}%)`}
                </Text>
              </View>
            )}
            
            {/* Center dot */}
            <View
              style={[
                styles.centerDot,
                {
                  left: scaledWidth / 2 - 4,
                  top: scaledHeight / 2 - 4,
                  backgroundColor: color,
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Simple summary component showing detection results
 */
export function HoldDetectionSummary({
  holds,
  processingTimeMs,
}: {
  holds: DetectedHold[];
  processingTimeMs?: number;
}) {
  // Count holds by type
  const holdsByType = holds.reduce((acc, hold) => {
    acc[hold.type] = (acc[hold.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate average confidence
  const avgConfidence = holds.length > 0
    ? holds.reduce((sum, h) => sum + h.confidence, 0) / holds.length
    : 0;

  return (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>
        ✅ Detected {holds.length} holds
      </Text>
      
      <View style={styles.summaryStats}>
        {Object.entries(holdsByType).map(([type, count]) => (
          <View key={type} style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: getHoldTypeColor(type) }]} />
            <Text style={styles.statText}>
              {count} {type}{count > 1 ? 's' : ''}
            </Text>
          </View>
        ))}
      </View>
      
      <Text style={styles.summaryMeta}>
        Avg confidence: {Math.round(avgConfidence * 100)}%
        {processingTimeMs && ` • ${Math.round(processingTimeMs)}ms`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  holdBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  labelContainer: {
    position: 'absolute',
    top: -20,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.8,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statText: {
    fontSize: 14,
    color: '#4a4a4a',
  },
  summaryMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
});
