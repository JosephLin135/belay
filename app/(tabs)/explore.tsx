import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Platform, StyleSheet, Alert, ActionSheetIOS, Dimensions, FlatList, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Button, View, ScrollView, TouchableOpacity, Text, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

// Helper function to get grade-based color
const getGradeColor = (grade?: string): string => {
  if (!grade || grade === '' || grade === '0') return '#94A3B8';
  const gradeNum = parseInt(grade);
  if (gradeNum <= 2) return '#22C55E'; // Green for beginner
  if (gradeNum <= 5) return '#3B82F6'; // Blue for intermediate
  if (gradeNum <= 8) return '#F59E0B'; // Orange for advanced
  if (gradeNum <= 11) return '#EF4444'; // Red for expert
  return '#8B5CF6'; // Purple for elite
};

export default function TabTwoScreen(){
  const insets = useSafeAreaInsets();

  // Get signed-in user's email
  const [userEmail, setUserEmail] = useState('');
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data?.user?.email ?? '');
    })();
  }, []);

  // Fetch routes from Supabase for this user (use 'route_settings' table)
  useEffect(() => {
    const fetchUserRoutes = async (email: string) => {
      const { data, error } = await supabase
        .from('route_settings')
        .select('*')
        .eq('user_id', email)
        .order('created_at', { ascending: false });
      if (!error) setRoutes(data || []);
    };
    if (userEmail) fetchUserRoutes(userEmail);
    // Listen for auth state changes and refetch routes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user?.email) fetchUserRoutes(session.user.email);
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, [userEmail]);

  const router = useRouter();
  const grades = [
    'V0⇾V2',
    'V3⇾V5',
    'V6⇾V8',
    'V9⇾V11',
    'V12⇾V14',
  ];

  // State for selected grade, modal visibility, route description, saved routes, and enlarged description
  const [selectedGrades, setSelectedGrades] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [routeDescription, setRouteDescription] = useState('');
  const [routes, setRoutes] = useState<{ id: string, user_id: string, grade: string, grade_level: string, title: string, description: string, created_at?: string }[]>([]);
  const [routeTitle, setRouteTitle] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [enlargedDescription, setEnlargedDescription] = useState<string | null>(null);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState('0'); // For grade selection in modal
  const [newImage, setNewImage] = useState<string | null>(null); // For new image URI

  // Handle grade selection from the horizontal scroll bar
  const handleGradePress = (grade: string) => {
    setSelectedGrades(grade);
  };

  // Supabase-based add route
  const handleAddRoute = async () => {
    if (!routeTitle.trim()) {
      Alert.alert('Please enter a route title.');
      return;
    }
    if (!selectedGrades) {
      Alert.alert('Select a grade range first!');
      return;
    }
    if (!routeDescription.trim()) {
      Alert.alert('Please enter a description.');
      return;
    }
    if (selectedGradeLevel === '0') {
      Alert.alert('Please select a grade level.');
      return;
    }
    let error;
    if (editIndex !== null) {
      // Edit mode: update existing route
      const routeToEdit = routes[editIndex];
      ({ error } = await supabase
        .from('route_settings')
        .update({
          title: routeTitle.trim(),
          grade: selectedGrades,
          grade_level: selectedGradeLevel,
          description: routeDescription.trim(),
        })
        .eq('id', routeToEdit.id));
    } else {
      // Add mode: insert new route
      ({ error } = await supabase
        .from('route_settings')
        .insert([{
          user_id: userEmail,
          title: routeTitle.trim(),
          grade: selectedGrades,
          grade_level: selectedGradeLevel,
          description: routeDescription.trim(),
        }]));
    }
    if (error) {
      Alert.alert('Error saving route', error.message);
      return;
    }
    // Refetch routes
    const { data } = await supabase
      .from('route_settings')
      .select('*')
      .eq('user_id', userEmail)
      .order('created_at', { ascending: false });
    setRoutes(data || []);
    setModalVisible(false);
    setRouteTitle('');
    setRouteDescription('');
    setSelectedGradeLevel('0');
    setEditIndex(null);
  };

  // Supabase-based delete route
  const deleteRoute = async (idx: number) => {
    const routeToDelete = routes[idx];
    const { error } = await supabase
      .from('route_settings')
      .delete()
      .eq('id', routeToDelete.id);
    if (error) {
      Alert.alert('Error deleting route', error.message);
      return;
    }
    // Refetch routes
    const { data } = await supabase
      .from('route_settings')
      .select('*')
      .eq('user_id', userEmail)
      .order('created_at', { ascending: false });
    setRoutes(data || []);
  };

  // Wrap deleteRoute with a confirmation dialog
  const confirmDeleteRoute = (idx: number) => {
    Alert.alert(
      'Delete Route',
      'Are you sure you want to delete this route?',
      [
        { text: 'Delete', style: 'destructive', onPress: () => deleteRoute(idx) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Grade selection for modal (similar to index.tsx)
  const handleGradeSelect = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: Array.from({ length: 15 }, (_, i) => `V${i}`),
        },
        (buttonIndex) => {
          setSelectedGradeLevel(buttonIndex.toString());
        }
      );
    } else {
      Alert.alert(
        'Select Grade',
        '',
        Array.from({ length: 15 }, (_, i) => ({
          text: `V${i}`,
          onPress: () => setSelectedGradeLevel(i.toString()),
        }))
      );
    }
  };

  // Image picker result handling
  const handleImagePickerResult = (result: any) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewImage(result.assets[0].uri);
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
              <Text style={styles.heroTitle}>Boulder Vision</Text>
              <Text style={styles.heroSubtitle}>AI Route Setting Ideas</Text>
            </View>
          </View>
        </View>
        
        {/* Grade Filter Pills */}
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gradeFilterScroll}
          contentContainerStyle={styles.gradeFilterContent}
        >
          <TouchableOpacity 
            style={[
              styles.gradeFilterPill, 
              !selectedGrades && styles.gradeFilterPillActive
            ]} 
            onPress={() => setSelectedGrades(null)}
          >
            <Text style={[
              styles.gradeFilterText,
              !selectedGrades && styles.gradeFilterTextActive
            ]}>All</Text>
          </TouchableOpacity>
          {grades.map((grade, idx) => (
            <TouchableOpacity 
              key={grade + idx} 
              style={[
                styles.gradeFilterPill,
                selectedGrades === grade && styles.gradeFilterPillActive
              ]} 
              onPress={() => handleGradePress(grade)}
            >
              <Text style={[
                styles.gradeFilterText,
                selectedGrades === grade && styles.gradeFilterTextActive
              ]}>{grade}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="bulb-outline" size={22} color="#1E293B" />
            <Text style={styles.sectionTitle}>
              {selectedGrades ? `${selectedGrades} Routes` : 'All Routes'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => {
              if (!selectedGrades) setSelectedGrades(grades[0]);
              setModalVisible(true);
            }} 
            style={styles.addButtonNew}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addButtonTextNew}>New Idea</Text>
          </TouchableOpacity>
        </View>

        {/* Routes List */}
        <FlatList
          data={routes.filter(r => !selectedGrades || r.grade === selectedGrades)}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.routeCard}>
              {/* Route Info */}
              <View style={styles.routeInfo}>
                <Text style={styles.routeName} numberOfLines={1}>{item.title}</Text>
                <View style={styles.routeMeta}>
                  <View style={[
                    styles.gradeChip,
                    { backgroundColor: getGradeColor(item.grade_level) }
                  ]}>
                    <Text style={styles.gradeChipText}>
                      V{item.grade_level}
                    </Text>
                  </View>
                  <Text style={styles.gradeRangeText}>{item.grade}</Text>
                </View>
                <TouchableOpacity onPress={() => setEnlargedDescription(item.description)}>
                  <Text style={styles.routeDescription} numberOfLines={2}>
                    {item.description || 'No description'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.routeActions}>
                <TouchableOpacity
                  style={styles.actionButtonEdit}
                  onPress={() => {
                    setEditIndex(index);
                    setRouteTitle(item.title);
                    setSelectedGrades(item.grade);
                    setSelectedGradeLevel(item.grade_level);
                    setRouteDescription(item.description);
                    setModalVisible(true);
                  }}
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
                <Ionicons name="bulb-outline" size={48} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No route ideas yet</Text>
              <Text style={styles.emptySubtitle}>
                {selectedGrades 
                  ? `Create your first ${selectedGrades} route idea`
                  : 'Start creating route setting ideas!'}
              </Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => {
                  if (!selectedGrades) setSelectedGrades(grades[0]);
                  setModalVisible(true);
                }}
              >
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Create Route Idea</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      {/* Modal for adding a new route */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <LinearGradient
              colors={['#1e4620', '#449e']}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeaderIcon}>
                <Ionicons name={editIndex !== null ? "pencil" : "bulb"} size={24} color="#1e4620" />
              </View>
              <Text style={styles.modalHeaderTitle}>
                {editIndex !== null ? 'Edit Route Idea' : 'New Route Idea'}
              </Text>
              <Text style={styles.modalHeaderSubtitle}>
                {editIndex !== null ? 'Update your route setting idea' : 'Create a new route setting concept'}
              </Text>
            </LinearGradient>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Route Title Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Route Title</Text>
                <View style={styles.formInputWrapper}>
                  <Ionicons name="flag-outline" size={20} color="#64748B" />
                  <TextInput
                    value={routeTitle}
                    onChangeText={setRouteTitle}
                    placeholder="e.g., Crimp Ladder"
                    style={styles.formInput}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Description Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <View style={[styles.formInputWrapper, styles.formTextAreaWrapper]}>
                  <Ionicons name="document-text-outline" size={20} color="#64748B" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                  <TextInput
                    value={routeDescription}
                    onChangeText={setRouteDescription}
                    placeholder="Describe the route concept, holds, and movement style..."
                    style={[styles.formInput, styles.formTextArea]}
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={4}
                  />
                </View>
              </View>

              {/* Grade Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Grade</Text>
                <TouchableOpacity onPress={handleGradeSelect} style={styles.gradeSelectButton}>
                  <View style={[
                    styles.gradeSelectIcon,
                    { backgroundColor: getGradeColor(selectedGradeLevel) }
                  ]}>
                    <Text style={styles.gradeSelectIconText}>
                      {selectedGradeLevel && selectedGradeLevel !== '0' ? `V${selectedGradeLevel}` : 'V?'}
                    </Text>
                  </View>
                  <Text style={styles.gradeSelectText}>
                    {selectedGradeLevel && selectedGradeLevel !== '0' ? `V${selectedGradeLevel}` : 'Select difficulty'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Image upload section */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reference Image (Optional)</Text>
                {newImage ? (
                  <View style={styles.photoPreview}>
                    <Image
                      source={{ uri: newImage }}
                      style={styles.photoPreviewImage}
                    />
                    <TouchableOpacity
                      style={styles.photoChangeButton}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          aspect: [4, 3],
                          quality: 1,
                        });
                        handleImagePickerResult(result);
                      }}
                    >
                      <Ionicons name="camera" size={16} color="#FFF" />
                      <Text style={styles.photoChangeText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoAddButton}
                    onPress={async () => {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        allowsEditing: true,
                        aspect: [4, 3],
                        quality: 1,
                      });
                      handleImagePickerResult(result);
                    }}
                  >
                    <View style={styles.photoAddIconCircle}>
                      <Ionicons name="image-outline" size={28} color="#1e4620" />
                    </View>
                    <Text style={styles.photoAddText}>Add a reference image</Text>
                    <Text style={styles.photoAddHint}>Optional inspiration photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setRouteTitle('');
                  setRouteDescription('');
                  setSelectedGradeLevel('0');
                  setNewImage(null);
                  setEditIndex(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveButton} 
                onPress={handleAddRoute}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1e4620', '#449e']}
                  style={styles.modalSaveGradient}
                >
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.modalSaveText}>
                    {editIndex !== null ? 'Update' : 'Save Idea'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for enlarged description */}
      <Modal visible={!!enlargedDescription} transparent animationType="fade">
        <TouchableOpacity
          style={styles.enlargedOverlay}
          activeOpacity={1}
          onPress={() => setEnlargedDescription(null)}
        >
          <View style={styles.enlargedCard}>
            <View style={styles.enlargedHeader}>
              <Ionicons name="document-text" size={24} color="#1e4620" />
              <Text style={styles.enlargedTitle}>Description</Text>
            </View>
            <ScrollView style={styles.enlargedScrollView}>
              <Text style={styles.enlargedText}>{enlargedDescription}</Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.enlargedCloseButton}
              onPress={() => setEnlargedDescription(null)}
            >
              <Text style={styles.enlargedCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
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
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
  
  // Grade Filter
  gradeFilterScroll: {
    marginTop: 4,
  },
  gradeFilterContent: {
    paddingHorizontal: 0,
    gap: 8,
  },
  gradeFilterPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  gradeFilterPillActive: {
    backgroundColor: '#FFF',
  },
  gradeFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  gradeFilterTextActive: {
    color: '#449e',
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
  sectionEmoji: {
    fontSize: 20,
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
    borderRadius: 20,
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
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    gap: 10,
    marginBottom: 8,
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
  gradeRangeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  routeDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  routeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingVertical: 60,
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
    maxHeight: 400,
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
  formTextAreaWrapper: {
    height: 120,
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  formTextArea: {
    height: '100%',
    textAlignVertical: 'top',
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

  // Enlarged Description Modal
  enlargedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  enlargedCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
  },
  enlargedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  enlargedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  enlargedScrollView: {
    maxHeight: 250,
  },
  enlargedText: {
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 24,
  },
  enlargedCloseButton: {
    marginTop: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  enlargedCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
});
