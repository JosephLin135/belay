import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ActionSheetIOS,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { resetOnboarding } from '@/components/onboarding-screen';
import { setSkipToAuthOnSignOut, triggerRouteSetterRefresh } from '@/app/(tabs)/_layout';
import { 
  getSavedPlan, 
  savePlanSelection, 
  getPlanById, 
  PLANS, 
  Plan, 
  PlanId,
  MembershipScreen 
} from '@/components/membership-screen';

const { width } = Dimensions.get('window');

// Simple base64 to ArrayBuffer decoder
function decode(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

interface UserProfile {
  id: string;
  name: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  home_gym?: string[];
  climbing_since?: string;
  max_grade?: string;
  preferred_style?: string;
  instagram_handle?: string;
  looking_for?: string[];
  is_route_setter?: boolean;
  route_setter_gym?: string;
}

interface GymSuggestion {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface UserStats {
  posts_count: number;
  comments_count: number;
  likes_received: number;
  likes_given: number;
}

const GRADE_OPTIONS = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14+'
];

const CLIMBING_STYLES = [
  { key: 'boulder', label: 'Bouldering', icon: 'cube-outline' },
  { key: 'sport', label: 'Sport Climbing', icon: 'trending-up-outline' },
  { key: 'trad', label: 'Trad Climbing', icon: 'shield-outline' },
  { key: 'top_rope', label: 'Top Rope', icon: 'arrow-up-outline' },
];

const LOOKING_FOR_OPTIONS = [
  { key: 'climbing_partner', label: 'Climbing Partners' },
  { key: 'belay_partner', label: 'Belay Partners' },
  { key: 'outdoor_trips', label: 'Outdoor Trips' },
  { key: 'training_buddy', label: 'Training Buddies' },
  { key: 'beta_advice', label: 'Beta & Advice' },
];

// Popular climbing gyms database (would be replaced with API in production)
const CLIMBING_GYMS: GymSuggestion[] = [
  { id: '1', name: 'Movement Gowanus', address: '575 Union St', city: 'Brooklyn, NY' },
  { id: '2', name: 'Brooklyn Boulders Queensbridge', address: '23-10 41st Ave', city: 'Queens, NY' },
  { id: '3', name: 'The Cliffs at LIC', address: '11-11 44th Dr', city: 'Long Island City, NY' },
  { id: '4', name: 'VITAL Brooklyn', address: '221 N 14th St', city: 'Brooklyn, NY' },
  { id: '5', name: 'Earth Treks Crystal City', address: '1235 S Clark St', city: 'Arlington, VA' },
  { id: '6', name: 'Planet Granite Portland', address: '1405 NW 14th Ave', city: 'Portland, OR' },
  { id: '7', name: 'Movement Denver', address: '1155 E Lincoln Ave', city: 'Denver, CO' },
  { id: '8', name: 'Austin Bouldering Project', address: '979 Springdale Rd', city: 'Austin, TX' },
  { id: '9', name: 'Sender One LAX', address: '6535 Santa Monica Blvd', city: 'Los Angeles, CA' },
  { id: '10', name: 'Touchstone Mission Cliffs', address: '2295 Harrison St', city: 'San Francisco, CA' },
  { id: '11', name: 'First Ascent Chicago', address: '2301 N Clybourn Ave', city: 'Chicago, IL' },
  { id: '12', name: 'Stone Summit Atlanta', address: '3701 Presidential Pkwy', city: 'Atlanta, GA' },
  { id: '13', name: 'Momentum Indoor Climbing', address: '220 W 10600 S', city: 'Sandy, UT' },
  { id: '14', name: 'Central Rock Gym', address: '299 Barber Ave', city: 'Worcester, MA' },
  { id: '15', name: 'MetroRock', address: '69 Norman St', city: 'Everett, MA' },
];

function isSupabaseStub(supabase: any) {
  return (
    !supabase ||
    typeof supabase.auth?.signUp !== 'function' ||
    (supabase.auth.signUp.toString().includes('Supabase client not initialized'))
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({ posts_count: 0, comments_count: 0, likes_received: 0, likes_given: 0 });
  const [refreshing, setRefreshing] = useState(false);
  
  // Plan state
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<Plan | null>(null);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  
  // Editable fields
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bio, setBio] = useState('');
  const [homeGyms, setHomeGyms] = useState<string[]>([]);
  const [climbingSince, setClimbingSince] = useState('');
  const [maxGrade, setMaxGrade] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  
  // UI State
  const [profileTab, setProfileTab] = useState<'identity' | 'climbing'>('identity');
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showGymSearch, setShowGymSearch] = useState(false);
  const [gymSearchQuery, setGymSearchQuery] = useState('');
  const [gymSuggestions, setGymSuggestions] = useState<GymSuggestion[]>([]);
  
  // Route Setter State
  const [isRouteSetter, setIsRouteSetter] = useState(false);
  const [routeSetterGym, setRouteSetterGym] = useState('');
  const [showRouteSetterModal, setShowRouteSetterModal] = useState(false);
  const [hasPendingApplication, setHasPendingApplication] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  
  // Application form fields
  const [appFullName, setAppFullName] = useState('');
  const [appGymName, setAppGymName] = useState('');
  const [appExperience, setAppExperience] = useState('');
  const [appAdditionalInfo, setAppAdditionalInfo] = useState('');

  useEffect(() => {
    loadProfile();
    loadCurrentPlan();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfile(), loadCurrentPlan()]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadCurrentPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('plan_id')
          .eq('id', user.id)
          .single();

        if (profileData?.plan_id) {
          const plan = getPlanById(profileData.plan_id as PlanId);
          if (plan) {
            setCurrentPlan(plan);
            await savePlanSelection(plan.id);
            return;
          }
        }
      }
    } catch (e) {
      // ignore and fall back to local storage
    }

    const planId = await getSavedPlan();
    if (planId) {
      const plan = getPlanById(planId);
      if (plan) setCurrentPlan(plan);
    } else {
      // Default to free plan
      setCurrentPlan(PLANS[0]);
    }
  };

  const loadProfile = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUser(user);

      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile:', profileError);
      }

      if (profileData) {
        setProfile(profileData);
        setName(profileData.name || user.user_metadata?.full_name || user.user_metadata?.name || '');
        setDisplayName(profileData.display_name || '');
        setAvatarUrl(profileData.avatar_url || null);
        setBio(profileData.bio || '');
        // Handle home_gym - could be string or array
        if (profileData.home_gym) {
          setHomeGyms(Array.isArray(profileData.home_gym) ? profileData.home_gym : [profileData.home_gym]);
        } else if (profileData.home_gym) {
          setHomeGyms([profileData.home_gym]);
        }
        setClimbingSince(profileData.climbing_since || '');
        setMaxGrade(profileData.max_grade || '');
        setPreferredStyle(profileData.preferred_style || '');
        setInstagramHandle(profileData.instagram_handle || '');
        setLookingFor(profileData.looking_for || []);
        
        // Update route setter status and trigger tab refresh
        const nowRouteSetter = profileData.is_route_setter || false;
        setIsRouteSetter(nowRouteSetter);
        setRouteSetterGym(profileData.route_setter_gym || '');
        
        // If user is now a route setter, mark any pending applications as approved
        if (nowRouteSetter) {
          await supabase
            .from('route_setter_applications')
            .update({ status: 'approved' })
            .eq('user_id', user.id)
            .eq('status', 'pending');
        }
        
        // Always trigger refresh to sync tab layout with current status
        await triggerRouteSetterRefresh();
        
        // Check for pending route setter application
        if (!nowRouteSetter) {
          // Check if there's an approved or rejected application
          const { data: oldApp } = await supabase
            .from('route_setter_applications')
            .select('id, status')
            .eq('user_id', user.id)
            .in('status', ['approved', 'rejected'])
            .maybeSingle();
          
          if (oldApp) {
            // Access was revoked or app was rejected - delete all applications so they can reapply
            await supabase
              .from('route_setter_applications')
              .delete()
              .eq('user_id', user.id);
            setHasPendingApplication(false);
          } else {
            // Check for pending applications
            const { data: appData } = await supabase
              .from('route_setter_applications')
              .select('status')
              .eq('user_id', user.id)
              .eq('status', 'pending')
              .maybeSingle();
            
            setHasPendingApplication(!!appData);
          }
        } else {
          setHasPendingApplication(false);
        }
      } else {
        // Create profile if doesn't exist
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || 'Climber',
          })
          .select()
          .single();
        
        if (newProfile) {
          setProfile(newProfile);
          setDisplayName(newProfile.display_name);
        }
      }

      // Get stats
      const { count: postsCount } = await supabase
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: commentsCount } = await supabase
        .from('community_comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count likes received on user's posts
      const { data: userPosts } = await supabase
        .from('community_posts')
        .select('id')
        .eq('user_id', user.id);
      
      let likesReceived = 0;
      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map((p: { id: string }) => p.id);
        const { count } = await supabase
          .from('community_likes')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds);
        likesReceived = count || 0;
      }

      // Count likes given by user
      const { count: likesGivenCount } = await supabase
        .from('community_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats({
        posts_count: postsCount || 0,
        comments_count: commentsCount || 0,
        likes_received: likesReceived,
        likes_given: likesGivenCount || 0,
      });

    } catch (error: any) {
      console.error('Error loading profile:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter a display name.');
      return;
    }

    setSaving(true);
    try {
      // Check if display name is taken by another user
      const { data: existingWithName, error: nameCheckError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', displayName.trim())
        .neq('id', user.id)
        .limit(1);
      
      if (nameCheckError) {
        console.error('Error checking display name:', nameCheckError);
      }
      
      if (existingWithName && existingWithName.length > 0) {
        Alert.alert('Display Name Taken', 'This display name is already in use. Please choose a different one.');
        setSaving(false);
        return;
      }

      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      let error;
      
      if (existingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            display_name: displayName.trim(),
            name: name.trim() || null,
            avatar_url: avatarUrl,
            bio: bio.trim() || null,
            home_gym: homeGyms.length > 0 ? homeGyms : null,
            climbing_since: climbingSince.trim() || null,
            max_grade: maxGrade || null,
            preferred_style: preferredStyle || null,
            instagram_handle: instagramHandle.trim() || null,
            looking_for: lookingFor.length > 0 ? lookingFor : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        error = updateError;
      } else {
        // Insert new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: displayName.trim(),
            name: name.trim() || null,
            avatar_url: avatarUrl,
            bio: bio.trim() || null,
            home_gym: homeGyms.length > 0 ? homeGyms : null,
            climbing_since: climbingSince.trim() || null,
            max_grade: maxGrade || null,
            preferred_style: preferredStyle || null,
            instagram_handle: instagramHandle.trim() || null,
            looking_for: lookingFor.length > 0 ? lookingFor : null,
            updated_at: new Date().toISOString(),
          });
        error = insertError;
      }

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Error saving profile:', error.message);
      Alert.alert('Error', `Failed to save profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Starting sign out...');
              // Set flag to skip intro slides and go directly to login
              await setSkipToAuthOnSignOut();
              console.log('Skip flag set');
              // Sign out from Supabase
              const { error } = await supabase.auth.signOut();
              console.log('Sign out complete, error:', error);
              if (error) {
                console.error('Sign out error:', error);
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              }
            } catch (e) {
              console.error('Sign out exception:', e);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleResetOnboarding = async () => {
    Alert.alert(
      'Reset Onboarding',
      'This will reset the onboarding and sign you out to show the slides again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Sign Out',
          style: 'destructive',
          onPress: async () => {
            await resetOnboarding();
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  // Avatar picker
  const showAvatarOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage('camera');
          else if (buttonIndex === 2) pickImage('library');
          else if (buttonIndex === 3) removeAvatar();
        }
      );
    } else {
      Alert.alert(
        'Profile Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => pickImage('camera') },
          { text: 'Choose from Library', onPress: () => pickImage('library') },
          { text: 'Remove Photo', style: 'destructive', onPress: removeAvatar },
        ]
      );
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow camera access to take a photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow photo library access.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error picking image:', error.message);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    
    setUploadingAvatar(true);
    try {
      // Read file and convert to base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      
      // Update profile immediately
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
        
    } catch (error: any) {
      console.error('Error uploading avatar:', error.message);
      Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    
    setAvatarUrl(null);
    await supabase
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  };

  // Gym search
  const searchGyms = useCallback((query: string) => {
    setGymSearchQuery(query);
    if (query.length < 2) {
      setGymSuggestions([]);
      return;
    }
    
    const filtered = CLIMBING_GYMS.filter(gym => 
      gym.name.toLowerCase().includes(query.toLowerCase()) ||
      gym.city.toLowerCase().includes(query.toLowerCase())
    );
    setGymSuggestions(filtered.slice(0, 5));
  }, []);

  const addHomeGym = (gym: GymSuggestion | string) => {
    const gymName = typeof gym === 'string' ? gym : `${gym.name} - ${gym.city}`;
    if (homeGyms.length >= 3) {
      Alert.alert('Limit Reached', 'You can only add up to 3 home gyms.');
      return;
    }
    if (homeGyms.includes(gymName)) {
      Alert.alert('Already Added', 'This gym is already in your list.');
      return;
    }
    setHomeGyms([...homeGyms, gymName]);
    setGymSearchQuery('');
    setGymSuggestions([]);
    setShowGymSearch(false);
  };

  const removeHomeGym = (index: number) => {
    setHomeGyms(homeGyms.filter((_, i) => i !== index));
  };

  const toggleLookingFor = (key: string) => {
    if (lookingFor.includes(key)) {
      setLookingFor(lookingFor.filter(k => k !== key));
    } else {
      setLookingFor([...lookingFor, key]);
    }
  };


  if (isSupabaseStub(supabase)) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>
          Error: Supabase client is not initialized. Please check your .env and restart Expo.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#1e4620" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Header - Made taller */}
      <LinearGradient
        colors={['#1e4620', '#449e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroHeader, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>CRUXLY</Text>
          <Text style={styles.heroSubtitle}>My information</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleResetOnboarding}
          >
            <Ionicons name="refresh-outline" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1e4620"
            colors={['#1e4620', '#449e00']}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Avatar & Stats Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={showAvatarOptions}>
              {uploadingAvatar ? (
                <View style={styles.avatar}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {displayName ? displayName[0].toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.posts_count}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.comments_count}</Text>
              <Text style={styles.statLabel}>Replies</Text>
            </View>
            {/* <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.likes_given}</Text>
              <Text style={styles.statLabel}>Liked</Text>
            </View> */}
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.likes_received}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>
        </View>

        {/* Edit Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Profile</Text>

          {/* Tab Selector */}
          <View style={styles.profileTabRow}>
            <TouchableOpacity
              style={[styles.profileTabBtn, profileTab === 'identity' && styles.profileTabBtnActive]}
              onPress={() => setProfileTab('identity')}
            >
              <Ionicons name="person-outline" size={15} color={profileTab === 'identity' ? '#FFF' : '#64748B'} />
              <Text style={[styles.profileTabText, profileTab === 'identity' && styles.profileTabTextActive]}>Identity</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileTabBtn, profileTab === 'climbing' && styles.profileTabBtnActive]}
              onPress={() => setProfileTab('climbing')}
            >
              <Ionicons name="trending-up-outline" size={15} color={profileTab === 'climbing' ? '#FFF' : '#64748B'} />
              <Text style={[styles.profileTabText, profileTab === 'climbing' && styles.profileTabTextActive]}>Climbing</Text>
            </TouchableOpacity>
          </View>

          {profileTab === 'identity' ? (
            <>
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Name</Text>
                <View style={styles.formInputWrapper}>
                  <Ionicons name="person" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Your real name"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                    maxLength={50}
                  />
                </View>
              </View>

              {/* Display Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Display Name</Text>
                <View style={styles.formInputWrapper}>
                  <Ionicons name="at-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Your climbing alias"
                    placeholderTextColor="#94A3B8"
                    value={displayName}
                    onChangeText={setDisplayName}
                    maxLength={30}
                  />
                </View>
              </View>

              {/* Bio */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Bio</Text>
                <View style={[styles.formInputWrapper, styles.textAreaWrapper]}>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    placeholder="Tell the community about yourself..."
                    placeholderTextColor="#94A3B8"
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    maxLength={200}
                  />
                </View>
                <Text style={styles.charCount}>{bio.length}/200</Text>
              </View>
            </>
          ) : (
            <>
              {/* Home Gyms */}
              <View style={styles.formGroup}>
                <View style={styles.formLabelRow}>
                  <Text style={styles.formLabel}>Home Gym(s)</Text>
                  <Text style={styles.formLabelHint}>{homeGyms.length}/3</Text>
                </View>
                {homeGyms.map((gym, index) => (
                  <View key={index} style={styles.gymChip}>
                    <Ionicons name="location" size={16} color="#1e4620" />
                    <Text style={styles.gymChipText} numberOfLines={1}>{gym}</Text>
                    <TouchableOpacity onPress={() => removeHomeGym(index)}>
                      <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                ))}
                {homeGyms.length < 3 && (
                  <TouchableOpacity style={styles.addGymButton} onPress={() => setShowGymSearch(true)}>
                    <Ionicons name="add-circle-outline" size={20} color="#1e4620" />
                    <Text style={styles.addGymButtonText}>Add a gym</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Preferred Style */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Preferred Style</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleScroll}>
                  {CLIMBING_STYLES.map(style => (
                    <TouchableOpacity
                      key={style.key}
                      style={[styles.styleChip, preferredStyle === style.key && styles.styleChipSelected]}
                      onPress={() => setPreferredStyle(preferredStyle === style.key ? '' : style.key)}
                    >
                      <Ionicons name={style.icon as any} size={16} color={preferredStyle === style.key ? '#FFF' : '#64748B'} />
                      <Text style={[styles.styleChipText, preferredStyle === style.key && styles.styleChipTextSelected]}>{style.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Max Grade */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Max Boulder Grade</Text>
                <TouchableOpacity style={styles.formInputWrapper} onPress={() => setShowGradePicker(!showGradePicker)}>
                  <Ionicons name="trending-up-outline" size={18} color="#94A3B8" />
                  <Text style={[styles.formInput, !maxGrade && { color: '#94A3B8' }]}>
                    {maxGrade || 'Select your max grade'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
                {showGradePicker && (
                  <View style={styles.gradePicker}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {GRADE_OPTIONS.map(grade => (
                        <TouchableOpacity
                          key={grade}
                          style={[styles.gradeOption, maxGrade === grade && styles.gradeOptionSelected]}
                          onPress={() => { setMaxGrade(grade); setShowGradePicker(false); }}
                        >
                          <Text style={[styles.gradeOptionText, maxGrade === grade && styles.gradeOptionTextSelected]}>{grade}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Climbing Since + Instagram side by side */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Climbing Since</Text>
                  <View style={styles.formInputWrapper}>
                    <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. 2020"
                      placeholderTextColor="#94A3B8"
                      value={climbingSince}
                      onChangeText={setClimbingSince}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
                <View style={[styles.formGroup, { flex: 1.5 }]}>
                  <Text style={styles.formLabel}>Instagram</Text>
                  <View style={styles.formInputWrapper}>
                    <Ionicons name="logo-instagram" size={18} color="#94A3B8" />
                    <Text style={styles.atSymbol}>@</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="username"
                      placeholderTextColor="#94A3B8"
                      value={instagramHandle}
                      onChangeText={setInstagramHandle}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={30}
                    />
                  </View>
                </View>
              </View>

              {/* Looking For */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Looking For</Text>
                <View style={styles.lookingForGrid}>
                  {LOOKING_FOR_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.lookingForChip, lookingFor.includes(option.key) && styles.lookingForChipSelected]}
                      onPress={() => toggleLookingFor(option.key)}
                    >
                      <Ionicons
                        name={lookingFor.includes(option.key) ? 'checkmark-circle' : 'add-circle-outline'}
                        size={16}
                        color={lookingFor.includes(option.key) ? '#FFF' : '#64748B'}
                      />
                      <Text style={[styles.lookingForChipText, lookingFor.includes(option.key) && styles.lookingForChipTextSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          <LinearGradient
            colors={['#1e4620', '#449e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Current Plan Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membership</Text>
          <Text style={styles.sectionSubtitle}>Your current subscription plan</Text>
          
          {currentPlan && (
            <View style={styles.currentPlanCard}>
              <LinearGradient
                colors={currentPlan.id === 'free' ? ['#64748B', '#475569'] : ['#1e4620', '#449e00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.currentPlanGradient}
              >
                <View style={styles.currentPlanHeader}>
                  <View>
                    <Text style={styles.currentPlanName}>{currentPlan.name}</Text>
                    <Text style={styles.currentPlanPrice}>
                      {currentPlan.price}{currentPlan.period !== 'forever' ? currentPlan.period : ''}
                    </Text>
                  </View>
                  {currentPlan.id !== 'free' && (
                    <View style={styles.proBadge}>
                      <Ionicons name="diamond" size={14} color="#FFF" />
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.currentPlanFeatures}>
                  {currentPlan.features.slice(0, 3).map((feature, idx) => (
                    <View key={idx} style={styles.currentPlanFeatureRow}>
                      <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.currentPlanFeatureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
              
              <TouchableOpacity 
                style={styles.changePlanButton}
                onPress={() => setShowChangePlanModal(true)}
              >
                <Ionicons name="swap-horizontal" size={18} color="#449e" />
                <Text style={styles.changePlanButtonText}>
                  {currentPlan.id === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Route Setter Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Setter Access</Text>
          <Text style={styles.sectionSubtitle}>
            {isRouteSetter 
              ? 'You have access to Boulder Vision tools' 
              : hasPendingApplication
                ? 'Your application is being reviewed'
                : 'Are you a route setter? Get access to Boulder Vision'}
          </Text>
          
          {isRouteSetter ? (
            <>
              <View style={styles.routeSetterCard}>
                <LinearGradient
                  colors={['#1e4620', '#449e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.routeSetterGradient}
                >
                  <View style={styles.routeSetterHeader}>
                    <View style={styles.routeSetterBadge}>
                      <Ionicons name="construct" size={20} color="#FFF" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.routeSetterTitle}>Route Setter</Text>
                      {routeSetterGym && (
                        <Text style={styles.routeSetterGym}>{routeSetterGym}</Text>
                      )}
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  </View>
                  <Text style={styles.routeSetterInfo}>
                    Access Boulder Vision in the main navigation to manage routes and analyze climbs.
                  </Text>
                </LinearGradient>
              </View>
              <TouchableOpacity 
                style={styles.routeSetterSignOutButton}
                onPress={() => {
                  Alert.alert(
                    'Remove Route Setter Access',
                    'Are you sure you want to remove your route setter access? You will need to reapply to get access again.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove Access',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const { error } = await supabase
                              .from('profiles')
                              .update({
                                is_route_setter: false,
                                route_setter_gym: null,
                              })
                              .eq('id', user.id);
                            
                            if (error) throw error;
                            
                            setIsRouteSetter(false);
                            setRouteSetterGym('');
                            await triggerRouteSetterRefresh();
                            Alert.alert('Access Removed', 'Your route setter access has been removed.');
                          } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to remove access');
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                <Text style={styles.routeSetterSignOutText}>Remove Route Setter Access</Text>
              </TouchableOpacity>
            </>
          ) : hasPendingApplication ? (
            <View style={styles.routeSetterPendingCard}>
              <View style={styles.routeSetterPendingContent}>
                <View style={styles.routeSetterPendingIcon}>
                  <Ionicons name="time" size={24} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeSetterPendingTitle}>Application Pending</Text>
                  <Text style={styles.routeSetterPendingDescription}>
                    We're reviewing your application. You'll be notified once approved.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.withdrawApplicationButton}
                onPress={() => {
                  Alert.alert(
                    'Withdraw Application',
                    'Are you sure you want to withdraw your route setter application?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Withdraw',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const { error } = await supabase
                              .from('route_setter_applications')
                              .delete()
                              .eq('user_id', user.id)
                              .eq('status', 'pending');
                            
                            if (error) throw error;
                            
                            setHasPendingApplication(false);
                            Alert.alert('Withdrawn', 'Your application has been withdrawn.');
                          } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to withdraw application');
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.withdrawApplicationText}>Withdraw Application</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.routeSetterApplyButton}
              onPress={() => {
                // Pre-fill name and email from profile
                setAppFullName(profile?.name || '');
                setShowRouteSetterModal(true);
              }}
            >
              <LinearGradient
                colors={['#1e4620', '#449e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.routeSetterApplyGradient}
              >
                <Ionicons name="construct-outline" size={20} color="#FFF" />
                <Text style={styles.routeSetterApplyText}>Apply as Route Setter</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <View style={styles.accountInfo}>
            <View style={styles.accountRow}>
              <Ionicons name="mail-outline" size={20} color="#64748B" />
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue}>{user?.email}</Text>
            </View>
            <View style={styles.accountRow}>
              <Ionicons name="time-outline" size={20} color="#64748B" />
              <Text style={styles.accountLabel}>Joined</Text>
              <Text style={styles.accountValue}>
                {new Date(user?.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Change Plan Modal */}
      <Modal
        visible={showChangePlanModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.changePlanModal}>
            <View style={styles.changePlanHeader}>
              <Text style={styles.changePlanTitle}>Change Your Plan</Text>
              <TouchableOpacity onPress={() => setShowChangePlanModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.plansScrollView} showsVerticalScrollIndicator={false}>
              {PLANS.map((plan) => {
                const isCurrentPlan = currentPlan?.id === plan.id;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.planOptionCard,
                      isCurrentPlan && styles.planOptionCardCurrent,
                    ]}
                    onPress={() => {
                      if (!isCurrentPlan) {
                        setSelectedNewPlan(plan);
                        setShowChangePlanModal(false);
                        setShowMembershipModal(true);
                      }
                    }}
                    disabled={isCurrentPlan}
                  >
                    <View style={styles.planOptionHeader}>
                      <View>
                        <View style={styles.planOptionNameRow}>
                          <Text style={styles.planOptionName}>{plan.name}</Text>
                          {plan.badge && (
                            <View style={[styles.planOptionBadge, plan.id === 'yearly' && styles.planOptionBadgeYellow]}>
                              <Text style={styles.planOptionBadgeText}>{plan.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.planOptionPrice}>
                          {plan.price}{plan.period !== 'forever' ? plan.period : ''}
                        </Text>
                      </View>
                      {isCurrentPlan ? (
                        <View style={styles.currentPlanIndicator}>
                          <Text style={styles.currentPlanIndicatorText}>Current</Text>
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                      )}
                    </View>
                    
                    <View style={styles.planOptionFeatures}>
                      {plan.features.slice(0, 3).map((feature, idx) => (
                        <View key={idx} style={styles.planOptionFeatureRow}>
                          <Ionicons name="checkmark-circle" size={14} color="#449e" />
                          <Text style={styles.planOptionFeatureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Membership Confirmation Modal */}
      {selectedNewPlan && (
        <MembershipScreen
          visible={showMembershipModal}
          selectedPlan={selectedNewPlan}
          onClose={() => {
            setShowMembershipModal(false);
            setSelectedNewPlan(null);
          }}
          onConfirm={(plan) => {
            setCurrentPlan(plan);
            setShowMembershipModal(false);
            setSelectedNewPlan(null);
            Alert.alert('Success', `Your plan has been changed to ${plan.name}!`);
          }}
        />
      )}

      {/* Gym Search Modal */}
      <Modal
        visible={showGymSearch}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGymSearch(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.gymSearchModal}>
            <View style={styles.gymSearchHeader}>
              <Text style={styles.gymSearchTitle}>Add Home Gym</Text>
              <TouchableOpacity onPress={() => setShowGymSearch(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.gymSearchInputWrapper}>
              <Ionicons name="search" size={20} color="#94A3B8" />
              <TextInput
                style={styles.gymSearchInput}
                placeholder="Search for a climbing gym..."
                placeholderTextColor="#94A3B8"
                value={gymSearchQuery}
                onChangeText={searchGyms}
                autoFocus
              />
              {gymSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setGymSearchQuery(''); setGymSuggestions([]); }}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.gymSuggestionsList}>
              {gymSuggestions.map(gym => (
                <TouchableOpacity
                  key={gym.id}
                  style={styles.gymSuggestionItem}
                  onPress={() => addHomeGym(gym)}
                >
                  <View style={styles.gymSuggestionIcon}>
                    <Ionicons name="location" size={20} color="#1e4620" />
                  </View>
                  <View style={styles.gymSuggestionInfo}>
                    <Text style={styles.gymSuggestionName}>{gym.name}</Text>
                    <Text style={styles.gymSuggestionAddress}>{gym.address}, {gym.city}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              
              {gymSearchQuery.length >= 2 && gymSuggestions.length === 0 && (
                <View style={styles.noGymResults}>
                  <Text style={styles.noGymResultsText}>No gyms found</Text>
                  <TouchableOpacity 
                    style={styles.addCustomGymButton}
                    onPress={() => addHomeGym(gymSearchQuery)}
                  >
                    <Ionicons name="add-circle" size={20} color="#1e4620" />
                    <Text style={styles.addCustomGymText}>Add "{gymSearchQuery}" as custom gym</Text>
                  </TouchableOpacity>
                </View>
              )}

              {gymSearchQuery.length < 2 && (
                <View style={styles.gymSearchHint}>
                  <Ionicons name="information-circle-outline" size={20} color="#94A3B8" />
                  <Text style={styles.gymSearchHintText}>
                    Type at least 2 characters to search
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Route Setter Application Modal */}
      <Modal
        visible={showRouteSetterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRouteSetterModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.routeSetterModal, { maxHeight: '90%' }]}>
            <View style={styles.routeSetterModalHeader}>
              <Text style={styles.routeSetterModalTitle}>Route Setter Application</Text>
              <TouchableOpacity onPress={() => setShowRouteSetterModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 50 }}
            >
              <View style={styles.routeSetterModalContent}>
                <View style={styles.routeSetterModalIcon}>
                  <LinearGradient
                    colors={['#7C3AED', '#A855F7']}
                    style={styles.routeSetterModalIconGradient}
                  >
                    <Ionicons name="construct" size={32} color="#FFF" />
                  </LinearGradient>
                </View>
                
                <Text style={styles.routeSetterModalDescription}>
                  Apply to become a verified route setter and unlock Boulder Vision tools. Applications are reviewed within 24-48 hours.
                </Text>
                
                <View style={styles.routeSetterFeatures}>
                  <View style={styles.routeSetterFeatureRow}>
                    <Ionicons name="eye" size={20} color="#7C3AED" />
                    <Text style={styles.routeSetterFeatureText}>AI-powered route visualization</Text>
                  </View>
                  <View style={styles.routeSetterFeatureRow}>
                    <Ionicons name="analytics" size={20} color="#7C3AED" />
                    <Text style={styles.routeSetterFeatureText}>Grade difficulty analysis</Text>
                  </View>
                  <View style={styles.routeSetterFeatureRow}>
                    <Ionicons name="people" size={20} color="#7C3AED" />
                    <Text style={styles.routeSetterFeatureText}>Community feedback dashboard</Text>
                  </View>
                  <View style={styles.routeSetterFeatureRow}>
                    <Ionicons name="camera" size={20} color="#7C3AED" />
                    <Text style={styles.routeSetterFeatureText}>Photo documentation tools</Text>
                  </View>
                </View>

                <View style={styles.applicationFormSection}>
                  <Text style={styles.applicationFormTitle}>Application Form</Text>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Full Name *</Text>
                    <View style={styles.formInputWrapper}>
                      <Ionicons name="person-outline" size={20} color="#94A3B8" />
                      <TextInput
                        style={styles.formInput}
                        placeholder="Your full name"
                        placeholderTextColor="#94A3B8"
                        value={appFullName}
                        onChangeText={setAppFullName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Gym Name *</Text>
                    <View style={styles.formInputWrapper}>
                      <Ionicons name="business-outline" size={20} color="#94A3B8" />
                      <TextInput
                        style={styles.formInput}
                        placeholder="Where do you set routes?"
                        placeholderTextColor="#94A3B8"
                        value={appGymName}
                        onChangeText={setAppGymName}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Route Setting Experience</Text>
                    <View style={[styles.formInputWrapper, { alignItems: 'flex-start', minHeight: 60 }]}>
                      <Ionicons name="document-text-outline" size={20} color="#94A3B8" style={{ marginTop: 12 }} />
                      <TextInput
                        style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                        placeholder="How long have you been setting?"
                        placeholderTextColor="#94A3B8"
                        value={appExperience}
                        onChangeText={setAppExperience}
                        multiline
                        numberOfLines={4}
                        scrollEnabled={true}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Additional Information (Optional)</Text>
                    <View style={[styles.formInputWrapper, { alignItems: 'flex-start', minHeight: 80 }]}>
                      <Ionicons name="chatbox-outline" size={20} color="#94A3B8" style={{ marginTop: 12 }} />
                      <TextInput
                        style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top', paddingTop: 12 }]}
                        placeholder="Anything else you'd like us to know?"
                        placeholderTextColor="#94A3B8"
                        value={appAdditionalInfo}
                        onChangeText={setAppAdditionalInfo}
                        multiline
                        numberOfLines={3}
                        scrollEnabled={true}
                      />
                    </View>
                  </View>
                  
                  {/* Spacer for keyboard */}
                  <View style={{ height: 120 }} />
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.routeSetterSubmitButton,
                    (!appFullName.trim() || !appGymName.trim() || !appExperience.trim() || submittingApplication) && styles.routeSetterSubmitButtonDisabled
                  ]}
                  onPress={async () => {
                    if (!appFullName.trim() || !appGymName.trim() || !appExperience.trim()) {
                      Alert.alert('Required Fields', 'Please fill in all required fields.');
                      return;
                    }
                    
                    setSubmittingApplication(true);
                    
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) {
                        throw new Error('Not authenticated');
                      }
                      
                      const response = await fetch(
                        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/route-setter-application`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({
                            fullName: appFullName.trim(),
                            email: user?.email,
                            gymName: appGymName.trim(),
                            experience: appExperience.trim(),
                            additionalInfo: appAdditionalInfo.trim() || undefined,
                          }),
                        }
                      );
                      
                      const result = await response.json();
                      
                      if (!response.ok) {
                        throw new Error(result.error || 'Failed to submit application');
                      }
                      
                      setHasPendingApplication(true);
                      setShowRouteSetterModal(false);
                      // Clear form
                      setAppFullName('');
                      setAppGymName('');
                      setAppExperience('');
                      setAppAdditionalInfo('');
                      
                      Alert.alert(
                        'Application Received!',
                        'Thanks for applying! We\'ll review your application and get back to you within 24-48 hours.'
                      );
                    } catch (error: any) {
                      Alert.alert('Error', error.message || 'Failed to submit application');
                    } finally {
                      setSubmittingApplication(false);
                    }
                  }}
                  disabled={!appFullName.trim() || !appGymName.trim() || !appExperience.trim() || submittingApplication}
                >
                  <LinearGradient
                    colors={(appFullName.trim() && appGymName.trim() && appExperience.trim() && !submittingApplication) ? ['#7C3AED', '#A855F7'] : ['#94A3B8', '#CBD5E1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.routeSetterSubmitGradient}
                  >
                    {submittingApplication ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="paper-plane" size={20} color="#FFF" />
                        <Text style={styles.routeSetterSubmitText}>Submit Application</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                
                <Text style={styles.routeSetterDisclaimer}>
                  By submitting, you confirm that you are an active route setter. We verify all applications to ensure the quality of our route setter community.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },

  heroHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroContent: {},
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollView: {
    flex: 1,
  },

  profileCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1e4620',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e4620',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },
  emailText: {
    fontSize: 14,
    color: '#64748B',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },

  // Section
  section: {
    marginTop: 14,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },

  // Form
  formGroup: {
    marginBottom: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 10,
    marginBottom: 18,
  },
  formInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  textAreaWrapper: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  textArea: {
    height: '100%',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },

  // Grade Picker
  gradePicker: {
    marginTop: 8,
    paddingVertical: 8,
  },
  gradeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  gradeOptionSelected: {
    backgroundColor: '#1e4620',
  },
  gradeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  gradeOptionTextSelected: {
    color: '#FFF',
  },

  // Save Button
  saveButton: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Account Info
  accountInfo: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountLabel: {
    fontSize: 14,
    color: '#64748B',
    width: 60,
  },
  accountValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },

  // Form Label Row
  formLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  formLabelHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  formHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },

  // Gym Chips
  gymChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  gymChipText: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  addGymButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  addGymButtonText: {
    fontSize: 14,
    color: '#1e4620',
    fontWeight: '600',
  },

  // Climbing Style
  styleScroll: {
    marginTop: -4,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
    gap: 6,
  },
  styleChipSelected: {
    backgroundColor: '#1e4620',
  },
  styleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  styleChipTextSelected: {
    color: '#FFF',
  },

  // Instagram
  atSymbol: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Looking For
  lookingForGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lookingForChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  lookingForChipSelected: {
    backgroundColor: '#1e4620',
  },
  lookingForChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  lookingForChipTextSelected: {
    color: '#FFF',
  },

  // Gym Search Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  gymSearchModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 400,
  },
  gymSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  gymSearchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  gymSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gymSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  gymSuggestionsList: {
    paddingHorizontal: 20,
  },
  gymSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  gymSuggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gymSuggestionInfo: {
    flex: 1,
  },
  gymSuggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  gymSuggestionAddress: {
    fontSize: 13,
    color: '#64748B',
  },
  noGymResults: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noGymResultsText: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 16,
  },
  addCustomGymButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  addCustomGymText: {
    fontSize: 14,
    color: '#1e4620',
    fontWeight: '600',
  },
  gymSearchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  gymSearchHintText: {
    fontSize: 14,
    color: '#94A3B8',
  },

  // Current Plan Card
  currentPlanCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  currentPlanGradient: {
    padding: 20,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  currentPlanName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  currentPlanPrice: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  currentPlanFeatures: {
    gap: 6,
  },
  currentPlanFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentPlanFeatureText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  changePlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  changePlanButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#449e',
  },

  // Change Plan Modal
  changePlanModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  changePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  changePlanTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  plansScrollView: {
    padding: 16,
  },
  planOptionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  planOptionCardCurrent: {
    borderColor: '#449e',
    backgroundColor: '#f0fff4',
  },
  planOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planOptionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planOptionName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  planOptionBadge: {
    backgroundColor: '#449e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  planOptionBadgeYellow: {
    backgroundColor: '#F59E0B',
  },
  planOptionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  planOptionPrice: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  currentPlanIndicator: {
    backgroundColor: '#449e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentPlanIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  planOptionFeatures: {
    gap: 6,
  },
  planOptionFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planOptionFeatureText: {
    fontSize: 13,
    color: '#64748B',
  },
  // Route Setter Styles
  routeSetterCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
  },
  routeSetterGradient: {
    padding: 16,
  },
  routeSetterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeSetterBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeSetterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  routeSetterGym: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  routeSetterInfo: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 12,
    lineHeight: 18,
  },
  routeSetterApplyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  routeSetterApplyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  routeSetterApplyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  routeSetterModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    width: '100%',
    marginTop: 'auto',
  },
  routeSetterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  routeSetterModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  routeSetterModalContent: {
    padding: 20,
  },
  routeSetterModalIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  routeSetterModalIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeSetterModalDescription: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  routeSetterFeatures: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  routeSetterFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeSetterFeatureText: {
    fontSize: 14,
    color: '#1E293B',
  },
  routeSetterSubmitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  routeSetterSubmitButtonDisabled: {
    opacity: 0.6,
  },
  routeSetterSubmitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  routeSetterSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  routeSetterDisclaimer: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  // Route Setter Additional Styles
  routeSetterSignOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7D7',
    backgroundColor: '#FEF2F2',
    gap: 8,
  },
  routeSetterSignOutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },
  routeSetterPendingCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginTop: 12,
    overflow: 'hidden',
  },
  routeSetterPendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  routeSetterPendingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeSetterPendingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 2,
  },
  routeSetterPendingDescription: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
  },
  applicationFormSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  applicationFormTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  withdrawApplicationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
    gap: 6,
  },
  withdrawApplicationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },

  // Profile Tab Selector
  profileTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    marginTop: 6,
  },
  profileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  profileTabBtnActive: {
    backgroundColor: '#1e4620',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  profileTabTextActive: {
    color: '#FFF',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
