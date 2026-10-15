import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Send, AlertCircle, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventCategory } from '@/types/database.types'

export function EditEventPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<EventCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    venue: '',
    start_at: '',
    end_at: '',
    registration_deadline: '',
    capacity: 100,
    registration_type: 'individual' as 'individual' | 'team',
    team_min_size: 1,
    team_max_size: 1,
    banner_url: '',
    status: 'draft',
  })

  // Format UTC timestamptz to format suitable for <input type="datetime-local" />
  const formatForInput = (isoString?: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    const offset = d.getTimezoneOffset() * 60000
    const local = new Date(d.getTime() - offset)
    return local.toISOString().slice(0, 16)
  }

  useEffect(() => {
    async function loadEvent() {
      if (!id || !isSupabaseConfigured) {
        setIsLoading(false)
        return
      }

      try {
        const [catsRes, eventRes] = await Promise.all([
          supabase.from('event_categories').select('*').order('name'),
          supabase.from('events').select('*').eq('id', id).single(),
        ])

        if (catsRes.data) setCategories(catsRes.data)

        if (eventRes.data) {
          const ev = eventRes.data
          setFormData({
            title: ev.title,
            description: ev.description,
            category_id: ev.category_id,
            venue: ev.venue,
            start_at: formatForInput(ev.start_at),
            end_at: formatForInput(ev.end_at),
            registration_deadline: formatForInput(ev.registration_deadline),
            capacity: ev.capacity,
            registration_type: ev.registration_type,
            team_min_size: ev.team_min_size,
            team_max_size: ev.team_max_size,
            banner_url: ev.banner_url || '',
            status: ev.status,
          })
        }
      } catch (err) {
        console.error('Error loading event:', err)
        toast({ type: 'error', title: 'Failed to load event' })
      } finally {
        setIsLoading(false)
      }
    }

    loadEvent()
  }, [id])

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleUpdate = async (nextStatus?: string) => {
    if (!user || !id) return

    setIsSubmitting(true)
    try {
      const payload: any = {
        title: formData.title,
        description: formData.description,
        category_id: formData.category_id,
        venue: formData.venue,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: new Date(formData.end_at).toISOString(),
        registration_deadline: new Date(formData.registration_deadline).toISOString(),
        capacity: formData.capacity,
        banner_url: formData.banner_url || null,
        updated_at: new Date().toISOString(),
      }

      if (nextStatus) {
        payload.status = nextStatus
      }

      const { error } = await supabase.from('events').update(payload).eq('id', id)
      if (error) throw error

      toast({
        type: 'success',
        title: 'Event Updated',
        message: 'Changes saved successfully.',
      })

      navigate('/organizer/events')
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update event details.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left">
      <div>
        <Link
          to="/organizer/events"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Events Management
        </Link>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Event</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Current Status: <strong className="uppercase text-primary-700">{formData.status}</strong>
        </p>
      </div>

      <Card className="border-slate-200 shadow-card">
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Event Title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => handleChange('category_id', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            label="Description & Agenda"
            rows={4}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Venue"
              value={formData.venue}
              onChange={(e) => handleChange('venue', e.target.value)}
              required
            />

            <Input
              label="Maximum Capacity"
              type="number"
              min={1}
              value={formData.capacity}
              onChange={(e) => handleChange('capacity', e.target.value)}
              required
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Schedule & Deadlines
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Start Time"
                type="datetime-local"
                value={formData.start_at}
                onChange={(e) => handleChange('start_at', e.target.value)}
                required
              />
              <Input
                label="End Time"
                type="datetime-local"
                value={formData.end_at}
                onChange={(e) => handleChange('end_at', e.target.value)}
                required
              />
              <Input
                label="Deadline"
                type="datetime-local"
                value={formData.registration_deadline}
                onChange={(e) => handleChange('registration_deadline', e.target.value)}
                required
              />
            </div>
          </div>

          <Input
            label="Banner URL"
            value={formData.banner_url}
            onChange={(e) => handleChange('banner_url', e.target.value)}
          />

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              isLoading={isSubmitting}
              onClick={() => handleUpdate()}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>

            {formData.status === 'draft' && (
              <Button
                type="button"
                isLoading={isSubmitting}
                onClick={() => handleUpdate('pending')}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Submit for Approval
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
