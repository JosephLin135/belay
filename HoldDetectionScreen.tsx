/**
 * HoldDetectionScreen.tsx
 * 
 * React Native component for Cruxly mobile app
 * Allows users to upload photos/videos and see detected holds
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Canvas, Path, Circle, Rect } from '@shopify/react-native-skia';

interface DetectedHold {
  id: number;
  type: string;
  confidence: number;
  bbox: number[];  // [x1, y1, x2, y2]
  center: number[];  // [x, y]
  area: number;
}

interface HoldDetectionResponse {
  success: boolean;
  holds: DetectedHold[];
  total_holds: number;
  image_width: number;
  image_height: number;
  processing_time_ms: number;
}

export default function HoldDetectionScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Request camera/gallery permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll permissions are required');
      return false;
    }
    return true;
  };

  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setImageDimensions({
        width: result.assets[0].width,
        height: result.assets[0].height
      });
      
      // Automatically detect holds
      detectHolds(uri);
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setImageDimensions({
        width: result.assets[0].width,
        height: result.assets[0].height
      });
      
      detectHolds(uri);
    }
  };

  // Upload image and detect holds
  const detectHolds = async (uri: string) => {
    setLoading(true);
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'climbing_wall.jpg',
      } as any);

      // Call your FastAPI backend
      const response = await fetch('https://your-api.cruxly.com/api/holds/detect', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          // Add your auth token here
          // 'Authorization': `Bearer ${authToken}`
        },
      });

      const data: HoldDetectionResponse = await response.json();

      if (data.success) {
        setDetectedHolds(data.holds);
        Alert.alert('Success', `Detected ${data.total_holds} holds!`);
      } else {
        Alert.alert('Error', 'Failed to detect holds');
      }
    } catch (error) {
      console.error('Hold detection error:', error);
      Alert.alert('Error', 'Could not process image');
    } finally {
      setLoading(false);
    }
  };

  // Get beta suggestions from detected holds
  const getBetaSuggestions = async () => {
    if (detectedHolds.length === 0) {
      Alert.alert('No holds detected', 'Please upload an image first');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('https://your-api.cruxly.com/api/holds/analyze-beta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          holds: detectedHolds,
          user_height_cm: 170,  // Get from user profile
          user_ape_index_cm: 0,  // Get from user profile
        }),
      });

      const data = await response.json();
      
      if (data.success && data.sequences.length > 0) {
        const beta = data.sequences[0];
        Alert.alert(
          'Beta Suggestion',
          beta.description,
          [{ text: 'Got it!' }]
        );
      }
    } catch (error) {
      console.error('Beta analysis error:', error);
      Alert.alert('Error', 'Could not analyze beta');
    } finally {
      setLoading(false);
    }
  };

  // Render detected holds overlay
  const renderHoldsOverlay = () => {
    if (!imageUri || detectedHolds.length === 0) return null;

    // Calculate scale factor (display size vs actual image size)
    const displayWidth = 350;
    const displayHeight = (imageDimensions.height / imageDimensions.width) * displayWidth;
    const scaleX = displayWidth / imageDimensions.width;
    const scaleY = displayHeight / imageDimensions.height;

    return (
      <View style={[styles.overlayContainer, { width: displayWidth, height: displayHeight }]}>
        <Canvas style={{ width: displayWidth, height: displayHeight }}>
          {detectedHolds.map((hold) => {
            const [x1, y1, x2, y2] = hold.bbox;
            const scaledX1 = x1 * scaleX;
            const scaledY1 = y1 * scaleY;
            const scaledX2 = x2 * scaleX;
            const scaledY2 = y2 * scaleY;
            const width = scaledX2 - scaledX1;
            const height = scaledY2 - scaledY1;

            return (
              <React.Fragment key={hold.id}>
                {/* Bounding box */}
                <Rect
                  x={scaledX1}
                  y={scaledY1}
                  width={width}
                  height={height}
                  color="rgba(0, 255, 0, 0.3)"
                  style="stroke"
                  strokeWidth={2}
                />
                
                {/* Center point */}
                <Circle
                  cx={hold.center[0] * scaleX}
                  cy={hold.center[1] * scaleY}
                  r={5}
                  color="#00ff00"
                />
              </React.Fragment>
            );
          })}
        </Canvas>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Hold Detection</Text>
      <Text style={styles.subtitle}>
        Upload a photo of a climbing wall to detect holds and get beta suggestions
      </Text>

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 Take Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>🖼️ Choose Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Detecting holds...</Text>
        </View>
      )}

      {/* Display image with holds overlay */}
      {imageUri && !loading && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
          />
          {renderHoldsOverlay()}
        </View>
      )}

      {/* Detection results */}
      {detectedHolds.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            ✅ Detected {detectedHolds.length} holds
          </Text>
          
          <TouchableOpacity
            style={styles.betaButton}
            onPress={getBetaSuggestions}
          >
            <Text style={styles.betaButtonText}>💡 Get Beta Suggestions</Text>
          </TouchableOpacity>

          {/* Hold details */}
          <View style={styles.holdsList}>
            {detectedHolds.map((hold) => (
              <View key={hold.id} style={styles.holdItem}>
                <Text style={styles.holdType}>Hold {hold.id + 1}</Text>
                <Text style={styles.holdConfidence}>
                  {(hold.confidence * 100).toFixed(1)}% confident
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  button: {
    flex: 1,
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  image: {
    width: 350,
    height: 500,
    borderRadius: 12,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  resultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  betaButton: {
    backgroundColor: '#00cc66',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  betaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  holdsList: {
    marginTop: 12,
  },
  holdItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  holdType: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  holdConfidence: {
    fontSize: 14,
    color: '#666',
  },
});
