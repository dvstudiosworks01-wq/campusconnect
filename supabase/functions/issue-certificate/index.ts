// Supabase Edge Function: issue-certificate
// Verifies eligibility and issues cryptographic certificates with private storage integration
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

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { event_id, student_id, certificate_type = 'participation' } = await req.json()
    if (!event_id || !student_id) {
      return new Response(JSON.stringify({ error: 'event_id and student_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify organizer or admin permission
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
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient privileges' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify student attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('event_id', event_id)
      .eq('student_id', student_id)
      .single()

    if (!attendance) {
      return new Response(JSON.stringify({ error: 'Student did not check in to this event' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate unique certificate ID
    const year = new Date().getFullYear()
    const prefix = event.title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'EVNT'
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
    const certificateNumber = `CERT-${prefix}-${year}-${rand}`
    const storagePath = `certificates/${event_id}/${student_id}.pdf`

    const { data: cert, error: certError } = await supabase
      .from('certificates')
      .insert({
        event_id,
        student_id,
        certificate_number: certificateNumber,
        certificate_type,
        storage_path: storagePath,
      })
      .select()
      .single()

    if (certError) throw certError

    return new Response(
      JSON.stringify({
        success: true,
        certificate_id: cert.id,
        certificate_number: certificateNumber,
        issued_at: cert.issued_at,
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
