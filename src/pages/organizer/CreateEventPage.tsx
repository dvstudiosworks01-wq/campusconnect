import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Save, Send, Image, AlertCircle } from 'lucide-react'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventCategory } from '@/types/database.types'

const eventFormSchema = z
  .object({
    title: z.string().min(3, 'Event title must be at least 3 characters'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    category_id: z.string().min(1, 'Please select an event category'),
    venue: z.string().min(2, 'Venue location is required'),
    start_at: z.string().min(1, 'Start date and time is required'),
    end_at: z.string().optional().or(z.literal('')),
    registration_deadline: z.string().min(1, 'Registration deadline is required'),
    capacity: z.coerce.number().int().positive('Capacity must be at least 1'),
    registration_type: z.literal('individual').default('individual'),
    team_min_size: z.coerce.number().int().default(1),
    team_max_size: z.coerce.number().int().default(1),
    banner_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  })
  .refine(
    (data) =>
      !data.end_at ||
      new Date(data.start_at).getTime() < new Date(data.end_at).getTime(),
    {
      message: 'End date and time must be after the start date and time',
      path: ['end_at'],
    }
  )
  .refine(
    (data) =>
      new Date(data.registration_deadline).getTime() <= new Date(data.start_at).getTime(),
    {
      message: 'Registration deadline must be before or equal to event start time',
      path: ['registration_deadline'],
    }
  )

export function CreateEventPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<EventCategory[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form fields
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    venue: '',
    start_at: '',
    end_at: '',
    registration_deadline: '',
    capacity: 100,
    registration_type: 'individual' as const,
    team_min_size: 1,
    team_max_size: 1,
    banner_url: '',
  })

  useEffect(() => {
    async function loadCategories() {
      if (!isSupabaseConfigured) return
      const { data } = await supabase.from('event_categories').select('*').order('name')
      if (data && data.length > 0) {
        setCategories(data)
        setFormData((prev) => ({ ...prev, category_id: data[0].id }))
      }
    }
    loadCategories()
  }, [])

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSubmit = async (submitStatus: 'draft' | 'pending') => {
    if (!user) return

    setErrors({})
    const result = eventFormSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message
        }
      })
      setErrors(fieldErrors)
      toast({ type: 'warning', title: 'Please fix validation errors' })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        organizer_id: user.id,
        title: result.data.title,
        description: result.data.description,
        category_id: result.data.category_id,
        venue: result.data.venue,
        start_at: new Date(result.data.start_at).toISOString(),
        end_at: result.data.end_at
          ? new Date(result.data.end_at).toISOString()
          : new Date(new Date(result.data.start_at).getTime() + 3 * 60 * 60 * 1000).toISOString(),
        registration_deadline: new Date(result.data.registration_deadline).toISOString(),
        capacity: result.data.capacity,
        registration_type: 'individual',
        team_min_size: 1,
        team_max_size: 1,
        status: submitStatus,
        banner_url: result.data.banner_url || null,
      }

      const { data, error } = await supabase.from('events').insert(payload).select().single()

      if (error) throw error

      toast({
        type: 'success',
        title: submitStatus === 'pending' ? 'Submitted for Approval' : 'Event Draft Saved',
        message: `"${result.data.title}" was created successfully.`,
      })

      navigate('/organizer/events')
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Event Creation Failed',
        message: err.message || 'Could not save event record.',
      })
    } finally {
      setIsSubmitting(false)
    }
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
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create College Event</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Define event schedule, registration capacity, rules, and choose whether to publish for admin
          review.
        </p>
      </div>

      <Card className="border-slate-200 shadow-card">
        <CardContent className="pt-6 space-y-6">
          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Event Title"
                placeholder="e.g. Kongu Annual Hackathon 2026"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                error={errors.title}
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
                {categories.length === 0 && (
                  <option value="">Loading categories...</option>
                )}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="text-xs text-red-600 font-medium">{errors.category_id}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <Textarea
            label="Detailed Description & Agenda"
            placeholder="Outline competition themes, requirements, judge criteria, prizes, or guest speaker info..."
            rows={4}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            error={errors.description}
            required
          />

          {/* Venue & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Venue / Campus Hall"
              placeholder="e.g. Tech Auditorium B-Block or Main Sports Complex"
              value={formData.venue}
              onChange={(e) => handleChange('venue', e.target.value)}
              error={errors.venue}
              required
            />

            <Input
              label="Maximum Capacity (Seats)"
              type="number"
              min={1}
              value={formData.capacity}
              onChange={(e) => handleChange('capacity', e.target.value)}
              error={errors.capacity}
              helperText="Strict atomic limit prevents overbooking on the server"
              required
            />
          </div>

          {/* Schedule Datetimes */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Schedule & Deadlines
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Start Date & Time"
                type="datetime-local"
                value={formData.start_at}
                onChange={(e) => handleChange('start_at', e.target.value)}
                error={errors.start_at}
                required
              />

              <Input
                label="End Date & Time (Optional)"
                type="datetime-local"
                value={formData.end_at}
                onChange={(e) => handleChange('end_at', e.target.value)}
                error={errors.end_at}
                helperText="Optional — leave blank if duration is flexible"
              />

              <Input
                label="Registration Deadline"
                type="datetime-local"
                value={formData.registration_deadline}
                onChange={(e) => handleChange('registration_deadline', e.target.value)}
                error={errors.registration_deadline}
                helperText="Must be <= Start Time"
                required
              />
            </div>
          </div>

          {/* Banner URL */}
          <Input
            label="Banner Image URL (Optional)"
            placeholder="https://images.unsplash.com/photo-..."
            value={formData.banner_url}
            onChange={(e) => handleChange('banner_url', e.target.value)}
            error={errors.banner_url}
            helperText="Provide a landscape photo URL or Supabase storage image link"
          />

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleSubmit('draft')}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              isLoading={isSubmitting}
              onClick={() => handleSubmit('pending')}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit for Admin Approval
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
