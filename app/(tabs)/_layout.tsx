import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Keyboard } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme'; 
import { useColorScheme } from '@/hooks/use-color-scheme';
import { OnboardingFlow, checkOnboardingComplete, resetOnboarding } from '@/components/onboarding-flow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export { resetOnboarding };

const SKIP_TO_AUTH_KEY = '@cruxly_skip_to_auth';

// Call this before signing out to skip intro slides
export async function setSkipToAuthOnSignOut() {
  await AsyncStorage.setItem(SKIP_TO_AUTH_KEY, 'true');
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<any | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [skipToAuth, setSkipToAuth] = useState(false); // Skip intro slides on sign out
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      try {
        // Check both onboarding and session status
        const [onboardingComplete, sessionRes] = await Promise.all([
          checkOnboardingComplete(),
          supabase.auth.getSession(),
        ]);

        if (!mounted) return;

        // Handle invalid refresh token error
        if (sessionRes?.error?.message?.includes('refresh token')) {
          console.warn('Invalid refresh token, signing out...');
          await supabase.auth.signOut();
          setSession(null);
          setShowOnboarding(true); // Show onboarding for fresh start
          setIsLoading(false);
          return;
        }

        const currentSession = sessionRes?.data?.session ?? null;
        setSession(currentSession);

        // If no session OR onboarding not complete -> show onboarding flow
        // The onboarding flow handles both intro slides AND auth
        if (!currentSession || !onboardingComplete) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
        }

        setIsLoading(false);
      } catch (e) {
        if (mounted) {
          setShowOnboarding(true);
          setIsLoading(false);
        }
      }
    };

    initializeApp();

    // Subscribe to auth changes
    const { data: { subscription } }: any = supabase.auth.onAuthStateChange(async (event: string, newSession: any) => {
      console.log('Auth state changed:', event, !!newSession);
      setSession(newSession ?? null);
      
      // When user signs out (no session), show onboarding/auth
      if (!newSession || event === 'SIGNED_OUT') {
        console.log('User signed out, showing auth screen');
        // Check if we should skip to auth (user signed out manually)
        const shouldSkipToAuth = await AsyncStorage.getItem(SKIP_TO_AUTH_KEY);
        console.log('Should skip to auth:', shouldSkipToAuth);
        if (shouldSkipToAuth === 'true') {
          await AsyncStorage.removeItem(SKIP_TO_AUTH_KEY);
          setSkipToAuth(true);
        }
        // Always show onboarding when signed out - user needs to log in
        setShowOnboarding(true);
      }
    });

    return () => {
      mounted = false;
      try {
        subscription?.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Show loading state
  if (isLoading || showOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF9' }}>
        <ActivityIndicator size="large" color="#1e4620" />
      </View>
    );
  }

  // Show unified onboarding flow (intro -> auth -> plans for new users)
  if (showOnboarding) {
    return (
      <OnboardingFlow
        startAtAuth={skipToAuth}
        onComplete={() => {
          // Refresh session and hide onboarding
          setSkipToAuth(false);
          supabase.auth.getSession().then((res: any) => {
            setSession(res?.data?.session ?? null);
            setShowOnboarding(false);
          });
        }}
      />
    );
  }

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        Keyboard.dismiss();
        return false;
      }}
    >
      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#1e4620',
          tabBarInactiveTintColor: colorScheme === 'dark' ? '#64748B' : '#94A3B8',
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
            borderTopWidth: 0,
            elevation: 24,
            shadowColor: '#1E293B',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            height: 88,
            paddingBottom: 8,
            paddingTop: 12,
            paddingHorizontal: 15,
          },
          tabBarActiveBackgroundColor: 'transparent',
          tabBarLabelPosition: 'below-icon',
          tabBarItemStyle: {
            borderRadius: 16,
            marginHorizontal: 4,
            paddingVertical: 6,
          },
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{ 
                backgroundColor: focused ? 'rgba(30, 70, 32, 0.15)' : 'transparent',
                padding: focused ? 14 : 8,
                borderRadius: 14,
              }}>
                <IconSymbol size={28} name="brain.head.profile.fill" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: '',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                backgroundColor: focused ? 'rgba(30, 70, 32, 0.15)' : 'transparent',
                padding: focused ? 14 : 8,
                borderRadius: 14,
              }}>
                <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: '',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                backgroundColor: focused ? 'rgba(30, 70, 32, 0.15)' : 'transparent',
                padding: focused ? 14 : 8,
                borderRadius: 14,
              }}>
                <IconSymbol size={28} name="mappin.and.ellipse.circle" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{
                backgroundColor: focused ? 'rgba(30, 70, 32, 0.15)' : 'transparent',
                padding: focused ? 14 : 8,
                borderRadius: 14,
              }}>
                <IconSymbol size={28} name="person.circle.fill" color={color} />
              </View>
            ),
          }}
        />
        </Tabs>
    </View>
  );
}
