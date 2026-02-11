import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');


// Welcome hero section
const WelcomeHero = () => (
  <View style={styles.heroContainer}>
    <ThemedText style={styles.brandName}>CRUXLY</ThemedText>
    <ThemedText style={styles.tagline}>Find your crew. Climb higher.</ThemedText>
  </View>
);

export function AuthScreen({ onSignedIn }: { onSignedIn?: () => void }) {
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const modeAnim = useRef(new Animated.Value(mode === 'signup' ? 1 : 0)).current;
  const nameFieldAnim = useRef(new Animated.Value(mode === 'signup' ? 1 : 0)).current;

  const ensureProfile = async (user: any) => {
    if (!user?.id) return;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profileData && profileError?.code !== 'PGRST116') {
      throw profileError;
    }

    if (!profileData) {
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || fullName || 'Climber',
        plan_id: 'free',
        plan_status: 'active',
        plan_updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;
    }
  };

  useEffect(() => {
    modeAnim.setValue(mode === 'signup' ? 1 : 0);
    nameFieldAnim.setValue(mode === 'signup' ? 1 : 0);
  }, [mode, nameFieldAnim]);

  async function handleSubmit() {
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const res: any = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (res?.error) throw res.error;
        await ensureProfile(res?.data?.user);
        setMessage('Welcome aboard! Check your email to confirm.');
        onSignedIn?.();
      } else {
        const res: any = await supabase.auth.signInWithPassword({ email, password });
        if (res?.error) throw res.error;
        await ensureProfile(res?.data?.user);
        setMessage('Welcome back!');
        onSignedIn?.();
      }
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setMessage(null);
    setLoading(true);
    try {
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'belay' });

      const res: any = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (res?.error) throw res.error;

      const authUrl = res?.data?.url;
      if (!authUrl) throw new Error('No auth URL returned');

      setMessage('Opening Google sign-in...');

      const handleUrl = async (event: { url: string }) => {
        const url = event.url;
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        if (url.includes('#')) {
          const fragment = url.split('#')[1];
          const params = new URLSearchParams(fragment);
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
        }

        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            const { data: { user } } = await supabase.auth.getUser();
            await ensureProfile(user);
            setMessage('Welcome!');
            onSignedIn?.();
          } catch (err: any) {
            setMessage('Error: ' + err.message);
          }
        } else {
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            const { data: { user } } = await supabase.auth.getUser();
            await ensureProfile(user);
            setMessage('Welcome!');
            onSignedIn?.();
          }
        }
        setLoading(false);
        subscription.remove();
      };

      const subscription = Linking.addEventListener('url', handleUrl);
      await Linking.openURL(authUrl);

      setTimeout(() => {
        subscription.remove();
        setLoading(false);
      }, 120000);
    } catch (err: any) {
      setMessage(err?.message ?? 'An error occurred');
      setLoading(false);
    }
  }

  const handleGetStarted = (nextMode: 'signin' | 'signup' = 'signup') => {
    setMode(nextMode);
    setShowForm(true);
  };

  const renderAuthForm = () => (
    <View style={styles.formCard}>
      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <Animated.View
          style={[
            styles.modeIndicator,
            {
              transform: [
                {
                  translateX: modeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, (width - 80) / 2 - 2],
                  }),
                },
              ],
            },
          ]}
        />
        <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signin')}>
          <ThemedText style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>
            Sign In
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signup')}>
          <ThemedText style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>
            Sign Up
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Form Fields */}
      <View style={styles.inputsContainer}>
        {/* Name field - only for signup */}
        <Animated.View
          pointerEvents={mode === 'signup' ? 'auto' : 'none'}
          style={{
            overflow: 'hidden',
            height: nameFieldAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 64] }),
            opacity: nameFieldAnim,
            marginBottom: nameFieldAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
            transform: [
              {
                translateY: nameFieldAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
              },
            ],
          }}
        >
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
        </Animated.View>

        {/* Email */}
        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            ref={emailInputRef}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
        </View>

        {/* Password */}
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
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
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
        <View style={[styles.messageBox, message.includes('error') || message.includes('Error') ? styles.messageError : {}]}>
          <Ionicons
            name={message.includes('error') || message.includes('Error') ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color={message.includes('error') || message.includes('Error') ? '#EF4444' : '#34D399'}
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
          <Path
            fill="#4285F4"
            d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.3H272v95.1h147.1c-6.3 34.1-25 63-53.3 82.2v68.3h86.1c50.6-46.7 79.6-115.3 79.6-195.3z"
          />
          <Path
            fill="#34A853"
            d="M272 544.3c72.6 0 133.6-24 178.2-65.2l-86.1-68.3c-24 16.1-54.7 25.6-92.1 25.6-70.7 0-130.6-47.7-152-111.7H32.5v70.4C77.2 485 168.2 544.3 272 544.3z"
          />
          <Path
            fill="#FBBC05"
            d="M120 328.7c-8.5-25.2-8.5-52.4 0-77.6V180.7H32.5C-6.4 240.6-6.4 303.7 32.5 363.6L120 328.7z"
          />
          <Path
            fill="#EA4335"
            d="M272 107.6c39.5 0 75 13.6 102.9 40.4l77.1-77.1C405.6 24 346.6 0 272 0 168.2 0 77.2 59.3 32.5 149.5l87.5 70.4c21.4-64 81.3-111.7 152-111.7z"
          />
        </Svg>
        <ThemedText style={styles.googleBtnText}>Google</ThemedText>
      </TouchableOpacity>

      {/* Terms */}
      <ThemedText style={styles.termsText}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </ThemedText>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.safeArea}>
            <WelcomeHero />

            {/* Get Started Buttons - show when form is hidden */}
            {!showForm && (
              <View style={styles.ctaContainer}>
                <TouchableOpacity style={styles.primaryCta} onPress={() => handleGetStarted('signup')}>
                  <ThemedText style={styles.primaryCtaText}>Get Started</ThemedText>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryCta}
                  onPress={() => handleGetStarted('signin')}
                >
                  <ThemedText style={styles.secondaryCtaText}>I already have an account</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {/* Auth Form - show when user clicks Get Started */}
            {showForm && renderAuthForm()}

            {/* Back button when form is shown */}
            {showForm && (
              <TouchableOpacity style={styles.backButton} onPress={() => setShowForm(false)}>
                <Ionicons name="chevron-back" size={20} color="#1e4620" />
                <ThemedText style={styles.backButtonText}>Back</ThemedText>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e7f1e7',
  },
  keyboardContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  heroContainer: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingTop: 100,
    paddingBottom: 6,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  logoRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(30, 70, 32, 0.2)',
  },
  brandName: {
    fontSize: 25,
    fontWeight: '900',
    color: '#1e4620',
    letterSpacing: 3,
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#2f3b2f',
    marginBottom: 24,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(30, 70, 32, 0.2)',
  },
  featurePillText: {
    fontSize: 12,
    color: '#2f3b2f',
    fontWeight: '600',
  },
  ctaContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
    gap: 16,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e4620',
    height: 50,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryCtaText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryCta: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  secondaryCtaText: {
    color: '#2f3b2f',
    fontSize: 15,
    fontWeight: '600',
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 12,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e4620',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  socialProofText: {
    fontSize: 13,
    color: '#64748B',
  },
  formCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 12,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    height: 52,
    borderRadius: 26,
    marginBottom: 24,
    position: 'relative',
    padding: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(30, 70, 32, 0.25)',
  },
  modeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: '#2f6b3a',
    borderRadius: 24,
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
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
    letterSpacing: 0.3,
  },
  modeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  inputsContainer: {
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 999,
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
    borderRadius: 999,
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
    borderRadius: 999,
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
    fontSize: 12,
    color: '#6b7a6b',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  backButtonText: {
    color: '#2f3b2f',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AuthScreen;
