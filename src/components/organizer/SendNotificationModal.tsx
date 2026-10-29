import React, { useState, useEffect } from 'react'
import {
  Bell,
  Users,
  Megaphone,
  Calendar,
  Send,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  notifyRegisteredStudents,
  notifyAllStudentsBroadcast,
  getEventRegistrantCount,
  getTotalStudentsCount,
} from '@/lib/notifications'

export interface SendNotificationModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedEventId?: string
  onSuccess?: () => void
}

export function SendNotificationModal({
  isOpen,
  onClose,
  preselectedEventId,
  onSuccess,
}: SendNotificationModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [targetType, setTargetType] = useState<'event_registrants' | 'all_students'>(
    preselectedEventId ? 'event_registrants' : 'all_students'
  )
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(preselectedEventId || '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [isLoadingCount, setIsLoadingCount] = useState(false)

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preselectedEventId) {
        setSelectedEventId(preselectedEventId)
        setTargetType('event_registrants')
      }
      fetchOrganizerEvents()
    } else {
      setSubject('')
      setMessage('')
    }
  }, [isOpen, preselectedEventId])

  const fetchOrganizerEvents = async () => {
    if (!isSupabaseConfigured || !user) return
    try {
      const { data } = await supabase
        .from('events')
        .select('id, title, status, start_at, venue')
        .in('status', ['published', 'completed', 'pending'])
        .order('start_at', { ascending: false })

      setEvents(data || [])
      if (!selectedEventId && data && data.length > 0) {
        setSelectedEventId(data[0].id)
      }
    } catch (err) {
      console.error('Error fetching events for notification modal:', err)
    }
  }

  // Update recipient count preview
  useEffect(() => {
    async function updateCount() {
      setIsLoadingCount(true)
      if (targetType === 'event_registrants') {
        if (selectedEventId) {
          const count = await getEventRegistrantCount(selectedEventId)
          setRecipientCount(count)
        } else {
          setRecipientCount(0)
        }
      } else {
        const count = await getTotalStudentsCount()
        setRecipientCount(count)
      }
      setIsLoadingCount(false)
    }

    if (isOpen) {
      updateCount()
    }
  }, [targetType, selectedEventId, isOpen])

  const selectedEvent = events.find((e) => e.id === selectedEventId)

  // Quick Template Helpers
  const applyTemplate = (type: 'venue' | 'reminder' | 'instructions' | 'announcement') => {
    const eventName = selectedEvent?.title || 'the event'
    if (type === 'venue') {
      setSubject(`Venue Update for ${eventName}`)
      setMessage(
        `Please note an update regarding the venue for ${eventName}. All attendees are requested to report to the designated hall on time.`
      )
    } else if (type === 'reminder') {
      setSubject(`Reminder: ${eventName} is happening soon!`)
      setMessage(
        `Friendly reminder that ${eventName} is scheduled to start soon. Please arrive 15 minutes before the session to complete your QR check-in.`
      )
    } else if (type === 'instructions') {
      setSubject(`Important Guidelines & Preparation for ${eventName}`)
      setMessage(
        `Kindly carry your official Kongu Engineering College student ID card. Ensure all required materials or laptops are prepared beforehand.`
      )
    } else if (type === 'announcement') {
      setSubject(`Notice to All Students: ${eventName || 'Campus Update'}`)
      setMessage(
        `Kongu Engineering College is pleased to share an important event announcement. Visit the events portal to view details and register.`
      )
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim()) {
      toast({ type: 'warning', title: 'Subject Required', message: 'Please enter a notification subject.' })
      return
    }

    if (!message.trim()) {
      toast({ type: 'warning', title: 'Message Required', message: 'Please enter the notification message body.' })
      return
    }

    if (targetType === 'event_registrants' && !selectedEventId) {
      toast({ type: 'warning', title: 'Event Required', message: 'Please select an event to notify its registrants.' })
      return
    }

    setIsLoading(true)
    try {
      if (targetType === 'event_registrants') {
        const res = await notifyRegisteredStudents(
          selectedEventId,
          selectedEvent?.title || 'College Event',
          subject.trim(),
          message.trim()
        )

        if (!res.success) throw new Error(res.error || 'Failed to dispatch notification')

        toast({
          type: 'success',
          title: 'Notification Dispatched!',
          message: `Successfully notified ${res.count} student${res.count === 1 ? '' : 's'} registered for "${selectedEvent?.title}".`,
        })
      } else {
        const res = await notifyAllStudentsBroadcast(
          subject.trim(),
          message.trim(),
          selectedEventId || undefined
        )

        if (!res.success) throw new Error(res.error || 'Failed to broadcast notification')

        toast({
          type: 'success',
          title: 'Broadcast Dispatched!',
          message: `Successfully broadcast notification to ${res.count} college student${res.count === 1 ? '' : 's'}.`,
        })
      }

      onClose()
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error('Send notification error:', err)
      toast({
        type: 'error',
        title: 'Dispatch Failed',
        message: err.message || 'Could not send notifications. Please verify database permissions.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send Student Notification"
      description="Dispatch official announcements or updates to registered attendees or the entire student body."
      maxWidth="lg"
    >
      <form onSubmit={handleSend} className="space-y-5 text-left">
        {/* Target Audience Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Target Audience
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTargetType('event_registrants')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                targetType === 'event_registrants'
                  ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  targetType === 'event_registrants'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Event Registrants</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Send updates to students registered for a specific event
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTargetType('all_students')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                targetType === 'all_students'
                  ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  targetType === 'all_students'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">All College Students</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Broadcast commonly to all students across Kongu Engineering College
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Event Selection */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            {targetType === 'event_registrants' ? 'Select Target Event *' : 'Associate with Event (Optional)'}
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            required={targetType === 'event_registrants'}
          >
            {targetType === 'all_students' && <option value="">-- No specific event link --</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.status})
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Estimated Audience:
            </span>
            <span className="font-semibold text-slate-800">
              {isLoadingCount
                ? 'Calculating...'
                : recipientCount !== null
                ? `${recipientCount} Student${recipientCount === 1 ? '' : 's'}`
                : '0 Students'}
            </span>
          </div>
        </div>

        {/* Quick Templates */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quick Templates
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyTemplate('venue')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              📍 Venue Update
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('reminder')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              ⏰ Starting Reminder
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('instructions')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              📋 Preparation Guidelines
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('announcement')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              📢 General Announcement
            </button>
          </div>
        </div>

        {/* Subject */}
        <Input
          label="Subject Line *"
          placeholder="e.g. Schedule Update or Important Event Guidelines"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />

        {/* Body */}
        <Textarea
          label="Message Body *"
          placeholder="Write the detailed message content for students..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
        />

        {/* Live Preview Box */}
        {(subject || message) && (
          <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-blue-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Live In-App Notification Preview
            </div>
            <div className="font-bold text-slate-900 pt-1">{subject || 'No subject'}</div>
            <div className="text-slate-600 line-clamp-3 whitespace-pre-line">
              {message || 'No message body'}
            </div>
            <div className="text-[10px] text-blue-700 font-medium pt-1">
              Audience: {targetType === 'event_registrants' ? 'Event Registrants' : 'All Students'} • Kongu Engineering College
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            leftIcon={<Send className="w-4 h-4" />}
          >
            {targetType === 'event_registrants'
              ? `Send to ${recipientCount !== null ? recipientCount : ''} Registrants`
              : `Broadcast to All Students`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
