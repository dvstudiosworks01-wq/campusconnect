import { useState, useEffect } from 'react'
import { GraduationCap, Building2, User, Phone, Hash, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

const KEC_DEPARTMENTS = [
  'Artificial Intelligence & Data Science',
  'Artificial Intelligence & Machine Learning',
  'Computer Science & Engineering',
  'Computer Science & Design',
  'Information Technology',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Mechatronics Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Food Technology',
  'Management Studies (MBA)',
  'Computer Applications (MCA)',
]

export function OnboardingModal() {
  const { user, profile, updateProfileDetails, isLoading } = useAuth()
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [department, setDepartment] = useState(KEC_DEPARTMENTS[0])
  const [yearOfStudy, setYearOfStudy] = useState('1')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if current user is missing necessary details
  useEffect(() => {
    if (!isLoading && user && profile) {
      const isMissingDetails = !profile.department || !profile.year_of_study
      if (isMissingDetails) {
        setFullName(profile.full_name || user.user_metadata?.full_name || '')
        setRollNumber(user.user_metadata?.roll_number || '')
        setPhone(user.user_metadata?.phone || '')
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
    } else {
      setIsOpen(false)
    }
  }, [user, profile, isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!fullName.trim()) {
      setErrorMsg('Full name is required.')
      return
    }

    if (!rollNumber.trim()) {
      setErrorMsg('Roll / Register number is required for college records.')
      return
    }

    if (!department) {
      setErrorMsg('Please select your department.')
      return
    }

    setIsSubmitting(true)
    try {
      const success = await updateProfileDetails({
        full_name: fullName.trim(),
        department: department.trim(),
        year_of_study: parseInt(yearOfStudy, 10),
        roll_number: rollNumber.trim().toUpperCase(),
        phone: phone.trim(),
      })

      if (success) {
        toast({
          type: 'success',
          title: 'Profile Completed!',
          message: 'Welcome to Kongu Engineering College CampusConnect.',
        })
        setIsOpen(false)
      } else {
        setErrorMsg('Failed to save profile. Please try again.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving your details.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // Prevent dismissal until required details are provided
        toast({
          type: 'warning',
          title: 'Details Required',
          message: 'Please complete your academic profile to continue.',
        })
      }}
      title="Complete Your Student Profile"
      description="Welcome to Kongu Engineering College CampusConnect! Please set up your academic profile to enable event registrations, QR attendance, and verified credentials."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-left">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Full Name */}
        <Input
          label="Full Name"
          placeholder="e.g. Dhanavenkat N K"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        {/* Institutional Email (Read-Only) */}
        <div className="space-y-1.5 text-left">
          <label className="block text-sm font-medium text-slate-700">Account Email</label>
          <input
            type="text"
            readOnly
            value={profile?.email || user?.email || ''}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed select-all"
          />
        </div>

        {/* Roll / Register Number & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Roll / Register Number"
            placeholder="e.g. 25ECR038"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
            helperText="e.g. 23CS045 or 25ECR038"
            required
          />

          <Input
            label="Mobile Number (Optional)"
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            helperText="For event SMS/updates"
          />
        </div>

        {/* Department */}
        <div className="space-y-1.5 text-left">
          <label className="block text-sm font-medium text-slate-700">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            required
          >
            {KEC_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Year of Study */}
        <div className="space-y-1.5 text-left">
          <label className="block text-sm font-medium text-slate-700">Year of Study</label>
          <select
            value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            required
          >
            <option value="1">1st Year (Freshman)</option>
            <option value="2">2nd Year (Sophomore)</option>
            <option value="3">3rd Year (Junior)</option>
            <option value="4">4th Year (Senior)</option>
            <option value="5">Postgraduate (PG / M.E / MBA)</option>
          </select>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto" leftIcon={<Check className="w-4 h-4" />}>
            Save & Continue to Portal
          </Button>
        </div>
      </form>
    </Modal>
  )
}
