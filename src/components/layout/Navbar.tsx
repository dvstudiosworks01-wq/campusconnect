import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Award, Calendar, LogIn, LayoutDashboard, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

export function Navbar() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

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
              College Events Portal
            </span>
          </div>
        </Link>

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
            className="hover:text-primary-600 transition-colors"
          >
            Verify Certificate
          </Link>
        </nav>

        <div className="flex items-center gap-3">
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
      </div>
    </header>
  )
}
