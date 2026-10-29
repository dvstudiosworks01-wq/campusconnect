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
  Clock,
  History,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  notifyRegisteredStudents,
  notifyAllStudentsBroadcast,
  getEventRegistrantCount,
  getTotalStudentsCount,
} from '@/lib/notifications'
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/utils'

export function OrganizerNotificationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Form State
  const [targetType, setTargetType] = useState<'event_registrants' | 'all_students'>('event_registrants')
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [isLoadingCount, setIsLoadingCount] = useState(false)

  // Stats
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [activeEventsCount, setActiveEventsCount] = useState<number>(0)

  // Sent History
  const [sentHistory, setSentHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historySearch, setHistorySearch] = useState('')

  // Load organizer events and stats
  const loadInitialData = async () => {
    if (!isSupabaseConfigured || !user) return

    try {
      // 1. Fetch organizer events
      const { data: eventData } = await supabase
        .from('events')
        .select('id, title, status, start_at, venue')
        .in('status', ['published', 'pending', 'completed'])
        .order('start_at', { ascending: false })

      setEvents(eventData || [])
      if (eventData && eventData.length > 0 && !selectedEventId) {
        setSelectedEventId(eventData[0].id)
      }
      setActiveEventsCount((eventData || []).filter((e) => e.status === 'published').length)

      // 2. Fetch total students count
      const studentCount = await getTotalStudentsCount()
      setTotalStudents(studentCount)

      // 3. Fetch sent notification logs
      await fetchNotificationLogs()
    } catch (err) {
      console.error('Error initializing notifications page:', err)
    }
  }

  const fetchNotificationLogs = async () => {
    if (!isSupabaseConfigured) {
      setIsLoadingHistory(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          subject,
          body,
          status,
          created_at,
          event:events(id, title),
          user:profiles!notifications_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setSentHistory(data || [])
    } catch (err) {
      console.error('Error fetching notification logs:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [user])

  // Recalculate recipient count
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

    updateCount()
  }, [targetType, selectedEventId])

  const selectedEvent = events.find((e) => e.id === selectedEventId)

  // Template autofill
  const applyTemplate = (type: 'venue' | 'reminder' | 'instructions' | 'announcement') => {
    const eventName = selectedEvent?.title || 'the event'
    if (type === 'venue') {
      setSubject(`Venue Update for ${eventName}`)
      setMessage(
        `Please note an update regarding the venue for ${eventName}. All attendees are requested to report to the designated hall on time.`
      )
    } else if (type === 'reminder') {
      setSubject(`Reminder: ${eventName} is starting soon!`)
      setMessage(
        `Friendly reminder that ${eventName} will begin shortly. Please arrive 15 minutes before the session to complete your QR check-in.`
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

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim()) {
      toast({ type: 'warning', title: 'Subject Required', message: 'Please enter a notification subject.' })
      return
    }

    if (!message.trim()) {
      toast({ type: 'warning', title: 'Message Required', message: 'Please enter a notification message.' })
      return
    }

    if (targetType === 'event_registrants' && !selectedEventId) {
      toast({ type: 'warning', title: 'Event Required', message: 'Please select an event to notify its registrants.' })
      return
    }

    setIsSubmitting(true)
    try {
      if (targetType === 'event_registrants') {
        const res = await notifyRegisteredStudents(
          selectedEventId,
          selectedEvent?.title || 'College Event',
          subject.trim(),
          message.trim()
        )

        if (!res.success) throw new Error(res.error || 'Failed to dispatch notifications')

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

      setSubject('')
      setMessage('')
      await fetchNotificationLogs()
    } catch (err: any) {
      console.error('Notification dispatch error:', err)
      toast({
        type: 'error',
        title: 'Dispatch Failed',
        message: err.message || 'Could not send notifications.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter history
  const filteredHistory = sentHistory.filter((item) => {
    if (!historySearch.trim()) return true
    const q = historySearch.toLowerCase()
    return (
      item.subject?.toLowerCase().includes(q) ||
      item.body?.toLowerCase().includes(q) ||
      item.event?.title?.toLowerCase().includes(q) ||
      item.user?.full_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-8 text-left">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Student Notifications & Broadcast Hub
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Send real-time alerts to registered attendees of an event or broadcast college-wide announcements to all students.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{totalStudents}</div>
              <div className="text-xs text-slate-500">Enrolled College Students</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{activeEventsCount}</div>
              <div className="text-xs text-slate-500">Active Published Events</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{sentHistory.length}</div>
              <div className="text-xs text-slate-500">Recent Notifications Tracked</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Broadcast Composer */}
      <Card className="border-slate-200 shadow-card">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Compose New Notification</h3>
              <p className="text-xs text-slate-500">
                Choose your recipient audience and craft your notification message below.
              </p>
            </div>
          </div>

          <form onSubmit={handleSendNotification} className="space-y-6">
            {/* Target Audience Segment Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Select Target Audience Segment *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTargetType('event_registrants')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    targetType === 'event_registrants'
                      ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      targetType === 'event_registrants'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Registered Students of an Event</div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Deliver updates, room changes, or timing reminders specifically to students registered for a chosen event.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('all_students')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    targetType === 'all_students'
                      ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      targetType === 'all_students'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">All College Students (Campus-Wide)</div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Send a common announcement to all enrolled students across all departments and academic years.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Event Selector */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                {targetType === 'event_registrants'
                  ? 'Select Event to Notify Registrants *'
                  : 'Associate with Event (Optional)'}
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
                  Estimated Audience Reach:
                </span>
                <span className="font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                  {isLoadingCount
                    ? 'Calculating recipients...'
                    : recipientCount !== null
                    ? `${recipientCount} Student${recipientCount === 1 ? '' : 's'}`
                    : '0 Students'}
                </span>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Quick Template Starters
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyTemplate('venue')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  📍 Venue Update
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('reminder')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  ⏰ Starting Reminder
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('instructions')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  📋 Guidelines & Preparation
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('announcement')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  📢 General College Announcement
                </button>
              </div>
            </div>

            {/* Subject */}
            <Input
              label="Notification Subject Line *"
              placeholder="e.g. Schedule Update or Important Guidelines for Event"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />

            {/* Message Body */}
            <Textarea
              label="Notification Message Body *"
              placeholder="Enter the full announcement text that students will see in their in-app notifications..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
            />

            {/* Live Preview Card */}
            {(subject || message) && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Live Preview: What Students Will See
                </div>
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                      {targetType === 'event_registrants' ? 'Event Update' : 'Campus Broadcast'}
                    </span>
                    <span className="text-[10px] text-slate-400">Just now</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{subject || 'No subject yet'}</div>
                  <div className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {message || 'No message content yet.'}
                  </div>
                  {selectedEvent && (
                    <div className="text-[11px] text-primary-600 font-semibold pt-1">
                      Event: {selectedEvent.title}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSubject('')
                  setMessage('')
                }}
                disabled={isSubmitting}
              >
                Clear Form
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
                className="px-6"
              >
                {targetType === 'event_registrants'
                  ? `Dispatch to ${recipientCount !== null ? recipientCount : ''} Registrants`
                  : `Broadcast to All Students (${totalStudents})`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sent History Table */}
      <Card className="border-slate-200 shadow-card">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Notification Delivery History</h3>
              <p className="text-xs text-slate-500">
                Log of real-time notifications dispatched across events and broadcasts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-48 sm:w-60"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchNotificationLogs}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {isLoadingHistory ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Subject & Content</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Associated Event</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 line-clamp-1">{item.subject}</div>
                        {item.body && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.body}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            item.type === 'campus_broadcast'
                              ? 'default'
                              : item.type === 'event_announcement'
                              ? 'info'
                              : 'warning'
                          }
                          className="capitalize text-[10px]"
                        >
                          {item.type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {item.event?.title || 'Campus-Wide'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {item.user?.full_name || item.user?.email || 'Student'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Sent
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No notification delivery logs found matching your query.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
