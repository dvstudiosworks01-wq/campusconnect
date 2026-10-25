import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton, EmptyState } from '@/components/ui/Skeleton'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime } from '@/lib/utils'
import type { EventItem, EventCategory } from '@/types/database.types'

export function EventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventItem[]>([])
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all') // 'all' | 'upcoming' | 'ongoing' | 'completed'

  useEffect(() => {
    async function fetchEventsAndCategories() {
      if (!isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const [categoriesRes, eventsRes] = await Promise.all([
          supabase.from('event_categories').select('*').order('name'),
          supabase
            .from('events')
            .select(`
              *,
              category:event_categories(name),
              organizer:profiles!events_organizer_id_fkey(full_name, email)
            `)
            .in('status', ['published', 'completed'])
            .order('start_at', { ascending: true }),
        ])

        if (categoriesRes.data) {
          setCategories(categoriesRes.data as EventCategory[])
        }

        if (eventsRes.data) {
          // Fetch registration count for each event
          const eventsWithCounts = await Promise.all(
            eventsRes.data.map(async (ev) => {
              const { count } = await supabase
                .from('registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', ev.id)
                .eq('status', 'confirmed')
              return {
                ...ev,
                registration_count: count || 0,
              }
            })
          )
          setEvents(eventsWithCounts as any)
        }
      } catch (err) {
        console.error('Error loading events:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEventsAndCategories()
  }, [])

  const filteredEvents = useMemo(() => {
    const now = new Date().getTime()
    return events.filter((ev) => {
      // Category filter
      if (selectedCategoryId !== 'all' && ev.category_id !== selectedCategoryId) {
        return false
      }

      // Timing filter
      const startTime = new Date(ev.start_at).getTime()
      const endTime = new Date(ev.end_at).getTime()

      if (selectedStatus === 'upcoming' && (startTime <= now || ev.status === 'completed')) {
        return false
      }
      if (selectedStatus === 'ongoing' && (now < startTime || now > endTime)) {
        return false
      }
      if (selectedStatus === 'completed' && ev.status !== 'completed' && endTime >= now) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = ev.title.toLowerCase().includes(q)
        const matchesDesc = ev.description.toLowerCase().includes(q)
        const matchesVenue = ev.venue.toLowerCase().includes(q)
        return matchesTitle || matchesDesc || matchesVenue
      }

      return true
    })
  }, [events, selectedCategoryId, selectedStatus, searchQuery])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">College Events Directory</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Discover academic symposiums, tech competitions, sports matches, and cultural festivals hosted on campus.
        </p>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-subtle space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by event, keyword, or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
            >
              <option value="all">All Timelines</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Happening Now</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center justify-between sm:justify-end text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-900">{filteredEvents.length}</strong> events
            </span>
          </div>
        </div>

        {/* Categories Chip Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategoryId === cat.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const isCompleted = event.status === 'completed' || new Date(event.end_at).getTime() < Date.now()
            const isDeadlinePassed = new Date(event.registration_deadline).getTime() < Date.now()
            const regCount = event.registration_count || 0
            const capacityRatio = Math.min(100, Math.round((regCount / event.capacity) * 100))
            const isFull = regCount >= event.capacity

            return (
              <Card
                key={event.id}
                className="overflow-hidden hover:shadow-card transition-shadow border-slate-200 flex flex-col justify-between group"
              >
                <div>
                  {/* Banner */}
                  <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
                    {event.banner_url ? (
                      <img
                        src={event.banner_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-slate-900 to-primary-950 text-white">
                        <Calendar className="w-12 h-12 opacity-30" />
                      </div>
                    )}

                    <div className="absolute top-3 left-3">
                      <Badge variant="default" className="bg-white/95 text-slate-900 shadow">
                        {event.category?.name || 'College Event'}
                      </Badge>
                    </div>

                    <div className="absolute top-3 right-3 flex gap-1.5">
                      {isCompleted ? (
                        <Badge variant="secondary" className="shadow">
                          Completed
                        </Badge>
                      ) : isFull ? (
                        <Badge variant="destructive" className="shadow">
                          Full
                        </Badge>
                      ) : isDeadlinePassed ? (
                        <Badge variant="warning" className="shadow">
                          Closed
                        </Badge>
                      ) : (
                        <Badge variant="success" className="shadow">
                          Open
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardContent className="pt-5 space-y-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
                        {event.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {event.description}
                      </p>
                    </div>

                    {/* Schedule and venue meta */}
                    <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium">
                          {formatDate(event.start_at)} • {formatTime(event.start_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Individual Registration</span>
                      </div>
                    </div>

                    {/* Capacity Indicator Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] font-medium text-slate-500">
                        <span>Participants</span>
                        <span>
                          {regCount} / {event.capacity} seats
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            capacityRatio >= 90
                              ? 'bg-rose-500'
                              : capacityRatio >= 60
                              ? 'bg-amber-500'
                              : 'bg-primary-600'
                          }`}
                          style={{ width: `${capacityRatio}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => navigate(`/events/${event.id}`)}
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No events found"
          description="No events match your current filter criteria. Try resetting filters or search keywords."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategoryId('all')
                setSelectedStatus('all')
              }}
            >
              Reset All Filters
            </Button>
          }
        />
      )}
    </div>
  )
}
