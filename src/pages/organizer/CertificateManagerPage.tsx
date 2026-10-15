import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileCheck2,
  Award,
  Sparkles,
  Users,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

export function CertificateManagerPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendees, setAttendees] = useState<any[]>([])
  const [issuedCertificates, setIssuedCertificates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isIssuing, setIsIssuing] = useState(false)

  useEffect(() => {
    async function loadEvents() {
      if (!user || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const { data } = await supabase
          .from('events')
          .select('id, title, status, start_at')
          .eq('organizer_id', user.id)
          .in('status', ['published', 'completed'])
          .order('start_at', { ascending: false })

        if (data && data.length > 0) {
          setEvents(data)
          setSelectedEventId(data[0].id)
        }
      } catch (err) {
        console.error('Error loading events:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadEvents()
  }, [user])

  useEffect(() => {
    if (!selectedEventId || !isSupabaseConfigured) return

    async function loadAttendeesAndCertificates() {
      setIsLoading(true)
      try {
        const [attRes, certsRes] = await Promise.all([
          supabase
            .from('attendance')
            .select(`
              student_id,
              student:profiles(id, full_name, email, department)
            `)
            .eq('event_id', selectedEventId),
          supabase
            .from('certificates')
            .select(`
              *,
              student:profiles(full_name, email, department)
            `)
            .eq('event_id', selectedEventId)
            .order('issued_at', { ascending: false }),
        ])

        setAttendees(attRes.data || [])
        setIssuedCertificates(certsRes.data || [])
      } catch (err) {
        console.error('Error loading certificate data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadAttendeesAndCertificates()
  }, [selectedEventId])

  // Bulk Issue Certificates for all verified attendees
  const handleBulkIssue = async () => {
    if (!selectedEventId || attendees.length === 0) return
    setIsIssuing(true)

    try {
      const year = new Date().getFullYear()
      const ev = events.find((e) => e.id === selectedEventId)
      const prefix = ev?.title?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'EVNT'

      let issuedCount = 0

      for (const att of attendees) {
        const studentId = att.student_id
        // Check if certificate already exists
        const exists = issuedCertificates.some((c) => c.student_id === studentId)
        if (!exists) {
          const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
          const certNumber = `CERT-${prefix}-${year}-${rand}`

          const { error } = await supabase.from('certificates').insert({
            event_id: selectedEventId,
            student_id: studentId,
            certificate_number: certNumber,
            certificate_type: 'participation',
            storage_path: `certificates/${selectedEventId}/${studentId}.pdf`,
          })

          if (!error) issuedCount++
        }
      }

      toast({
        type: 'success',
        title: 'Certificates Generated',
        message: `Successfully issued ${issuedCount} verifiable certificates.`,
      })

      // Reload
      const { data: certs } = await supabase
        .from('certificates')
        .select('*, student:profiles(full_name, email, department)')
        .eq('event_id', selectedEventId)

      if (certs) setIssuedCertificates(certs)
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Issuance Failed',
        message: err.message || 'Could not issue certificates.',
      })
    } finally {
      setIsIssuing(false)
    }
  }

  const unissuedCount = attendees.filter(
    (att) => !issuedCertificates.some((c) => c.student_id === att.student_id)
  ).length

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Certificate Issuance Engine
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Authorize and generate tamper-proof cryptographic certificates for confirmed attendees.
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
                  {ev.title}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              onClick={handleBulkIssue}
              isLoading={isIssuing}
              disabled={unissuedCount === 0}
              leftIcon={<Sparkles className="w-4 h-4 text-amber-300" />}
            >
              Issue All Eligible ({unissuedCount})
            </Button>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-subtle p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Verified Attendees
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{attendees.length}</div>
        </Card>

        <Card className="border-slate-200 shadow-subtle p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Certificates Issued
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {issuedCertificates.length}
          </div>
        </Card>

        <Card className="border-slate-200 shadow-subtle p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Eligible Pending Issuance
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{unissuedCount}</div>
        </Card>
      </div>

      {/* Issued Certificates Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Issued Certificates Registry</h3>

        {isLoading ? (
          <Card className="border-slate-200 p-6 space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </Card>
        ) : issuedCertificates.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Certificate ID</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Issued Date</th>
                    <th className="py-3 px-4 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {issuedCertificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary-700">
                        #{cert.certificate_number}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {cert.student?.full_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {cert.student?.department || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="default" className="capitalize text-[10px]">
                          {cert.certificate_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {formatDate(cert.issued_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/verify-certificate?cert=${cert.certificate_number}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-semibold"
                        >
                          <span>Public Seal</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Award className="w-6 h-6" />}
            title="No certificates issued for this event"
            description="Once attendees mark presence using the live QR session, click 'Issue All Eligible' to generate their certificates."
          />
        )}
      </div>
    </div>
  )
}
