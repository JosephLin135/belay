import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, View, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

import { Modal, Platform, StyleSheet, TextInput, TouchableOpacity, Text, FlatList, Alert, ActionSheetIOS, ActivityIndicator, ScrollView, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

// Helper function to get grade-based color
const getGradeColor = (grade?: string): string => {
  if (!grade || grade === '') return '#94A3B8';
  const gradeNum = parseInt(grade);
  if (gradeNum <= 2) return '#22C55E'; // Green for beginner
  if (gradeNum <= 5) return '#3B82F6'; // Blue for intermediate
  if (gradeNum <= 8) return '#F59E0B'; // Orange for advanced
  if (gradeNum <= 11) return '#EF4444'; // Red for expert
  return '#8B5CF6'; // Purple for elite
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Supabase-backed state
  const [routes, setRoutes] = useState<{ id: string; name: string; image?: string; grade?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal/form state
  const [modalVisible, setModalVisible] = useState(false);
  const [newRoute, setNewRoute] = useState('');
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('');

  // AI Beta modal state
  const [betaModalVisible, setBetaModalVisible] = useState(false);
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaText, setBetaText] = useState('');
  const [betaError, setBetaError] = useState('');
  const [betaRoute, setBetaRoute] = useState<{ name: string; image?: string } | null>(null);

  // Fetch routes from Supabase
  const fetchRoutes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setRoutes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRoutes();
    // Listen for auth state changes and refetch routes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      fetchRoutes();
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Edit a route
  const handleEditRoute = (idx: number) => {
    setEditIndex(idx);
    setNewRoute(routes[idx].name);
    setNewImage(routes[idx].image);
    setSelectedGrade(routes[idx].grade ?? '');
    setModalVisible(true);
    setError('');
  };

  // Request AI beta for a route
  const handleRequestBeta = async (route: { name: string; image?: string }) => {
    setBetaModalVisible(true);
    setBetaLoading(true);
    setBetaText('');
    setBetaError('');
    setBetaRoute(route);
    try {
      // Replace this URL with your actual AI endpoint
      const endpoint = 'https://api.example.com/beta-suggestion';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: route.name,
          image: route.image,
        }),
      });
      if (!response.ok) throw new Error('Failed to get beta suggestion');
      const data = await response.json();
      setBetaText(data.suggestion || 'No beta suggestion returned.');
    } catch (e: any) {
      setBetaError(e.message || 'Failed to get beta suggestion.');
    }
    setBetaLoading(false);
  };

  // Helper: upload image to Supabase Storage and return public URL
  const uploadImageToSupabase = async (uri: string) => {
    try {
      setUploading(true);
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `boulder_${Date.now()}.${fileExt}`;
      const fileType = `image/${fileExt}`;
      // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const fileBuffer = Buffer.from(base64, 'base64');
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage.from('boulder-images').upload(fileName, fileBuffer, {
        contentType: fileType,
        upsert: true,
      });
      if (error) throw error;
      // Get public URL
      const { data: publicUrlData } = supabase.storage.from('boulder-images').getPublicUrl(fileName);
      console.log('Uploaded image URL:', publicUrlData?.publicUrl);
      setUploading(false);
      return publicUrlData?.publicUrl || '';
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Image Upload Error', e.message || 'Failed to upload image.');
      return '';
    }
  };

  // Save or update a route (called when Save is pressed)
  const handleSaveRoute = async () => {
    if (!newRoute.trim()) {
      setError('Route name is required.');
      return;
    }
    setError('');
    // Get the signed-in user's ID (UUID, not email)
    let userId = '';
    try {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? '';
    } catch {}
    if (!userId) {
      Alert.alert('Error', 'You must be signed in to save routes.');
      return;
    }
    let imageUrl = newImage;
    console.log('Original newImage URI:', newImage);
    // If newImage is a local file (starts with file:/ or ph:// or is not http), upload it
    if (newImage && !newImage.startsWith('http')) {
      imageUrl = await uploadImageToSupabase(newImage);
      console.log('Image URL after upload:', imageUrl);
      if (!imageUrl) {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
        return;
      }
    }
    console.log('Saving route with image:', imageUrl);
    if (editIndex !== null) {
      // Edit mode: update existing route in Supabase
      const routeToEdit = routes[editIndex];
      const { error } = await supabase
        .from('routes')
        .update({
          name: newRoute.trim(),
          image: imageUrl,
          grade: selectedGrade,
        })
        .eq('id', routeToEdit.id);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setEditIndex(null);
    } else {
      // Add mode: add new route to Supabase
      const insertData = {
        user_id: userId,
        name: newRoute.trim(),
        image: imageUrl,
        grade: selectedGrade,
      };
      console.log('Inserting data:', JSON.stringify(insertData));
      const { data, error } = await supabase
        .from('routes')
        .insert([insertData])
        .select();
      console.log('Insert result:', JSON.stringify(data), 'Error:', error);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
    }
    setNewRoute('');
    setNewImage(undefined);
    setModalVisible(false);
    fetchRoutes();
  };

  // Delete a route by index
  const deleteRoute = async (idx: number) => {
    const routeToDelete = routes[idx];
    const { error } = await supabase
      .from('routes')
      .delete()
      .eq('id', routeToDelete.id);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    fetchRoutes();
  };

  // Show confirmation before deleting a route
  const confirmDeleteRoute = (idx: number) => {
    Alert.alert(
      'Delete Route',
      'Are you sure you want to delete this route?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRoute(idx) },
      ]
    );
  };

  // Handle picking/taking an image for a route
  const handleImageSelect = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (permission.granted) {
              const result = await ImagePicker.launchCameraAsync({
                quality: 1,
                allowsEditing: true,
              });
              if (!result.canceled && result.assets.length > 0) {
                setNewImage(result.assets[0].uri);
              }
            }
          } else if (buttonIndex === 2) {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 1,
              allowsEditing: true,
            });
            if (!result.canceled && result.assets.length > 0) {
              setNewImage(result.assets[0].uri);
            }
          }
        }
      );
    } else {
      Alert.alert(
        'Add Image',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: async () => {
              const permission = await ImagePicker.requestCameraPermissionsAsync();
              if (permission.granted) {
                const result = await ImagePicker.launchCameraAsync({
                  quality: 1,
                  allowsEditing: true,
                });
                if (!result.canceled && result.assets.length > 0) {
                  setNewImage(result.assets[0].uri);
                }
              }
            }
          },
          { text: 'Choose from Library', onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
                allowsEditing: true,
              });
              if (!result.canceled && result.assets.length > 0) {
                setNewImage(result.assets[0].uri);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  // Filter routes based on search text
  const filteredRoutes = routes.filter(route =>
    route.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Handle grade selection
  const handleGradeSelect = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: Array.from({ length: 15 }, (_, i) => `V${i}`),
        },
        (buttonIndex) => {
          setSelectedGrade(buttonIndex.toString());
        }
      );
    } else {
      Alert.alert(
        'Select Grade',
        '',
        Array.from({ length: 15 }, (_, i) => ({
          text: `V${i}`,
          onPress: () => setSelectedGrade(i.toString()),
        }))
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style='dark'/>
      
      {/* Hero Header Section */}
      <LinearGradient
        colors={['#1e4620', '#449e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroHeader, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroContent}>
            <View>
              <Text style={styles.heroTitle}>Boulder Buddy</Text>
              <Text style={styles.heroSubtitle}>Track your sends</Text>
            </View>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{routes.length}</Text>
            <Text style={styles.statLabel}>Routes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {routes.filter(r => r.grade !== undefined && r.grade !== '').length > 0 
                ? `V${Math.max(...routes.filter(r => r.grade).map(r => parseInt(r.grade || '0')))}`
                : '--'}
            </Text>
            <Text style={styles.statLabel}>Hardest</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="sparkles" size={20} color="#FFF" />
          </View>
        </View>
      </LinearGradient>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="layers-outline" size={22} color="#1E293B" />
            <Text style={styles.sectionTitle}>My Routes</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setModalVisible(true)} 
            style={styles.addButtonNew}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addButtonTextNew}>Log Route</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        {routes.length > 0 && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color="#94A3B8" style={styles.searchIcon} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search your routes..."
                style={styles.searchInput}
                placeholderTextColor="#94A3B8"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Routes List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1e4620" />
            <Text style={styles.loadingText}>Loading your sends...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRoutes}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <View style={styles.routeCard}>
                {/* Route Image */}
                <TouchableOpacity 
                  onPress={() => setEnlargedImage(item.image)}
                  style={styles.routeImageContainer}
                >
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.routeImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.routeImagePlaceholder}>
                      <Ionicons name="image-outline" size={28} color="#94A3B8" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Route Info */}
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.routeMeta}>
                    <View style={[
                      styles.gradeChip,
                      { backgroundColor: getGradeColor(item.grade) }
                    ]}>
                      <Text style={styles.gradeChipText}>
                        {item.grade !== undefined && item.grade !== '' ? `V${item.grade}` : 'V?'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.routeActions}>
                  <TouchableOpacity
                    style={styles.actionButtonBeta}
                    onPress={() => handleRequestBeta(item)}
                  >
                    <Ionicons name="bulb-outline" size={16} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButtonEdit}
                    onPress={() => handleEditRoute(index)}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#1E293B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButtonDelete}
                    onPress={() => confirmDeleteRoute(index)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="flag-outline" size={48} color="#CBD5E1" />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchText.trim().length > 0 ? 'No matches found' : 'No routes yet'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchText.trim().length > 0 
                    ? `No routes matching "${searchText.trim()}"`
                    : 'Start logging your climbing adventures!'}
                </Text>
                {!searchText.trim() && (
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => setModalVisible(true)}
                  >
                    <Ionicons name="add" size={20} color="#FFF" />
                    <Text style={styles.emptyButtonText}>Log Your First Route</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
      {/* Modal for AI Beta suggestion */}
      <Modal visible={betaModalVisible} animationType="slide" transparent>
        <View style={styles.betaModalOverlay}>
          <View style={styles.betaModalContent}>
            <LinearGradient
              colors={['#1e4620', '#449e']}
              style={styles.betaModalHeader}
            >
              <Ionicons name="bulb" size={28} color="#FFF" />
              <Text style={styles.betaModalTitle}>AI Beta Assistant</Text>
            </LinearGradient>
            
            <View style={styles.betaModalBody}>
              {betaRoute?.image && (
                <Image 
                  source={{ uri: betaRoute.image }} 
                  style={styles.betaRouteImage} 
                  resizeMode="cover" 
                />
              )}
              <Text style={styles.betaRouteName}>{betaRoute?.name}</Text>
              
              {betaLoading ? (
                <View style={styles.betaLoadingContainer}>
                  <ActivityIndicator size="large" color="#1e4620" />
                  <Text style={styles.betaLoadingText}>Analyzing your route...</Text>
                </View>
              ) : betaError ? (
                <View style={styles.betaErrorContainer}>
                  <Ionicons name="alert-circle" size={24} color="#EF4444" />
                  <Text style={styles.betaErrorText}>{betaError}</Text>
                </View>
              ) : (
                <ScrollView style={styles.betaScrollView}>
                  <Text style={styles.betaResultText}>{betaText}</Text>
                </ScrollView>
              )}
            </View>

            <TouchableOpacity 
              onPress={() => setBetaModalVisible(false)} 
              style={styles.betaCloseButton}
            >
              <Text style={styles.betaCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Modal for adding/editing a route */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <LinearGradient
              colors={['#1e4620', '#449e']}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeaderIcon}>
                <Ionicons name={editIndex !== null ? "pencil" : "add-circle"} size={24} color="#1e4620" />
              </View>
              <Text style={styles.modalHeaderTitle}>
                {editIndex !== null ? 'Edit Route' : 'Log New Route'}
              </Text>
              <Text style={styles.modalHeaderSubtitle}>
                {editIndex !== null ? 'Update your climb details' : 'Track your latest send'}
              </Text>
            </LinearGradient>

            <View style={styles.modalBody}>
              {/* Route Name Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Route Name</Text>
                <View style={styles.formInputWrapper}>
                  <Ionicons name="flag-outline" size={20} color="#64748B" />
                  <TextInput
                    value={newRoute}
                    onChangeText={setNewRoute}
                    placeholder="e.g., Midnight Lightning"
                    style={styles.formInput}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {error ? (
                  <View style={styles.formError}>
                    <Ionicons name="alert-circle" size={14} color="#EF4444" />
                    <Text style={styles.formErrorText}>{error}</Text>
                  </View>
                ) : null}
              </View>

              {/* Photo Section */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Photo</Text>
                {newImage ? (
                  <View style={styles.photoPreview}>
                    <ExpoImage
                      source={{ uri: newImage }}
                      style={styles.photoPreviewImage}
                      contentFit="cover"
                    />
                    <TouchableOpacity style={styles.photoChangeButton} onPress={handleImageSelect}>
                      <Ionicons name="camera" size={16} color="#FFF" />
                      <Text style={styles.photoChangeText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.photoAddButton} onPress={handleImageSelect}>
                    <View style={styles.photoAddIconCircle}>
                      <Ionicons name="camera-outline" size={28} color="#1e4620" />
                    </View>
                    <Text style={styles.photoAddText}>Add a photo of the route</Text>
                    <Text style={styles.photoAddHint}>Helps with AI beta suggestions</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Grade Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Grade</Text>
                <TouchableOpacity onPress={handleGradeSelect} style={styles.gradeSelectButton}>
                  <View style={[
                    styles.gradeSelectIcon,
                    { backgroundColor: getGradeColor(selectedGrade) }
                  ]}>
                    <Text style={styles.gradeSelectIconText}>
                      {selectedGrade ? `V${selectedGrade}` : 'V?'}
                    </Text>
                  </View>
                  <Text style={styles.gradeSelectText}>
                    {selectedGrade ? `V${selectedGrade}` : 'Select difficulty'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setEditIndex(null);
                  setError('');
                  setNewRoute('');
                  setNewImage(undefined);
                  setSelectedGrade('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveButton} 
                onPress={handleSaveRoute}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1e4620', '#449e']}
                  style={styles.modalSaveGradient}
                >
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.modalSaveText}>
                    {editIndex !== null ? 'Update' : 'Save Route'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal for enlarged route image */}
      <Modal visible={!!enlargedImage} transparent animationType="fade">
        <TouchableOpacity
          style={styles.enlargedImageOverlay}
          activeOpacity={1}
          onPress={() => setEnlargedImage(undefined)}
        >
          {enlargedImage && (
            <View style={styles.enlargedImageContainer}>
              <Image
                source={{ uri: enlargedImage }}
                style={styles.enlargedImage}
                resizeMode="contain"
              />
              <View style={styles.enlargedImageClose}>
                <Ionicons name="close-circle" size={32} color="#FFF" />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Modern climbing-focused styles
const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },

  // Hero Header
  heroHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  signOutText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Content Container
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  addButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e4620',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonTextNew: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // Search
  searchContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },

  // Route List
  listContent: {
    paddingBottom: 100,
  },

  // Route Card
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  routeImageContainer: {
    marginRight: 14,
  },
  routeImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  routeImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gradeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  routeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonBeta: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1e4620',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonEdit: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonDelete: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e4620',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },

  // Beta Modal
  betaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  betaModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  betaModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  betaModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  betaModalBody: {
    padding: 24,
    alignItems: 'center',
  },
  betaRouteImage: {
    width: 140,
    height: 140,
    borderRadius: 16,
    marginBottom: 16,
  },
  betaRouteName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  betaLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  betaLoadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },
  betaErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  betaErrorText: {
    color: '#EF4444',
    fontSize: 15,
  },
  betaScrollView: {
    maxHeight: 200,
    width: '100%',
  },
  betaResultText: {
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 24,
  },
  betaCloseButton: {
    marginHorizontal: 24,
    marginBottom: 34,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  betaCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },

  // Add/Edit Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeaderGradient: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  modalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  modalHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  modalBody: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  formInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 54,
    gap: 10,
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  formErrorText: {
    color: '#EF4444',
    fontSize: 13,
  },

  // Photo Section
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  photoPreviewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  photoChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    backgroundColor: '#1e4620',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  photoChangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  photoAddButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#B8D4F0',
    borderStyle: 'dashed',
    paddingVertical: 28,
  },
  photoAddIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F1FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoAddText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  photoAddHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },

  // Grade Selection
  gradeSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 54,
  },
  gradeSelectIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gradeSelectIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  gradeSelectText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },

  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSaveButton: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Enlarged Image Modal
  enlargedImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  enlargedImageContainer: {
    position: 'relative',
  },
  enlargedImage: {
    width: screenWidth - 40,
    height: screenWidth - 40,
    borderRadius: 16,
  },
  enlargedImageClose: {
    position: 'absolute',
    top: -50,
    right: 0,
  },
});
