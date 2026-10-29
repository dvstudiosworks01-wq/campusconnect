import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  UserCheck,
  Calendar,
  Clock,
  Bell,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatDateTime, formatTime } from '@/lib/utils'
import { SendNotificationModal } from '@/components/organizer/SendNotificationModal'

export function EventRegistrationsPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [event, setEvent] = useState<any | null>(null)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('confirmed')
  const [isLoading, setIsLoading] = useState(true)
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const [notifyModalOpen, setNotifyModalOpen] = useState(false)

  const loadData = async () => {
    if (!id || !isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const [eventRes, regsRes, attRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase
          .from('registrations')
          .select(`
            *,
            student:profiles!registrations_student_id_fkey(*),
            team:teams(*)
          `)
          .eq('event_id', id)
          .order('registered_at', { ascending: true }),
        supabase.from('attendance').select('student_id').eq('event_id', id),
      ])

      if (eventRes.data) setEvent(eventRes.data)
      if (regsRes.data) setRegistrations(regsRes.data)

      if (attRes.data) {
        const map: Record<string, boolean> = {}
        attRes.data.forEach((att) => {
          map[att.student_id] = true
        })
        setAttendanceMap(map)
      }
    } catch (err) {
      console.error('Error loading registrations:', err)
      toast({ type: 'error', title: 'Failed to load roster' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleManualCheckIn = async (studentId: string, studentName: string) => {
    if (!id) return
    setCheckingInId(studentId)

    try {
      const { data, error } = await supabase.rpc('manual_record_attendance', {
        p_event_id: id,
        p_student_id: studentId,
      })

      if (error) throw error

      toast({
        type: 'success',
        title: 'Student Checked In',
        message: `${studentName} was marked present manually.`,
      })

      setAttendanceMap((prev) => ({ ...prev, [studentId]: true }))
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Check-in Error',
        message: err.message || 'Could not record manual attendance.',
      })
    } finally {
      setCheckingInId(null)
    }
  }

  // Export registrations CSV
  const exportCSV = () => {
    if (registrations.length === 0) return

    const headers = [
      'Registration ID',
      'Student Name',
      'Email',
      'Department',
      'Year of Study',
      'Status',
      'Attendance',
      'Registered At',
    ]
    const rows = registrations.map((r) => [
      r.id,
      r.student?.full_name || 'N/A',
      r.student?.email || 'N/A',
      r.student?.department || 'N/A',
      r.student?.year_of_study || 'N/A',
      r.status,
      attendanceMap[r.student_id] ? 'Present' : 'Absent',
      r.registered_at,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
        '\n'
      )

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Roster_${event?.title?.replace(/\s+/g, '_') || 'Event'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredRegistrations = registrations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.student?.full_name?.toLowerCase().includes(q) ||
      r.student?.email?.toLowerCase().includes(q) ||
      r.team?.team_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 text-left">
      <div>
        <Link
          to="/organizer/events"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Events Management
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Participant Roster</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {event?.title} • {formatDate(event?.start_at)} ({event?.venue})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNotifyModalOpen(true)}
              leftIcon={<Bell className="w-4 h-4 text-blue-600" />}
            >
              Notify Registrants
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
          >
            <option value="confirmed">Confirmed Only</option>
            <option value="cancelled">Cancelled Only</option>
            <option value="all">All Registrations</option>
          </select>
          <span className="text-slate-500 shrink-0">
            Total: <strong>{filteredRegistrations.length}</strong>
          </span>
        </div>
      </div>

      {/* Roster Table */}
      {isLoading ? (
        <Card className="border-slate-200 p-6 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </Card>
      ) : filteredRegistrations.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Department & Year</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-center">Attendance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRegistrations.map((r) => {
                  const isPresent = Boolean(attendanceMap[r.student_id])

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{r.student?.full_name}</div>
                        <div className="text-slate-400 text-[11px]">{r.student?.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{r.student?.department || 'General'}</div>
                        <div className="text-[11px] text-slate-400">
                          {r.student?.year_of_study ? `Year ${r.student.year_of_study}` : '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {formatDateTime(r.registered_at)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isPresent ? (
                          <Badge variant="success" className="gap-1 inline-flex items-center">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Present</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-400">
                            Absent
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isPresent && r.status === 'confirmed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            isLoading={checkingInId === r.student_id}
                            onClick={() =>
                              handleManualCheckIn(r.student_id, r.student?.full_name || 'Student')
                            }
                            leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                          >
                            Mark Present
                          </Button>
                        )}
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
          icon={<Users className="w-6 h-6" />}
          title="No participants found"
          description="No student registrations match your current query or filter."
        />
      )}
      {/* Send Notification Modal */}
      <SendNotificationModal
        isOpen={notifyModalOpen}
        onClose={() => setNotifyModalOpen(false)}
        preselectedEventId={id}
      />
    </div>
  )
}
