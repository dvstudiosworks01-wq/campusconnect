import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Award,
  Calendar,
  Building,
  User,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

export function CertificateVerifyPage() {
  const [searchParams] = useSearchParams()
  const [certNumber, setCertNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const verifyCertificate = async (numToVerify: string) => {
    const trimmed = numToVerify.trim().toUpperCase()
    if (!trimmed) return

    setIsLoading(true)
    setHasSearched(true)
    setVerificationResult(null)

    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.rpc('verify_certificate_public', {
        p_certificate_number: trimmed,
      })

      if (error) throw error
      setVerificationResult(data)
    } catch (err) {
      console.error('Error verifying certificate:', err)
      setVerificationResult({
        found: false,
        message: 'Could not connect to certificate verification service.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const queryCert = searchParams.get('cert')
    if (queryCert) {
      setCertNumber(queryCert)
      verifyCertificate(queryCert)
    }
  }, [searchParams])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verifyCertificate(certNumber)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 text-left">
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Public Certificate Verification
        </h1>
        <p className="text-sm text-slate-500">
          Verify the authenticity of digital certificates issued by Apex Institute of Technology for
          competitions, symposiums, and collegiate events.
        </p>
      </div>

      {/* Verification Query Form */}
      <Card className="border-slate-200 shadow-card max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter Certificate Number (e.g. CERT-2026-XXXX)"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value.toUpperCase())}
                className="font-mono uppercase text-sm h-11"
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="h-11 px-6 shrink-0"
              leftIcon={<Search className="w-4 h-4" />}
            >
              Verify Now
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result Display */}
      {hasSearched && !isLoading && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
          {verificationResult?.found ? (
            verificationResult.is_valid ? (
              /* VALID CERTIFICATE DISPLAY */
              <div className="rounded-2xl border-2 border-emerald-500 bg-white p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-1 rounded-bl-xl flex items-center gap-1 shadow">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified Authenticity</span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Award className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Certificate of Completion</h3>
                    <p className="text-xs font-mono text-emerald-700 font-semibold mt-0.5">
                      #{verificationResult.certificate_number}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-100 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Awarded To</span>
                    <span className="font-bold text-slate-900 text-base">
                      {verificationResult.student_name}
                    </span>
                    {verificationResult.department && (
                      <span className="text-xs text-slate-500 block">
                        Dept. of {verificationResult.department}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Certificate Type</span>
                    <Badge variant="default" className="capitalize mt-1">
                      {verificationResult.certificate_type.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium block">College Event</span>
                    <span className="font-semibold text-slate-800">
                      {verificationResult.event_title}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Issue Date</span>
                    <span className="font-semibold text-slate-800">
                      {formatDate(verificationResult.issued_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Cryptographically verified on PostgreSQL database</span>
                  </div>
                  <span className="font-semibold text-slate-700">Apex Institute of Technology</span>
                </div>
              </div>
            ) : (
              /* REVOKED CERTIFICATE DISPLAY */
              <div className="rounded-2xl border-2 border-rose-500 bg-rose-50/50 p-6 sm:p-8 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div>
                    <Badge variant="destructive" className="mb-1">
                      Certificate Revoked
                    </Badge>
                    <h3 className="text-lg font-bold text-rose-950">
                      This Certificate Has Been Revoked
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Certificate #{verificationResult.certificate_number} was revoked by the college
                  administration on {formatDate(verificationResult.revoked_at)}. It is no longer valid.
                </p>
              </div>
            )
          ) : (
            /* NOT FOUND DISPLAY */
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-subtle space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Certificate Not Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No matching record exists for certificate number <strong>"{certNumber}"</strong>. Please verify
                the exact certificate code printed on the document.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
