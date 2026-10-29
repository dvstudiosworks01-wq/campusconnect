import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Award,
  QrCode,
  ShieldCheck,
  ArrowRight,
  Users,
  MapPin,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, formatTime } from '@/lib/utils'
import type { EventItem } from '@/types/database.types'

export function LandingPage() {
  const navigate = useNavigate()
  const [activeEventsCount, setActiveEventsCount] = useState(0)
  const [featuredEvents, setFeaturedEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadLandingData() {
      if (!isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const now = new Date().toISOString()

        // Query only active events (published and not yet ended)
        const { data: events } = await supabase
          .from('events')
          .select('*, category:event_categories(name)')
          .eq('status', 'published')
          .gte('end_at', now)
          .order('start_at', { ascending: true })
          .limit(3)

        if (events) setFeaturedEvents(events as any)

        // Query active events count
        const { count: evCount } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published')
          .gte('end_at', now)

        setActiveEventsCount(evCount || 0)
      } catch (err) {
        console.error('Error loading landing data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadLandingData()
  }, [])

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section with KEC Provided Image at Background (Blue & Green gradient removed) */}
      <section className="relative overflow-hidden bg-white text-slate-900 pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200">
        {/* KEC Provided Image at Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <img
            src="/kec-hero-bg.png"
            alt="Kongu Engineering College Background"
            className="w-[500px] sm:w-[650px] lg:w-[750px] max-w-[92vw] object-contain opacity-25"
          />
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 shadow-sm">
            <img src="/kec-hero-bg.png" alt="KEC" className="w-4 h-4 object-contain inline-block" />
            <span>Kongu Engineering College, Perundurai</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight sm:leading-none">
            Empowering Campus Life with Next-Gen Event Coordination
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            The single unified college hub for hackathons, cultural festivals, sports leagues, time-limited QR attendance sessions, and tamper-proof digital certificates.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
            <Button
              size="lg"
              onClick={() => navigate('/events')}
              className="bg-primary-600 hover:bg-primary-700 text-white shadow-md font-semibold px-6 border-0"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Explore College Events
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/verify-certificate')}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm"
              leftIcon={<ShieldCheck className="w-4 h-4 text-primary-600" />}
            >
              Verify Certificate
            </Button>
          </div>
        </div>

        {/* Active Events counter */}
        <div className="max-w-xs mx-auto mt-12 px-2 relative z-10">
          <div className="bg-white/95 border border-slate-200 rounded-2xl p-5 text-center shadow-md backdrop-blur-sm">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              {activeEventsCount}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">
              Active Events
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <Badge variant="secondary" className="mb-2">
              Featured Programs
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Upcoming College Highlights
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Participate and register before deadlines close.
            </p>
          </div>
          <Link to="/events">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              View All Events
            </Button>
          </Link>
        </div>

        {featuredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredEvents.map((event) => (
              <Card
                key={event.id}
                className="overflow-hidden hover:shadow-card transition-shadow border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 w-full bg-slate-100 relative overflow-hidden">
                    {event.banner_url ? (
                      <img
                        src={event.banner_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-primary-900 to-primary-700 text-white">
                        <Calendar className="w-12 h-12 opacity-40" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge variant="default" className="bg-white/95 text-slate-900 shadow">
                        {event.category?.name || 'College Event'}
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge variant="info" className="shadow capitalize">
                        Individual
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="pt-5 space-y-3">
                    <h3 className="font-bold text-lg text-slate-900 line-clamp-1">{event.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {event.description}
                    </p>

                    <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {formatDate(event.start_at)} • {formatTime(event.start_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    View & Register
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-slate-700">Events Scheduled Soon</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Our organizers are preparing new competitions and symposiums. Check back shortly!
            </p>
          </div>
        )}
      </section>

      {/* Feature Pillar Highlights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3 shadow-subtle">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Cryptographic QR Attendance</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Organizers generate dynamic, time-limited QR sessions. Only registered participants can check in securely through token hash verification.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3 shadow-subtle">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Verifiable PDF Certificates</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every issued certificate bears a cryptographic certificate number and verification link, enabling employers and external institutions to validate credentials instantly.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3 shadow-subtle">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Atomic Clash & Capacity Checks</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Server-enforced interval collision detection ensures students never get double-booked, while atomic row locking prevents overbooking event seats.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
