import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar,
  PlusCircle,
  QrCode,
  Users,
  Trophy,
  Edit,
  Send,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime } from '@/lib/utils'

export function OrganizerEventsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [events, setEvents] = useState<any[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const fetchOrganizerEvents = async () => {
    if (!user || !isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          category:event_categories(name)
        `)
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      console.error('Error fetching organizer events:', err)
      toast({ type: 'error', title: 'Failed to load events' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizerEvents()
  }, [user])

  const submitForApproval = async (eventId: string, title: string) => {
    setSubmittingId(eventId)
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'pending' })
        .eq('id', eventId)

      if (error) throw error

      toast({
        type: 'success',
        title: 'Submitted for Approval',
        message: `"${title}" was submitted to the Dean's Office for administrative review.`,
      })

      await fetchOrganizerEvents()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Could not submit event for approval.',
      })
    } finally {
      setSubmittingId(null)
    }
  }

  const filteredEvents = events.filter((ev) => {
    if (filter === 'all') return true
    return ev.status === filter
  })

  const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
    draft: 'secondary',
    pending: 'warning',
    published: 'success',
    rejected: 'destructive',
    cancelled: 'destructive',
    completed: 'secondary',
  }

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Managed Events</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Full event lifecycle: design drafts, request admin publication, run QR sessions, and award
            rankings.
          </p>
        </div>

        <Link to="/organizer/events/new">
          <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
            Create New Event
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs w-fit">
        {['all', 'draft', 'pending', 'published', 'completed', 'rejected'].map((statusKey) => (
          <button
            key={statusKey}
            onClick={() => setFilter(statusKey)}
            className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-colors cursor-pointer ${
              filter === statusKey
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {statusKey} ({statusKey === 'all' ? events.length : events.filter((e) => e.status === statusKey).length})
          </button>
        ))}
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="space-y-4">
          {filteredEvents.map((ev) => (
            <Card key={ev.id} className="border-slate-200 shadow-subtle overflow-hidden">
              <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default" className="text-[11px]">
                      {ev.category?.name || 'General'}
                    </Badge>
                    <Badge
                      variant={statusVariants[ev.status] || 'secondary'}
                      className="capitalize text-[11px]"
                    >
                      {ev.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize text-[11px]">
                      {ev.registration_type} Mode (Max {ev.capacity} seats)
                    </Badge>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900">{ev.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {ev.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(ev.start_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {formatTime(ev.start_at)} - {formatTime(ev.end_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ev.venue}</span>
                    </div>
                  </div>
                </div>

                {/* Organizer Control Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {/* Approval Action */}
                  {(ev.status === 'draft' || ev.status === 'rejected') && (
                    <Button
                      size="sm"
                      onClick={() => submitForApproval(ev.id, ev.title)}
                      isLoading={submittingId === ev.id}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      Submit for Approval
                    </Button>
                  )}

                  {/* QR Session Button */}
                  {ev.status === 'published' && (
                    <Link to={`/organizer/attendance?eventId=${ev.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<QrCode className="w-3.5 h-3.5 text-primary-600" />}
                      >
                        Live QR
                      </Button>
                    </Link>
                  )}

                  {/* Roster Button */}
                  <Link to={`/organizer/events/${ev.id}/registrations`}>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Users className="w-3.5 h-3.5 text-slate-600" />}
                    >
                      Registrations
                    </Button>
                  </Link>

                  {/* Results Button */}
                  <Link to={`/organizer/results?eventId=${ev.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Trophy className="w-3.5 h-3.5 text-amber-600" />}
                    >
                      Results
                    </Button>
                  </Link>

                  {/* Edit Button */}
                  <Link to={`/organizer/events/${ev.id}/edit`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Edit className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No events in this category"
          description="You do not have any events matching the selected status filter."
        />
      )}
    </div>
  )
}
