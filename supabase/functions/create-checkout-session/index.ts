import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CheckoutRequest = {
  priceId: string;
  planId: 'weekly' | 'monthly' | 'yearly';
  redirectUrl: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
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

  const body = (await req.json()) as CheckoutRequest;
  const { priceId, planId, redirectUrl } = body;

  if (!priceId || !planId || !redirectUrl) {
    return jsonResponse({ error: 'Missing required fields.' }, 400);
  }

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', redirectUrl);
  form.set('client_reference_id', authData.user.id);
  form.set('metadata[planId]', planId);
  form.set('metadata[userId]', authData.user.id);
  if (authData.user.email) {
    form.set('customer_email', authData.user.email);
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!stripeRes.ok) {
    const errorText = await stripeRes.text();
    return jsonResponse({ error: `Stripe error: ${errorText}` }, 400);
  }

  const data = await stripeRes.json();
  return jsonResponse({ url: data.url, sessionId: data.id }, 200);
});
