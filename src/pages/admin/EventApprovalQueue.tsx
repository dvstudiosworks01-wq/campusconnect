import { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime, formatDateTime } from '@/lib/utils'

export function EventApprovalQueue() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [pendingEvents, setPendingEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Reject modal state
  const [rejectModalEvent, setRejectModalEvent] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchPendingEvents = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          category:event_categories(name),
          organizer:profiles!events_organizer_id_fkey(id, full_name, email, department)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw error
      setPendingEvents(data || [])
    } catch (err) {
      console.error('Error loading approval queue:', err)
      toast({ type: 'error', title: 'Failed to load approval queue' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingEvents()
  }, [])

  const handleApprove = async (eventId: string, title: string, organizerId: string) => {
    setProcessingId(eventId)
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', eventId)

      if (error) throw error

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: user?.id,
        action: 'APPROVE_EVENT',
        entity_type: 'event',
        entity_id: eventId,
        details: { title, status: 'published' },
      })

      // Send notification to organizer
      await supabase.from('notifications').insert({
        user_id: organizerId,
        event_id: eventId,
        type: 'event_approval',
        subject: `Your event "${title}" has been approved!`,
        body: `Congratulations, the college administration has published "${title}". Students can now view and register for this event.`,
        status: 'pending',
      })

      toast({
        type: 'success',
        title: 'Event Approved and Published!',
        message: `"${title}" is now publicly visible on the portal.`,
      })

      await fetchPendingEvents()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Approval Failed',
        message: err.message || 'Could not approve event.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectModalEvent) return

    setProcessingId(rejectModalEvent.id)
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', rejectModalEvent.id)

      if (error) throw error

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: user?.id,
        action: 'REJECT_EVENT',
        entity_type: 'event',
        entity_id: rejectModalEvent.id,
        details: { title: rejectModalEvent.title, reason: rejectReason },
      })

      // Send notification to organizer
      await supabase.from('notifications').insert({
        user_id: rejectModalEvent.organizer_id,
        event_id: rejectModalEvent.id,
        type: 'event_rejection',
        subject: `Administrative feedback on "${rejectModalEvent.title}"`,
        body: `Your event was returned with the following note: ${rejectReason || 'Scheduling or capacity conflict.'}`,
        status: 'pending',
      })

      toast({
        type: 'info',
        title: 'Event Rejected',
        message: `Returned to organizer with review feedback.`,
      })

      setRejectModalEvent(null)
      setRejectReason('')
      await fetchPendingEvents()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Rejection Failed',
        message: err.message || 'Could not reject event.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Event Approval Review Queue
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Review, approve, or reject event applications submitted by campus organizers and student bodies.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : pendingEvents.length > 0 ? (
        <div className="space-y-4">
          {pendingEvents.map((ev) => (
            <Card key={ev.id} className="border-slate-200 shadow-subtle overflow-hidden">
              <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default" className="text-[11px]">
                      {ev.category?.name || 'General'}
                    </Badge>
                    <Badge variant="warning" className="text-[11px]">
                      Pending Review
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      Capacity: {ev.capacity} Seats
                    </Badge>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900">{ev.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {ev.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {formatDate(ev.start_at)} ({formatTime(ev.start_at)}
                        {ev.end_at ? ` - ${formatTime(ev.end_at)}` : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Venue: {ev.venue}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deadline: {formatDateTime(ev.registration_deadline)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Organizer: {ev.organizer?.full_name} ({ev.organizer?.email})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-row lg:flex-col gap-2.5 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    isLoading={processingId === ev.id}
                    onClick={() => handleApprove(ev.id, ev.title, ev.organizer_id)}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Approve & Publish
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 border-rose-200"
                    onClick={() => {
                      setRejectModalEvent(ev)
                      setRejectReason('')
                    }}
                    leftIcon={<XCircle className="w-4 h-4" />}
                  >
                    Reject with Feedback
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
          title="Queue is completely clear"
          description="All event proposals submitted by organizers have been reviewed and published."
        />
      )}

      {/* REJECT MODAL */}
      <Modal
        isOpen={Boolean(rejectModalEvent)}
        onClose={() => setRejectModalEvent(null)}
        title="Reject Event Proposal"
        description={`Provide review feedback for "${rejectModalEvent?.title}". This note will be sent to the organizer.`}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <Textarea
            label="Reason for Rejection / Suggested Changes"
            placeholder="e.g. Schedule clashes with College Convocation; please reschedule start date to after 2:00 PM."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            required
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRejectModalEvent(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" isLoading={processingId === rejectModalEvent?.id}>
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
