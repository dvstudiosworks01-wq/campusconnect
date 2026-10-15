import { useEffect, useState, useRef } from 'react'
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Camera,
  Calendar,
  Clock,
  Keyboard,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatDateTime } from '@/lib/utils'

export function AttendanceStatusPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [attendances, setAttendances] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Scanner state
  const [isScannerActive, setIsScannerActive] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastCheckInResult, setLastCheckInResult] = useState<any | null>(null)

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = 'campus-qr-scanner-box'

  const fetchAttendanceRecords = async () => {
    if (!user || !isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          event:events(id, title, venue, start_at, end_at, category:event_categories(name))
        `)
        .eq('student_id', user.id)
        .order('checked_in_at', { ascending: false })

      if (error) throw error
      setAttendances(data || [])
    } catch (err) {
      console.error('Error fetching attendance:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAttendanceRecords()
    return () => {
      // Clean up scanner on unmount
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [user])

  const processAttendanceCheckIn = async (token: string) => {
    if (!token.trim()) return
    setIsSubmitting(true)
    setLastCheckInResult(null)

    try {
      // Execute the security definer function
      const { data, error } = await supabase.rpc('check_in_with_qr', {
        p_token: token.trim(),
      })

      if (error) throw error

      setLastCheckInResult(data)
      toast({
        type: 'success',
        title: 'Attendance Marked!',
        message: `Verified attendance for "${data?.event_title}".`,
      })

      setManualToken('')
      // Stop scanner if active
      if (isScannerActive && html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop().catch(() => {})
        setIsScannerActive(false)
      }

      await fetchAttendanceRecords()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Check-in Rejected',
        message: err.message || 'Invalid or expired QR code session.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const startScanner = async () => {
    setIsScannerActive(true)
    setLastCheckInResult(null)

    setTimeout(async () => {
      try {
        const qrScanner = new Html5Qrcode(scannerContainerId)
        html5QrCodeRef.current = qrScanner

        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Check if scanned text is full URL with token or raw token
            let token = decodedText
            if (decodedText.includes('token=')) {
              const urlParams = new URLSearchParams(decodedText.split('?')[1])
              token = urlParams.get('token') || decodedText
            }
            processAttendanceCheckIn(token)
          },
          () => {
            // Scan progress callback (noop)
          }
        )
      } catch (err) {
        console.error('Camera scanner init failed:', err)
        toast({
          type: 'warning',
          title: 'Camera Access Unavailable',
          message: 'Unable to access camera. Please enter the attendance token code below.',
        })
        setIsScannerActive(false)
      }
    }, 150)
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      await html5QrCodeRef.current.stop().catch(() => {})
      html5QrCodeRef.current = null
    }
    setIsScannerActive(false)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    processAttendanceCheckIn(manualToken)
  }

  return (
    <div className="space-y-8 text-left">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">QR Attendance Check-In</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Scan the organizer's active session QR code at the event venue to mark your verified presence.
        </p>
      </div>

      {/* SUCCESS BANNER */}
      {lastCheckInResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 flex items-start gap-4 shadow-lg animate-in zoom-in-95">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-base font-bold text-emerald-900">Attendance Recorded Successfully!</h4>
            <p className="text-xs text-emerald-800">
              You are officially checked in for <strong>{lastCheckInResult.event_title}</strong>. Your
              participation points and certificate eligibility have been logged.
            </p>
          </div>
        </div>
      )}

      {/* CHECK-IN CARD */}
      <Card className="border-slate-200 shadow-card">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary-600" />
            <span>Mark Attendance</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* CAMERA SCANNER AREA */}
          <div className="space-y-4">
            {isScannerActive ? (
              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  id={scannerContainerId}
                  className="w-full max-w-sm h-72 rounded-2xl overflow-hidden border-2 border-primary-500 bg-slate-950 shadow-inner"
                />
                <Button variant="outline" size="sm" onClick={stopScanner}>
                  Cancel Camera Scan
                </Button>
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shadow-sm">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Scan QR Code at the Venue</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                    Aim your camera at the live attendance screen projected by the event organizer.
                  </p>
                </div>
                <Button
                  size="md"
                  onClick={startScanner}
                  leftIcon={<QrCode className="w-4 h-4" />}
                  className="font-semibold"
                >
                  Launch Camera Scanner
                </Button>
              </div>
            )}
          </div>

          {/* FALLBACK MANUAL CODE INPUT */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4" />
              <span>Camera Unavailable? Enter Token Code</span>
            </div>

            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                placeholder="Paste or enter 32-character attendance token..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="font-mono text-xs"
                required
              />
              <Button type="submit" isLoading={isSubmitting} className="shrink-0">
                Submit Token
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* ATTENDANCE HISTORY */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Your Attendance History</h3>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : attendances.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Venue</th>
                    <th className="py-3 px-4">Verified Date & Time</th>
                    <th className="py-3 px-4 text-center">Method</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {attendances.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {att.event?.title || 'College Event'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{att.event?.venue}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {formatDateTime(att.checked_in_at)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="outline" className="uppercase text-[10px] font-mono">
                          {att.method}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Badge variant="success" className="gap-1 inline-flex items-center">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Present</span>
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<QrCode className="w-6 h-6" />}
            title="No attendance records yet"
            description="Your verified attendance logs will appear here once you scan the QR code at registered college events."
          />
        )}
      </div>
    </div>
  )
}
