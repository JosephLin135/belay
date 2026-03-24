import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TextInput, View, TouchableOpacity, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Animated, Dimensions, Platform, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

// Required for web browser auth session to work properly
WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

// Topographic-style background pattern with climbing theme
const TopoBackground = () => (
  <View style={StyleSheet.absoluteFill}>
    <Svg height="100%" width="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FAFAF9" stopOpacity="1" />
          <Stop offset="1" stopColor="#F1F5F9" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Path d="M0 0 H100 V100 H0 Z" fill="url(#grad)" />

      {/* Abstract mountain/topo lines */}
      <Path
        d="M0 70 Q 20 50, 40 65 T 80 55 T 100 60"
        fill="none"
        stroke="#1e4620"
        strokeWidth="0.4"
        opacity="0.2"
      />
      <Path
        d="M0 80 Q 30 60, 60 75 T 100 70"
        fill="none"
        stroke="#1e4620"
        strokeWidth="0.3"
        opacity="0.15"
      />
      <Path
        d="M0 40 Q 25 55, 50 40 T 100 45"
        fill="none"
        stroke="#2D4A5E"
        strokeWidth="0.3"
        opacity="0.1"
      />
      <Path
        d="M0 30 Q 35 45, 70 30 T 100 35"
        fill="none"
        stroke="#2D4A5E"
        strokeWidth="0.25"
        opacity="0.08"
      />
      <Circle cx="85" cy="15" r="20" fill="#1e4620" opacity="0.06" />
      <Circle cx="10" cy="85" r="30" fill="#2D4A5E" opacity="0.04" />
    </Svg>
  </View>
);

