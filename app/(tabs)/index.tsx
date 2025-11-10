import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link, useLocalSearchParams } from 'expo-router';

export default function HomeScreen() {
  const params = useLocalSearchParams();
  const app = (params?.app as string) ?? 'belaybuddy';

  return (
    <ThemedView style={styles.container}>
      {app === 'belaybuddy' ? (
        <ThemedText style={styles.title}>BelayBuddy</ThemedText>
      ) : (
        <ThemedText style={styles.title}>RouteVision</ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
  },
  title: {
    fontSize: 24,
    marginVertical: 8,
  },
});
