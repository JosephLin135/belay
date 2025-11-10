import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AuthScreen from '@/components/auth-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // get initial session
    supabase.auth.getSession().then((res: any) => {
      if (!mounted) return;
      setSession(res?.data?.session ?? null);
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
    });

    // subscribe to auth changes
    const { data: { subscription } }: any = supabase.auth.onAuthStateChange((_: any, session: any) => {
      setSession(session ?? null);
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

  if (!session) {
    return (
      <AuthScreen
        onSignedIn={(choice?: any) => supabase.auth.getSession().then((res: any) => {
          setSession(res?.data?.session ?? null);
          // navigate to the index tab and include the chosen app as a query param so the index page can show it
          try {
            if (choice) {
              // replace to root index and pass the app choice as a query param
              router.replace({ pathname: '/', params: { app: choice } });
            }
          } catch (e) {
            // ignore router errors
          }
        })}
      />
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        // make the tab bar background white and the active tab a light gray on light mode
        tabBarStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background,
        },
        tabBarActiveBackgroundColor: colorScheme === 'light' ? '#f2f2f2' : undefined,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={async () => {
                try {
                  await supabase.auth.signOut();
                } catch (e) {
                  // ignore
                }
              }}
              style={{ paddingHorizontal: 12 }}
            >
              <ThemedText lightColor="#36454F">Sign out</ThemedText>
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
