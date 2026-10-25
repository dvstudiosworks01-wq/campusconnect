import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Award,
  QrCode,
  Users,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime } from '@/lib/utils'

export function StudentDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    registeredCount: 0,
    attendedCount: 0,
    certificatesCount: 0,
    pointsCount: 0,
  })
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStudentOverview() {
      if (!user || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch confirmed registrations with event details
        const { data: registrations } = await supabase
          .from('registrations')
          .select(`
            *,
            event:events(
              id,
              title,
              venue,
              start_at,
              end_at,
              status,
              banner_url,
              category:event_categories(name)
            ),
            team:teams(team_name)
          `)
          .eq('student_id', user.id)
          .eq('status', 'confirmed')

        // Fetch attendance count
        const { count: attCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user.id)

        // Fetch certificates count
        const { count: certCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user.id)
          .is('revoked_at', null)

        // Fetch results points awarded
        const { data: results } = await supabase
          .from('results')
          .select('points_awarded')
          .eq('student_id', user.id)

        const totalPoints =
          (results?.reduce((acc, curr) => acc + (curr.points_awarded || 0), 0) || 0) +
          (attCount || 0) // 1 point per attended event

        setStats({
          registeredCount: registrations?.length || 0,
          attendedCount: attCount || 0,
          certificatesCount: certCount || 0,
          pointsCount: totalPoints,
        })

        if (registrations) {
          const now = new Date().getTime()
          const upcoming = registrations
            .filter((r) => r.event && new Date(r.event.end_at).getTime() >= now)
            .sort((a, b) => new Date(a.event.start_at).getTime() - new Date(b.event.start_at).getTime())
            .slice(0, 3)

          setUpcomingEvents(upcoming)
        }
      } catch (err) {
        console.error('Error loading student dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadStudentOverview()
  }, [user])

  return (
    <div className="space-y-8 text-left">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <Badge
            variant="default"
            className="bg-primary-500/20 text-primary-200 border-primary-500/30 text-[11px] uppercase font-semibold tracking-wider"
          >
            Student Portal
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Scholar'}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Track your registered events, join QR check-in sessions, and
            download verified credentials.
          </p>
          <div className="pt-3 flex flex-wrap gap-2.5">
            <Button
              size="sm"
              onClick={() => navigate('/student/attendance')}
              className="bg-white text-slate-900 hover:bg-slate-100 shadow font-semibold"
              leftIcon={<QrCode className="w-4 h-4 text-primary-600" />}
            >
              Scan Attendance QR
            </Button>
            <Link to="/events">
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent border-slate-700 text-white hover:bg-slate-800"
              >
                Browse New Events
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Registrations
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.registeredCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Attended</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.attendedCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Certificates
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {stats.certificatesCount}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Leaderboard Points
              </p>
              <h3 className="text-2xl font-bold text-primary-700 mt-1 flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-primary-500" />
                {stats.pointsCount}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Registered Events */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Your Upcoming Events</h3>
          <Link
            to="/student/registrations"
            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <span>View All Registrations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingEvents.map((item) => (
              <Card
                key={item.id}
                className="border-slate-200 hover:shadow-card transition-shadow flex flex-col justify-between"
              >
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="default" className="text-[11px]">
                      {item.event?.category?.name || 'Event'}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-slate-900 line-clamp-1">{item.event?.title}</h4>
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {formatDate(item.event?.start_at)} • {formatTime(item.event?.start_at)}
                      </span>
                    </div>
                    <div className="text-slate-600 font-medium truncate">
                      Venue: {item.event?.venue}
                    </div>
                  </div>
                </CardContent>
                <div className="p-4 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => navigate(`/events/${item.event?.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Calendar className="w-6 h-6" />}
            title="No upcoming registrations"
            description="You are not registered for any upcoming events. Browse open events on campus and secure your spot."
            action={
              <Link to="/events">
                <Button size="sm">Explore Events</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  )
}
