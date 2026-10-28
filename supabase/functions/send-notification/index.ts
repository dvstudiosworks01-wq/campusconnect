// Supabase Edge Function: send-notification
// Transactional email dispatch via Resend API with idempotency and delivery logging
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
    const collegeName = Deno.env.get('COLLEGE_NAME') || 'Kongu Engineering College'
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'CampusConnect <notifications@resend.dev>'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { notification_id, user_id, event_id, subject, body_html, recipient_email } = await req.json()

    if (!user_id || !subject) {
      return new Response(JSON.stringify({ error: 'user_id and subject are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Lookup recipient profile if email not directly supplied
    let targetEmail = recipient_email
    if (!targetEmail) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user_id)
        .single()
      targetEmail = userProfile?.email
    }

    if (!targetEmail) {
      return new Response(JSON.stringify({ error: 'Recipient email could not be resolved' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if notification record already sent to prevent duplicate delivery
    if (notification_id) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('status')
        .eq('id', notification_id)
        .single()

      if (existing?.status === 'sent') {
        return new Response(JSON.stringify({ message: 'Notification already delivered' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let isSent = false
    let providerError = null

    // Dispatch via Resend API if API key is present
    if (resendApiKey && resendApiKey !== 'placeholder') {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: targetEmail,
            subject: `[${collegeName}] ${subject}`,
            html: body_html || `<p>${subject}</p>`,
          }),
        })

        if (resendResponse.ok) {
          isSent = true
        } else {
          const errData = await resendResponse.json()
          providerError = errData.message || 'Resend provider error'
        }
      } catch (err: any) {
        providerError = err.message
      }
    } else {
      console.log(`[CampusConnect Mock Email] To: ${targetEmail} | Subject: ${subject}`)
      // Graceful local development behavior
      isSent = true
    }

    const now = new Date().toISOString()
    const finalStatus = isSent ? 'sent' : 'failed'

    // Update or insert notification log
    if (notification_id) {
      await supabase
        .from('notifications')
        .update({
          status: finalStatus,
          sent_at: isSent ? now : null,
        })
        .eq('id', notification_id)
    } else {
      await supabase.from('notifications').insert({
        user_id,
        event_id: event_id || null,
        type: 'transactional_email',
        subject,
        body: body_html,
        status: finalStatus,
        sent_at: isSent ? now : null,
      })
    }

    return new Response(
      JSON.stringify({
        success: isSent,
        status: finalStatus,
        delivered_to: targetEmail,
        provider_error: providerError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
