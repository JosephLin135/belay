import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TextInput, View, TouchableOpacity, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

type AppChoice = 'belaybuddy' | 'routevision';

export function AuthScreen({ onSignedIn }: { onSignedIn?: (choice?: AppChoice) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [appChoice, setAppChoice] = useState<AppChoice>('belaybuddy');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(mode === 'signup' ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim.current, {
      toValue: mode === 'signup' ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [mode]);

  async function handleSubmit() {
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        // Email + password sign up. Attach name as user metadata.
        const res: any = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (res?.error) throw res.error;
        setMessage('Sign-up successful. Check your email to confirm if required.');
  onSignedIn?.(appChoice);
      } else {
        // Email + password sign in
        const res: any = await supabase.auth.signInWithPassword({ email, password });
        if (res?.error) throw res.error;
        setMessage('Signed in');
        onSignedIn?.(appChoice);
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
      // persist the user's selected app so we can restore it after the OAuth redirect
      try {
        await AsyncStorage.setItem('selectedApp', appChoice);
      } catch (e) {
        // ignore storage errors
      }
      // This will open the browser to the Supabase-hosted OAuth flow. Make sure
      // you configure Google OAuth in Supabase and set redirect URIs as noted in docs.
      const res: any = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (res?.error) throw res.error;
      // Supabase may return a URL to open for the OAuth flow. Attempt to open it.
      const url = res?.data?.url ?? (res as any)?.url ?? res?.data?.provider_url;
      if (url) {
        // persist message then open in-app auth session (uses custom tabs / SFSafariViewController)
        setMessage('Opening Google sign-in...');
        try {
          const result: any = await (AuthSession as any).startAsync({ authUrl: url });
          // result.type === 'success' when the in-app browser flow finished
          if (result?.type === 'success') {
            setMessage('Google sign-in completed. Finalizing...');
            // try to read the session and notify parent
            try {
              const s: any = await supabase.auth.getSession();
              if (s?.data?.session) {
                onSignedIn?.(appChoice);
              }
            } catch (e) {
              // ignore
            }
          } else if (result?.type === 'dismiss') {
            setMessage('Sign-in cancelled');
          } else {
            setMessage('Google sign-in finished with unknown status');
          }
        } catch (e) {
          // fallback: try to open externally
          try {
            await Linking.openURL(url);
          } catch (err) {
            setMessage(`Open this URL in your browser: ${url}`);
          }
        }
      } else {
        // If no url returned, inform the user; Supabase might handle redirect internally in web contexts.
        setMessage('Unable to open Google sign-in. If you are on a device, make sure a browser is available.');
      }
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  const googleSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3">
    <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.3H272v95.1h147.1c-6.3 34.1-25 63-53.3 82.2v68.3h86.1c50.6-46.7 79.6-115.3 79.6-195.3z"/>
    <path fill="#34A853" d="M272 544.3c72.6 0 133.6-24 178.2-65.2l-86.1-68.3c-24 16.1-54.7 25.6-92.1 25.6-70.7 0-130.6-47.7-152-111.7H32.5v70.4C77.2 485 168.2 544.3 272 544.3z"/>
    <path fill="#FBBC05" d="M120 328.7c-8.5-25.2-8.5-52.4 0-77.6V180.7H32.5C-6.4 240.6-6.4 303.7 32.5 363.6L120 328.7z"/>
    <path fill="#EA4335" d="M272 107.6c39.5 0 75 13.6 102.9 40.4l77.1-77.1C405.6 24 346.6 0 272 0 168.2 0 77.2 59.3 32.5 149.5l87.5 70.4c21.4-64 81.3-111.7 152-111.7z"/>
  </svg>
  `;

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()} accessible={false}>
      <ThemedView style={styles.container} lightColor="#ffffff">
        <View style={styles.logoRow}>
          <ThemedText lightColor="#36454F" style={styles.header}>BELAY'D</ThemedText>
          <ThemedText lightColor="#928E85" style={styles.tag}>Climb together. Track routes.</ThemedText>
        </View>

        <View style={styles.card}>

      <ThemedText lightColor="#36454F" style={styles.cardTitle}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</ThemedText>

      <View style={styles.appSwitchRow}>
        <TouchableOpacity
          style={[
            styles.appButton,
            { borderColor: '#928E85' },
            appChoice === 'belaybuddy' && styles.appButtonActive,
          ]}
          onPress={() => setAppChoice('belaybuddy')}
        >
          <ThemedText lightColor={appChoice === 'belaybuddy' ? '#36454F' : '#928E85'}>BelayBuddy</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.appButton,
            { borderColor: '#928E85' },
            appChoice === 'routevision' && styles.appButtonActive,
          ]}
          onPress={() => setAppChoice('routevision')}
        >
          <ThemedText lightColor={appChoice === 'routevision' ? '#36454F' : '#928E85'}>RouteVision</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'signin' ? styles.modeButtonActive : undefined]}
          onPress={() => setMode('signin')}
        >
          <ThemedText lightColor={mode === 'signin' ? '#fff' : '#36454F'} style={mode === 'signin' ? styles.modeButtonTextActive : styles.modeButtonText}>Sign in</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'signup' ? styles.modeButtonActive : undefined]}
          onPress={() => setMode('signup')}
        >
          <ThemedText lightColor={mode === 'signup' ? '#fff' : '#36454F'} style={mode === 'signup' ? styles.modeButtonTextActive : styles.modeButtonText}>Sign up</ThemedText>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={{
          opacity: anim.current,
          transform: [
            {
              translateY: anim.current.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
            },
          ],
          overflow: 'hidden',
          // animate maxHeight so layout changes are smooth
          maxHeight: anim.current.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }) as any,
        }}
        pointerEvents={mode === 'signup' ? 'auto' : 'none'}
      >
        <TextInput
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          style={[styles.input, { borderColor: '#928E85', color: '#36454F' }]}
          placeholderTextColor="#999"
        />

        {/* Phone sign-in removed: using email + password only */}
      </Animated.View>

      <Animated.View
        style={{
          opacity: anim.current.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }),
        }}
      >
        <TextInput
          placeholder={mode === 'signup' ? 'Email' : 'Email'}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { borderColor: '#928E85', color: '#36454F' }]}
          placeholderTextColor="#999"
        />
      </Animated.View>

  <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={[styles.input, styles.passwordInput, { borderColor: '#928E85', color: '#36454F' }]}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.eyeButtonAbsolute} onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#36454F" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.submit, { backgroundColor: '#36454F' }]} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitText}>{mode === 'signin' ? 'Sign in' : 'Create account'} — {appChoice === 'belaybuddy' ? 'BelayBuddy' : 'RouteVision'}</ThemedText>}
      </TouchableOpacity>
      <View style={styles.sepRow}>
        <View style={styles.sepLine} />
        <ThemedText style={styles.sepText}>or</ThemedText>
        <View style={styles.sepLine} />
      </View>

      <TouchableOpacity
        style={[styles.googleButton]}
        onPress={handleGoogleSignIn}
        disabled={loading}
        accessibilityLabel="Continue with Google"
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#36454F" />
        ) : (
          <>
              <SvgXml xml={googleSvg} width="20" height="20" style={styles.googleIcon} />
              <ThemedText style={styles.googleText}>Continue with Google</ThemedText>
          </>
        )}
      </TouchableOpacity>

      </View>

  {message ? <ThemedText lightColor="#36454F" style={styles.message}>{message}</ThemedText> : null}

      <ThemedText style={styles.small}>Your account information is handled by Supabase auth.</ThemedText>
      </ThemedView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  header: {
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 16,
    color: '#36454F',
  },
  subheader: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
    color: '#928E85',
  },
  appSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  appButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  appButtonActive: {
    backgroundColor: '#f2f2f2',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  modeActive: {
    fontWeight: '700',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#928E85',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeButtonActive: {
    backgroundColor: '#36454F',
    borderColor: '#36454F',
  },
  modeButtonText: {
    fontSize: 16,
    color: '#36454F',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButtonAbsolute: {
    position: 'absolute',
    right: 8,
    top: 6,
    padding: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  submit: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
  },
  message: {
    marginTop: 12,
    textAlign: 'center',
  },
  small: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 8,
    color: '#928E85',
  },
  googleButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#36454F',
    backgroundColor: '#fff',
  },
  googleText: {
    color: '#36454F',
    fontWeight: '700',
  },
  googleIcon: {
    marginRight: 10,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  tag: {
    color: '#928E85',
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
    color: '#36454F',
  },
  sepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eef0f3',
  },
  sepText: {
    marginHorizontal: 10,
    color: '#928E85',
    fontSize: 12,
  },
});

export default AuthScreen;