export function AuthScreen({ onSignedIn }: { onSignedIn?: () => void }) {
  // Input refs for Enter key navigation
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Animations
  const anim = useRef(new Animated.Value(mode === 'signup' ? 1 : 0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: mode === 'signup' ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [mode]);

  async function handleSubmit() {
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const res: any = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (res?.error) throw res.error;
        setMessage('Sign-up successful. Check your email to confirm if required.');
        onSignedIn?.();
      } else {
        const res: any = await supabase.auth.signInWithPassword({ email, password });
        if (res?.error) throw res.error;
        setMessage('Signed in');
        onSignedIn?.();
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
  }

  async function handleGoogleSignIn() {
    setMessage(null);
    setLoading(true);
    try {
      // For Expo Go, we need to use exp:// URL. For production, use belay://
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'belay' });
      
      console.log('Redirect URI:', redirectTo);

      // Get the OAuth URL from Supabase
      const res: any = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      
      if (res?.error) throw res.error;

      const authUrl = res?.data?.url;
      if (!authUrl) {
        throw new Error('No auth URL returned from Supabase');
      }

      setMessage('Opening Google sign-in...');
      
      // Set up a listener for the deep link before opening the browser
      const handleUrl = async (event: { url: string }) => {
        const url = event.url;
        console.log('Deep link received:', url);
        
        // Parse tokens from the URL
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Supabase returns tokens in the URL fragment (#)
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
            setMessage('Signed in successfully!');
            onSignedIn?.();
          } catch (err: any) {
            setMessage('Error setting session: ' + err.message);
          }
        } else {
          // Check if a session exists anyway
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            setMessage('Signed in successfully!');
            onSignedIn?.();
          }
        }
        setLoading(false);
        subscription.remove();
      };

      // Add the listener
      const subscription = Linking.addEventListener('url', handleUrl);

      // Open the auth URL in the external browser
      await Linking.openURL(authUrl);
      
      // Clean up after a timeout (user might cancel)
      setTimeout(() => {
        subscription.remove();
        setLoading(false);
      }, 120000); // 2 minute timeout

    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setMessage(err?.message ?? 'An error occurred during sign-in');
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.gradientBg}>
        <TopoBackground />
      </View>
      {Platform.OS === 'web' ? (
        <SafeAreaView style={styles.contentContainer}>
          <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}> 
            <ThemedText style={styles.header}>CRUXLY</ThemedText>
            <ThemedText style={styles.tag}>Let's climb together.</ThemedText>
          </Animated.View>
          <View style={{ height: 32 }} />
          <Animated.View style={[styles.formCard, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}> 
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <Animated.View style={[
                styles.modeIndicator,
                {
                  transform: [{
                    translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [2, (width - 48 - 48 - 4) / 2] })
                  }]
                }
              ]} />
              <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signin')}>
                <ThemedText style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Sign In</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signup')}>
                <ThemedText style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Sign Up</ThemedText>
              </TouchableOpacity>
            </View>
            {/* Form Fields */}
            <View style={styles.inputsContainer}>
              <Animated.View style={{
                overflow: 'hidden',
                height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 72] }),
                opacity: anim,
                marginBottom: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }),
              }}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Full Name"
                    placeholderTextColor="#64748b"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    style={styles.input}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      // Focus next input (email)
                      if (emailInputRef?.current) emailInputRef.current.focus();
                    }}
                  />
                </View>
              </Animated.View>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  ref={emailInputRef}
                  placeholder="Email Address"
                  placeholderTextColor="#64748b"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    // Focus next input (password)
                    if (passwordInputRef?.current) passwordInputRef.current.focus();
                  }}
                />
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  ref={passwordInputRef}
                  placeholder="Password"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>
            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.submitBtnText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </ThemedText>
              )}
            </TouchableOpacity>
            {message ? (
              <View style={styles.messageBox}>
                <Ionicons name="information-circle" size={16} color="#1e4620" />
                <ThemedText style={styles.messageText}>{message}</ThemedText>
              </View>
            ) : null}
            <View style={styles.divider}>
              <View style={styles.line} />
              <ThemedText style={styles.orText}>OR</ThemedText>
              <View style={styles.line} />
            </View>
            {/* Google Button */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <View style={{ width: 20, height: 20, marginRight: 12 }}>
                <Svg height="100%" width="100%" viewBox="0 0 533.5 544.3">
                  <Path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.3H272v95.1h147.1c-6.3 34.1-25 63-53.3 82.2v68.3h86.1c50.6-46.7 79.6-115.3 79.6-195.3z" />
                  <Path fill="#34A853" d="M272 544.3c72.6 0 133.6-24 178.2-65.2l-86.1-68.3c-24 16.1-54.7 25.6-92.1 25.6-70.7 0-130.6-47.7-152-111.7H32.5v70.4C77.2 485 168.2 544.3 272 544.3z" />
                  <Path fill="#FBBC05" d="M120 328.7c-8.5-25.2-8.5-52.4 0-77.6V180.7H32.5C-6.4 240.6-6.4 303.7 32.5 363.6L120 328.7z" />
                  <Path fill="#EA4335" d="M272 107.6c39.5 0 75 13.6 102.9 40.4l77.1-77.1C405.6 24 346.6 0 272 0 168.2 0 77.2 59.3 32.5 149.5l87.5 70.4c21.4-64 81.3-111.7 152-111.7z" />
                </Svg>
              </View>
              <ThemedText style={styles.googleBtnText}>Continue with Google</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={styles.contentContainer}>
            <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}> 
              <ThemedText style={styles.header}>CRUXLY</ThemedText>
              <ThemedText style={styles.tag}>Let's climb together.</ThemedText>
            </Animated.View>
            <View style={{ height: 32 }} />
            <Animated.View style={[styles.formCard, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}> 
              {/* Mode Toggle */}
              <View style={styles.modeToggle}>
                <Animated.View style={[
                  styles.modeIndicator,
                  {
                    transform: [{
                      translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [2, (width - 48 - 48 - 4) / 2] })
                    }]
                  }
                ]} />
                <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signin')}>
                  <ThemedText style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Sign In</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modeBtn} onPress={() => setMode('signup')}>
                  <ThemedText style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Sign Up</ThemedText>
                </TouchableOpacity>
              </View>
              {/* Form Fields */}
              <View style={styles.inputsContainer}>
                <Animated.View style={{
                  overflow: 'hidden',
                  height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 72] }),
                  opacity: anim,
                  marginBottom: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }),
                }}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      placeholder="Full Name"
                      placeholderTextColor="#64748b"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      style={styles.input}
                    />
                  </View>
                </Animated.View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Email Address"
                    placeholderTextColor="#64748b"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#64748b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    style={styles.input}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.submitBtnText}>
                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  </ThemedText>
                )}
              </TouchableOpacity>
              {message ? (
                <View style={styles.messageBox}>
                  <Ionicons name="information-circle" size={16} color="#1e4620" />
                  <ThemedText style={styles.messageText}>{message}</ThemedText>
                </View>
              ) : null}
              <View style={styles.divider}>
                <View style={styles.line} />
                <ThemedText style={styles.orText}>OR</ThemedText>
                <View style={styles.line} />
              </View>
              {/* Google Button */}
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                <View style={{ width: 20, height: 20, marginRight: 12 }}>
                  <Svg height="100%" width="100%" viewBox="0 0 533.5 544.3">
                    <Path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.3H272v95.1h147.1c-6.3 34.1-25 63-53.3 82.2v68.3h86.1c50.6-46.7 79.6-115.3 79.6-195.3z" />
                    <Path fill="#34A853" d="M272 544.3c72.6 0 133.6-24 178.2-65.2l-86.1-68.3c-24 16.1-54.7 25.6-92.1 25.6-70.7 0-130.6-47.7-152-111.7H32.5v70.4C77.2 485 168.2 544.3 272 544.3z" />
                    <Path fill="#FBBC05" d="M120 328.7c-8.5-25.2-8.5-52.4 0-77.6V180.7H32.5C-6.4 240.6-6.4 303.7 32.5 363.6L120 328.7z" />
                    <Path fill="#EA4335" d="M272 107.6c39.5 0 75 13.6 102.9 40.4l77.1-77.1C405.6 24 346.6 0 272 0 168.2 0 77.2 59.3 32.5 149.5l87.5 70.4c21.4-64 81.3-111.7 152-111.7z" />
                  </Svg>
                </View>
                <ThemedText style={styles.googleBtnText}>Continue with Google</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 0,
  },
  logoImg: {
    width: 64,
    height: 64,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(121, 159, 203, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(121, 159, 203, 0.15)',
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  header: {
    fontSize: 25,
    fontWeight: '800',
    color: '#1e4620',
  },
  tag: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    height: 48,
    borderRadius: 24,
    marginBottom: 24,
    position: 'relative',
    padding: 3,
    overflow: 'hidden',
  },
  modeIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '50%',
    backgroundColor: '#1e4620',
    borderRadius: 22,
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modeText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  modeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  inputsContainer: {
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 58,
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
    height: 58,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1e4620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(121, 159, 203, 0.08)',
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
    gap: 10,
  },
  messageText: {
    color: '#1E293B',
    fontSize: 13,
    flex: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  orText: {
    color: '#94A3B8',
    fontSize: 12,
    marginHorizontal: 16,
    fontWeight: '600',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  googleBtnText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AuthScreen;
