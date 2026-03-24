import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MembershipScreen, PLANS, Plan, PlanId, savePlanSelection } from '@/components/membership-screen';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

const ONBOARDING_KEY = '@cruxly_onboarding_complete';

// Intro slides (before auth)
const introSlides = [
  {
    id: 1,
    title: 'CRUXLY',
    subtitle: 'Your all-in-one climbing companion',
    description: 'Connect with climbers and discover new routes!',
  },
  {
    id: 2,
    title: 'Find Your Crew',
    subtitle: 'Never climb alone',
    description: 'Meet climbers at your level, join local communities, and organize sessions!',
  },
  {
    id: 3,
    title: 'AI Insights',
    subtitle: 'Climb smarter, not harder',
    description: 'Analyze your climbs with AI and level up faster!',
  },
];

interface OnboardingFlowProps {
  onComplete: () => void;
  startAtAuth?: boolean; // Skip intro slides and go directly to auth
}

export function OnboardingFlow({ onComplete, startAtAuth = false }: OnboardingFlowProps) {
  // Flow state: 'intro' -> 'auth' -> 'plans' (new users only) -> complete
  const [flowStep, setFlowStep] = useState<'intro' | 'auth' | 'plans'>(startAtAuth ? 'auth' : 'intro');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Auth state
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // Auto-clear messages after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  
  // Plan state
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('free');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const modeAnim = useRef(new Animated.Value(0)).current;

  const selectedPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[0];

  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: mode === 'signup' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [mode]);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
    }
  };

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleIntroNext = () => {
    if (currentSlide < introSlides.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // Move to auth step
      setFlowStep('auth');
    }
  };

  const handleSkipIntro = () => {
    setFlowStep('auth');
  };

  const ensureProfile = async (user: any, isNew: boolean = false) => {
    if (!user?.id) return false;

    // Ensure we have a valid session before making DB calls
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      console.log('No active session, skipping profile creation');
      return false;
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, plan_id')
        .eq('id', user.id)
        .single();

      // PGRST116 means no rows found, which is expected for new users
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking profile:', profileError);
        // Don't throw - continue to try creating profile
      }

      if (!profileData) {
        // New user - create profile using insert (not upsert)
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          display_name: user.user_metadata?.full_name || user.user_metadata?.name || fullName || 'Climber',
          plan_id: 'free',
          plan_status: 'active',
          plan_updated_at: new Date().toISOString(),
        });
        
        if (insertError) {
          // If insert fails due to duplicate, profile already exists
          if (insertError.code === '23505') {
            console.log('Profile already exists');
            return false;
          }
          console.error('Error creating profile:', insertError);
          // Don't throw - let user continue anyway
        }
        return true; // Is new user
      }
      
      return false; // Existing user
    } catch (err) {
      console.error('Profile check/create error:', err);
      return false; // Continue anyway
    }
  };

  const handleAuthSubmit = async () => {
    setMessage(null);
    setLoading(true);
    Keyboard.dismiss();
    
    try {
      if (mode === 'signup') {
        const res: any = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (res?.error) throw res.error;
        // When email confirmation is required Supabase may not return a user/session.
        // Don't try to create a profile or advance the flow until the user has
        // confirmed their email and has an active session.
        const signedUpUser = res?.data?.user;
        if (!signedUpUser) {
          setMessage('Sign-up successful. Check your email to confirm your account before signing in.');
          // Keep the user on the auth step so they can confirm and then sign in
          setFlowStep('auth');
          return;
        }
        await ensureProfile(signedUpUser, true);
        setIsNewUser(true);
        // New user -> show plans
        setFlowStep('plans');
      } else {
        const res: any = await supabase.auth.signInWithPassword({ email, password });
        if (res?.error) throw res.error;
        const isNew = await ensureProfile(res?.data?.user);
        if (isNew) {
          setIsNewUser(true);
          setFlowStep('plans');
        } else {
          // Existing user -> skip plans, complete onboarding
          await completeOnboarding();
        }
      }
    } catch (err: any) {
      const raw = err?.message ?? String(err);
      const lower = String(raw).toLowerCase();
      if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('429') || lower.includes('email rate')) {
        setMessage('Email rate limit exceeded. Please wait a few minutes and try again, or use a different email.');
      } else {
        setMessage(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setMessage(null);
    setLoading(true);
    
    try {
      // Production redirect URL - this works in standalone builds
      // For Expo Go testing, you'll need to add the exp:// URL to Supabase
      const redirectUrl = 'belay://auth/callback';
      
      console.log('Redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned');

      // Open the browser for Google sign in
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        {
          showInRecents: true,
          preferEphemeralSession: false,
        }
      );
      
      console.log('Auth result:', JSON.stringify(result, null, 2));

      if (result.type === 'success' && result.url) {
        // Parse the URL to extract tokens
        const url = result.url;
        console.log('Callback URL:', url);
        
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Check for tokens in URL fragment (hash) - Supabase returns tokens here
        if (url.includes('#')) {
          const fragment = url.split('#')[1];
          const params = new URLSearchParams(fragment);
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
          console.log('Found tokens in fragment:', !!accessToken, !!refreshToken);
        }
        
        // Also check query params as fallback
        if (!accessToken && url.includes('?')) {
          const queryString = url.split('?')[1]?.split('#')[0];
          if (queryString) {
            const params = new URLSearchParams(queryString);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            console.log('Found tokens in query:', !!accessToken, !!refreshToken);
          }
        }

        if (accessToken && refreshToken) {
          // Set the session with the tokens from the URL
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) throw sessionError;
          
          // Get the user and check/create profile
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const isNew = await ensureProfile(user);
            if (isNew) {
              setIsNewUser(true);
              setFlowStep('plans');
            } else {
              await completeOnboarding();
            }
          } else {
            throw new Error('Failed to get user after authentication');
          }
        } else {
          // No tokens in URL - check if we have a session anyway
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const isNew = await ensureProfile(user);
              if (isNew) {
                setIsNewUser(true);
                setFlowStep('plans');
              } else {
                await completeOnboarding();
              }
            }
          } else {
            throw new Error('Authentication failed - no tokens received. Make sure the redirect URL is configured in Supabase.');
          }
        }
      } else if (result.type === 'cancel') {
        setMessage('Sign in was cancelled');
      } else if (result.type === 'dismiss') {
        // User dismissed the browser - check if auth completed
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const isNew = await ensureProfile(user);
            if (isNew) {
              setIsNewUser(true);
              setFlowStep('plans');
            } else {
              await completeOnboarding();
            }
            return;
          }
        }
        setMessage('Sign in was dismissed');
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setMessage(err?.message ?? 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      // Ignore
    }
    onComplete();
  };

  const handlePlanSelect = (planId: PlanId) => {
    setSelectedPlanId(planId);
  };

  const handlePlanContinue = () => {
    setShowMembershipModal(true);
  };

  const handleMembershipConfirm = async (plan: Plan) => {
    setShowMembershipModal(false);
    await completeOnboarding();
  };

  // Render intro slides
  const renderIntroSlide = (slide: typeof introSlides[0], index: number) => (
    <View key={slide.id} style={styles.slide}>
      <View style={styles.slideContent}>
        <ThemedText style={styles.slideTitle}>{slide.title}</ThemedText>
        <ThemedText style={styles.slideSubtitle}>{slide.subtitle}</ThemedText>
        <ThemedText style={styles.slideDescription}>{slide.description}</ThemedText>
      </View>
    </View>
  );

  // Render plan card
  const renderPlanCard = (plan: Plan) => {
    const isSelected = selectedPlanId === plan.id;
    
    return (
      <View key={plan.id} style={styles.planCardWrapper}>
        {plan.badge ? (
          <View style={[styles.planBadgeContainer, plan.id === 'yearly' ? styles.planBadgeYellow : styles.planBadgePurple]}>
            <ThemedText style={styles.planBadgeText}>{plan.badge}</ThemedText>
          </View>
        ) : (
          <View style={styles.planBadgeSpacer} />
        )}
        
        <TouchableOpacity
          style={[styles.planCard, isSelected && styles.planCardSelected]}
          onPress={() => handlePlanSelect(plan.id)}
          activeOpacity={1}
        >
          <View style={[styles.selectIndicator, isSelected && styles.selectIndicatorActive]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#FFF" />}
          </View>
          
          <ThemedText style={styles.planName}>{plan.name}</ThemedText>
          <View style={styles.planPriceRow}>
            <ThemedText style={styles.planPrice}>{plan.price}</ThemedText>
            <ThemedText style={styles.planPeriod}>{plan.period}</ThemedText>
          </View>
          <View style={styles.planFeatures}>
            {plan.features.slice(0, 4).map((feature, idx) => (
              <View key={idx} style={styles.planFeatureRow}>
                <Ionicons name="checkmark-circle" size={14} color={isSelected ? "#449e" : "#94A3B8"} />
                <ThemedText style={[styles.planFeatureText, isSelected && styles.planFeatureTextSelected]}>{feature}</ThemedText>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // INTRO STEP
  if (flowStep === 'intro') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {currentSlide < introSlides.length - 1 && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipIntro}>
              <ThemedText style={styles.skipText}>Skip</ThemedText>
            </TouchableOpacity>
          )}

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            style={styles.scrollView}
          >
            {introSlides.map((slide, index) => renderIntroSlide(slide, index))}
          </ScrollView>

          <View style={styles.bottomSection}>
            <View style={styles.dotsContainer}>
              {introSlides.map((_, index) => (
                <TouchableOpacity key={index} onPress={() => goToSlide(index)}>
                  <View style={[styles.dot, currentSlide === index && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleIntroNext}>
              <ThemedText style={styles.nextButtonText}>
                {currentSlide === introSlides.length - 1 ? 'Get Started' : 'Next'}
              </ThemedText>
              <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // AUTH STEP
  if (flowStep === 'auth') {
    return (
      <View style={styles.authContainer}>
        <SafeAreaView style={styles.authSafeArea}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              style={styles.keyboardContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}
            >
              <ScrollView 
                contentContainerStyle={styles.authScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Header */}
                <View style={styles.authHeader}>
                  <ThemedText style={styles.authTitle}>Welcome to Cruxly</ThemedText>
                  <ThemedText style={styles.authSubtitle}>
                    {mode === 'signup' ? 'Create your account to get started' : 'Sign in to continue climbing'}
                  </ThemedText>
                </View>

                {/* Mode Toggle */}
                <View style={styles.modeToggle}>
                  <Animated.View
                    style={[
                      styles.modeIndicator,
                      {
                        transform: [{
                          translateX: modeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, (width - 60) / 2],
                          }),
                        }],
                      },
                    ]}
                  />
                  <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signin')}>
                    <ThemedText style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Sign In</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signup')}>
                    <ThemedText style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Sign Up</ThemedText>
                  </TouchableOpacity>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
                  {mode === 'signup' && (
                    <View style={styles.inputWrapper}>
                      <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                      <TextInput
                        placeholder="Full name"
                        placeholderTextColor="#94A3B8"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        style={styles.input}
                        returnKeyType="next"
                        onSubmitEditing={() => emailInputRef.current?.focus()}
                      />
                    </View>
                  )}

                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      ref={emailInputRef}
                      placeholder="Email"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      ref={passwordInputRef}
                      placeholder="Password"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      style={styles.input}
                      returnKeyType="done"
                      onSubmitEditing={handleAuthSubmit}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity style={styles.submitBtn} onPress={handleAuthSubmit} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <View style={styles.submitBtnContent}>
                        <ThemedText style={styles.submitBtnText}>
                          {mode === 'signin' ? 'Sign In' : 'Create Account'}
                        </ThemedText>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Message */}
                  {message && (
                    <View style={[styles.messageBox, message.toLowerCase().includes('error') && styles.messageError]}>
                      <Ionicons
                        name={message.toLowerCase().includes('error') ? 'alert-circle' : 'checkmark-circle'}
                        size={18}
                        color={message.toLowerCase().includes('error') ? '#EF4444' : '#34D399'}
                      />
                      <ThemedText style={styles.messageText}>{message}</ThemedText>
                    </View>
                  )}

                  {/* Divider */}
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <ThemedText style={styles.dividerText}>or continue with</ThemedText>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Google Button */}
                  <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={loading}>
                    <Svg width={20} height={20} viewBox="0 0 533.5 544.3">
                      <Path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.3H272v95.1h147.1c-6.3 34.1-25 63-53.3 82.2v68.3h86.1c50.6-46.7 79.6-115.3 79.6-195.3z" />
                      <Path fill="#34A853" d="M272 544.3c72.6 0 133.6-24 178.2-65.2l-86.1-68.3c-24 16.1-54.7 25.6-92.1 25.6-70.7 0-130.6-47.7-152-111.7H32.5v70.4C77.2 485 168.2 544.3 272 544.3z" />
                      <Path fill="#FBBC05" d="M120 328.7c-8.5-25.2-8.5-52.4 0-77.6V180.7H32.5C-6.4 240.6-6.4 303.7 32.5 363.6L120 328.7z" />
                      <Path fill="#EA4335" d="M272 107.6c39.5 0 75 13.6 102.9 40.4l77.1-77.1C405.6 24 346.6 0 272 0 168.2 0 77.2 59.3 32.5 149.5l87.5 70.4c21.4-64 81.3-111.7 152-111.7z" />
                    </Svg>
                    <ThemedText style={styles.googleBtnText}>Google</ThemedText>
                  </TouchableOpacity>

                  <ThemedText style={styles.termsText}>
                    By signing up, you agree to our Terms of Service and Privacy Policy
                  </ThemedText>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>

          {/* Back to intro - outside KeyboardAvoidingView */}
          <TouchableOpacity style={styles.backButton} onPress={() => { setFlowStep('intro'); setCurrentSlide(0); }}>
            <Ionicons name="chevron-back" size={20} color="#1e4620" />
            <ThemedText style={styles.backButtonText}>Back</ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // PLANS STEP (new users only)
  if (flowStep === 'plans') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.plansHeader}>
            <ThemedText style={styles.slideTitle}>Choose Your Plan</ThemedText>
            <ThemedText style={styles.slideSubtitle}>Unlock your full potential</ThemedText>
          </View>

          <View style={styles.plansContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.plansScroll}
              snapToInterval={width * 0.7}
              decelerationRate="fast"
            >
              {PLANS.map(renderPlanCard)}
            </ScrollView>
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity style={styles.nextButton} onPress={handlePlanContinue}>
              <ThemedText style={styles.nextButtonText}>
                Continue with {selectedPlan.name}
              </ThemedText>
              <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <MembershipScreen
          visible={showMembershipModal}
          selectedPlan={selectedPlan}
          onClose={() => setShowMembershipModal(false)}
          onConfirm={handleMembershipConfirm}
        />
      </View>
    );
  }

  return null;
}

// Check if onboarding was completed
export async function checkOnboardingComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (e) {
    return false;
  }
}

