import { NavLink, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Calendar,
  Award,
  Users,
  QrCode,
  FileCheck2,
  Settings,
  ShieldAlert,
  LogOut,
  PlusCircle,
  Trophy,
  History,
  FileText,
  BellRing,
  Layers,
  BarChart3,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onCloseMobile?: () => void
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const studentLinks = [
    { label: 'Overview', to: '/student', icon: BarChart3 },
    { label: 'My Registrations', to: '/student/registrations', icon: Calendar },
    { label: 'Attendance', to: '/student/attendance', icon: QrCode },
    { label: 'My Certificates', to: '/student/certificates', icon: Award },
    { label: 'Leaderboard', to: '/leaderboard', icon: Trophy },
    { label: 'My Profile', to: '/student/profile', icon: Settings },
  ]

  const organizerLinks = [
    { label: 'Overview', to: '/organizer', icon: BarChart3 },
    { label: 'My Events', to: '/organizer/events', icon: Calendar },
    { label: 'Create New Event', to: '/organizer/events/new', icon: PlusCircle },
    { label: 'QR Attendance Live', to: '/organizer/attendance', icon: QrCode },
    { label: 'Attendance Records', to: '/organizer/attendance-reports', icon: History },
    { label: 'Publish Results', to: '/organizer/results', icon: Trophy },
    { label: 'Issue Certificates', to: '/organizer/certificates', icon: FileCheck2 },
  ]

  const adminLinks = [
    { label: 'Admin Dashboard', to: '/admin', icon: BarChart3 },
    { label: 'Approval Queue', to: '/admin/approvals', icon: Calendar },
    { label: 'User & Roles', to: '/admin/users', icon: Users },
    { label: 'Categories & Rules', to: '/admin/categories', icon: Layers },
    { label: 'Certificate Audit', to: '/admin/certificates', icon: FileCheck2 },
    { label: 'Notification Logs', to: '/admin/notifications', icon: BellRing },
    { label: 'System Audit Logs', to: '/admin/audit-logs', icon: FileText },
  ]

  let currentNavLinks = studentLinks
  if (role === 'organizer') currentNavLinks = organizerLinks
  if (role === 'admin') currentNavLinks = adminLinks

  const roleBadgeVariants = {
    student: 'info',
    organizer: 'warning',
    admin: 'destructive',
  } as const

  return (
    <aside className="w-64 bg-sidebar text-slate-300 flex flex-col h-full border-r border-sidebar-border shadow-xl select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-sidebar-border bg-sidebar/50">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white shadow">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-bold text-white text-base tracking-tight leading-none">
            CampusConnect
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">
            Portal Engine
          </span>
        </div>
      </div>

      {/* User Information Pill */}
      <div className="p-4 mx-3 my-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-full bg-primary-950 border border-primary-600/40 text-primary-300 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{profile?.full_name?.charAt(0).toUpperCase() || 'U'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">
            {profile?.full_name || 'Authenticated User'}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge
              variant={roleBadgeVariants[role || 'student']}
              className="text-[10px] uppercase font-bold px-1.5 py-0"
            >
              {role || 'student'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation section */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {currentNavLinks.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/student' || item.to === '/organizer' || item.to === '/admin'}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          )
        })}

        {/* Public portal quick link */}
        <div className="pt-4 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Shortcuts
        </div>
        <NavLink
          to="/events"
          onClick={onCloseMobile}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60"
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span>Public Events</span>
        </NavLink>
        <NavLink
          to="/leaderboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60"
        >
          <Award className="w-4 h-4 shrink-0" />
          <span>Leaderboard</span>
        </NavLink>
      </div>

      {/* Footer / Sign Out */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar/50">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
