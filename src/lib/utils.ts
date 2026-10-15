import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A'
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A'
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A'
  try {
    const d = new Date(dateString)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

/**
 * Check if two time intervals overlap.
 * Conflict rule: new_start < existing_end AND new_end > existing_start
 */
export function hasTimeConflict(
  newStart: string | Date,
  newEnd: string | Date,
  existingStart: string | Date,
  existingEnd: string | Date
): boolean {
  const nStart = new Date(newStart).getTime()
  const nEnd = new Date(newEnd).getTime()
  const eStart = new Date(existingStart).getTime()
  const eEnd = new Date(existingEnd).getTime()

  return nStart < eEnd && nEnd > eStart
}

/**
 * Generate a random 6-character alphanumeric invite code for teams
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
