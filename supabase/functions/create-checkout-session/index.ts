import { serve } from 'std/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CreateCheckoutBody = {
  priceId: string;
  planId: string;
  redirectUrl: string;
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

  const { priceId, planId, redirectUrl } = (await req.json()) as CreateCheckoutBody;
  if (!priceId || !planId || !redirectUrl) {
    return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: profileData } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', authData.user.id)
    .single();

  let customerId = profileData?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: authData.user.email ?? undefined,
      metadata: { user_id: authData.user.id },
    });
    customerId = customer.id;
  }

  await supabaseAdmin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      stripe_customer_id: customerId,
      plan_id: planId,
      plan_status: 'pending',
      plan_updated_at: new Date().toISOString(),
    });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: customerId,
    success_url: `${redirectUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${redirectUrl}?canceled=1`,
    metadata: {
      user_id: authData.user.id,
      plan_id: planId,
    },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
