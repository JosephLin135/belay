import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type FinalizeRequest = {
  sessionId: string;
};

type PlanId = 'free' | 'weekly' | 'monthly' | 'yearly';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const stripePriceMap = {
  weekly: Deno.env.get('STRIPE_PRICE_WEEKLY') ?? '',
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '',
  yearly: Deno.env.get('STRIPE_PRICE_YEARLY') ?? '',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function inferPlanFromPrice(priceId?: string): PlanId | null {
  if (!priceId) return null;
  if (priceId === stripePriceMap.weekly) return 'weekly';
  if (priceId === stripePriceMap.monthly) return 'monthly';
  if (priceId === stripePriceMap.yearly) return 'yearly';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  if (!supabaseUrl || !supabaseAnonKey || !stripeSecretKey) {
    return jsonResponse({ error: 'Missing server configuration.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = (await req.json()) as FinalizeRequest;
  if (!body.sessionId) {
    return jsonResponse({ error: 'Missing sessionId.' }, 400);
  }

  const stripeRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(body.sessionId)}?expand[]=line_items`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
    }
  );

  if (!stripeRes.ok) {
    const errorText = await stripeRes.text();
    return jsonResponse({ error: `Stripe error: ${errorText}` }, 400);
  }

  const session = await stripeRes.json();

  if (session?.payment_status !== 'paid' && session?.status !== 'complete') {
    return jsonResponse({ error: 'Checkout session is not completed.' }, 400);
  }

  const firstLineItem = session?.line_items?.data?.[0];
  const priceId = firstLineItem?.price?.id as string | undefined;

  const metadataPlanId = session?.metadata?.planId as PlanId | undefined;
  const inferredPlanId = inferPlanFromPrice(priceId);
  const planId: PlanId = metadataPlanId || inferredPlanId || 'monthly';

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      plan_id: planId,
      plan_status: 'active',
      plan_updated_at: new Date().toISOString(),
    })
    .eq('id', authData.user.id);

  if (updateError) {
    return jsonResponse({ error: `Profile update failed: ${updateError.message}` }, 500);
  }

  return jsonResponse({
    success: true,
    planId,
  });
});
