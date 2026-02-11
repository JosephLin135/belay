import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type FinalizeBody = {
  sessionId: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !stripeSecretKey) {
    return new Response(JSON.stringify({ error: 'Missing server configuration.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { sessionId } = (await req.json()) as FinalizeBody;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session ID.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;

  if (!userId || userId !== authData.user.id || !planId) {
    return new Response(JSON.stringify({ error: 'Invalid session metadata.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  await supabaseAdmin
    .from('profiles')
    .update({
      plan_id: planId,
      plan_status: 'active',
      stripe_customer_id: session.customer as string | null,
      stripe_subscription_id: subscriptionId ?? null,
      plan_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return new Response(JSON.stringify({ planId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
