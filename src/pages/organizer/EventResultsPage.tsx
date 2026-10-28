import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Trophy, Award, Medal, Check, Plus, Trash2, Users, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function EventResultsPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { toast } = useToast()

  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(
    searchParams.get('eventId') || ''
  )
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Result entry form state
  const [rank, setRank] = useState<number>(1)
  const [targetType, setTargetType] = useState<'student' | 'team'>('student')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [score, setScore] = useState<string>('95')

  useEffect(() => {
    async function loadOrganizerEvents() {
      if (!user || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const { data: evs } = await supabase
          .from('events')
          .select('*')
          .eq('organizer_id', user.id)
          .in('status', ['published', 'completed'])
          .order('start_at', { ascending: false })

        if (evs && evs.length > 0) {
          setEvents(evs)
          const paramId = searchParams.get('eventId')
          if (paramId && evs.some((e) => e.id === paramId)) {
            setSelectedEventId(paramId)
          } else if (!selectedEventId) {
            setSelectedEventId(evs[0].id)
          }
        }

        // Fetch point rules
        const { data: rulesData } = await supabase
          .from('leaderboard_point_rules')
          .select('*')
          .eq('is_active', true)
          .order('rank', { ascending: true })

        if (rulesData) setRules(rulesData)
      } catch (err) {
        console.error('Error loading events:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrganizerEvents()
  }, [user, searchParams])

  useEffect(() => {
    if (!selectedEventId || !isSupabaseConfigured) return
    const ev = events.find((e) => e.id === selectedEventId)
    setSelectedEvent(ev || null)
    setTargetType(ev?.registration_type === 'team' ? 'team' : 'student')

    loadEventResultsAndRoster(selectedEventId)
  }, [selectedEventId, events])

  const loadEventResultsAndRoster = async (eventId: string) => {
    try {
      const [resultsRes, regsRes, teamsRes] = await Promise.all([
        supabase
          .from('results')
          .select(`
            *,
            student:profiles!results_student_id_fkey(full_name, email, department),
            team:teams(team_name)
          `)
          .eq('event_id', eventId)
          .order('rank', { ascending: true }),
        supabase
          .from('registrations')
          .select('student_id, student:profiles(id, full_name, email)')
          .eq('event_id', eventId)
          .eq('status', 'confirmed'),
        supabase
          .from('teams')
          .select('id, team_name')
          .eq('event_id', eventId),
      ])

      setResults(resultsRes.data || [])
      setParticipants(regsRes.data?.map((r) => r.student).filter(Boolean) || [])
      setTeams(teamsRes.data || [])
    } catch (err) {
      console.error('Error loading results & roster:', err)
    }
  }

  const handlePublishResult = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEventId) return

    // Calculate default points from rule
    const matchingRule = rules.find((r) => r.rank === rank)
    const pointsAwarded = matchingRule ? matchingRule.points : (rank === 1 ? 10 : rank === 2 ? 7 : rank === 3 ? 5 : 0)

    if (!selectedStudentId) {
      toast({ type: 'warning', title: 'Please select a student' })
      return
    }

    setIsSubmitting(true)
    try {
      const payload: any = {
        event_id: selectedEventId,
        rank,
        score: score ? parseFloat(score) : null,
        points_awarded: pointsAwarded,
        student_id: selectedStudentId,
        team_id: null,
      }

      // Check if rank already exists
      const existing = results.find((r) => r.rank === rank)
      if (existing) {
        const { error } = await supabase.from('results').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('results').insert(payload)
        if (error) throw error
      }

      toast({
        type: 'success',
        title: 'Result Recorded!',
        message: `Rank ${rank} awarded with ${pointsAwarded} points.`,
      })

      await loadEventResultsAndRoster(selectedEventId)
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Failed to Record Result',
        message: err.message || 'Error occurred recording result.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteResult = async (resultId: string) => {
    try {
      const { error } = await supabase.from('results').delete().eq('id', resultId)
      if (error) throw error
      toast({ type: 'info', title: 'Result removed' })
      await loadEventResultsAndRoster(selectedEventId)
    } catch (err: any) {
      toast({ type: 'error', title: 'Delete Failed', message: err.message })
    }
  }

  const markEventCompleted = async () => {
    if (!selectedEventId) return
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'completed' })
        .eq('id', selectedEventId)

      if (error) throw error
      toast({ type: 'success', title: 'Event Marked as Completed!' })
      setSelectedEvent((prev: any) => ({ ...prev, status: 'completed' }))
    } catch (err: any) {
      toast({ type: 'error', title: 'Status update failed', message: err.message })
    }
  }

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Publish Competition Results
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Award podium ranks, scores, and official position certificates.
          </p>
        </div>

        {events.length > 0 && (
          <div className="flex items-center gap-3">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.status})
                </option>
              ))}
            </select>

            {selectedEvent?.status !== 'completed' && (
              <Button size="sm" variant="outline" onClick={markEventCompleted}>
                Mark Event Completed
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Result Entry Form */}
        <Card className="border-slate-200 shadow-card">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>Record Podium Winner</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handlePublishResult} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-sm font-medium text-slate-700">Podium Rank</label>
                <select
                  value={rank}
                  onChange={(e) => setRank(parseInt(e.target.value, 10))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                >
                  <option value={1}>🥇 1st Place (Winner — 10 Points)</option>
                  <option value={2}>🥈 2nd Place (Runner-up — 7 Points)</option>
                  <option value={3}>🥉 3rd Place (2nd Runner-up — 5 Points)</option>
                  <option value={4}>4th Place</option>
                  <option value={5}>5th Place</option>
                </select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-sm font-medium text-slate-700">Winning Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  required
                >
                  <option value="">Select registered student...</option>
                  {participants.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Score / Marks (Optional)"
                type="number"
                step="0.1"
                placeholder="e.g. 96.5"
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />

              <div className="pt-2">
                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Save & Publish Result
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Current Results List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200 shadow-subtle">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold">
                Official Results for {selectedEvent?.title}
              </CardTitle>
              <Badge variant="default">{results.length} Placed</Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((res) => {
                    const winnerLabel = res.student?.full_name || 'Participant'
                    const detail = res.student?.department || ''

                    return (
                      <div
                        key={res.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-subtle"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-extrabold text-sm">
                            {res.rank === 1 ? '🥇' : res.rank === 2 ? '🥈' : res.rank === 3 ? '🥉' : res.rank}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{winnerLabel}</div>
                            <div className="text-xs text-slate-500">
                              Rank {res.rank} • Score: {res.score || 'N/A'} • {detail}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary-700 text-sm bg-primary-50 px-2.5 py-1 rounded-lg">
                            +{res.points_awarded} pts
                          </span>
                          <button
                            onClick={() => handleDeleteResult(res.id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<Trophy className="w-6 h-6" />}
                  title="No results published yet"
                  description="Use the form on the left to enter scores and award 1st, 2nd, and 3rd place podium spots."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
