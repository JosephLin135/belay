import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import {
  OnboardingScreen,
  checkOnboardingComplete,
  resetOnboarding,
} from '@/components/onboarding-screen';

interface OnboardingFlowProps {
  onComplete: () => void;
  startAtAuth?: boolean;
}

export function OnboardingFlow({ onComplete, startAtAuth = false }: OnboardingFlowProps) {
  const [showAuth, setShowAuth] = useState(startAtAuth);
  const [bootPhase, setBootPhase] = useState<'spinner' | 'done'>('spinner');
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setShowAuth(startAtAuth);
  }, [startAtAuth]);

  useEffect(() => {
    const spinnerTimer = setTimeout(() => {
      setBootPhase('done');
    }, 2200);

    return () => {
      clearTimeout(spinnerTimer);
    };
  }, []);

  useEffect(() => {
    if (bootPhase !== 'spinner') return;

    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [bootPhase, spinAnim]);

  if (bootPhase === 'spinner') {
    const rotate = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={styles.spinnerScreen}>
        <Animated.View style={[styles.spinnerRing, { transform: [{ rotate }] }]} />
      </View>
    );
  }

  if (showAuth) {
    return <AuthScreen onSignedIn={onComplete} />;
  }

  return <OnboardingScreen onComplete={() => setShowAuth(true)} />;
}

export { checkOnboardingComplete, resetOnboarding };

const styles = StyleSheet.create({
  spinnerScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  spinnerRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: '#D1D5DB',
    borderTopColor: '#1e4620',
  },
});
