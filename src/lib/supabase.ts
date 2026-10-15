import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
)

if (!isSupabaseConfigured) {
  console.warn(
    '[CampusConnect] Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not fully configured. Please set them in your .env file.'
  )
}

// Fallback dummy URL and anon key so client initializes cleanly without throwing at import time
const safeUrl = isSupabaseConfigured ? supabaseUrl : 'https://dummy.supabase.co'
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'dummy-anon-key'

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
