import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SELECTED_PLAN_KEY = '@cruxly_selected_plan';

export type PlanId = 'free' | 'weekly' | 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  priceValue: number;
  period: string;
  billingInfo: string;
  features: string[];
  highlighted: boolean;
  badge?: string;
  stripePriceId?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceValue: 0,
    period: '',
    billingInfo: 'No credit card required',
    features: [
      'Find climbing partners',
      'Join communities',
      'Basic route tracking',
      'View community posts',
      'Create up to 5 posts/month',
    ],
    highlighted: false,
  },
  {
    id: 'weekly',
    name: 'Weekly',
    price: '$2.99',
    priceValue: 2.99,
    period: '/ week',
    billingInfo: 'Billed weekly, cancel anytime',
    features: [
      'All Free features',
      'AI route recommendations',
      '10 AI chats per week',
      'Progress analytics',
      'Unlimited community posts',
      'Early access to new features',
    ],
    highlighted: false,
    stripePriceId: 'price_weekly_placeholder',
  },
  {
    id: 'monthly',
    name: 'Pro Monthly',
    price: '$7.99',
    priceValue: 7.99,
    period: '/ month',
    billingInfo: 'Billed monthly, cancel anytime',
    features: [
      'All Weekly features',
      'Unlimited AI chats',
      'Advanced analytics & insights',
      'Priority support',
      'Custom training plans',
      'Exclusive Pro badge',
    ],
    highlighted: true,
    badge: 'MOST POPULAR',
    stripePriceId: 'price_monthly_placeholder',
  },
  {
    id: 'yearly',
    name: 'Pro Yearly',
    price: '$59.99',
    priceValue: 59.99,
    period: '/ year',
    billingInfo: 'Billed annually (save $35.89/year)',
    features: [
      'Everything in Pro Monthly',
      '2 months free',
      'Exclusive beta features',
      'Personal AI coach',
      'Offline mode',
      'Priority feature requests',
    ],
    highlighted: false,
    badge: 'BEST VALUE',
    stripePriceId: 'price_yearly_placeholder',
  },
];

interface MembershipScreenProps {
  visible: boolean;
  selectedPlan: Plan;
  onClose: () => void;
  onConfirm: (plan: Plan) => void;
}

