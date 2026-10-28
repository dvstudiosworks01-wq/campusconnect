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
  Download,
  Clock,
} from 'lucide-react'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

export function CertificateManagerPage() {
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendees, setAttendees] = useState<any[]>([])
  const [issuedCertificates, setIssuedCertificates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isIssuing, setIsIssuing] = useState(false)
  const [issuingStudentId, setIssuingStudentId] = useState<string | null>(null)
  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null)

  // Load published/completed events
  useEffect(() => {
    async function loadEvents() {
      if (!user || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        let query = supabase
          .from('events')
          .select('id, title, status, start_at')
          .in('status', ['published', 'completed'])
          .order('start_at', { ascending: false })

        // Organizers only see their own events, admins see all
        if (profile?.role !== 'admin') {
          query = query.eq('organizer_id', user.id)
        }

        const { data, error } = await query
        if (error) throw error

        if (data && data.length > 0) {
          setEvents(data)
          setSelectedEventId(data[0].id)
        } else {
          setEvents([])
          setSelectedEventId('')
        }
      } catch (err) {
        console.error('Error loading events:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadEvents()
  }, [user, profile])

  // Load verified attendees and issued certificates for the selected event
  const loadAttendeesAndCertificates = async () => {
    if (!selectedEventId || !isSupabaseConfigured) return
    setIsLoading(true)

    try {
      const [attRes, certsRes] = await Promise.all([
        supabase
          .from('attendance')
          .select(`
            id,
            student_id,
            checked_in_at,
            method,
            student:profiles!attendance_student_id_fkey(id, full_name, email, department, roll_number)
          `)
          .eq('event_id', selectedEventId),
        supabase
          .from('certificates')
          .select(`
            *,
            student:profiles!certificates_student_id_fkey(id, full_name, email, department, roll_number)
          `)
          .eq('event_id', selectedEventId)
          .order('issued_at', { ascending: false }),
      ])

      if (attRes.error) {
        console.error('Error fetching attendance with FK join:', attRes.error)
      }
      if (certsRes.error) {
        console.error('Error fetching certificates with FK join:', certsRes.error)
      }

      setAttendees(attRes.data || [])
      setIssuedCertificates(certsRes.data || [])
    } catch (err) {
      console.error('Error loading certificate data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAttendeesAndCertificates()
  }, [selectedEventId])

  // Single Certificate Issuance
  const handleIssueSingle = async (studentId: string, certType: string = 'participation') => {
    if (!selectedEventId) return
    setIssuingStudentId(studentId)

    try {
      const year = new Date().getFullYear()
      const ev = events.find((e) => e.id === selectedEventId)
      const prefix = ev?.title?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'EVNT'
      const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
      const certNumber = `CERT-${prefix}-${year}-${rand}`

      const { data, error } = await supabase
        .from('certificates')
        .insert({
          event_id: selectedEventId,
          student_id: studentId,
          certificate_number: certNumber,
          certificate_type: certType,
          storage_path: `certificates/${selectedEventId}/${studentId}.pdf`,
        })
        .select(`*, student:profiles!certificates_student_id_fkey(id, full_name, email, department, roll_number)`)
        .single()

      if (error) throw error

      toast({
        type: 'success',
        title: 'Certificate Issued',
        message: `Certificate #${certNumber} generated successfully.`,
      })

      if (data) {
        setIssuedCertificates((prev) => [data, ...prev])
      }
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Issuance Failed',
        message: err.message || 'Could not issue certificate.',
      })
    } finally {
      setIssuingStudentId(null)
    }
  }

  // Bulk Issue Certificates for all eligible attendees
  const handleBulkIssue = async () => {
    if (!selectedEventId || unissuedAttendees.length === 0) return
    setIsIssuing(true)

    try {
      const year = new Date().getFullYear()
      const ev = events.find((e) => e.id === selectedEventId)
      const prefix = ev?.title?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'EVNT'

      let issuedCount = 0

      for (const att of unissuedAttendees) {
        const studentId = att.student_id
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

      toast({
        type: 'success',
        title: 'Certificates Generated',
        message: `Successfully issued ${issuedCount} verifiable certificates.`,
      })

      await loadAttendeesAndCertificates()
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

  // PDF Certificate Generator & Downloader
  const downloadCertificatePDF = async (cert: any) => {
    setDownloadingCertId(cert.id)
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const ev = events.find((e) => e.id === selectedEventId)
      const studentName = cert.student?.full_name || 'Campus Student'
      const eventTitle = ev?.title || 'College Event'
      const certNumber = cert.certificate_number
      const certType = cert.certificate_type.toUpperCase().replace('_', ' ')
      const issueDate = formatDate(cert.issued_at)
      const verifyUrl = `${window.location.origin}/verify-certificate?cert=${certNumber}`

      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 160,
        margin: 1,
        color: { dark: '#0b1329', light: '#ffffff' },
      })

      // Borders
      doc.setDrawColor(29, 78, 216)
      doc.setLineWidth(2)
      doc.rect(10, 10, 277, 190)

      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.5)
      doc.rect(14, 14, 269, 182)

      // Header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(11, 19, 41)
      doc.text('KONGU ENGINEERING COLLEGE', 148.5, 38, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(
        'Autonomous Institution Affiliated to Anna University | Perundurai, Erode - 638060',
        148.5,
        45,
        { align: 'center' }
      )

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(29, 78, 216)
      doc.text(`CERTIFICATE OF ${certType}`, 148.5, 62, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(71, 85, 105)
      doc.text('This is to certify that', 148.5, 78, { align: 'center' })

      // Student Name
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(15, 23, 42)
      doc.text(studentName.toUpperCase(), 148.5, 92, { align: 'center' })

      const deptText = cert.student?.department
        ? `of Department of ${cert.student.department}`
        : 'of Kongu Engineering College'
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(71, 85, 105)
      doc.text(deptText, 148.5, 102, { align: 'center' })

      doc.text('has successfully participated in the college event', 148.5, 112, { align: 'center' })

      // Event Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(29, 78, 216)
      doc.text(`"${eventTitle.toUpperCase()}"`, 148.5, 124, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(`Issued on ${issueDate}`, 148.5, 136, { align: 'center' })

      // Embed Verification QR Code in bottom-left
      doc.addImage(qrDataUrl, 'PNG', 24, 142, 32, 32)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      doc.text('Scan to verify credential', 40, 178, { align: 'center' })

      // Signatures
      // Signature 1
      doc.setDrawColor(148, 163, 184)
      doc.setLineWidth(0.5)
      doc.line(160, 166, 210, 166)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Faculty Convener', 185, 172, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('Campus Events Board', 185, 177, { align: 'center' })

      // Signature 2
      doc.line(220, 166, 270, 166)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Dean of Academics', 245, 172, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('Kongu Engineering College', 245, 177, { align: 'center' })

      // Prominent, properly-bounded Certificate ID centered at footer
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(100, 116, 139)
      doc.text(`CERTIFICATE ID: #${certNumber}`, 148.5, 188, { align: 'center' })

      doc.save(`${certNumber}_${studentName.replace(/\s+/g, '_')}.pdf`)
      toast({
        type: 'success',
        title: 'Certificate Downloaded',
        message: `Saved ${certNumber} as PDF.`,
      })
    } catch (err: any) {
      console.error('PDF export error:', err)
      toast({ type: 'error', title: 'Export Failed', message: 'Could not generate certificate PDF.' })
    } finally {
      setDownloadingCertId(null)
    }
  }

  // Filter attendees who do not have an issued certificate yet
  const unissuedAttendees = attendees.filter(
    (att) => !issuedCertificates.some((c) => c.student_id === att.student_id)
  )
  const unissuedCount = unissuedAttendees.length

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

      {/* SECTION 1: ELIGIBLE ATTENDEES PENDING ISSUANCE */}
      {unissuedAttendees.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Eligible Attendees Awaiting Certificates ({unissuedCount})
            </h3>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-amber-50/60 border-b border-amber-200 text-xs font-semibold text-amber-900 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll / ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Verified At</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs">
                  {unissuedAttendees.map((att) => (
                    <tr key={att.student_id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{att.student?.full_name || 'Student Participant'}</div>
                        <div className="text-slate-400 font-normal text-[11px]">{att.student?.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        {att.student?.roll_number || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {att.student?.department || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{formatDate(att.checked_in_at)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-3 border-amber-300 text-amber-800 hover:bg-amber-50"
                          isLoading={issuingStudentId === att.student_id}
                          onClick={() => handleIssueSingle(att.student_id)}
                          leftIcon={<Award className="w-3.5 h-3.5 text-amber-600" />}
                        >
                          Issue Certificate
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ISSUED CERTIFICATES REGISTRY */}
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
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {issuedCertificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary-700">
                        #{cert.certificate_number}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{cert.student?.full_name}</div>
                        {cert.student?.roll_number && (
                          <div className="text-slate-400 font-mono text-[11px]">
                            {cert.student.roll_number}
                          </div>
                        )}
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
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/verify-certificate?cert=${cert.certificate_number}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-semibold"
                          >
                            <span>Public Seal</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2 text-slate-600 hover:text-slate-900"
                            isLoading={downloadingCertId === cert.id}
                            onClick={() => downloadCertificatePDF(cert)}
                            title="Download PDF Certificate"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
