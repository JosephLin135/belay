import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MembershipScreen, PLANS, Plan, PlanId, savePlanSelection } from '@/components/membership-screen';

const { width, height } = Dimensions.get('window');

const ONBOARDING_KEY = '@cruxly_onboarding_complete';

// Slide data
const slides = [
  {
    id: 1,
    title: 'Cruxly',
    subtitle: 'Your all-in-one climbing companion',
    description: 'Connect with climbers and discover new routes!',
    gradient: ['#1e4620', '#449e'],
  },
  {
    id: 2,
    title: 'Find Your Crew',
    subtitle: 'Never climb alone',
    description: 'Meet climbers at your level, join local communities, annd organize sessions!',
    gradient: ['#1e4620', '#449e'],
  },
  {
    id: 3,
    icon: 'sparkles-outline',
    title: 'AI Insights',
    subtitle: 'Climb smarter, not harder',
    description: 'Analyze your climbs with AI and level up faster!',
    gradient: ['#1e4620', '#449e'],
  },
  {
    id: 4,
    icon: 'diamond-outline',
    title: 'Choose Your Plan',
    subtitle: 'Unlock your full potential',
    description: '',
    gradient: ['#1e4620', '#449e'],
    illustration: 'plans',
    isPlansSlide: true,
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('free');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const selectedPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
    }
  };

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // On the plans slide, show the membership modal
      setShowMembershipModal(true);
    }
  };

  const handleSkip = () => {
    goToSlide(slides.length - 1);
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      // Ignore storage errors
    }
    onComplete();
  };

  const handlePlanSelect = (planId: PlanId) => {
    setSelectedPlanId(planId);
  };

  const handleMembershipConfirm = async (plan: Plan) => {
    setShowMembershipModal(false);
    await handleComplete();
  };

  const renderPlanCard = (plan: Plan) => {
    const isSelected = selectedPlanId === plan.id;
    
    return (
      <View key={plan.id} style={styles.planCardWrapper}>
        {/* Badge text above the card */}
        {plan.badge ? (
          <View style={[styles.planBadgeContainer, plan.id === 'yearly' ? styles.planBadgeYellow : styles.planBadgePurple]}>
            <ThemedText style={[styles.planBadgeText, plan.id === 'yearly' ? styles.planBadgeTextYellow : styles.planBadgeTextPurple]}>{plan.badge}</ThemedText>
          </View>
        ) : (
          <View style={styles.planBadgeSpacer} />
        )}
        
        <TouchableOpacity
          style={[
            styles.planCard,
            isSelected && styles.planCardSelected,
          ]}
          onPress={() => handlePlanSelect(plan.id)}
          activeOpacity={1}
        >
          {/* Selection indicator */}
          <View style={[styles.selectIndicator, isSelected && styles.selectIndicatorActive]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#FFF" />}
          </View>
          
          <ThemedText style={styles.planName}>{plan.name}</ThemedText>
          <View style={styles.planPriceRow}>
            <ThemedText style={styles.planPrice}>{plan.price}</ThemedText>
            <ThemedText style={styles.planPeriod}>{plan.period}</ThemedText>
          </View>
          <View style={styles.planFeatures}>
            {plan.features.slice(0, 4).map((feature, idx) => (
              <View key={idx} style={styles.planFeatureRow}>
                <Ionicons name="checkmark-circle" size={14} color={isSelected ? "#449e" : "#94A3B8"} />
                <ThemedText style={[styles.planFeatureText, isSelected && styles.planFeatureTextSelected]}>{feature}</ThemedText>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSlide = (slide: typeof slides[0], index: number) => (
    <View key={slide.id} style={styles.slide}>
      <View style={[styles.slideContent]}>
        {/* Illustration or Plans */}
        {slide.isPlansSlide ? (
          <View style={styles.plansContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.plansScroll}
              snapToInterval={width * 0.7}
              decelerationRate="fast"
            >
              {PLANS.map(renderPlanCard)}
            </ScrollView>
          </View>
        ) : (
          <Animated.View
            style={[
              {
                backgroundColor: slide.gradient[0] + '15',
                transform: [
                  {
                    scale: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
          </Animated.View>
        )}

        {/* Text Content */}
        <ThemedText style={styles.slideTitle}>{slide.title}</ThemedText>
        <ThemedText style={[styles.slideSubtitle, { color: slide.gradient[0] }]}>
          {slide.subtitle}
        </ThemedText>
        {slide.description ? (
          <ThemedText style={styles.slideDescription}>{slide.description}</ThemedText>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Skip button */}
        {currentSlide < slides.length - 1 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <ThemedText style={styles.skipText}>Skip</ThemedText>
          </TouchableOpacity>
        )}

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {slides.map((slide, index) => renderSlide(slide, index))}
        </ScrollView>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Dots */}
          <View style={styles.dotsContainer}>
            {slides.map((_, index) => (
              <TouchableOpacity key={index} onPress={() => goToSlide(index)}>
                <View
                  style={[
                    styles.dot,
                    currentSlide === index && [
                      styles.dotActive,
                      { backgroundColor: slides[currentSlide].gradient[0] },
                    ],
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Next/Get Started Button */}
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: slides[currentSlide].gradient[0] }]}
            onPress={handleNext}
          >
            <ThemedText style={styles.nextButtonText}>
              {currentSlide === slides.length - 1 
                ? `Continue with ${selectedPlan.name}` 
                : 'Next'}
            </ThemedText>
            <Ionicons
              name={currentSlide === slides.length - 1 ? 'arrow-forward' : 'arrow-forward'}
              size={20}
              color="#FFF"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Membership Confirmation Modal */}
      <MembershipScreen
        visible={showMembershipModal}
        selectedPlan={selectedPlan}
        onClose={() => setShowMembershipModal(false)}
        onConfirm={handleMembershipConfirm}
      />
    </View>
  );
}

// Check if onboarding was completed
export async function checkOnboardingComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (e) {
    return false;
  }
}

// Reset onboarding (for testing)
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (e) {
    // Ignore
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  safeArea: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    color: '#449e',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    paddingHorizontal: 24,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    overflow: 'visible',
  },
  slideTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
    lineHeight: 40,
  },
  slideSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  plansContainer: {
    width: '100%',
    marginTop: 16,
    marginBottom: 16,
  },
  plansScroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  planCardWrapper: {
    marginRight: 16,
  },
  planBadgeContainer: {
    alignSelf: 'center',
    width: '90%',
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  planBadgePurple: {
    backgroundColor: '#8B5CF6',
    top: 18,
  },
  planBadgeYellow: {
    backgroundColor: '#F59E0B',
    top:18,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFF',
    bottom: 3,
  },
  planBadgeTextPurple: {
    color: '#FFF',
  },
  planBadgeTextYellow: {
    color: '#FFF',
  },
  planBadgeSpacer: {
    height: 40,
  },
  planCard: {
    width: width * 0.65,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    paddingTop: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
    minHeight: 220,
  },
  planCardSelected: {
    borderColor: '#449e',
    backgroundColor: '#f0fff4',
    shadowColor: '#449e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  selectIndicator: {
    position: 'absolute',
    top: 10,
    right: 16,
    width: 20,
    height: 20,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectIndicatorActive: {
    backgroundColor: '#449e',
    borderColor: '#449e',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 6,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 25,
    fontWeight: '800',
    color: '#1E293B',
  },
  planPeriod: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  planFeatures: {
    gap: 8,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 13,
    color: '#64748B',
  },
  planFeatureTextSelected: {
    color: '#1E293B',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default OnboardingScreen;
