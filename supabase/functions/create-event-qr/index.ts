// Supabase Edge Function: create-event-qr
// Cryptographically generates time-limited QR attendance session and stores SHA-256 hash
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify calling user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { event_id, duration_minutes = 10 } = await req.json()
    if (!event_id) {
      return new Response(JSON.stringify({ error: 'event_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify organizer or admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: event } = await supabase
      .from('events')
      .select('organizer_id, title')
      .eq('id', event_id)
      .single()

    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (profile?.role !== 'admin' && event.organizer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: You are not the organizer of this event' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate 32-character random hexadecimal token
    const randomBytes = new Uint8Array(16)
    crypto.getRandomValues(randomBytes)
    const rawToken = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('')

    // SHA-256 hash
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawToken))
    const tokenHash = Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('')

    const validFrom = new Date()
    const expiresAt = new Date(validFrom.getTime() + duration_minutes * 60 * 1000)

    // Revoke previous active sessions
    await supabase
      .from('event_qr_sessions')
      .update({ revoked_at: validFrom.toISOString() })
      .eq('event_id', event_id)
      .is('revoked_at', null)

    // Insert new session
    const { data: newSession, error: sessionError } = await supabase
      .from('event_qr_sessions')
      .insert({
        event_id,
        token_hash: tokenHash,
        valid_from: validFrom.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    return new Response(
      JSON.stringify({
        success: true,
        session_id: newSession.id,
        raw_token: rawToken,
        expires_at: expiresAt.toISOString(),
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
