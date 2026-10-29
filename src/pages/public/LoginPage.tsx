import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { GraduationCap, ShieldCheck, AlertCircle, ArrowRight, Info } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export function LoginPage() {
  const { signInWithGoogle, user, role, isConfigured } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || (role === 'admin' ? '/admin' : role === 'organizer' ? '/organizer' : '/student')

  // If already logged in, redirect
  useEffect(() => {
    if (user && role) {
      navigate(from, { replace: true })
    }
  }, [user, role, navigate, from])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      await signInWithGoogle()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize Google authentication.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-500/25 mb-2">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to CampusConnect
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Access collegiate events, team registrations, live QR attendance sessions, and verified credentials.
          </p>
        </div>

        <Card className="border-slate-200 shadow-xl">
          <CardContent className="pt-6 space-y-5">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMsg}</div>
              </div>
            )}

            {!isConfigured && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Supabase Environment Pending</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Provide <code className="bg-amber-100 px-1 py-0.5 rounded text-slate-800 font-mono">VITE_SUPABASE_URL</code> and{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded text-slate-800 font-mono">VITE_SUPABASE_ANON_KEY</code> in{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded text-slate-800 font-mono">.env</code> to connect live authentication.
                </p>
              </div>
            )}

            {/* Official Google OAuth Action Button */}
            <Button
              variant="outline"
              size="lg"
              className="w-full flex items-center justify-center gap-3 h-12 bg-white hover:bg-slate-50 border-slate-300 text-slate-700 font-semibold shadow-sm text-sm"
              onClick={handleGoogleSignIn}
              isLoading={isLoading}
              disabled={!isConfigured}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            <div className="pt-2 border-t border-slate-100 text-left space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Role Policy:</strong> All Google sign-ins default to the{' '}
                  <span className="text-primary-700 font-semibold">Student</span> role. Elevated Organizer and
                  Admin privileges are granted solely by authorized college administrators.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-400">
          <Link to="/events" className="hover:text-primary-600 transition-colors inline-flex items-center gap-1">
            <span>Browse open college events without signing in</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
