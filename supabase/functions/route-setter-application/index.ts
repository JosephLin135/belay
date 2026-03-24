import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ApplicationBody = {
  fullName: string;
  email: string;
  gymName: string;
  experience: string;
  additionalInfo?: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';

const RECIPIENT_EMAIL = 'getcruxly@gmail.com';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Missing server configuration.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authenticate user
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = (await req.json()) as ApplicationBody;
  const { fullName, email, gymName, experience, additionalInfo } = body;

  if (!fullName || !email || !gymName || !experience) {
    return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Store application in database
  const { error: dbError } = await supabase
    .from('route_setter_applications')
    .insert({
      user_id: authData.user.id,
      full_name: fullName,
      email: email,
      gym_name: gymName,
      experience: experience,
      additional_info: additionalInfo || null,
      status: 'pending',
    });

  if (dbError) {
    console.error('Database error:', dbError);
    // Continue anyway - we still want to send the email
  }

  // Build email content
  const emailHtml = `
    <h2>New Route Setter Application</h2>
    <p><strong>Applicant ID:</strong> ${authData.user.id}</p>
    <p><strong>Full Name:</strong> ${fullName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Gym:</strong> ${gymName}</p>
    <p><strong>Experience:</strong></p>
    <p style="white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 8px;">${experience}</p>
    ${additionalInfo ? `
    <p><strong>Additional Information:</strong></p>
    <p style="white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 8px;">${additionalInfo}</p>
    ` : ''}
    <hr />
    <p style="color: #666; font-size: 12px;">
      To approve this application, update the user's profile in Supabase:<br />
      <code>UPDATE profiles SET is_route_setter = true, route_setter_gym = '${gymName}' WHERE id = '${authData.user.id}';</code>
    </p>
  `;

  // Send email using Resend API (if configured)
  if (resendApiKey) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Cruxly <onboarding@resend.dev>',
          to: [RECIPIENT_EMAIL],
          subject: `Route Setter Application: ${fullName} (${gymName})`,
          html: emailHtml,
        }),
      });

      if (!emailRes.ok) {
        const errorText = await emailRes.text();
        console.error('Resend API error:', errorText);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the request - application is still stored
    }
  } else {
    console.log('RESEND_API_KEY not configured. Application stored in database.');
    console.log('Email would be sent to:', RECIPIENT_EMAIL);
    console.log('Application details:', { fullName, email, gymName, experience, additionalInfo });
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Application submitted successfully' 
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});
