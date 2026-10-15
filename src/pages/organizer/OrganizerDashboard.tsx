import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Users,
  QrCode,
  Award,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime } from '@/lib/utils'

export function OrganizerDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    myEventsCount: 0,
    pendingApprovalCount: 0,
    totalRegistrations: 0,
    totalAttended: 0,
  })
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadOrganizerData() {
      if (!user || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch organizer's events
        const { data: events, error } = await supabase
          .from('events')
          .select(`
            *,
            category:event_categories(name)
          `)
          .eq('organizer_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        const myEvents = events || []
        const eventIds = myEvents.map((e) => e.id)

        let regCount = 0
        let attCount = 0

        if (eventIds.length > 0) {
          const [{ count: rCount }, { count: aCount }] = await Promise.all([
            supabase
              .from('registrations')
              .select('*', { count: 'exact', head: true })
              .in('event_id', eventIds)
              .eq('status', 'confirmed'),
            supabase
              .from('attendance')
              .select('*', { count: 'exact', head: true })
              .in('event_id', eventIds),
          ])

          regCount = rCount || 0
          attCount = aCount || 0
        }

        setStats({
          myEventsCount: myEvents.length,
          pendingApprovalCount: myEvents.filter((e) => e.status === 'pending').length,
          totalRegistrations: regCount,
          totalAttended: attCount,
        })

        setRecentEvents(myEvents.slice(0, 4))
      } catch (err) {
        console.error('Error loading organizer overview:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrganizerData()
  }, [user])

  return (
    <div className="space-y-8 text-left">
      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge variant="warning" className="mb-2">
            Organizer Command
          </Badge>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Event Management Workspace
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Coordinate collegiate events, initiate live QR check-ins, record results, and issue
            certificates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link to="/organizer/events/new">
            <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Create New Event
            </Button>
          </Link>
          <Link to="/organizer/attendance">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<QrCode className="w-4 h-4 text-primary-600" />}
            >
              Launch QR Session
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                My Events
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.myEventsCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Pending Approval
              </p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">
                {stats.pendingApprovalCount}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Registrations
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {stats.totalRegistrations}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Verified Check-ins
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.totalAttended}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events Table / Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Your Coordinated Events</h3>
          <Link
            to="/organizer/events"
            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <span>View All My Events</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : recentEvents.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Event Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Schedule</th>
                    <th className="py-3 px-4">Format</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentEvents.map((ev) => {
                    const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
                      draft: 'secondary',
                      pending: 'warning',
                      published: 'success',
                      rejected: 'destructive',
                      cancelled: 'destructive',
                      completed: 'secondary',
                    }

                    return (
                      <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{ev.title}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {ev.category?.name || 'General'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {formatDate(ev.start_at)} ({formatTime(ev.start_at)})
                        </td>
                        <td className="py-3.5 px-4 capitalize text-slate-600">
                          {ev.registration_type}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            variant={statusVariants[ev.status] || 'secondary'}
                            className="capitalize text-[10px]"
                          >
                            {ev.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <Link to={`/organizer/attendance?eventId=${ev.id}`}>
                            <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                              QR Hub
                            </Button>
                          </Link>
                          <Link to={`/organizer/events/${ev.id}/registrations`}>
                            <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                              Roster
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Calendar className="w-6 h-6" />}
            title="No events created yet"
            description="Create your first college event, workshop, or competition to begin accepting registrations."
            action={
              <Link to="/organizer/events/new">
                <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                  Create Event
                </Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  )
}