export function MembershipScreen({ visible, selectedPlan, onClose, onConfirm }: MembershipScreenProps) {
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (selectedPlan.id !== 'free' && !agreed) {
      Alert.alert('Terms Required', 'Please agree to the terms and conditions to continue.');
      return;
    }

    setProcessing(true);

    try {
      if (selectedPlan.id === 'free') {
        // Free plan - just save and continue
        await savePlanSelection(selectedPlan.id);
        onConfirm(selectedPlan);
      } else {
        // Paid plan - would integrate with Stripe here
        // For now, simulate the process
        await simulatePayment(selectedPlan);
        await savePlanSelection(selectedPlan.id);
        onConfirm(selectedPlan);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const simulatePayment = async (plan: Plan): Promise<void> => {
    // In production, this would:
    // 1. Create a Stripe Checkout session via your backend
    // 2. Open the Stripe payment page
    // 3. Handle the callback/redirect
    // 4. Verify the payment on your backend
    // 5. Update the user's subscription status in Supabase

    // For demo purposes, we'll just simulate a delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1500);
    });
  };

  const openStripePayment = async () => {
    // In production, you would:
    // 1. Call your backend to create a Stripe Checkout session
    // 2. Get the checkout URL
    // 3. Open it with Linking.openURL()
    
    // Example:
    // const response = await fetch('YOUR_BACKEND_URL/create-checkout-session', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ 
    //     priceId: selectedPlan.stripePriceId,
    //     userId: currentUserId,
    //   }),
    // });
    // const { url } = await response.json();
    // await Linking.openURL(url);

    Alert.alert(
      'Stripe Integration',
      'In production, this would open Stripe Checkout for secure payment processing.\n\nFor demo purposes, we\'ll simulate a successful payment.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Simulate Payment', onPress: handleConfirm },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Your Plan</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Selected Plan Card */}
          <View style={styles.selectedPlanCard}>
            <LinearGradient
              colors={['#1e4620', '#449e00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planGradient}
            >
              {selectedPlan.badge && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>{selectedPlan.badge}</Text>
                </View>
              )}
              <Text style={styles.selectedPlanName}>{selectedPlan.name}</Text>
              <View style={styles.selectedPriceRow}>
                <Text style={styles.selectedPrice}>{selectedPlan.price}</Text>
                <Text style={styles.selectedPeriod}>{selectedPlan.period}</Text>
              </View>
              <Text style={styles.selectedBilling}>{selectedPlan.billingInfo}</Text>
            </LinearGradient>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's Included</Text>
            <View style={styles.featuresList}>
              {selectedPlan.features.map((feature, idx) => (
                <View key={idx} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </View>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Terms and Conditions - Only for paid plans */}
          {selectedPlan.id !== 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Terms & Conditions</Text>
              <View style={styles.termsBox}>
                <ScrollView style={styles.termsScroll} nestedScrollEnabled>
                  <Text style={styles.termsText}>
                    <Text style={styles.termsBold}>Subscription Agreement{'\n\n'}</Text>
                    
                    By subscribing to Cruxly {selectedPlan.name}, you agree to the following terms:{'\n\n'}
                    
                    <Text style={styles.termsBold}>1. Billing{'\n'}</Text>
                    • Your subscription will be billed {selectedPlan.period === '/week' ? 'weekly' : selectedPlan.period === '/month' ? 'monthly' : 'annually'} at {selectedPlan.price}
                    {selectedPlan.period === '/year' && ' (equivalent to $5/month)'}
                    {'\n'}• Payment will be charged to your selected payment method
                    {'\n'}• Billing cycle begins on the date of purchase{'\n\n'}
                    
                    <Text style={styles.termsBold}>2. Cancellation{'\n'}</Text>
                    • You may cancel your subscription at any time
                    {'\n'}• Upon cancellation, you'll retain access until the end of your current billing period
                    {'\n'}• No refunds for partial billing periods{'\n\n'}
                    
                    <Text style={styles.termsBold}>3. Auto-Renewal{'\n'}</Text>
                    • Your subscription will automatically renew unless cancelled at least 24 hours before the end of the current period
                    {'\n'}• You can manage your subscription in your account settings{'\n\n'}
                    
                    <Text style={styles.termsBold}>4. Features{'\n'}</Text>
                    • Access to all features included in your plan
                    {'\n'}• Feature availability may vary by region
                    {'\n'}• We reserve the right to modify features with notice{'\n\n'}
                    
                    <Text style={styles.termsBold}>5. Privacy{'\n'}</Text>
                    • Your data is protected according to our Privacy Policy
                    {'\n'}• We do not sell your personal information
                    {'\n'}• AI features use your climbing data to provide personalized recommendations{'\n\n'}
                    
                    <Text style={styles.termsBold}>6. Refund Policy{'\n'}</Text>
                    • Free trial users can cancel without charge
                    {'\n'}• Refund requests within 7 days of purchase may be considered on a case-by-case basis
                    {'\n'}• Contact support@cruxly.app for refund inquiries{'\n\n'}
                    
                    By proceeding, you acknowledge that you have read and agree to these terms, our Terms of Service, and Privacy Policy.
                  </Text>
                </ScrollView>
              </View>

              {/* Agreement Checkbox */}
              <TouchableOpacity 
                style={styles.agreementRow}
                onPress={() => setAgreed(!agreed)}
              >
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.agreementText}>
                  I agree to the Terms & Conditions and Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Payment Info - Only for paid plans */}
          {selectedPlan.id !== 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Secure Payment</Text>
              <View style={styles.paymentInfo}>
                <View style={styles.paymentRow}>
                  <Ionicons name="lock-closed" size={20} color="#449e" />
                  <Text style={styles.paymentText}>256-bit SSL encryption</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Ionicons name="card" size={20} color="#449e" />
                  <Text style={styles.paymentText}>Powered by Stripe</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Ionicons name="shield-checkmark" size={20} color="#449e" />
                  <Text style={styles.paymentText}>Cancel anytime, no hidden fees</Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.bottomCTA, { paddingBottom: insets.bottom + 16 }]}>
          {selectedPlan.id === 'free' ? (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              disabled={processing}
            >
              <LinearGradient
                colors={['#1e4620', '#449e00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.confirmText}>Continue with Free Plan</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.confirmButton, (!agreed || processing) && styles.confirmButtonDisabled]}
              onPress={openStripePayment}
              disabled={!agreed || processing}
            >
              <LinearGradient
                colors={agreed ? ['#1e4620', '#449e00'] : ['#94A3B8', '#94A3B8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#FFF" />
                    <Text style={styles.confirmText}>Subscribe for {selectedPlan.price}{selectedPlan.period}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          <Text style={styles.secureText}>
            {selectedPlan.id === 'free' 
              ? 'No payment required' 
              : 'Secure checkout powered by Stripe'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Helper function to save plan selection
export async function savePlanSelection(planId: PlanId): Promise<void> {
  try {
    await AsyncStorage.setItem(SELECTED_PLAN_KEY, planId);
  } catch (e) {
    console.error('Error saving plan:', e);
  }
}

// Helper function to get saved plan
export async function getSavedPlan(): Promise<PlanId | null> {
  try {
    const planId = await AsyncStorage.getItem(SELECTED_PLAN_KEY);
    return planId as PlanId | null;
  } catch (e) {
    return null;
  }
}

// Get plan details by ID
export function getPlanById(planId: PlanId): Plan | undefined {
  return PLANS.find(p => p.id === planId);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  scrollView: {
    flex: 1,
  },
  selectedPlanCard: {
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  planGradient: {
    padding: 24,
    alignItems: 'center',
  },
  selectedBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  selectedBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedPlanName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  selectedPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  selectedPrice: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFF',
  },
  selectedPeriod: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },
  selectedBilling: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  featuresList: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#449e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
  },
  termsBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  termsScroll: {
    flex: 1,
  },
  termsText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
  termsBold: {
    fontWeight: '700',
    color: '#334155',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#449e',
    borderColor: '#449e',
  },
  agreementText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
  },
  paymentInfo: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentText: {
    fontSize: 14,
    color: '#475569',
  },
  bottomCTA: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#FAFAF9',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  confirmButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 8,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  secureText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default MembershipScreen;
