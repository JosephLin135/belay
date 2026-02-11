import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AuthScreen from '@/components/auth-screen-new';
import { OnboardingScreen, checkOnboardingComplete } from '@/components/onboarding-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<any | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // Check onboarding status first
    const initializeApp = async () => {
      try {
        const onboardingComplete = await checkOnboardingComplete();
        if (mounted) {
          setShowOnboarding(!onboardingComplete);
        }
      } catch (e) {
        if (mounted) {
          setShowOnboarding(false); // Default to not showing if error
        }
      }

      // get initial session
      supabase.auth.getSession().then((res: any) => {
        if (!mounted) return;
        // Handle invalid refresh token error
        if (res?.error?.message?.includes('refresh token')) {
          console.warn('Invalid refresh token, signing out...');
          supabase.auth.signOut();
          setSession(null);
          setIsLoading(false);
          return;
        }
        setSession(res?.data?.session ?? null);
        setIsLoading(false);
        // if a selected app was stored before OAuth, navigate to it
        (async () => {
          try {
            const choice = await AsyncStorage.getItem('selectedApp');
            if (choice) {
              await AsyncStorage.removeItem('selectedApp');
              router.replace({ pathname: '/', params: { app: choice } });
            }
          } catch (e) {
            // ignore
          }
        })();
      }).catch((err: any) => {
        // Handle auth errors (e.g., invalid refresh token)
        console.warn('Auth session error:', err?.message);
        if (mounted) {
          supabase.auth.signOut();
          setSession(null);
          setIsLoading(false);
        }
      });
    };

    initializeApp();

    // subscribe to auth changes
    const { data: { subscription } }: any = supabase.auth.onAuthStateChange(async (_: any, session: any) => {
      setSession(session ?? null);
      
      // Re-check onboarding status when auth state changes (for debugging reset)
      if (!session) {
        const onboardingComplete = await checkOnboardingComplete();
        setShowOnboarding(!onboardingComplete);
      }
      
      // If we just signed in via OAuth, a selectedApp might be stored; restore it.
      (async () => {
        try {
          const choice = await AsyncStorage.getItem('selectedApp');
          if (choice) {
            await AsyncStorage.removeItem('selectedApp');
            try { router.replace({ pathname: '/', params: { app: choice } }); } catch (e) { /* ignore */ }
          }
        } catch (e) {
          // ignore
        }
      })();
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

  // Show loading state while checking onboarding and auth
  if (isLoading || showOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF9' }}>
        <ActivityIndicator size="large" color="#799FCB" />
      </View>
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  if (!session) {
    return (
      <AuthScreen
        onSignedIn={() => supabase.auth.getSession().then((res: any) => {
          setSession(res?.data?.session ?? null);
        })}
      />
    );
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#799FCB',
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
              backgroundColor: focused ? 'rgba(121, 159, 203, 0.15)' : 'transparent',
              padding: 10,
              borderRadius: 14,
              transform: [{ scale: focused ? 1.05 : 1 }],
            }}>
              <IconSymbol size={30} name="brain.head.profile.fill" color={color} />
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
              backgroundColor: focused ? 'rgba(121, 159, 203, 0.15)' : 'transparent',
              padding: 10,
              borderRadius: 14,
              transform: [{ scale: focused ? 1.05 : 1 }],
            }}>
              <IconSymbol size={30} name="bubble.left.and.bubble.right.fill" color={color} />
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
              backgroundColor: focused ? 'rgba(121, 159, 203, 0.15)' : 'transparent',
              padding: 10,
              borderRadius: 14,
              transform: [{ scale: focused ? 1.05 : 1 }],
            }}>
              <IconSymbol size={30} name="mappin.and.ellipse.circle" color={color} />
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
              backgroundColor: focused ? 'rgba(121, 159, 203, 0.15)' : 'transparent',
              padding: 10,
              borderRadius: 14,
              transform: [{ scale: focused ? 1.05 : 1 }],
            }}>
              <IconSymbol size={30} name="person.circle.fill" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
