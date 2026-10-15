import { useEffect, useState } from 'react'
import { Layers, Plus, Trash2, Trophy, Save, Edit3, Award, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventCategory, LeaderboardRule } from '@/types/database.types'

export function CategoryManagement() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [categories, setCategories] = useState<EventCategory[]>([])
  const [rules, setRules] = useState<LeaderboardRule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // New category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDesc, setCategoryDesc] = useState('')
  const [isSubmittingCat, setIsSubmittingCat] = useState(false)

  // Points configuration form
  const [pointsState, setPointsState] = useState<Record<number, number>>({
    1: 10,
    2: 7,
    3: 5,
    0: 1,
  })
  const [isSavingPoints, setIsSavingPoints] = useState(false)

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const [catsRes, rulesRes] = await Promise.all([
        supabase.from('event_categories').select('*').order('name'),
        supabase.from('leaderboard_point_rules').select('*').order('rank', { ascending: true }),
      ])

      if (catsRes.data) setCategories(catsRes.data)
      if (rulesRes.data) {
        setRules(rulesRes.data)
        const map: Record<number, number> = {}
        rulesRes.data.forEach((r) => {
          map[r.rank] = r.points
        })
        setPointsState((prev) => ({ ...prev, ...map }))
      }
    } catch (err) {
      console.error('Error loading categories & rules:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryName.trim()) return

    setIsSubmittingCat(true)
    try {
      const { error } = await supabase.from('event_categories').insert({
        name: categoryName.trim(),
        description: categoryDesc.trim() || null,
      })

      if (error) throw error

      toast({
        type: 'success',
        title: 'Category Created',
        message: `Category "${categoryName}" added to portal.`,
      })

      setIsCategoryModalOpen(false)
      setCategoryName('')
      setCategoryDesc('')
      await loadData()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Failed to Add Category',
        message: err.message || 'Error creating category.',
      })
    } finally {
      setIsSubmittingCat(false)
    }
  }

  const handleDeleteCategory = async (catId: string, name: string) => {
    try {
      const { error } = await supabase.from('event_categories').delete().eq('id', catId)
      if (error) throw error

      toast({ type: 'info', title: 'Category Removed', message: `"${name}" was deleted.` })
      await loadData()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Cannot delete category that currently has associated events.',
      })
    }
  }

  const handleSavePoints = async () => {
    setIsSavingPoints(true)
    try {
      const updates = [
        { rank: 1, points: pointsState[1], description: 'First Place / Winner' },
        { rank: 2, points: pointsState[2], description: 'Second Place / Runner Up' },
        { rank: 3, points: pointsState[3], description: 'Third Place / Second Runner Up' },
        { rank: 0, points: pointsState[0], description: 'Event Attendance / Participation' },
      ]

      for (const item of updates) {
        await supabase
          .from('leaderboard_point_rules')
          .upsert(item, { onConflict: 'rank' })
      }

      toast({
        type: 'success',
        title: 'Scoring Rules Saved',
        message: 'Updated leaderboard point distribution values.',
      })

      await loadData()
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update scoring rules.',
      })
    } finally {
      setIsSavingPoints(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Categories & Leaderboard Rules
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure collegiate event categories and award point metrics for podium winners and attendance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EVENT CATEGORIES CARD */}
        <Card className="border-slate-200 shadow-card">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary-600" />
              <span>Event Categories</span>
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setIsCategoryModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Category
            </Button>
          </CardHeader>

          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : categories.length > 0 ? (
              <div className="space-y-2.5">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                      {c.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{c.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded transition-colors cursor-pointer"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">No categories configured.</p>
            )}
          </CardContent>
        </Card>

        {/* LEADERBOARD SCORING CONFIGURATION */}
        <Card className="border-slate-200 shadow-card flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Leaderboard Point Matrix</span>
              </CardTitle>
              <Badge variant="success">Configurable</Badge>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Define the points allocated to student scholars when competition podium results and QR
                attendances are verified.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <span>🥇 First Place (Winner)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={pointsState[1]}
                      onChange={(e) =>
                        setPointsState((prev) => ({ ...prev, 1: parseInt(e.target.value, 10) || 0 }))
                      }
                      className="w-16 h-8 text-center font-bold text-sm rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="font-semibold text-slate-600">pts</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span>🥈 Second Place (Runner Up)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={pointsState[2]}
                      onChange={(e) =>
                        setPointsState((prev) => ({ ...prev, 2: parseInt(e.target.value, 10) || 0 }))
                      }
                      className="w-16 h-8 text-center font-bold text-sm rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="font-semibold text-slate-600">pts</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span>🥉 Third Place (2nd Runner Up)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={pointsState[3]}
                      onChange={(e) =>
                        setPointsState((prev) => ({ ...prev, 3: parseInt(e.target.value, 10) || 0 }))
                      }
                      className="w-16 h-8 text-center font-bold text-sm rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="font-semibold text-slate-600">pts</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-primary-50/60 border border-primary-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-primary-950">
                    <span>🎟️ Attendance / Participation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={pointsState[0]}
                      onChange={(e) =>
                        setPointsState((prev) => ({ ...prev, 0: parseInt(e.target.value, 10) || 0 }))
                      }
                      className="w-16 h-8 text-center font-bold text-sm rounded-lg border border-slate-300 bg-white"
                    />
                    <span className="font-semibold text-slate-600">pts</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>

          <div className="p-5 pt-0 border-t border-slate-100 flex justify-end">
            <Button
              size="sm"
              onClick={handleSavePoints}
              isLoading={isSavingPoints}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Scoring Rules
            </Button>
          </div>
        </Card>
      </div>

      {/* CREATE CATEGORY MODAL */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Event Category"
        description="Create a new classification category for collegiate events."
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Robotics & Automation"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
          />
          <Textarea
            label="Description (Optional)"
            placeholder="Outline the scope of events that fall under this category..."
            value={categoryDesc}
            onChange={(e) => setCategoryDesc(e.target.value)}
            rows={2}
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingCat}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
