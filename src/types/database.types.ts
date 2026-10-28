export type UserRole = 'student' | 'organizer' | 'admin'

export type EventStatus = 
  | 'draft' 
  | 'pending' 
  | 'published' 
  | 'rejected' 
  | 'cancelled' 
  | 'completed'

export type RegistrationType = 'individual' | 'team'

export type RegistrationStatus = 'confirmed' | 'cancelled' | 'waitlist'

export type TeamStatus = 'forming' | 'completed' | 'disbanded'

export type AttendanceMethod = 'qr' | 'manual'

export type CertificateType = 'participation' | 'winner' | 'runner_up' | 'merit' | 'organizer'

export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  department: string | null
  year_of_study: number | null
  roll_number?: string | null
  phone?: string | null
  role: UserRole
  created_at: string
}

export interface EventCategory {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface EventItem {
  id: string
  organizer_id: string
  title: string
  description: string
  category_id: string
  venue: string
  start_at: string
  end_at?: string | null
  registration_deadline: string
  capacity: number
  registration_type: RegistrationType
  team_min_size: number
  team_max_size: number
  status: EventStatus
  banner_url?: string | null
  created_at: string
  // Joins
  category?: EventCategory
  organizer?: Profile
  registration_count?: number
}

export interface Team {
  id: string
  event_id: string
  team_name: string
  leader_id: string
  invite_code_hash: string
  invite_code?: string // only returned when leader creates it or views it
  status: TeamStatus
  created_at: string
  // Joins
  event?: EventItem
  leader?: Profile
  members?: Registration[]
  member_count?: number
}

export interface Registration {
  id: string
  event_id: string
  student_id: string
  team_id: string | null
  status: RegistrationStatus
  registered_at: string
  // Joins
  event?: EventItem
  student?: Profile
  team?: Team
}

export interface Attendance {
  id: string
  event_id: string
  student_id: string
  registration_id: string
  checked_in_at: string
  checked_in_by: string | null
  method: AttendanceMethod
  // Joins
  student?: Profile
  event?: EventItem
}

export interface EventQRSession {
  id: string
  event_id: string
  token_hash: string
  valid_from: string
  expires_at: string
  revoked_at: string | null
  created_at: string
  // Joins
  event?: EventItem
}

export interface ResultItem {
  id: string
  event_id: string
  student_id: string | null
  team_id: string | null
  rank: number
  score: number | null
  points_awarded: number
  created_at: string
  // Joins
  event?: EventItem
  student?: Profile
  team?: Team
}

export interface CertificateItem {
  id: string
  event_id: string
  student_id: string
  certificate_number: string
  certificate_type: CertificateType
  storage_path: string
  issued_at: string
  revoked_at: string | null
  // Joins
  event?: EventItem
  student?: Profile
}

export interface NotificationItem {
  id: string
  user_id: string
  event_id: string | null
  type: string
  subject: string
  body?: string
  status: NotificationStatus
  sent_at: string | null
  created_at: string
  // Joins
  event?: EventItem
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details?: Record<string, any>
  created_at: string
  // Joins
  actor?: Profile
}

export interface LeaderboardRule {
  id: string
  rank: number // 1, 2, 3 or 0 for participation
  points: number
  description: string
  is_active: boolean
}

export interface LeaderboardEntry {
  student_id: string
  student: Profile
  total_points: number
  events_participated: number
  wins_count: number
  runner_up_count: number
  rank: number
}

export interface TeamLeaderboardEntry {
  team_id: string
  team_name: string
  total_points: number
  events_count: number
  wins_count: number
  rank: number
}
