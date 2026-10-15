import React from 'react'
import { Navigate, useLocation, Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types/database.types'
import { Button } from '@/components/ui/Button'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <p className="text-sm font-medium text-slate-500">Authenticating session...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role authorization
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            This module requires <span className="font-semibold capitalize">{allowedRoles.join(' or ')}</span> authorization.
            Your current assigned role is <span className="font-semibold capitalize text-primary-600">{role}</span>.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link to={role === 'admin' ? '/admin' : role === 'organizer' ? '/organizer' : '/student'}>
              <Button className="w-full" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Return to My Dashboard
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">
                Public Portal
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
