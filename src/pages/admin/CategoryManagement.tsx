import { useEffect, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventCategory } from '@/types/database.types'

export function CategoryManagement() {
  const { toast } = useToast()

  const [categories, setCategories] = useState<EventCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // New category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDesc, setCategoryDesc] = useState('')
  const [isSubmittingCat, setIsSubmittingCat] = useState(false)

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    try {
      const { data } = await supabase.from('event_categories').select('*').order('name')
      if (data) setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
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

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Event Categories
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure collegiate event categories for campus activity organization, filtering, and departments.
        </p>
      </div>

      {/* EVENT CATEGORIES CARD */}
      <Card className="border-slate-200 shadow-card">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-600" />
            <span>Active Categories ({categories.length})</span>
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

      {/* CREATE CATEGORY MODAL */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Event Category"
        description="Create a new classification category for campus events."
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Technical Symposium, Cultural Fest"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
          />

          <Textarea
            label="Description (Optional)"
            placeholder="Brief overview of events grouped under this category..."
            value={categoryDesc}
            onChange={(e) => setCategoryDesc(e.target.value)}
            rows={3}
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCategoryModalOpen(false)}
            >
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
