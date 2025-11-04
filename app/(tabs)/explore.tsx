import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { Collapsible } from '@/components/ui/collapsible';
import { ExternalLink } from '@/components/external-link';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { HelloWave } from '@/components/hello-wave';

export default function TabTwoScreen() {
  return (
      <ThemedView style={styles.container}>
        <HelloWave />
        <ThemedText style={styles.title}>Explore</ThemedText>
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