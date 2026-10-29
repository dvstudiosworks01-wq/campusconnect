import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Calendar,
  LogIn,
  LayoutDashboard,
  User,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

export function Navbar() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const getDashboardPath = () => {
    if (!profile) return '/student'
    if (profile.role === 'admin') return '/admin'
    if (profile.role === 'organizer') return '/organizer'
    return '/student'
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md shadow-primary-500/20 group-hover:bg-primary-700 transition-colors">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-lg text-slate-900 tracking-tight leading-tight">
              CampusConnect
            </span>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Kongu Events Portal
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link
            to="/events"
            className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Events
          </Link>
          <Link
            to="/verify-certificate"
            className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Certificate
          </Link>
        </nav>

        {/* Desktop User / Auth Button */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<LayoutDashboard className="w-4 h-4" />}
                onClick={() => navigate(getDashboardPath())}
              >
                Dashboard
              </Button>
              <Link
                to="/student/profile"
                className="flex items-center gap-2 pl-2 border-l border-slate-200 hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
              </Link>
            </div>
          ) : (
            <Button
              size="sm"
              leftIcon={<LogIn className="w-4 h-4" />}
              onClick={() => navigate('/login')}
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs px-2.5 h-8"
              onClick={() => navigate(getDashboardPath())}
            >
              Dashboard
            </Button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/98 px-4 pt-3 pb-5 space-y-3 shadow-lg animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
            <Link
              to="/events"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors"
            >
              <Calendar className="w-4 h-4 text-primary-600" />
              <span>Events Directory</span>
            </Link>
            <Link
              to="/verify-certificate"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verify Certificate</span>
            </Link>
            {user ? (
              <Link
                to="/student/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors"
              >
                <User className="w-4 h-4 text-slate-600" />
                <span>My Profile ({profile?.full_name || 'Account'})</span>
              </Link>
            ) : null}
          </nav>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <Button
                size="sm"
                className="w-full"
                leftIcon={<LayoutDashboard className="w-4 h-4" />}
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate(getDashboardPath())
                }}
              >
                Open Dashboard
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full"
                leftIcon={<LogIn className="w-4 h-4" />}
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate('/login')
                }}
              >
                Sign In to Portal
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
