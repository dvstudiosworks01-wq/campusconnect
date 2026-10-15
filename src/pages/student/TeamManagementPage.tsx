import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Copy,
  Check,
  Crown,
  UserPlus,
  Calendar,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function TeamManagementPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [teams, setTeams] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Join Team with code modal
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [teamEvents, setTeamEvents] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadTeams = async () => {
    if (!user || !isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      // Find all team registrations for this student
      const { data: userRegs } = await supabase
        .from('registrations')
        .select('team_id')
        .eq('student_id', user.id)
        .eq('status', 'confirmed')
        .not('team_id', 'is', null)

      const teamIds = Array.from(new Set(userRegs?.map((r) => r.team_id).filter(Boolean) || []))

      if (teamIds.length === 0) {
        setTeams([])
        setIsLoading(false)
        return
      }

      // Fetch team objects with events and leader
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select(`
          *,
          event:events(id, title, start_at, end_at, team_min_size, team_max_size),
          leader:profiles!teams_leader_id_fkey(full_name, email, department)
        `)
        .in('id', teamIds)

      if (error) throw error

      // Fetch all member registrations for these teams
      const { data: memberRegs } = await supabase
        .from('registrations')
        .select(`
          team_id,
          student:profiles(id, full_name, email, department, avatar_url)
        `)
        .in('team_id', teamIds)
        .eq('status', 'confirmed')

      const populated = teamsData?.map((t) => {
        const members = memberRegs
          ?.filter((mr) => mr.team_id === t.id)
          .map((mr) => mr.student)
          .filter(Boolean)
        return {
          ...t,
          members: members || [],
        }
      })

      setTeams(populated || [])
    } catch (err) {
      console.error('Error loading teams:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTeams()

    // Also fetch published team events for the join team dropdown
    async function fetchTeamEvents() {
      if (!isSupabaseConfigured) return
      const { data } = await supabase
        .from('events')
        .select('id, title')
        .eq('status', 'published')
        .eq('registration_type', 'team')
        .gt('registration_deadline', new Date().toISOString())
      if (data) setTeamEvents(data)
    }
    fetchTeamEvents()
  }, [user])

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEventId || !inviteCode.trim()) return

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('join_team_with_code', {
        p_event_id: selectedEventId,
        p_invite_code: inviteCode.trim().toUpperCase(),
      })

      if (error) throw error

      toast({
        type: 'success',
        title: 'Joined Team!',
        message: `Successfully joined ${data?.team_name}.`,
      })

      setIsJoinOpen(false)
      setInviteCode('')
      await loadTeams()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Join Failed',
        message: err.message || 'Invalid invite code or team is full.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Team Hub</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your project hackathon teams, roster rosters, and invite codes.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsJoinOpen(true)}
          leftIcon={<UserPlus className="w-4 h-4" />}
        >
          Join Team with Code
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team) => {
            const isLeader = team.leader_id === user?.id
            const maxMembers = team.event?.team_max_size || 4

            return (
              <Card key={team.id} className="border-slate-200 shadow-subtle flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold">{team.team_name}</CardTitle>
                        {isLeader && (
                          <Badge variant="warning" className="text-[10px] gap-1 py-0.5">
                            <Crown className="w-3 h-3 text-amber-600" />
                            <span>Team Leader</span>
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium">{team.event?.title}</p>
                    </div>

                    <Badge variant="outline" className="text-xs font-semibold">
                      {team.members?.length || 1} / {maxMembers} Members
                    </Badge>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {/* Leader details */}
                    <div className="text-xs text-slate-600 space-y-1">
                      <span className="font-semibold text-slate-800">Team Leader:</span>{' '}
                      {team.leader?.full_name} ({team.leader?.department || 'Department'})
                    </div>

                    {/* Member Roster */}
                    <div>
                      <div className="text-xs font-semibold text-slate-800 mb-2">Member Roster:</div>
                      <div className="space-y-2">
                        {team.members?.map((member: any) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-[10px]">
                                {member.full_name?.charAt(0) || 'M'}
                              </div>
                              <span className="font-medium text-slate-800">{member.full_name}</span>
                            </div>
                            <span className="text-slate-400 text-[11px]">
                              {member.department || 'Enrolled'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 pt-0 border-t border-slate-100 mt-4 flex justify-between items-center">
                  <Link
                    to={`/events/${team.event?.id}`}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                  >
                    <span>Event Details</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  <Badge variant="secondary" className="capitalize text-[11px]">
                    Status: {team.status}
                  </Badge>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No teams joined yet"
          description="Participate in team-based hackathons and tournaments by creating a team during event registration or entering an invitation code."
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setIsJoinOpen(true)}>
                Join with Code
              </Button>
              <Link to="/events">
                <Button variant="outline" size="sm">
                  Browse Team Events
                </Button>
              </Link>
            </div>
          }
        />
      )}

      {/* JOIN TEAM MODAL */}
      <Modal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        title="Join Team with Invitation Code"
        description="Select the event and enter the 6-character code given by your team leader."
      >
        <form onSubmit={handleJoinWithCode} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-sm font-medium text-slate-700">Team Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              required
            >
              <option value="">Select a team event...</option>
              {teamEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Invitation Code"
            placeholder="e.g. 7K4N2P"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="font-mono uppercase tracking-widest text-center text-lg font-bold"
            maxLength={6}
            required
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsJoinOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Join Team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
