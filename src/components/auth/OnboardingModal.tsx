import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Building2, User, Phone, Hash, Check, ShieldCheck, Briefcase } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

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

const FACULTY_DESIGNATIONS = [
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'Head of Department (HOD)',
  'Faculty Coordinator',
  'Lab Instructor',
  'Non-Teaching Staff',
]

export function OnboardingModal() {
  const navigate = useNavigate()
  const { user, profile, isAccountDeleted, updateProfileDetails, refreshProfile, isLoading } = useAuth()
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [userType, setUserType] = useState<'student' | 'faculty'>('student')
  const [fullName, setFullName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [staffId, setStaffId] = useState('')
  const [designation, setDesignation] = useState(FACULTY_DESIGNATIONS[0])
  const [department, setDepartment] = useState(KEC_DEPARTMENTS[0])
  const [yearOfStudy, setYearOfStudy] = useState('1')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if current user is missing necessary details
  useEffect(() => {
    if (!isLoading && user && profile && !isAccountDeleted) {
      const isStaffOrAdmin = profile.role === 'organizer' || profile.role === 'admin'
      const isMissingDetails = isStaffOrAdmin
        ? !profile.department
        : !profile.department || (!profile.year_of_study && !user.user_metadata?.staff_id)

      if (isMissingDetails) {
        setFullName(profile.full_name || user.user_metadata?.full_name || '')
        setPhone(profile.phone || user.user_metadata?.phone || '')
        if (profile.department) setDepartment(profile.department)

        if (isStaffOrAdmin || user.user_metadata?.user_type === 'faculty' || user.user_metadata?.staff_id) {
          setUserType('faculty')
          setStaffId(profile.roll_number || user.user_metadata?.staff_id || '')
          setDesignation(profile.designation || user.user_metadata?.designation || FACULTY_DESIGNATIONS[0])
        } else {
          // If user email has Kongu student pattern e.g. .25ece@kongu.edu
          const isStudentPattern = /\.\d{2}[a-z]+@kongu\.edu$/i.test(user.email || '')
          setUserType(isStudentPattern ? 'student' : 'student')
          setRollNumber(profile.roll_number || user.user_metadata?.roll_number || '')
        }
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

    if (!department) {
      setErrorMsg('Please select your department.')
      return
    }

    if (userType === 'student') {
      if (!rollNumber.trim()) {
        setErrorMsg('Roll / Register number is required for student records.')
        return
      }

      setIsSubmitting(true)
      try {
        // Try atomic stored procedure first
        const { error: rpcErr } = await supabase.rpc('complete_student_onboarding', {
          p_full_name: fullName.trim(),
          p_department: department.trim(),
          p_year_of_study: parseInt(yearOfStudy, 10),
          p_roll_number: rollNumber.trim().toUpperCase(),
          p_phone: phone.trim(),
        })

        if (rpcErr) {
          // Fallback to updateProfileDetails
          const success = await updateProfileDetails({
            full_name: fullName.trim(),
            department: department.trim(),
            year_of_study: parseInt(yearOfStudy, 10),
            roll_number: rollNumber.trim().toUpperCase(),
            phone: phone.trim(),
          })
          if (!success) throw new Error('Failed to save student profile details.')
        }

        await refreshProfile()
        toast({
          type: 'success',
          title: 'Student Profile Completed!',
          message: 'Welcome to Kongu Engineering College CampusConnect.',
        })
        setIsOpen(false)
      } catch (err: any) {
        setErrorMsg(err.message || 'An error occurred while saving your details.')
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Faculty / Staff
      if (!staffId.trim()) {
        setErrorMsg('Staff / Employee ID is required for faculty verification.')
        return
      }

      setIsSubmitting(true)
      try {
        // Try stored procedure to assign organizer role
        const { error: rpcErr } = await supabase.rpc('complete_faculty_onboarding', {
          p_full_name: fullName.trim(),
          p_department: department.trim(),
          p_staff_id: staffId.trim().toUpperCase(),
          p_designation: designation.trim(),
          p_phone: phone.trim(),
        })

        if (rpcErr) {
          console.warn('RPC complete_faculty_onboarding fallback:', rpcErr)
          // Fallback: update profile without role change
          await updateProfileDetails({
            full_name: fullName.trim(),
            department: department.trim(),
            year_of_study: null,
            roll_number: staffId.trim().toUpperCase(),
            designation: designation.trim(),
            phone: phone.trim(),
          })
          await supabase.auth.updateUser({
            data: {
              user_type: 'faculty',
              staff_id: staffId.trim().toUpperCase(),
              designation: designation.trim(),
              phone: phone.trim(),
              department: department.trim(),
            },
          })
        }

        await refreshProfile()
        toast({
          type: 'success',
          title: 'Faculty Profile Activated!',
          message: 'Welcome to the Event Organizer portal.',
        })
        setIsOpen(false)
        navigate('/organizer')
      } catch (err: any) {
        setErrorMsg(err.message || 'An error occurred while activating your faculty profile.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        toast({
          type: 'warning',
          title: 'Details Required',
          message: 'Please complete your college profile to continue.',
        })
      }}
      title={userType === 'student' ? 'Complete Your Student Profile' : 'Complete Your Faculty / Staff Profile'}
      description={
        userType === 'student'
          ? 'Welcome to Kongu Engineering College CampusConnect! Set up your academic profile to enable event registrations, QR attendance, and verified credentials.'
          : 'Welcome to Kongu Engineering College CampusConnect! Set up your faculty profile to access event coordination, student registrations, and administrative tools.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-left">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Role Type Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            I am registering as:
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setUserType('student')
                setErrorMsg(null)
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                userType === 'student'
                  ? 'bg-white text-primary-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Student
            </button>
            <button
              type="button"
              onClick={() => {
                setUserType('faculty')
                setErrorMsg(null)
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                userType === 'faculty'
                  ? 'bg-white text-primary-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Faculty / Staff
            </button>
          </div>
        </div>

        {/* Full Name */}
        <Input
          label="Full Name"
          placeholder={userType === 'student' ? 'e.g. Dhanavenkat N K' : 'e.g. Dr. R. Suresh / Prof. Priya M'}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        {/* Account Email (Read-Only) */}
        <div className="space-y-1.5 text-left">
          <label className="block text-sm font-medium text-slate-700">Account Email</label>
          <input
            type="text"
            readOnly
            value={profile?.email || user?.email || ''}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed select-all"
          />
        </div>

        {/* Identifier & Phone Fields */}
        {userType === 'student' ? (
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
              helperText="For event updates"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Staff / Employee ID"
              placeholder="e.g. KEC/ECE/104 or EMP-204"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value.toUpperCase())}
              helperText="Institutional employee code"
              required
            />

            <Input
              label="Mobile Number (Optional)"
              type="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              helperText="For faculty coordination"
            />
          </div>
        )}

        {/* Designation (Faculty only) */}
        {userType === 'faculty' && (
          <div className="space-y-1.5 text-left">
            <label className="block text-sm font-medium text-slate-700">Designation / Role</label>
            <select
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              required
            >
              {FACULTY_DESIGNATIONS.map((desig) => (
                <option key={desig} value={desig}>
                  {desig}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {/* Year of Study (Student only) */}
        {userType === 'student' && (
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
        )}

        {/* Faculty Organizer Notice */}
        {userType === 'faculty' && (
          <div className="p-3 rounded-xl bg-primary-50 border border-primary-200 text-xs text-primary-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
            <div>
              <strong>Faculty Access Privileges:</strong> Registering as faculty grants Event Organizer permissions to create events, mark QR attendance, issue certificates, and oversee department activities.
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <Button
            type="submit"
            isLoading={isSubmitting}
            className="w-full sm:w-auto"
            leftIcon={<Check className="w-4 h-4" />}
          >
            {userType === 'student' ? 'Save & Enter Student Portal' : 'Save & Enter Organizer Portal'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
