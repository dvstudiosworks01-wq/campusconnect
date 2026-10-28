import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/database.types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  isLoading: boolean
  isConfigured: boolean
  isAccountDeleted: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfileDetails: (data: Partial<Profile>) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isAccountDeleted, setIsAccountDeleted] = useState<boolean>(false)

  const fetchProfile = useCallback(async (userId: string, userMeta?: any, userEmail?: string) => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return null
    }

    try {
      // 1. Verify user exists in Supabase Auth by checking live auth status
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        console.warn('[CampusConnect] User is not recognized by Supabase Auth (likely deleted):', userError)
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
        setIsAccountDeleted(true)
        return null
      }

      // 2. Fetch profile from database
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // Profile row does not exist yet; handle automatic creation as fallback
        const fullName =
          userMeta?.full_name ||
          userMeta?.name ||
          (userEmail ? userEmail.split('@')[0] : 'Campus Student')
        const avatarUrl = userMeta?.avatar_url || userMeta?.picture || null

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: fullName,
            email: userEmail || '',
            avatar_url: avatarUrl,
            role: 'student', // Strict student default
          })
          .select()
          .single()

        if (!insertError && newProfile) {
          setProfile(newProfile as Profile)
          setIsAccountDeleted(false)
          return newProfile as Profile
        } else {
          // If insert fails, user was deleted or restricted
          console.warn('[CampusConnect] Profile insertion failed (account likely deregistered):', insertError)
          await supabase.auth.signOut()
          setUser(null)
          setSession(null)
          setProfile(null)
          setIsAccountDeleted(true)
          return null
        }
      } else if (data) {
        const fullProfile = {
          ...data,
          roll_number: userMeta?.roll_number || (data as any).roll_number || null,
          designation: userMeta?.designation || (data as any).designation || null,
          phone: userMeta?.phone || (data as any).phone || null,
        }
        setProfile(fullProfile as Profile)
        setIsAccountDeleted(false)
        return fullProfile as Profile
      } else {
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
        setIsAccountDeleted(true)
        return null
      }
    } catch (err) {
      console.error('[CampusConnect] Error loading user profile:', err)
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setProfile(null)
      setIsAccountDeleted(true)
    }
    return null
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user.user_metadata, user.email)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.user_metadata, session.user.email).finally(() => {
          setIsLoading(false)
        })
      } else {
        setIsLoading(false)
      }
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.user_metadata, session.user.email)
      } else {
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      alert(
        'Supabase is not configured yet. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      )
      return
    }

    const redirectUrl = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('[CampusConnect] Google OAuth Error:', error.message)
      throw error
    }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[CampusConnect] Sign out error:', error.message)
    }
    setUser(null)
    setSession(null)
    setProfile(null)
    setIsAccountDeleted(false)
  }

  const updateProfileDetails = async (data: Partial<Profile>): Promise<boolean> => {
    if (!user || !profile) return false
    try {
      // Prevent client-side role tampering: exclude 'role' from self-update
      const { role, id, created_at, roll_number, phone, ...allowedUpdates } = data as any

      const { error } = await supabase
        .from('profiles')
        .update(allowedUpdates)
        .eq('id', user.id)

      if (error) {
        console.error('[CampusConnect] Profile update error:', error.message)
        return false
      }

      // Store roll_number, phone & designation in auth metadata
      if (roll_number !== undefined || phone !== undefined || (data as any).designation !== undefined) {
        await supabase.auth.updateUser({
          data: {
            ...(roll_number !== undefined ? { roll_number } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...((data as any).designation !== undefined ? { designation: (data as any).designation } : {}),
            department: allowedUpdates.department,
            year_of_study: allowedUpdates.year_of_study,
          },
        })
      }

      await refreshProfile()
      return true
    } catch (err) {
      console.error('[CampusConnect] Profile update exception:', err)
      return false
    }
  }

  const role: UserRole | null = profile?.role ?? null

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isConfigured: isSupabaseConfigured,
        isAccountDeleted,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfileDetails,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
