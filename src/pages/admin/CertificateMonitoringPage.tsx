import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileCheck2,
  Search,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  ExternalLink,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

export function CertificateMonitoringPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [certificates, setCertificates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'valid' | 'revoked'>('all')

  // Revoke modal
  const [revokeModalCert, setRevokeModalCert] = useState<any | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchCertificates = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          event:events(id, title),
          student:profiles!certificates_student_id_fkey(full_name, email, department)
        `)
        .order('issued_at', { ascending: false })

      if (error) throw error
      setCertificates(data || [])
    } catch (err) {
      console.error('Error fetching certificates:', err)
      toast({ type: 'error', title: 'Failed to load certificates registry' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCertificates()
  }, [])

  const handleRevoke = async () => {
    if (!revokeModalCert || !user) return
    setIsProcessing(true)

    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('certificates')
        .update({ revoked_at: now })
        .eq('id', revokeModalCert.id)

      if (error) throw error

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'REVOKE_CERTIFICATE',
        entity_type: 'certificate',
        entity_id: revokeModalCert.id,
        details: {
          certificate_number: revokeModalCert.certificate_number,
          student_id: revokeModalCert.student_id,
        },
      })

      toast({
        type: 'warning',
        title: 'Certificate Revoked',
        message: `Certificate #${revokeModalCert.certificate_number} has been invalidated.`,
      })

      setRevokeModalCert(null)
      await fetchCertificates()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Revoke Failed',
        message: err.message || 'Could not revoke certificate.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReinstate = async (cert: any) => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('certificates')
        .update({ revoked_at: null })
        .eq('id', cert.id)

      if (error) throw error

      toast({
        type: 'success',
        title: 'Certificate Reinstated',
        message: `Certificate #${cert.certificate_number} is now marked valid.`,
      })

      await fetchCertificates()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Reinstate Failed',
        message: err.message || 'Could not reinstate certificate.',
      })
    }
  }

  const filteredCertificates = certificates.filter((c) => {
    const isValid = !c.revoked_at
    if (filter === 'valid' && !isValid) return false
    if (filter === 'revoked' && isValid) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.certificate_number.toLowerCase().includes(q) ||
      c.student?.full_name?.toLowerCase().includes(q) ||
      c.event?.title?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Certificate Audit & Revocation Center
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Campus-wide monitoring of issued digital certificates with instant cryptographic revocation.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by cert ID, student, or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs w-full sm:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({certificates.length})
          </button>
          <button
            onClick={() => setFilter('valid')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
              filter === 'valid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Valid ({certificates.filter((c) => !c.revoked_at).length})
          </button>
          <button
            onClick={() => setFilter('revoked')}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
              filter === 'revoked' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Revoked ({certificates.filter((c) => c.revoked_at).length})
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card className="border-slate-200 p-6 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </Card>
      ) : filteredCertificates.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Certificate Number</th>
                  <th className="py-3 px-4">Awarded To</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCertificates.map((cert) => {
                  const isValid = !cert.revoked_at

                  return (
                    <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary-700">
                        #{cert.certificate_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{cert.student?.full_name}</div>
                        <div className="text-slate-400 text-[11px]">{cert.student?.department}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{cert.event?.title}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant="default" className="capitalize text-[10px]">
                          {cert.certificate_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isValid ? (
                          <Badge variant="success" className="gap-1 inline-flex items-center">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Valid</span>
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 inline-flex items-center">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Revoked</span>
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Link
                          to={`/verify-certificate?cert=${cert.certificate_number}`}
                          target="_blank"
                        >
                          <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                            Verify
                          </Button>
                        </Link>

                        {isValid ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 text-xs h-7 px-2"
                            onClick={() => setRevokeModalCert(cert)}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-700 border-emerald-300 text-xs h-7 px-2"
                            onClick={() => handleReinstate(cert)}
                            leftIcon={<RotateCcw className="w-3 h-3" />}
                          >
                            Reinstate
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<FileCheck2 className="w-6 h-6" />}
          title="No certificates found"
          description="No certificates match your query or filter criteria."
        />
      )}

      {/* REVOKE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(revokeModalCert)}
        onClose={() => setRevokeModalCert(null)}
        title="Revoke Certificate"
        description="Are you sure you want to invalidate this certificate?"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Revoking certificate{' '}
            <strong className="text-slate-900 font-mono">
              #{revokeModalCert?.certificate_number}
            </strong>{' '}
            issued to <strong>{revokeModalCert?.student?.full_name}</strong> will cause the public
            verification portal to display a "Certificate Revoked" notice immediately.
          </p>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRevokeModalCert(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} isLoading={isProcessing}>
              Confirm Revocation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
