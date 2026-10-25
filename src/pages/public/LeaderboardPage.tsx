import { useEffect, useState } from 'react'
import {
  Trophy,
  Medal,
  Award,
  Users,
  Search,
  Sparkles,
  Info,
  Calendar,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { LeaderboardEntry, LeaderboardRule } from '@/types/database.types'

export function LeaderboardPage() {
  const [individualData, setIndividualData] = useState<LeaderboardEntry[]>([])
  const [rules, setRules] = useState<LeaderboardRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch active point rules
        const { data: rulesData } = await supabase
          .from('leaderboard_point_rules')
          .select('*')
          .eq('is_active', true)
          .order('rank', { ascending: true })

        if (rulesData) setRules(rulesData as LeaderboardRule[])

        // Fetch results with profiles and events
        const { data: resultsData } = await supabase
          .from('results')
          .select(`
            *,
            student:profiles!results_student_id_fkey(*),
            team:teams(*),
            event:events(title, category_id)
          `)

        // Fetch all verified attendances to award participation points
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('student_id, event_id')

        const participationPoints = rulesData?.find((r) => r.rank === 0)?.points || 1

        // Aggregate individual student points
        const studentMap: Record<string, any> = {}

        // Add attendance participation points
        if (attendanceData) {
          attendanceData.forEach((att) => {
            if (!studentMap[att.student_id]) {
              studentMap[att.student_id] = {
                student_id: att.student_id,
                total_points: 0,
                events_participated: 0,
                wins_count: 0,
                runner_up_count: 0,
              }
            }
            studentMap[att.student_id].events_participated += 1
            studentMap[att.student_id].total_points += participationPoints
          })
        }

        // Add competition result points
        if (resultsData) {
          resultsData.forEach((res) => {
            if (res.student_id) {
              if (!studentMap[res.student_id]) {
                studentMap[res.student_id] = {
                  student_id: res.student_id,
                  student: res.student,
                  total_points: 0,
                  events_participated: 0,
                  wins_count: 0,
                  runner_up_count: 0,
                }
              }
              studentMap[res.student_id].total_points += res.points_awarded || 0
              if (res.rank === 1) studentMap[res.student_id].wins_count += 1
              if (res.rank === 2) studentMap[res.student_id].runner_up_count += 1
              if (res.student) studentMap[res.student_id].student = res.student
            }
          })
        }

        // Fetch missing profile data for students with attendance
        const studentIds = Object.keys(studentMap)
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', studentIds)

          if (profiles) {
            profiles.forEach((p) => {
              if (studentMap[p.id]) {
                studentMap[p.id].student = p
              }
            })
          }
        }

        // Convert to sorted array
        const sortedIndividual: LeaderboardEntry[] = Object.values(studentMap)
          .filter((s: any) => s.student)
          .sort((a: any, b: any) => b.total_points - a.total_points)
          .map((item: any, idx: number) => ({
            ...item,
            rank: idx + 1,
          }))

        setIndividualData(sortedIndividual)
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  const filteredIndividual = individualData.filter((entry) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      entry.student?.full_name?.toLowerCase().includes(q) ||
      entry.student?.department?.toLowerCase().includes(q)
    )
  })

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-extrabold text-xs shadow-md">
          🥇 1
        </span>
      )
    }
    if (rank === 2) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-extrabold text-xs shadow-md">
          🥈 2
        </span>
      )
    }
    if (rank === 3) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white font-extrabold text-xs shadow-md">
          🥉 3
        </span>
      )
    }
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
        {rank}
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Badge variant="default" className="mb-2">
            Campus Rankings
          </Badge>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Collegiate Leaderboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Celebrating student and departmental achievements based on validated event attendance and
            competition victory points.
          </p>
        </div>

        {/* Scoring policy pills */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-600 shadow-subtle">
          <Info className="w-4 h-4 text-primary-600 shrink-0" />
          <span className="font-semibold text-slate-800">Scoring Rules:</span>
          <span>1st: 10 pts</span>
          <span>•</span>
          <span>2nd: 7 pts</span>
          <span>•</span>
          <span>3rd: 5 pts</span>
          <span>•</span>
          <span>Attendance: 1 pt</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-slate-800">Individual Scholar Standings</h2>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by student name or dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      {isLoading ? (
        <Card className="border-slate-200 p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </Card>
      ) : filteredIndividual.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                    <th className="py-3.5 px-4">Student Scholar</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4 text-center">Events Attended</th>
                    <th className="py-3.5 px-4 text-center">Podiums (1st / 2nd)</th>
                    <th className="py-3.5 px-4 text-right">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIndividual.map((row) => (
                    <tr
                      key={row.student_id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-4 px-4 text-center">{getRankBadge(row.rank)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {row.student?.avatar_url ? (
                              <img
                                src={row.student.avatar_url}
                                alt={row.student.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{row.student?.full_name?.charAt(0) || 'S'}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                              {row.student?.full_name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {row.student?.year_of_study
                                ? `Year ${row.student.year_of_study}`
                                : 'Student'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-600 text-xs font-medium">
                        {row.student?.department || 'General'}
                      </td>
                      <td className="py-4 px-4 text-center text-xs font-semibold text-slate-700">
                        {row.events_participated}
                      </td>
                      <td className="py-4 px-4 text-center text-xs text-slate-600">
                        {row.wins_count > 0 && (
                          <span className="font-bold text-amber-600">{row.wins_count}W </span>
                        )}
                        {row.runner_up_count > 0 && (
                          <span className="font-semibold text-slate-500">
                            {row.runner_up_count}R
                          </span>
                        )}
                        {row.wins_count === 0 && row.runner_up_count === 0 && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-extrabold text-base text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg">
                          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                          {row.total_points} pts
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Trophy className="w-6 h-6" />}
            title="Leaderboard is initializing"
            description="As competitions conclude and participants check in via QR, official rankings and points will appear here."
          />
        )}
    </div>
  )
}