// Reset onboarding (for testing)
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (e) {
    // Ignore
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  safeArea: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    color: '#1e4620',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    paddingHorizontal: 24,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    overflow: 'visible',
  },
  slideTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 48,
  },
  slideSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e4620',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#1e4620',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 16,
    backgroundColor: '#1e4620',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Auth styles
  authContainer: {
    flex: 1,
    backgroundColor: '#e7f1e7',
  },
  keyboardContainer: {
    flex: 1,
  },
  authSafeArea: {
    flex: 1,
  },
  authScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  authHeader: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 24,
  },
  authTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#1e4620',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#2f3b2f',
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    height: 52,
    borderRadius: 12,
    marginBottom: 24,
    position: 'relative',
    padding: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(30, 70, 32, 0.25)',
  },
  modeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    width: (width - 60) / 2,
    backgroundColor: '#2f6b3a',
    borderRadius: 8,
  },
  modeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modeText: {
    color: '#1e4620',
    fontWeight: '700',
    fontSize: 14,
  },
  modeTextActive: {
    color: '#fff',
  },
  formContainer: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(30, 70, 32, 0.2)',
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#1E293B',
    fontSize: 16,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  submitBtn: {
    backgroundColor: '#1e4620',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  messageError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  messageText: {
    color: '#1E293B',
    fontSize: 14,
    flex: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    color: '#6b7a6b',
    fontSize: 13,
    marginHorizontal: 16,
    fontWeight: '500',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(30, 70, 32, 0.2)',
    gap: 10,
  },
  googleBtnText: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 11,
    color: '#6b7a6b',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 4,
    marginBottom: 8,
  },
  backButtonText: {
    color: '#2f3b2f',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Plans styles
  plansHeader: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 16,
    overflow: 'visible',
  },
  plansContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  plansScroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  planCardWrapper: {
    marginRight: 16,
  },
  planBadgeContainer: {
    alignSelf: 'center',
    width: '90%',
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  planBadgePurple: {
    backgroundColor: '#8B5CF6',
    top: 18,
  },
  planBadgeYellow: {
    backgroundColor: '#F59E0B',
    top: 18,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFF',
  },
  planBadgeSpacer: {
    height: 40,
  },
  planCard: {
    width: width * 0.65,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    minHeight: 220,
  },
  planCardSelected: {
    borderColor: '#1e4620',
    backgroundColor: '#f0fff4',
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  selectIndicator: {
    position: 'absolute',
    top: 10,
    right: 16,
    width: 20,
    height: 20,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectIndicatorActive: {
    backgroundColor: '#1e4620',
    borderColor: '#1e4620',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 6,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 25,
    fontWeight: '800',
    color: '#1E293B',
  },
  planPeriod: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  planFeatures: {
    gap: 8,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 13,
    color: '#64748B',
  },
  planFeatureTextSelected: {
    color: '#1E293B',
  },
});

export default OnboardingFlow;
