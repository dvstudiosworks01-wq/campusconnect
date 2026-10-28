import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Download,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Sparkles,
  QrCode,
} from 'lucide-react'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

export function MyCertificatesPage() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [certificates, setCertificates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCertificates() {
      if (!user || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('certificates')
          .select(`
            *,
            event:events(id, title, venue, start_at, end_at)
          `)
          .eq('student_id', user.id)
          .is('revoked_at', null)
          .order('issued_at', { ascending: false })

        if (error) throw error
        setCertificates(data || [])
      } catch (err) {
        console.error('Error fetching certificates:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCertificates()
  }, [user])

  // Generate and download a PDF certificate with QR code verification link
  const downloadCertificatePDF = async (cert: any) => {
    setIsGeneratingPdf(cert.id)
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const studentName = profile?.full_name || 'Campus Student'
      const eventTitle = cert.event?.title || 'College Event'
      const certNumber = cert.certificate_number
      const certType = cert.certificate_type.toUpperCase().replace('_', ' ')
      const issueDate = formatDate(cert.issued_at)
      const verifyUrl = `${window.location.origin}/verify-certificate?cert=${certNumber}`

      // Generate verification QR code data URL
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 160,
        margin: 1,
        color: { dark: '#0b1329', light: '#ffffff' },
      })

      // Draw decorative certificate borders
      doc.setDrawColor(29, 78, 216) // primary blue
      doc.setLineWidth(2)
      doc.rect(10, 10, 277, 190)

      doc.setDrawColor(203, 213, 225) // slate
      doc.setLineWidth(0.5)
      doc.rect(14, 14, 269, 182)

      // College Title & Header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(11, 19, 41) // Dark navy
      doc.text('KONGU ENGINEERING COLLEGE', 148.5, 38, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text('AUTONOMOUS • AFFILIATED TO ANNA UNIVERSITY • PERUNDURAI, ERODE', 148.5, 45, {
        align: 'center',
      })

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(28)
      doc.setTextColor(29, 78, 216)
      doc.text(`CERTIFICATE OF ${certType}`, 148.5, 66, { align: 'center' })

      // Body text
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(12)
      doc.setTextColor(71, 85, 105)
      doc.text('This is to certify that', 148.5, 82, { align: 'center' })

      // Student Name
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(24)
      doc.setTextColor(15, 23, 42)
      doc.text(studentName, 148.5, 96, { align: 'center' })

      if (profile?.department) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(100, 116, 139)
        doc.text(`Department of ${profile.department}`, 148.5, 104, { align: 'center' })
      }

      // Achievement explanation
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(12)
      doc.setTextColor(71, 85, 105)
      doc.text('has successfully participated in and demonstrated academic excellence at', 148.5, 118, {
        align: 'center',
      })

      // Event Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(29, 78, 216)
      doc.text(eventTitle, 148.5, 128, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(`Held on campus at Kongu Engineering College on ${issueDate}`, 148.5, 136, {
        align: 'center',
      })

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

      // Save PDF
      doc.save(`Certificate_${certNumber}.pdf`)
      toast({
        type: 'success',
        title: 'Certificate Downloaded',
        message: `Saved Certificate #${certNumber} as PDF.`,
      })
    } catch (err: any) {
      console.error('PDF generation failure:', err)
      toast({
        type: 'error',
        title: 'Download Failed',
        message: err.message || 'Could not compile certificate PDF.',
      })
    } finally {
      setIsGeneratingPdf(null)
    }
  }

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Issued Certificates</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Download tamper-proof, verifiable PDF certificates earned from events and competitions.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <Card key={cert.id} className="border-slate-200 shadow-subtle flex flex-col justify-between">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shrink-0 shadow-sm">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900">
                        {cert.event?.title || 'College Event'}
                      </h3>
                      <p className="text-xs font-mono text-primary-700 font-semibold mt-0.5">
                        #{cert.certificate_number}
                      </p>
                    </div>
                  </div>

                  <Badge variant="default" className="capitalize text-xs font-semibold">
                    {cert.certificate_type.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Issued: {formatDate(cert.issued_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    isLoading={isGeneratingPdf === cert.id}
                    onClick={() => downloadCertificatePDF(cert)}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Download PDF
                  </Button>

                  <Link to={`/verify-certificate?cert=${cert.certificate_number}`} target="_blank">
                    <Button variant="outline" size="sm" leftIcon={<ExternalLink className="w-4 h-4" />}>
                      Verify
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Award className="w-6 h-6" />}
          title="No certificates issued yet"
          description="Attend registered events and check in with the QR scanner to receive official certificates of participation or victory from organizers."
          action={
            <Link to="/events">
              <Button size="sm">Explore Open Events</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
