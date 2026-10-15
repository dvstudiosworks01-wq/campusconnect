import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Share2,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  UserCheck,
  UserPlus,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatDateTime, formatTime, hasTimeConflict, generateInviteCode } from '@/lib/utils'
import type { EventItem, Registration } from '@/types/database.types'

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile, role } = useAuth()
  const { toast } = useToast()

  const [event, setEvent] = useState<EventItem | null>(null)
  const [existingRegistrations, setExistingRegistrations] = useState<Registration[]>([])
  const [userRegistration, setUserRegistration] = useState<Registration | null>(null)
  const [registrationCount, setRegistrationCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Clash warning state
  const [conflictingEvent, setConflictingEvent] = useState<EventItem | null>(null)

  // Team Modals
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false)
  const [isJoinTeamOpen, setIsJoinTeamOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [generatedCode, setGeneratedCode] = useState(generateInviteCode())
  const [inputInviteCode, setInputInviteCode] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    async function loadEventData() {
      if (!id || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch event details
        const { data: eventData, error: eventErr } = await supabase
          .from('events')
          .select(`
            *,
            category:event_categories(name),
            organizer:profiles!events_organizer_id_fkey(full_name, email, avatar_url)
          `)
          .eq('id', id)
          .single()

        if (eventErr || !eventData) {
          toast({ type: 'error', title: 'Event not found' })
          navigate('/events')
          return
        }

        setEvent(eventData as any)

        // Fetch registration count
        const { count } = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', id)
          .eq('status', 'confirmed')

        setRegistrationCount(count || 0)

        // If user is logged in, check their registration and look for time clashes
        if (user) {
          const { data: userRegs } = await supabase
            .from('registrations')
            .select(`
              *,
              event:events(*)
            `)
            .eq('student_id', user.id)
            .eq('status', 'confirmed')

          if (userRegs) {
            setExistingRegistrations(userRegs as any)
            const currentEventReg = userRegs.find((r) => r.event_id === id)
            setUserRegistration((currentEventReg as any) || null)

            // Calculate client-side event clash detection
            if (!currentEventReg) {
              const clash = userRegs.find(
                (r: any) =>
                  r.event &&
                  r.event.id !== id &&
                  hasTimeConflict(
                    eventData.start_at,
                    eventData.end_at,
                    r.event.start_at,
                    r.event.end_at
                  )
              )
              if (clash && (clash as any).event) {
                setConflictingEvent((clash as any).event)
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading event detail:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadEventData()
  }, [id, user, navigate, toast])

  // Handle individual event registration
  const handleRegisterIndividual = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/events/${id}` } } })
      return
    }

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('register_for_event', {
        p_event_id: id,
        p_team_id: null,
      })

      if (error) throw error

      toast({
        type: 'success',
        title: 'Registration Confirmed!',
        message: 'You are successfully registered for this event.',
      })

      setRegistrationCount((prev) => prev + 1)
      setUserRegistration({
        id: data?.registration_id,
        event_id: id!,
        student_id: user.id,
        team_id: null,
        status: 'confirmed',
        registered_at: new Date().toISOString(),
      })
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Registration Failed',
        message: err.message || 'Could not complete registration.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Create Team
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim() || !user || !id) return

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('create_team_with_leader', {
        p_event_id: id,
        p_team_name: teamName.trim(),
        p_invite_code: generatedCode.trim(),
      })

      if (error) throw error

      toast({
        type: 'success',
        title: 'Team Created!',
        message: `Team "${teamName}" created. You are registered as team leader. Share code ${generatedCode} with your teammates.`,
      })

      setIsCreateTeamOpen(false)
      setRegistrationCount((prev) => prev + 1)
      setUserRegistration({
        id: 'team-reg',
        event_id: id,
        student_id: user.id,
        team_id: data?.team_id,
        status: 'confirmed',
        registered_at: new Date().toISOString(),
      })
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Failed to Create Team',
        message: err.message || 'Error occurred while creating team.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Join Team with Invite Code
  const handleJoinTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputInviteCode.trim() || !user || !id) return

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('join_team_with_code', {
        p_event_id: id,
        p_invite_code: inputInviteCode.trim().toUpperCase(),
      })

      if (error) throw error

      toast({
        type: 'success',
        title: 'Joined Team!',
        message: `Successfully joined team "${data?.team_name}". Registration confirmed.`,
      })

      setIsJoinTeamOpen(false)
      setRegistrationCount((prev) => prev + 1)
      setUserRegistration({
        id: 'team-join-reg',
        event_id: id,
        student_id: user.id,
        team_id: data?.team_id,
        status: 'confirmed',
        registered_at: new Date().toISOString(),
      })
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Could Not Join Team',
        message: err.message || 'Invalid invite code or team is full.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(generatedCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast({ type: 'info', title: 'Code Copied', message: 'Share this code with teammates.' })
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 md:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!event) return null

  const isCompleted = event.status === 'completed' || new Date(event.end_at).getTime() < Date.now()
  const isDeadlinePassed = new Date(event.registration_deadline).getTime() < Date.now()
  const isFull = registrationCount >= event.capacity
  const capacityPercent = Math.min(100, Math.round((registrationCount / event.capacity) * 100))
  const canRegister = !userRegistration && !isCompleted && !isDeadlinePassed && !isFull && !conflictingEvent

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-left">
      {/* Breadcrumb / Back button */}
      <div>
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Events Directory
        </Link>
      </div>

      {/* Hero Banner Header */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[300px] flex flex-col justify-end p-6 sm:p-10 text-white">
        {event.banner_url ? (
          <img
            src={event.banner_url}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-primary-950 to-slate-900 opacity-90" />
        )}

        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" className="bg-white/95 text-slate-900 shadow">
              {event.category?.name || 'College Event'}
            </Badge>
            <Badge
              variant={event.registration_type === 'team' ? 'warning' : 'info'}
              className="capitalize shadow"
            >
              {event.registration_type} Format
            </Badge>
            {userRegistration && (
              <Badge variant="success" className="shadow flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>You are Registered</span>
              </Badge>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            {event.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300 pt-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary-400" />
              <span>{formatDate(event.start_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary-400" />
              <span>
                {formatTime(event.start_at)} - {formatTime(event.end_at)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary-400" />
              <span>{event.venue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Clash Warning Alert */}
      {conflictingEvent && !userRegistration && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3.5 shadow-sm">
          <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-950">Schedule Conflict Detected</h4>
            <p className="text-xs text-rose-800 leading-relaxed">
              You are already registered for{' '}
              <strong className="underline">{conflictingEvent.title}</strong>, which runs from{' '}
              <strong>{formatTime(conflictingEvent.start_at)}</strong> to{' '}
              <strong>{formatTime(conflictingEvent.end_at)}</strong> on{' '}
              <strong>{formatDate(conflictingEvent.start_at)}</strong>. Server rules prevent overlapping event
              commitments to maintain attendance integrity.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Description, Rules, Organizer */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200">
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">About the Event</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>

              {event.registration_type === 'team' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary-600" />
                    Team Participation Guidelines
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                    <li>
                      Team size must be between <strong>{event.team_min_size}</strong> and{' '}
                      <strong>{event.team_max_size}</strong> members.
                    </li>
                    <li>The team leader creates the team and shares the unique 6-digit invitation code.</li>
                    <li>Teammates must join using the invitation code before the registration deadline.</li>
                    <li>Every team member must be checked in individually on event day to receive certificates.</li>
                  </ul>
                </div>
              )}

              {/* Host / Organizer Card */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                    {event.organizer?.full_name ? event.organizer.full_name[0].toUpperCase() : 'O'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Organized by {event.organizer?.full_name || 'Faculty Committee'}
                    </div>
                    <div className="text-[11px] text-slate-500">{event.organizer?.email}</div>
                  </div>
                </div>

                {role === 'organizer' && event.organizer_id === user?.id && (
                  <Link to={`/organizer/attendance?eventId=${event.id}`}>
                    <Button variant="outline" size="sm">
                      Organizer QR Hub
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Registration Card & Action Panel */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-card">
            <CardContent className="pt-6 space-y-5">
              <h3 className="text-base font-bold text-slate-900">Registration Status</h3>

              {/* Deadline alert */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="text-slate-500 font-medium">Deadline to Register</div>
                <div className="text-slate-900 font-bold">
                  {formatDateTime(event.registration_deadline)}
                </div>
              </div>

              {/* Capacity Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Capacity Filled</span>
                  <span>
                    <strong>{registrationCount}</strong> / {event.capacity} seats ({capacityPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      capacityPercent >= 90
                        ? 'bg-rose-500'
                        : capacityPercent >= 70
                        ? 'bg-amber-500'
                        : 'bg-primary-600'
                    }`}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons based on User Auth & Status */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                {userRegistration ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <div className="text-sm font-bold text-emerald-950">You Are Registered!</div>
                    <p className="text-xs text-emerald-800">
                      Present your student ID or authenticate via the QR scanner on event day to mark attendance.
                    </p>
                    <Link to="/student/registrations">
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        View My Registrations
                      </Button>
                    </Link>
                  </div>
                ) : !user ? (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() =>
                      navigate('/login', { state: { from: { pathname: `/events/${id}` } } })
                    }
                  >
                    Sign In with Google to Register
                  </Button>
                ) : isCompleted ? (
                  <Button disabled size="lg" className="w-full">
                    Event Completed
                  </Button>
                ) : isDeadlinePassed ? (
                  <Button disabled size="lg" className="w-full">
                    Registration Closed
                  </Button>
                ) : isFull ? (
                  <Button disabled size="lg" className="w-full">
                    At Full Capacity
                  </Button>
                ) : conflictingEvent ? (
                  <Button disabled size="lg" className="w-full bg-rose-200 text-rose-800">
                    Schedule Conflict Blocked
                  </Button>
                ) : event.registration_type === 'individual' ? (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleRegisterIndividual}
                    isLoading={isSubmitting}
                  >
                    Confirm My Registration
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        setGeneratedCode(generateInviteCode())
                        setIsCreateTeamOpen(true)
                      }}
                      leftIcon={<UserPlus className="w-4 h-4" />}
                    >
                      Create Team as Leader
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full"
                      onClick={() => setIsJoinTeamOpen(true)}
                      leftIcon={<UserCheck className="w-4 h-4" />}
                    >
                      Join Existing Team with Code
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CREATE TEAM MODAL */}
      <Modal
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        title="Create Team"
        description={`Assemble a team for "${event.title}". You will be registered as the team leader.`}
      >
        <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
          <Input
            label="Team Name"
            placeholder="e.g. CyberKnights"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-sm font-medium text-slate-700">Team Invitation Code</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedCode}
                className="h-10 font-mono tracking-widest text-center text-lg font-bold bg-slate-100 rounded-lg border border-slate-300 w-full select-all text-slate-800"
              />
              <Button
                type="button"
                variant="outline"
                onClick={copyCodeToClipboard}
                leftIcon={copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              >
                {copiedCode ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Teammates will enter this code to join your team. Size: {event.team_min_size} -{' '}
              {event.team_max_size} members.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreateTeamOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Team & Register
            </Button>
          </div>
        </form>
      </Modal>

      {/* JOIN TEAM MODAL */}
      <Modal
        isOpen={isJoinTeamOpen}
        onClose={() => setIsJoinTeamOpen(false)}
        title="Join Team with Invite Code"
        description="Enter the 6-character code provided by your team leader."
      >
        <form onSubmit={handleJoinTeamSubmit} className="space-y-4">
          <Input
            label="Invitation Code"
            placeholder="e.g. 8K2M9P"
            value={inputInviteCode}
            onChange={(e) => setInputInviteCode(e.target.value.toUpperCase())}
            className="font-mono tracking-widest uppercase text-center text-lg font-bold"
            maxLength={6}
            required
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsJoinTeamOpen(false)}>
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
