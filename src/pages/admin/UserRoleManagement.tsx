import { useEffect, useState } from 'react'
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Check,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/database.types'

export function UserRoleManagement() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Role modification modal state
  const [targetUser, setTargetUser] = useState<Profile | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchUsers = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProfiles(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      toast({ type: 'error', title: 'Failed to load user directory' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleOpenRoleModal = (profile: Profile) => {
    setTargetUser(profile)
    setSelectedRole(profile.role)
  }

  const handleRoleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUser || !user) return

    if (targetUser.id === user.id && selectedRole !== 'admin') {
      toast({
        type: 'warning',
        title: 'Operation Denied',
        message: 'You cannot revoke your own administrator privileges.',
      })
      return
    }

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: selectedRole })
        .eq('id', targetUser.id)

      if (error) throw error

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'ROLE_CHANGE',
        entity_type: 'profile',
        entity_id: targetUser.id,
        details: {
          target_user_name: targetUser.full_name,
          target_user_email: targetUser.email,
          previous_role: targetUser.role,
          new_role: selectedRole,
        },
      })

      toast({
        type: 'success',
        title: 'User Role Updated',
        message: `${targetUser.full_name} is now assigned as "${selectedRole}".`,
      })

      setTargetUser(null)
      await fetchUsers()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Role Update Failed',
        message: err.message || 'Could not update user role.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q)
    )
  })

  const roleVariants: Record<string, 'default' | 'secondary' | 'warning' | 'destructive' | 'info'> = {
    student: 'info',
    organizer: 'warning',
    admin: 'destructive',
  }

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Campus User & Role Governance
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Assign elevated Event Organizer or Administrative permissions to faculty and authorized leaders.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs w-full sm:w-auto">
          {['all', 'student', 'organizer', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-md font-medium capitalize cursor-pointer ${
                roleFilter === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r} ({r === 'all' ? profiles.length : profiles.filter((p) => p.role === r).length})
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <Card className="border-slate-200 p-6 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </Card>
      ) : filteredProfiles.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Department & Year</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Enrolled Date</th>
                  <th className="py-3 px-4 text-right">Access Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{p.full_name?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{p.full_name}</div>
                          <div className="text-slate-400 text-[11px]">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{p.department || 'General'}</div>
                      <div className="text-slate-400 text-[11px]">
                        {p.year_of_study ? `Year ${p.year_of_study}` : '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={roleVariants[p.role]} className="uppercase text-[10px] font-bold">
                        {p.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => handleOpenRoleModal(p)}
                        leftIcon={<Shield className="w-3.5 h-3.5 text-primary-600" />}
                      >
                        Change Role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No users match query"
          description="Try clearing the search query or changing role filters."
        />
      )}

      {/* CHANGE ROLE MODAL */}
      <Modal
        isOpen={Boolean(targetUser)}
        onClose={() => setTargetUser(null)}
        title="Administrative Role Assignment"
        description={`Modify system privileges for ${targetUser?.full_name} (${targetUser?.email}).`}
      >
        <form onSubmit={handleRoleUpdateSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-sm font-medium text-slate-700">Assign Privilege Level</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-semibold"
            >
              <option value="student">Student (Standard participant access)</option>
              <option value="organizer">Event Organizer (Create events, QR attendance, results)</option>
              <option value="admin">Administrator (Full control, approvals, audits)</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <strong>Security Audit Note:</strong> This role modification will be permanently logged in the
            college audit trail with your administrator signature.
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setTargetUser(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isUpdating}>
              Confirm Privilege Change
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
