import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface NotificationPayload {
  id?: string
  user_id: string
  event_id?: string | null
  type: 'event_announcement' | 'event_update' | 'campus_broadcast' | 'event_approval' | string
  subject: string
  body?: string
  status?: 'pending' | 'sent' | 'failed'
  sent_at?: string | null
  created_at?: string
}

export interface NotificationResult {
  success: boolean
  count: number
  error?: string
}

/**
 * Automatically notifies all students when a new event is published / added to the portal.
 */
export async function notifyAllStudentsNewEvent(event: {
  id: string
  title: string
  venue?: string
  start_at?: string
}): Promise<NotificationResult> {
  if (!isSupabaseConfigured) {
    return { success: false, count: 0, error: 'Database not connected' }
  }

  const subject = `New Event Announced: ${event.title}`
  const body = `A new college event "${event.title}" has been published at Kongu Engineering College! ${
    event.venue ? `Venue: ${event.venue}. ` : ''
  }Check out the event details and reserve your slot before registration closes.`

  // 1. Attempt to run via database RPC if installed
  try {
    const { data, error } = await supabase.rpc('notify_all_students', {
      p_subject: subject,
      p_body: body,
      p_event_id: event.id,
    })

    if (!error && typeof data === 'number') {
      return { success: true, count: data }
    }
  } catch (rpcErr) {
    // Continue to direct insertion fallback
    console.warn('notify_all_students RPC unavailable, falling back to direct insertion', rpcErr)
  }

  // 2. Direct client-side batch insert fallback
  try {
    const { data: students, error: studentErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'student')

    if (studentErr) throw studentErr
    if (!students || students.length === 0) {
      return { success: true, count: 0 }
    }

    const notifications = students.map((s) => ({
      user_id: s.id,
      event_id: event.id,
      type: 'event_announcement',
      subject,
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }))

    // Chunk into batches of 100 rows
    const chunkSize = 100
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize)
      const { error: insertErr } = await supabase.from('notifications').insert(chunk)
      if (insertErr) {
        console.error('Batch insert notification error:', insertErr)
      }
    }

    return { success: true, count: notifications.length }
  } catch (err: any) {
    console.error('Failed to notify students of new event:', err)
    return { success: false, count: 0, error: err.message || 'Notification broadcast failed' }
  }
}

/**
 * Organizers send update/alert notifications specifically to students registered for a given event.
 */
export async function notifyRegisteredStudents(
  eventId: string,
  eventTitle: string,
  subject: string,
  message: string
): Promise<NotificationResult> {
  if (!isSupabaseConfigured) {
    return { success: false, count: 0, error: 'Database not connected' }
  }

  const formattedSubject = subject.startsWith(`[${eventTitle}]`)
    ? subject
    : `[${eventTitle}] ${subject}`

  // 1. Attempt RPC
  try {
    const { data, error } = await supabase.rpc('notify_event_registrants', {
      p_event_id: eventId,
      p_subject: formattedSubject,
      p_body: message,
    })

    if (!error && typeof data === 'number') {
      return { success: true, count: data }
    }
  } catch (rpcErr) {
    console.warn('notify_event_registrants RPC unavailable, using fallback', rpcErr)
  }

  // 2. Direct fallback
  try {
    const { data: registrations, error: regErr } = await supabase
      .from('registrations')
      .select('student_id')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')

    if (regErr) throw regErr

    // Unique student IDs
    const studentIds = Array.from(
      new Set((registrations || []).map((r) => r.student_id).filter(Boolean))
    )

    if (studentIds.length === 0) {
      return { success: true, count: 0 }
    }

    const notifications = studentIds.map((sid) => ({
      user_id: sid,
      event_id: eventId,
      type: 'event_update',
      subject: formattedSubject,
      body: message,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }))

    const chunkSize = 100
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize)
      const { error: insertErr } = await supabase.from('notifications').insert(chunk)
      if (insertErr) {
        console.error('Batch insert notification error:', insertErr)
      }
    }

    return { success: true, count: notifications.length }
  } catch (err: any) {
    console.error('Failed to notify registered students:', err)
    return { success: false, count: 0, error: err.message || 'Notification delivery failed' }
  }
}

/**
 * Organizers send a common broadcast announcement to all enrolled students.
 */
export async function notifyAllStudentsBroadcast(
  subject: string,
  message: string,
  eventId?: string
): Promise<NotificationResult> {
  if (!isSupabaseConfigured) {
    return { success: false, count: 0, error: 'Database not connected' }
  }

  // 1. Attempt RPC
  try {
    const { data, error } = await supabase.rpc('notify_all_students', {
      p_subject: subject,
      p_body: message,
      p_event_id: eventId || null,
    })

    if (!error && typeof data === 'number') {
      return { success: true, count: data }
    }
  } catch (rpcErr) {
    console.warn('notify_all_students RPC unavailable, using fallback', rpcErr)
  }

  // 2. Direct fallback
  try {
    const { data: students, error: studentErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'student')

    if (studentErr) throw studentErr
    if (!students || students.length === 0) {
      return { success: true, count: 0 }
    }

    const notifications = students.map((s) => ({
      user_id: s.id,
      event_id: eventId || null,
      type: 'campus_broadcast',
      subject,
      body: message,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }))

    const chunkSize = 100
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize)
      const { error: insertErr } = await supabase.from('notifications').insert(chunk)
      if (insertErr) {
        console.error('Batch insert notification error:', insertErr)
      }
    }

    return { success: true, count: notifications.length }
  } catch (err: any) {
    console.error('Failed to broadcast notification:', err)
    return { success: false, count: 0, error: err.message || 'Broadcast delivery failed' }
  }
}

/**
 * Fetches count of active confirmed registrants for an event.
 */
export async function getEventRegistrantCount(eventId: string): Promise<number> {
  if (!isSupabaseConfigured || !eventId) return 0
  try {
    const { count, error } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('status', 'cancelled')

    if (error) throw error
    return count || 0
  } catch {
    return 0
  }
}

/**
 * Fetches total count of enrolled students in the college.
 */
export async function getTotalStudentsCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student')

    if (error) throw error
    return count || 0
  } catch {
    return 0
  }
}
