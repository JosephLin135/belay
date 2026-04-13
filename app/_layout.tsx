import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Keyboard, View } from 'react-native';
import { useFonts, ChauPhilomeneOne_400Regular } from '@expo-google-fonts/chau-philomene-one';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/loading-screen';

import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ ChauPhilomeneOne_400Regular });
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      // Keep custom loading screen visible briefly, then fade out
      setTimeout(() => setShowLoader(false), 600);
    }
  }, [fontsLoaded]);

  return (
    <View
      // Capture touch events in the capture phase to dismiss keyboard
      onStartShouldSetResponderCapture={() => {
        Keyboard.dismiss();
        return false; // do not block children
      }}
      style={{ flex: 1 }}
    >
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
      <LoadingScreen visible={showLoader} />
    </View>
  );
}
