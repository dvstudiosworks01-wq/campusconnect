import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  QrCode,
  ShieldCheck,
  Clock,
  Users,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  UserCheck,
} from 'lucide-react'
import QRCode from 'qrcode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime } from '@/lib/utils'

export function QRAttendancePage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { toast } = useToast()

  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(
    searchParams.get('eventId') || ''
  )
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)

  // Active Session State
  const [activeSession, setActiveSession] = useState<any | null>(null)
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(10)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  // Live Attendance State
  const [liveAttendedCount, setLiveAttendedCount] = useState<number>(0)
  const [registrationCount, setRegistrationCount] = useState<number>(0)
  const [recentAttendees, setRecentAttendees] = useState<any[]>([])

  // Fullscreen projection toggle
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  // Manual Check-in Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([])
  const [manualStudentId, setManualStudentId] = useState('')
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)

  // Fetch organizer's published events
  useEffect(() => {
    async function fetchEvents() {
      if (!user || !isSupabaseConfigured) {
        setIsLoadingEvents(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('organizer_id', user.id)
          .eq('status', 'published')
          .order('start_at', { ascending: true })

        if (error) throw error
        const evList = data || []
        setEvents(evList)

        const paramId = searchParams.get('eventId')
        if (paramId && evList.some((e) => e.id === paramId)) {
          setSelectedEventId(paramId)
        } else if (evList.length > 0 && !selectedEventId) {
          setSelectedEventId(evList[0].id)
        }
      } catch (err) {
        console.error('Error fetching published events:', err)
      } finally {
        setIsLoadingEvents(false)
      }
    }

    fetchEvents()
  }, [user, searchParams])

  // When selected event changes, load event details, active sessions, and live attendance
  useEffect(() => {
    if (!selectedEventId || !isSupabaseConfigured) return

    const ev = events.find((e) => e.id === selectedEventId)
    setSelectedEvent(ev || null)

    loadLiveAttendance(selectedEventId)
    checkExistingActiveSession(selectedEventId)

    // Interval to refresh live attendance every 5 seconds
    const interval = setInterval(() => {
      loadLiveAttendance(selectedEventId)
    }, 5000)

    return () => clearInterval(interval)
  }, [selectedEventId, events])

  // Countdown timer effect
  useEffect(() => {
    if (secondsRemaining <= 0) {
      if (activeSession && secondsRemaining === 0) {
        // Expired
        setActiveSession(null)
        setRawToken(null)
        setQrCodeDataUrl(null)
      }
      return
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [secondsRemaining, activeSession])

  const loadLiveAttendance = async (eventId: string) => {
    try {
      const [{ count: regCount }, { count: attCount }, { data: recent }] =
        await Promise.all([
          supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('status', 'confirmed'),
          supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId),
          supabase
            .from('attendance')
            .select(`
              *,
              student:profiles(full_name, department)
            `)
            .eq('event_id', eventId)
            .order('checked_in_at', { ascending: false })
            .limit(5),
        ])

      setRegistrationCount(regCount || 0)
      setLiveAttendedCount(attCount || 0)
      setRecentAttendees(recent || [])
    } catch (err) {
      console.error('Error fetching live attendance count:', err)
    }
  }

  const checkExistingActiveSession = async (eventId: string) => {
    try {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('event_qr_sessions')
        .select('*')
        .eq('event_id', eventId)
        .is('revoked_at', null)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        const session = data[0]
        setActiveSession(session)
        const secondsLeft = Math.floor(
          (new Date(session.expires_at).getTime() - Date.now()) / 1000
        )
        setSecondsRemaining(Math.max(0, secondsLeft))
      }
    } catch (err) {
      console.error('Error checking active session:', err)
    }
  }

  // Generate cryptographically secure random token and session
  const generateNewQRSession = async () => {
    if (!selectedEventId || !user) return

    setIsGenerating(true)
    try {
      // 1. Generate 32-character random hex token
      const array = new Uint8Array(16)
      crypto.getRandomValues(array)
      const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')

      // 2. Hash using SHA-256 via Web Crypto
      const encoder = new TextEncoder()
      const data = encoder.encode(token)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      // 3. Define time window
      const now = new Date()
      const expiresAt = new Date(now.getTime() + sessionDurationMinutes * 60 * 1000)

      // 4. Revoke previous active sessions for this event
      await supabase
        .from('event_qr_sessions')
        .update({ revoked_at: now.toISOString() })
        .eq('event_id', selectedEventId)
        .is('revoked_at', null)

      // 5. Insert new session
      const { data: newSession, error } = await supabase
        .from('event_qr_sessions')
        .insert({
          event_id: selectedEventId,
          token_hash: tokenHash,
          valid_from: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // 6. Generate QR code with raw token
      const qrPayload = `${window.location.origin}/student/attendance?token=${token}`
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: 360,
        margin: 2,
        color: { dark: '#0b1329', light: '#ffffff' },
      })

      setActiveSession(newSession)
      setRawToken(token)
      setQrCodeDataUrl(dataUrl)
      setSecondsRemaining(sessionDurationMinutes * 60)

      toast({
        type: 'success',
        title: 'QR Attendance Session Live',
        message: `Session active for ${sessionDurationMinutes} minutes. Project onto venue screen.`,
      })
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Failed to Launch Session',
        message: err.message || 'Error occurred generating QR session.',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Revoke active session
  const revokeActiveSession = async () => {
    if (!activeSession) return
    setIsRevoking(true)
    try {
      const { error } = await supabase
        .from('event_qr_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', activeSession.id)

      if (error) throw error

      setActiveSession(null)
      setRawToken(null)
      setQrCodeDataUrl(null)
      setSecondsRemaining(0)

      toast({
        type: 'info',
        title: 'Session Revoked',
        message: 'The attendance QR code has been invalidated immediately.',
      })
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Revoke Failed',
        message: err.message || 'Could not revoke session.',
      })
    } finally {
      setIsRevoking(false)
    }
  }

  // Copy raw token code
  const copyToken = () => {
    if (!rawToken) return
    navigator.clipboard.writeText(rawToken)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
    toast({ type: 'info', title: 'Token Copied to Clipboard' })
  }

  // Load students for manual check-in modal
  const openManualModal = async () => {
    if (!selectedEventId) return
    setIsManualModalOpen(true)
    try {
      const { data } = await supabase
        .from('registrations')
        .select(`
          student_id,
          student:profiles(id, full_name, email, department)
        `)
        .eq('event_id', selectedEventId)
        .eq('status', 'confirmed')

      if (data) {
        setRegisteredStudents(data.map((r) => r.student).filter(Boolean))
      }
    } catch (err) {
      console.error('Error loading registered students:', err)
    }
  }

  const handleManualCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualStudentId || !selectedEventId) return

    setIsSubmittingManual(true)
    try {
      const { error } = await supabase.rpc('manual_record_attendance', {
        p_event_id: selectedEventId,
        p_student_id: manualStudentId,
      })

      if (error) throw error

      toast({
        type: 'success',
        title: 'Manual Check-in Successful',
        message: 'Student marked present.',
      })

      setIsManualModalOpen(false)
      setManualStudentId('')
      loadLiveAttendance(selectedEventId)
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Check-in Error',
        message: err.message || 'Could not mark attendance.',
      })
    } finally {
      setIsSubmittingManual(false)
    }
  }

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header and Event Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Live QR Attendance Station
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Broadcast time-limited cryptographic QR check-in codes projected at the event venue.
          </p>
        </div>

        {events.length > 0 && (
          <div className="w-full sm:w-72">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoadingEvents ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<QrCode className="w-6 h-6" />}
          title="No published events open for check-in"
          description="You can generate QR attendance sessions for approved, published events on their scheduled date."
          action={
            <Link to="/organizer/events">
              <Button size="sm">Manage Events</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main QR Display Screen */}
          <Card
            className={`lg:col-span-2 border-slate-200 shadow-card flex flex-col justify-between overflow-hidden transition-all ${
              isFullscreen ? 'fixed inset-0 z-50 bg-white rounded-none p-8 m-0' : ''
            }`}
          >
            <div>
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary-600" />
                    <span>{selectedEvent?.title}</span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Venue: {selectedEvent?.venue} • Time: {formatTime(selectedEvent?.start_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    leftIcon={
                      isFullscreen ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )
                    }
                  >
                    {isFullscreen ? 'Exit Fullscreen' : 'Project Screen'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6 flex flex-col items-center justify-center space-y-6">
                {activeSession && qrCodeDataUrl ? (
                  <div className="flex flex-col items-center space-y-4 animate-in zoom-in-95">
                    {/* Countdown pill */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white shadow-md text-sm font-bold font-mono">
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span>Expires in {formatTimer(secondsRemaining)}</span>
                    </div>

                    {/* High-res QR Image with frame */}
                    <div className="p-4 rounded-3xl bg-white border-4 border-primary-600 shadow-2xl">
                      <img
                        src={qrCodeDataUrl}
                        alt="Event QR Check-In"
                        className="w-72 h-72 sm:w-80 sm:h-80 object-contain"
                      />
                    </div>

                    {/* Token fallback code */}
                    {rawToken && (
                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-slate-500">Manual Code:</span>
                        <code className="font-mono font-bold text-xs text-slate-800">
                          {rawToken}
                        </code>
                        <button
                          onClick={copyToken}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        >
                          {copiedToken ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    <div className="text-center space-y-1">
                      <p className="text-xs font-medium text-slate-600">
                        Students must scan this code or input the token on their student portal.
                      </p>
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-[11px] font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>SHA-256 Cryptographic Hash Stored</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-sm">
                    <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shadow-inner">
                      <QrCode className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900">
                        No Active Session Running
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Generate a secure, time-limited QR attendance session to project on screen for
                        registered participants.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-xs text-slate-500 font-medium">Session Window:</span>
                      <select
                        value={sessionDurationMinutes}
                        onChange={(e) => setSessionDurationMinutes(parseInt(e.target.value, 10))}
                        className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 font-semibold"
                      >
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                      </select>
                    </div>

                    <Button
                      size="lg"
                      className="w-full mt-2"
                      onClick={generateNewQRSession}
                      isLoading={isGenerating}
                      leftIcon={<QrCode className="w-4 h-4" />}
                    >
                      Generate Live QR Code
                    </Button>
                  </div>
                )}
              </CardContent>
            </div>

            {/* Bottom Actions Bar */}
            {activeSession && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateNewQRSession}
                  isLoading={isGenerating}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Regenerate QR Token
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={revokeActiveSession}
                  isLoading={isRevoking}
                  leftIcon={<XCircle className="w-3.5 h-3.5" />}
                >
                  Revoke Active Session
                </Button>
              </div>
            )}
          </Card>

          {/* Right Column: Live Statistics & Manual Check-in */}
          <div className="space-y-6">
            {/* Live Counter Card */}
            <Card className="border-slate-200 shadow-card">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Live Attendance Stats</h3>
                  <Badge variant="success" className="animate-pulse text-[10px] uppercase font-bold">
                    Live Sync
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Registered
                    </span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {registrationCount}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
                      Checked In
                    </span>
                    <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
                      {liveAttendedCount}
                    </span>
                  </div>
                </div>

                {/* Turnout Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Turnout Rate</span>
                    <span>
                      {registrationCount > 0
                        ? Math.round((liveAttendedCount / registrationCount) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          registrationCount > 0
                            ? Math.min(100, (liveAttendedCount / registrationCount) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Manual Check-in shortcut */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={openManualModal}
                    leftIcon={<UserCheck className="w-4 h-4 text-primary-600" />}
                  >
                    Manual Check-In Fallback
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Check-ins Feed */}
            <Card className="border-slate-200 shadow-subtle">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                  Recent Verified Check-Ins
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {recentAttendees.length > 0 ? (
                  <div className="space-y-2.5">
                    {recentAttendees.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {att.student?.full_name || 'Student'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatTime(att.checked_in_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    Awaiting initial check-in scans...
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* MANUAL CHECK-IN MODAL */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Manual Attendance Check-In"
        description="Search and verify attendance for students whose camera/device is unavailable."
      >
        <form onSubmit={handleManualCheckInSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-sm font-medium text-slate-700">
              Select Registered Student
            </label>
            <select
              value={manualStudentId}
              onChange={(e) => setManualStudentId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              required
            >
              <option value="">Choose a registered student...</option>
              {registeredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.email}) — Dept: {s.department || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingManual}>
              Mark Present
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
