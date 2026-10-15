import { useEffect, useState } from 'react'
import { BellRing, Mail, CheckCircle2, Clock, AlertCircle, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'

export function NotificationLogsPage() {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchNotifications = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          user:profiles!notifications_user_id_fkey(full_name, email),
          event:events(title)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error loading notification logs:', err)
      toast({ type: 'error', title: 'Failed to load notifications' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const handleRetry = async (notifId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notifId)

      if (error) throw error
      toast({ type: 'success', title: 'Notification Queued / Sent' })
      await fetchNotifications()
    } catch (err: any) {
      toast({ type: 'error', title: 'Retry Failed', message: err.message })
    }
  }

  const filtered = notifications.filter((n) => {
    if (statusFilter !== 'all' && n.status !== statusFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      n.subject.toLowerCase().includes(q) ||
      n.user?.email?.toLowerCase().includes(q) ||
      n.user?.full_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Notification Delivery Logs
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit transactional email dispatch, registration alerts, and event updates.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchNotifications}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh Logs
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by recipient or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs w-full sm:w-auto">
          {['all', 'sent', 'pending', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md font-medium capitalize cursor-pointer ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="border-slate-200 p-6 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </Card>
      ) : filtered.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Event Context</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{n.user?.full_name || 'User'}</div>
                      <div className="text-[11px] text-slate-400">{n.user?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{n.subject}</td>
                    <td className="py-3.5 px-4 text-slate-600">{n.event?.title || 'System Alert'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          n.status === 'sent'
                            ? 'success'
                            : n.status === 'failed'
                            ? 'destructive'
                            : 'warning'
                        }
                        className="uppercase text-[10px]"
                      >
                        {n.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500 font-medium">
                      {n.sent_at ? formatDateTime(n.sent_at) : formatDateTime(n.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<BellRing className="w-6 h-6" />}
          title="No notification records"
          description="Transactional messages will be logged here as users register and receive event reminders."
        />
      )}
    </div>
  )
}
