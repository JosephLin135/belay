import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ActionSheetIOS,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({ posts_count: 0, comments_count: 0, likes_received: 0 });
  
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
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showGymSearch, setShowGymSearch] = useState(false);
  const [gymSearchQuery, setGymSearchQuery] = useState('');
  const [gymSuggestions, setGymSuggestions] = useState<GymSuggestion[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

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
        setName(profileData.name || '');
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

      setStats({
        posts_count: postsCount || 0,
        comments_count: commentsCount || 0,
        likes_received: likesReceived,
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
      const { error } = await supabase
        .from('profiles')
        .upsert({
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

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Error saving profile:', error.message);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
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

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#799FCB" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Header - Made taller */}
      <LinearGradient
        colors={['#799FCB', '#5A7FB0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroHeader, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>CRUXLY</Text>
          <Text style={styles.heroSubtitle}>My information</Text>
        </View>
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.sectionSubtitle}>This is how you appear in discussions</Text>

          {/* Name */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Name</Text>
            <View style={styles.formInputWrapper}>
              <Ionicons name="person" size={20} color="#94A3B8" />
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
              <Ionicons name="person-outline" size={20} color="#94A3B8" />
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

          {/* Home Gyms - Multiple with search */}
          <View style={styles.formGroup}>
            <View style={styles.formLabelRow}>
              <Text style={styles.formLabel}>Home Gyms</Text>
              <Text style={styles.formLabelHint}>{homeGyms.length}/3</Text>
            </View>
            
            {/* Current gyms list */}
            {homeGyms.map((gym, index) => (
              <View key={index} style={styles.gymChip}>
                <Ionicons name="location" size={16} color="#799FCB" />
                <Text style={styles.gymChipText} numberOfLines={1}>{gym}</Text>
                <TouchableOpacity onPress={() => removeHomeGym(index)}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ))}
            
            {/* Add gym button */}
            {homeGyms.length < 3 && (
              <TouchableOpacity 
                style={styles.addGymButton}
                onPress={() => setShowGymSearch(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#799FCB" />
                <Text style={styles.addGymButtonText}>Add a gym</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Preferred Climbing Style */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Preferred Style</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleScroll}>
              {CLIMBING_STYLES.map(style => (
                <TouchableOpacity
                  key={style.key}
                  style={[
                    styles.styleChip,
                    preferredStyle === style.key && styles.styleChipSelected,
                  ]}
                  onPress={() => setPreferredStyle(preferredStyle === style.key ? '' : style.key)}
                >
                  <Ionicons 
                    name={style.icon as any} 
                    size={16} 
                    color={preferredStyle === style.key ? '#FFF' : '#64748B'} 
                  />
                  <Text style={[
                    styles.styleChipText,
                    preferredStyle === style.key && styles.styleChipTextSelected,
                  ]}>{style.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Max Grade */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Max Boulder Grade</Text>
            <TouchableOpacity 
              style={styles.formInputWrapper}
              onPress={() => setShowGradePicker(!showGradePicker)}
            >
              <Ionicons name="trending-up-outline" size={20} color="#94A3B8" />
              <Text style={[styles.formInput, !maxGrade && { color: '#94A3B8' }]}>
                {maxGrade || 'Select your max grade'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#94A3B8" />
            </TouchableOpacity>
            
            {showGradePicker && (
              <View style={styles.gradePicker}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {GRADE_OPTIONS.map(grade => (
                    <TouchableOpacity
                      key={grade}
                      style={[
                        styles.gradeOption,
                        maxGrade === grade && styles.gradeOptionSelected,
                      ]}
                      onPress={() => {
                        setMaxGrade(grade);
                        setShowGradePicker(false);
                      }}
                    >
                      <Text style={[
                        styles.gradeOptionText,
                        maxGrade === grade && styles.gradeOptionTextSelected,
                      ]}>{grade}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Climbing Since */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Climbing Since</Text>
            <View style={styles.formInputWrapper}>
              <Ionicons name="calendar-outline" size={20} color="#94A3B8" />
              <TextInput
                style={styles.formInput}
                placeholder="e.g., 2020"
                placeholderTextColor="#94A3B8"
                value={climbingSince}
                onChangeText={setClimbingSince}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          {/* Instagram Handle */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Instagram</Text>
            <View style={styles.formInputWrapper}>
              <Ionicons name="logo-instagram" size={20} color="#94A3B8" />
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

          {/* Looking For */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Looking For</Text>
            <Text style={styles.formHint}>Connect with climbers for...</Text>
            <View style={styles.lookingForGrid}>
              {LOOKING_FOR_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.lookingForChip,
                    lookingFor.includes(option.key) && styles.lookingForChipSelected,
                  ]}
                  onPress={() => toggleLookingFor(option.key)}
                >
                  <Ionicons 
                    name={lookingFor.includes(option.key) ? "checkmark-circle" : "add-circle-outline"} 
                    size={16} 
                    color={lookingFor.includes(option.key) ? '#FFF' : '#64748B'} 
                  />
                  <Text style={[
                    styles.lookingForChipText,
                    lookingFor.includes(option.key) && styles.lookingForChipTextSelected,
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          <LinearGradient
            colors={['#799FCB', '#5A7FB0']}
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
                    <Ionicons name="location" size={20} color="#799FCB" />
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
                    <Ionicons name="add-circle" size={20} color="#799FCB" />
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

  // Hero Header - Made taller to not cover avatar
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

  // Profile Card
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
    backgroundColor: '#799FCB',
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
    backgroundColor: '#799FCB',
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
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },

  // Form
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  formInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 52,
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
    backgroundColor: '#799FCB',
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
    color: '#799FCB',
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
    backgroundColor: '#799FCB',
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
    backgroundColor: '#799FCB',
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
    color: '#799FCB',
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
});
