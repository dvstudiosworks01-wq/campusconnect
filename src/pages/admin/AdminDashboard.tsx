import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Calendar,
  CheckCircle2,
  Award,
  Clock,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    studentsCount: 0,
    organizersCount: 0,
    publishedEvents: 0,
    pendingEvents: 0,
    totalRegistrations: 0,
    totalAttendance: 0,
    totalCertificates: 0,
  })

  const [deptData, setDeptData] = useState<any[]>([])
  const [popularEvents, setPopularEvents] = useState<any[]>([])
  const [pendingQueue, setPendingQueue] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadAdminAnalytics() {
      if (!isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const [
          { count: userCount },
          { count: studentCount },
          { count: organizerCount },
          { count: pubEvCount },
          { count: pendEvCount },
          { count: regCount },
          { count: attCount },
          { count: certCount },
          { data: profiles },
          { data: pendingEvents },
          { data: topEvents },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'organizer'),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published'),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
          supabase.from('attendance').select('*', { count: 'exact', head: true }),
          supabase.from('certificates').select('*', { count: 'exact', head: true }).is('revoked_at', null),
          supabase.from('profiles').select('department'),
          supabase
            .from('events')
            .select(`
              id,
              title,
              start_at,
              venue,
              capacity,
              organizer:profiles!events_organizer_id_fkey(full_name)
            `)
            .eq('status', 'pending')
            .limit(3),
          supabase
            .from('events')
            .select('id, title, capacity')
            .eq('status', 'published')
            .limit(5),
        ])

        setStats({
          totalUsers: userCount || 0,
          studentsCount: studentCount || 0,
          organizersCount: organizerCount || 0,
          publishedEvents: pubEvCount || 0,
          pendingEvents: pendEvCount || 0,
          totalRegistrations: regCount || 0,
          totalAttendance: attCount || 0,
          totalCertificates: certCount || 0,
        })

        if (pendingEvents) setPendingQueue(pendingEvents)

        // Department breakdown
        if (profiles) {
          const counts: Record<string, number> = {}
          profiles.forEach((p) => {
            const dept = p.department || 'Other'
            counts[dept] = (counts[dept] || 0) + 1
          })
          const chartData = Object.entries(counts).map(([name, count]) => ({
            name: name.replace('Engineering', 'Eng.').replace('Department of ', ''),
            students: count,
          }))
          setDeptData(chartData.slice(0, 6))
        }

        // Popular events with registration count
        if (topEvents) {
          const eventsWithCounts = await Promise.all(
            topEvents.map(async (ev) => {
              const { count } = await supabase
                .from('registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', ev.id)
                .eq('status', 'confirmed')
              return {
                title: ev.title.length > 20 ? ev.title.slice(0, 20) + '...' : ev.title,
                registrations: count || 0,
                capacity: ev.capacity,
              }
            })
          )
          setPopularEvents(eventsWithCounts)
        }
      } catch (err) {
        console.error('Error loading admin analytics:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadAdminAnalytics()
  }, [])

  const COLORS = ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#e2e8f0']

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge variant="destructive" className="mb-2 uppercase text-[10px] font-bold">
            Administrative HQ
          </Badge>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Campus Analytics & Oversight
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time telemetry across college enrollment, event approval queues, and certificate
            integrity.
          </p>
        </div>

        {stats.pendingEvents > 0 && (
          <Link to="/admin/approvals">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow"
              leftIcon={<Clock className="w-4 h-4" />}
            >
              Review {stats.pendingEvents} Pending Events
            </Button>
          </Link>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Scholars
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{stats.totalUsers}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {stats.studentsCount} Students • {stats.organizersCount} Organizers
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Published Events
              </p>
              <h3 className="text-2xl font-extrabold text-primary-700 mt-1">
                {stats.publishedEvents}
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                {stats.pendingEvents} awaiting approval
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Registrations
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.totalRegistrations}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {stats.totalAttendance} Checked In (
                {stats.totalRegistrations > 0
                  ? Math.round((stats.totalAttendance / stats.totalRegistrations) * 100)
                  : 0}
                %)
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-subtle">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Certificates Issued
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.totalCertificates}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Cryptographically Sealed</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department participation chart */}
        <Card className="border-slate-200 shadow-subtle">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900">
              User Enrollment by Academic Department
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              Demographics
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 h-72">
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <Bar dataKey="students" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Awaiting student enrollment data...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Popular events capacity filling */}
        <Card className="border-slate-200 shadow-subtle">
          <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900">
              Popular Events & Capacity Utilization
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              Turnout
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 h-72">
            {popularEvents.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={popularEvents}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis
                    dataKey="title"
                    type="category"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '12px',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <Bar dataKey="registrations" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Awaiting published event registrations...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Events Quick Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Pending Event Review Queue</h3>
          <Link
            to="/admin/approvals"
            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <span>Open Full Approval Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pendingQueue.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pendingQueue.map((item) => (
              <Card key={item.id} className="border-slate-200 p-5 space-y-3">
                <Badge variant="warning" className="text-[10px]">
                  Pending Review
                </Badge>
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.title}</h4>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Venue: {item.venue}</div>
                  <div>Organizer: {item.organizer?.full_name}</div>
                </div>
                <Link to="/admin/approvals">
                  <Button size="sm" variant="outline" className="w-full text-xs mt-2">
                    Review Details
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
            No events pending approval at this time. All submissions processed!
          </div>
        )}
      </div>
    </div>
  )
}
