import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Process Supabase auth hash fragment or query code
    const handleAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (session?.user) {
          // Fetch user role from public.profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          const role = profile?.role || 'student'

          if (role === 'admin') {
            navigate('/admin', { replace: true })
          } else if (role === 'organizer') {
            navigate('/organizer', { replace: true })
          } else {
            navigate('/student', { replace: true })
          }
        } else {
          // Listen once for auth state change if session is still processing
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (newSession?.user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', newSession.user.id)
                .single()

              const role = profile?.role || 'student'
              subscription.unsubscribe()
              if (role === 'admin') navigate('/admin', { replace: true })
              else if (role === 'organizer') navigate('/organizer', { replace: true })
              else navigate('/student', { replace: true })
            }
          })
        }
      } catch (err: any) {
        console.error('Auth callback failure:', err)
        setError(err.message || 'Authentication exchange failed.')
      }
    }

    handleAuth()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-red-200 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Sign-in Verification Error</h2>
          <p className="text-sm text-slate-600">{error}</p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Back to Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      <div className="text-center">
        <h3 className="text-base font-semibold text-slate-800">Finalizing Campus Authentication</h3>
        <p className="text-xs text-slate-500 mt-1">
          Synchronizing institutional credentials and routing to your role dashboard...
        </p>
      </div>
    </div>
  )
}
