import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X, Bell, Shield } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/Badge'

export function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { profile, role, isConfigured } = useAuth()
  const location = useLocation()

  // Generate page heading from path
  const getPageTitle = () => {
    const parts = location.pathname.split('/').filter(Boolean)
    if (parts.length === 1) {
      if (parts[0] === 'student') return 'Student Dashboard'
      if (parts[0] === 'organizer') return 'Organizer Workspace'
      if (parts[0] === 'admin') return 'Administration Control Center'
      return 'Dashboard'
    }
    const lastPart = parts[parts.length - 1]
    return lastPart
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-sidebar focus:outline-none">
            <div className="absolute top-0 right-0 -mr-12 pt-4">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white focus:outline-none"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden -ml-2 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {!isConfigured && (
              <Badge variant="warning" className="hidden sm:inline-flex gap-1.5 py-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Supabase Demo Mode</span>
              </Badge>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>

            {/* User chip in header */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900">
                  {profile?.full_name || 'Logged In'}
                </div>
                <div className="text-[10px] text-slate-500 capitalize">{role} role</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
