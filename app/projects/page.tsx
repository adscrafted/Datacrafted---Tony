'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, ChevronRight, Plus, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/contexts/auth-context'
import { useProjectStore } from '@/lib/stores/project-store'
import { FileUploadCore } from '@/components/upload/file-upload-core'
import { formatDistanceToNow } from 'date-fns'
import { useDataStore } from '@/lib/store'
import { MinimalHeader } from '@/components/ui/minimal-header'

function ProjectsContent() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const newProjectId = searchParams.get('newProject')

  const {
    projects,
    loadProjects,
    createProject,
    deleteProject,
    saveProjectData,
    setCurrentProject
  } = useProjectStore()

  const { setFileName, setRawData, setAnalysis, setDataSchema } = useDataStore()

  useEffect(() => {
    loadProjects(user?.uid || 'anonymous')
  }, [user, loadProjects])

  // Highlight new project for a few seconds
  useEffect(() => {
    if (newProjectId) {
      setHighlightedProject(newProjectId)
      const timer = setTimeout(() => {
        setHighlightedProject(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [newProjectId])

  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)
  const [highlightedProject, setHighlightedProject] = useState<string | null>(newProjectId)

  const handleFileUpload = async (data: any) => {
    if (isCreatingProject) return

    setIsCreatingProject(true)

    try {
      const currentSchema = useDataStore.getState().dataSchema

      const project = await createProject({
        userId: user?.uid || 'anonymous',
        name: `Project ${new Date().toLocaleDateString()}`,
        description: 'Dataset uploaded to DataCrafted'
      })

      await saveProjectData(project.id, data, undefined, currentSchema || undefined)
      setCurrentProject(project.id)
      setFileName(project.name)
      setRawData(data)

      // Hide upload after successful creation
      setShowUpload(false)
      // Navigate to simple dashboard
      router.push(`/dashboard?id=${project.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleOpenProject = async (projectId: string) => {
    setCurrentProject(projectId)

    // Try to load project data (sync first, then async)
    let projectData = useProjectStore.getState().getProjectData(projectId)

    // If not found in memory, try loading from IndexedDB
    if (!projectData || !projectData.rawData) {
      projectData = await useProjectStore.getState().loadProjectDataAsync(projectId)
    }

    if (projectData && projectData.rawData) {
      setRawData(projectData.rawData)
      if (projectData.analysis) {
        setAnalysis(projectData.analysis)
      }
      if (projectData.dataSchema) {
        setDataSchema(projectData.dataSchema)
      }
      setFileName(projectData.dataSchema?.fileName || 'Project Data')
    }

    // Navigate to simple dashboard
    router.push(`/dashboard?id=${projectId}`)
  }

  const activeProjects = projects.filter(p =>
    p.status === 'active' &&
    p.userId === (user?.uid || 'anonymous')
  )

  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this project? This action cannot be undone.')) {
      deleteProject(projectId)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <MinimalHeader showNavigation={true} />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* New Project Button */}
        <div className="mb-12">
          <Button
            onClick={() => setShowUpload(!showUpload)}
            className="mb-6 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>

          {/* Collapsible Upload Area */}
          {showUpload && (
            <div className="mb-8 p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <FileUploadCore
                onUploadComplete={handleFileUpload}
                onUploadError={(error) => {
                  console.error('Upload error:', error)
                  setIsCreatingProject(false)
                }}
                disabled={isCreatingProject}
              />
            </div>
          )}
        </div>

        {/* Projects List */}
        {activeProjects.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2">No projects yet</h2>
            <p className="text-gray-500">Create your first project to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* List Header */}
            <div className="px-4 py-2 text-sm font-medium text-gray-500 border-b border-gray-100">
              {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''}
            </div>

            {/* Project List Items */}
            {activeProjects.map((project) => (
              <div
                key={project.id}
                className={`group flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-all duration-300 ${
                  highlightedProject === project.id ? 'bg-blue-50 border-2 border-blue-400 shadow-md' : ''
                }`}
                onClick={() => handleOpenProject(project.id)}
                onMouseEnter={() => setHoveredProject(project.id)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center mt-0.5">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDistanceToNow(new Date(project.lastAccessedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Delete Button - Only visible on hover */}
                  {hoveredProject === project.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}

                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading projects...</p>
        </div>
      </div>
    }>
      <ProjectsContent />
    </Suspense>
  )
}