import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime } from '@/lib/utils'

export function MyRegistrationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [registrations, setRegistrations] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Cancel registration confirmation
  const [cancelModalItem, setCancelModalItem] = useState<any | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const fetchRegistrations = async () => {
    if (!user || !isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          *,
          event:events(
            id,
            title,
            description,
            venue,
            start_at,
            end_at,
            registration_deadline,
            status,
            category:event_categories(name)
          ),
          team:teams(id, team_name)
        `)
        .eq('student_id', user.id)
        .order('registered_at', { ascending: false })

      if (error) throw error
      setRegistrations(data || [])
    } catch (err) {
      console.error('Error fetching registrations:', err)
      toast({ type: 'error', title: 'Failed to load registrations' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRegistrations()
  }, [user])

  const handleCancelRegistration = async () => {
    if (!cancelModalItem) return
    setIsCancelling(true)

    try {
      const { error } = await supabase
        .from('registrations')
        .update({ status: 'cancelled' })
        .eq('id', cancelModalItem.id)

      if (error) throw error

      toast({
        type: 'success',
        title: 'Registration Cancelled',
        message: `Your registration for "${cancelModalItem.event?.title}" has been cancelled.`,
      })

      setCancelModalItem(null)
      await fetchRegistrations()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Cancellation failed',
        message: err.message || 'Could not cancel registration.',
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const filteredRegistrations = registrations.filter((r) => {
    if (filter === 'all') return true
    return r.status === filter
  })

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Event Registrations</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            View all confirmed and past event registrations with schedule details.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({registrations.length})
          </button>
          <button
            onClick={() => setFilter('confirmed')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              filter === 'confirmed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Confirmed ({registrations.filter((r) => r.status === 'confirmed').length})
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              filter === 'cancelled'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cancelled ({registrations.filter((r) => r.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : filteredRegistrations.length > 0 ? (
        <div className="space-y-4">
          {filteredRegistrations.map((reg) => {
            const isCompleted =
              reg.event?.status === 'completed' ||
              new Date(reg.event?.end_at).getTime() < Date.now()

            return (
              <Card key={reg.id} className="border-slate-200 shadow-subtle overflow-hidden">
                <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default" className="text-[11px]">
                        {reg.event?.category?.name || 'College Event'}
                      </Badge>
                      <Badge
                        variant={
                          reg.status === 'confirmed'
                            ? 'success'
                            : reg.status === 'cancelled'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="capitalize"
                      >
                        {reg.status}
                      </Badge>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">{reg.event?.title}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(reg.event?.start_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {formatTime(reg.event?.start_at)} - {formatTime(reg.event?.end_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{reg.event?.venue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <Link to={`/events/${reg.event?.id}`}>
                      <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                        View Event
                      </Button>
                    </Link>

                    {reg.status === 'confirmed' && !isCompleted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => setCancelModalItem(reg)}
                      >
                        Cancel Seat
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No registrations found"
          description="You do not have any registrations under this filter."
          action={
            <Link to="/events">
              <Button size="sm">Browse Events Directory</Button>
            </Link>
          }
        />
      )}

      {/* CANCEL REGISTRATION MODAL */}
      <Modal
        isOpen={Boolean(cancelModalItem)}
        onClose={() => setCancelModalItem(null)}
        title="Cancel Registration"
        description="Are you sure you want to cancel your seat for this event?"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Cancelling your registration for{' '}
            <strong className="text-slate-900">{cancelModalItem?.event?.title}</strong> will release your
            spot to other students. You can register again later if seats remain open.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCancelModalItem(null)}>
              Keep My Registration
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelRegistration}
              isLoading={isCancelling}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
