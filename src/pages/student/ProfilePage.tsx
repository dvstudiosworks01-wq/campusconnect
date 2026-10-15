import { useState, useEffect } from 'react'
import { User, Mail, GraduationCap, Building2, Shield, Check, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'

export function ProfilePage() {
  const { profile, updateProfileDetails } = useAuth()
  const { toast } = useToast()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [department, setDepartment] = useState(profile?.department || 'Computer Science & Engineering')
  const [yearOfStudy, setYearOfStudy] = useState(profile?.year_of_study ? String(profile.year_of_study) : '3')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      if (profile.department) setDepartment(profile.department)
      if (profile.year_of_study) setYearOfStudy(String(profile.year_of_study))
    }
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast({ type: 'warning', title: 'Full name is required' })
      return
    }

    setIsSaving(true)
    const success = await updateProfileDetails({
      full_name: fullName.trim(),
      department: department.trim(),
      year_of_study: parseInt(yearOfStudy, 10),
    })

    setIsSaving(false)
    if (success) {
      toast({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your personal and academic details were saved.',
      })
    } else {
      toast({
        type: 'error',
        title: 'Update Failed',
        message: 'Unable to save profile details.',
      })
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-left">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Student Profile</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your collegiate profile, department information, and academic credentials.
        </p>
      </div>

      <Card className="border-slate-200 shadow-card">
        <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xl overflow-hidden border border-primary-200 shadow-sm shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{profile?.full_name?.charAt(0).toUpperCase() || 'S'}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold">{profile?.full_name}</CardTitle>
              <Badge variant="default" className="capitalize text-xs font-semibold">
                {profile?.role || 'student'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.email}</p>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="e.g. Alex Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <div className="space-y-1.5 text-left">
              <label className="block text-sm font-medium text-slate-700">Institutional Email</label>
              <input
                type="text"
                readOnly
                value={profile?.email || ''}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400">
                Email is tied to your Google OAuth account and cannot be modified.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-sm font-medium text-slate-700">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Biotechnology">Biotechnology</option>
                  <option value="Business Administration">Business Administration</option>
                </select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-sm font-medium text-slate-700">Year of Study</label>
                <select
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="1">Year 1 (Freshman)</option>
                  <option value="2">Year 2 (Sophomore)</option>
                  <option value="3">Year 3 (Junior)</option>
                  <option value="4">Year 4 (Senior)</option>
                  <option value="5">Year 5 (Postgraduate)</option>
                </select>
              </div>
            </div>

            {/* Role security note */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5 mt-4">
              <Shield className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <strong>Role Authorization Policy:</strong> You are currently authorized as a{' '}
                <span className="font-semibold text-slate-800 capitalize">{profile?.role || 'student'}</span>.
                Elevation to Event Organizer or Administrator requires trusted verification by college
                faculty in accordance with CampusConnect security protocols.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" isLoading={isSaving} leftIcon={<Check className="w-4 h-4" />}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
