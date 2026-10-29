import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Calendar,
  Megaphone,
  AlertCircle,
  Info,
  CheckCheck,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/utils'

export function NotificationBellDropdown() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Local storage key for tracking read notifications safely
  const storageKey = user ? `campusconnect_read_notifs_${user.id}` : ''

  // Load saved read IDs from localStorage
  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setReadIds(new Set(JSON.parse(saved)))
      }
    } catch {
      // Ignore local storage error
    }
  }, [storageKey])

  // Fetch user's notifications
  const fetchNotifications = async () => {
    if (!user || !isSupabaseConfigured) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          event_id,
          type,
          subject,
          body,
          status,
          created_at,
          event:events(id, title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Failed to load user notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  // Real-time subscription for live notifications
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return

    const channel = supabase
      .channel(`public:notifications:user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Mark all as read
  const handleMarkAllRead = () => {
    const allIds = new Set([...readIds, ...notifications.map((n) => n.id)])
    setReadIds(allIds)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(allIds)))
      } catch {
        // Ignore local storage error
      }
    }
  }

  // Mark single notification read
  const markAsRead = (id: string) => {
    if (readIds.has(id)) return
    const updated = new Set(readIds).add(id)
    setReadIds(updated)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)))
      } catch {
        // Ignore local storage error
      }
    }
  }

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'event_announcement':
        return <Calendar className="w-4 h-4 text-blue-600" />
      case 'event_update':
        return <AlertCircle className="w-4 h-4 text-amber-600" />
      case 'campus_broadcast':
        return <Megaphone className="w-4 h-4 text-emerald-600" />
      default:
        return <Info className="w-4 h-4 text-slate-600" />
    }
  }

  const getBadgeLabel = (type: string) => {
    switch (type) {
      case 'event_announcement':
        return 'New Event'
      case 'event_update':
        return 'Event Update'
      case 'campus_broadcast':
        return 'Campus Notice'
      default:
        return 'Notice'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) fetchNotifications()
        }}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden text-left animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => {
                const isUnread = !readIds.has(notif.id)
                return (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-50 ${
                      isUnread ? 'bg-blue-50/40' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        {getNotificationIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {getBadgeLabel(notif.type)}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatRelativeTime(notif.created_at)}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-900 leading-snug">
                          {notif.subject}
                        </div>

                        {notif.body && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {notif.body}
                          </p>
                        )}

                        {notif.event_id && (
                          <div className="pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setIsOpen(false)
                                navigate(`/events/${notif.event_id}`)
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                            >
                              <span>View Event Details</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary-600 shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-700">No Notifications Yet</div>
                <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto">
                  Event announcements, room changes, and important college updates will show up here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
