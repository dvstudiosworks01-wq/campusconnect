import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://tbnoknbjetskyslsuskq.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibm9rbmJqZXRza3lzbHN1c2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzc2NTYsImV4cCI6MjEwNzY1MzY1Nn0.S33rejrAqXnl41QzRwoRYsoZKaq11IuSwUdTayaKZhw'

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
