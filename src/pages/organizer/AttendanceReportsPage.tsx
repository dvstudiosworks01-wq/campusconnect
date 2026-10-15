import { useEffect, useState } from 'react'
import {
  History,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Filter,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatDateTime } from '@/lib/utils'

export function AttendanceReportsPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [reportData, setReportData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetchOrganizerEvents() {
      if (!user || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const { data } = await supabase
          .from('events')
          .select('id, title, venue, start_at')
          .eq('organizer_id', user.id)
          .order('start_at', { ascending: false })

        if (data && data.length > 0) {
          setEvents(data)
          setSelectedEventId(data[0].id)
        }
      } catch (err) {
        console.error('Error loading events for report:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrganizerEvents()
  }, [user])

  useEffect(() => {
    if (!selectedEventId || !isSupabaseConfigured) return

    async function loadEventAttendanceReport() {
      setIsLoading(true)
      try {
        const [regsRes, attRes] = await Promise.all([
          supabase
            .from('registrations')
            .select(`
              *,
              student:profiles!registrations_student_id_fkey(id, full_name, email, department, year_of_study),
              team:teams(team_name)
            `)
            .eq('event_id', selectedEventId)
            .eq('status', 'confirmed'),
          supabase
            .from('attendance')
            .select('*')
            .eq('event_id', selectedEventId),
        ])

        const attMap: Record<string, any> = {}
        attRes.data?.forEach((a) => {
          attMap[a.student_id] = a
        })

        const combined =
          regsRes.data?.map((r) => {
            const attRecord = attMap[r.student_id]
            return {
              registration_id: r.id,
              student: r.student,
              team: r.team,
              isPresent: Boolean(attRecord),
              method: attRecord?.method || null,
              checked_in_at: attRecord?.checked_in_at || null,
            }
          }) || []

        setReportData(combined)
      } catch (err) {
        console.error('Error compiling attendance report:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadEventAttendanceReport()
  }, [selectedEventId])

  const presentCount = reportData.filter((r) => r.isPresent).length
  const totalCount = reportData.length
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

  const filteredData = reportData.filter((r) => {
    if (filter === 'present' && !r.isPresent) return false
    if (filter === 'absent' && r.isPresent) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.student?.full_name?.toLowerCase().includes(q) ||
      r.student?.email?.toLowerCase().includes(q) ||
      r.student?.department?.toLowerCase().includes(q)
    )
  })

  const exportReportCSV = () => {
    if (reportData.length === 0) return
    const ev = events.find((e) => e.id === selectedEventId)
    const headers = ['Student Name', 'Email', 'Department', 'Year', 'Team', 'Attendance', 'Check-In Method', 'Timestamp']
    const rows = reportData.map((r) => [
      r.student?.full_name || 'N/A',
      r.student?.email || 'N/A',
      r.student?.department || 'N/A',
      r.student?.year_of_study || 'N/A',
      r.team?.team_name || 'Individual',
      r.isPresent ? 'Present' : 'Absent',
      r.method || 'N/A',
      r.checked_in_at || 'N/A',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Attendance_Report_${ev?.title?.replace(/\s+/g, '_') || 'Event'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Audit Reports</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Comprehensive attendance turnout metrics, student verification stamps, and CSV records.
          </p>
        </div>

        {events.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({formatDate(ev.start_at)})
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={exportReportCSV}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export CSV
            </Button>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-subtle p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Confirmed
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
        </Card>

        <Card className="border-slate-200 shadow-subtle p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Present Attendees
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{presentCount}</div>
        </Card>

        <Card className="border-slate-200 shadow-subtle p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary-700">
            Turnout Rate
          </div>
          <div className="text-2xl font-bold text-primary-700 mt-1">{attendanceRate}%</div>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({reportData.length})
          </button>
          <button
            onClick={() => setFilter('present')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
              filter === 'present' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Present ({presentCount})
          </button>
          <button
            onClick={() => setFilter('absent')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
              filter === 'absent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Absent ({totalCount - presentCount})
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card className="border-slate-200 p-6 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </Card>
      ) : filteredData.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Checked In At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{row.student?.full_name}</div>
                      <div className="text-[11px] text-slate-400">{row.student?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{row.student?.department || '—'}</td>
                    <td className="py-3.5 px-4">
                      {row.team ? (
                        <Badge variant="warning" className="text-[10px]">
                          {row.team.team_name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">Individual</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {row.isPresent ? (
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
                    <td className="py-3.5 px-4 capitalize font-mono text-[11px] text-slate-600">
                      {row.method || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500 font-medium">
                      {row.checked_in_at ? formatDateTime(row.checked_in_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<History className="w-6 h-6" />}
          title="No records found"
          description="No students match the current filter."
        />
      )}
    </div>
  )
}
