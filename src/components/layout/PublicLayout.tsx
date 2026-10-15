import { Outlet, Link } from 'react-router-dom'
import { GraduationCap, ShieldCheck, Mail, MapPin } from 'lucide-react'
import { Navbar } from './Navbar'

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="font-bold text-base text-slate-900">CampusConnect</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Official centralized event management, team coordination, QR attendance, and verified
              certificate issuance portal for college students and faculty.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link to="/events" className="hover:text-primary-600 transition-colors">
                  Upcoming Events
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" className="hover:text-primary-600 transition-colors">
                  Campus Leaderboard
                </Link>
              </li>
              <li>
                <Link to="/verify-certificate" className="hover:text-primary-600 transition-colors">
                  Public Certificate Verification
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">
              Portals
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link to="/student" className="hover:text-primary-600 transition-colors">
                  Student Dashboard
                </Link>
              </li>
              <li>
                <Link to="/organizer" className="hover:text-primary-600 transition-colors">
                  Organizer Dashboard
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-primary-600 transition-colors">
                  Administration Office
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">
              College Campus
            </h4>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Apex Institute of Technology, Main Campus</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>events@apexcollege.edu</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-medium pt-1">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>SSL Encrypted & RLS Secured</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
          <p>© {new Date().getFullYear()} CampusConnect. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">College Event Management Portal</p>
        </div>
      </footer>
    </div>
  )
}
