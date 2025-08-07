'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, MoreVertical, Trash2, BarChart3, FileSpreadsheet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/contexts/auth-context'
import { useProjectStore } from '@/lib/stores/project-store'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { FileUploadCore } from '@/components/upload/file-upload-core'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { useDataStore } from '@/lib/store'

function ProjectsContent() {
  const { user, logout } = useAuth()
  const router = useRouter()
  
  const { 
    projects, 
    loadProjects, 
    createProject, 
    archiveProject,
    deleteProject,
    saveProjectData,
    setCurrentProject
  } = useProjectStore()
  
  const { setFileName, setRawData, setAnalysis, setDataSchema, dataSchema } = useDataStore()

  useEffect(() => {
    if (user) {
      loadProjects(user.uid)
    }
  }, [user, loadProjects])

  // Temporary function to clear all projects for testing
  const clearAllProjects = () => {
    if (window.confirm('Clear all projects? This cannot be undone.')) {
      useProjectStore.getState().clearStore()
      window.location.reload()
    }
  }

  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const handleFileUpload = async (data: any) => {
    console.log('🔵 [PROJECTS] handleFileUpload called with data length:', data?.length)
    
    if (!user) {
      console.log('❌ [PROJECTS] No user, aborting')
      return
    }
    
    // Prevent duplicate project creation
    if (isCreatingProject) {
      console.log('⚠️ [PROJECTS] Project creation already in progress, skipping...')
      return
    }

    console.log('🚀 [PROJECTS] Starting project creation for uploaded file...')
    setIsCreatingProject(true)

    try {
      // Get the schema from the store (it should have been set by file upload)
      const currentSchema = useDataStore.getState().dataSchema
      console.log('🔍 [PROJECTS] Getting schema from store:', {
        hasSchema: !!currentSchema,
        columnCount: currentSchema?.columns?.length,
        sampleColumns: currentSchema?.columns?.slice(0, 3)
      })
      
      // Create a new project
      console.log('🔄 [PROJECTS] Calling createProject...')
      const project = await createProject({
        userId: user.uid,
        name: `Project ${new Date().toLocaleDateString()}`,
        description: 'Uploaded via DataCrafted'
      })

      console.log('✅ [PROJECTS] Project created successfully:', project.id)

      // Save the data to the project (in debug mode, stored locally)
      console.log('🔄 [PROJECTS] Saving project data...')
      await saveProjectData(project.id, data, null, currentSchema)
      console.log('✅ [PROJECTS] Project data saved')
      
      // Set as current project and navigate to dashboard
      console.log('🔄 [PROJECTS] Setting current project and loading data...')
      setCurrentProject(project.id)
      
      // Load data into the main store for dashboard
      setFileName(project.name)
      setRawData(data)
      
      console.log('🔄 [PROJECTS] Navigating to project dashboard...')
      router.push(`/projects/${project.id}`)
    } catch (error) {
      console.error('❌ [PROJECTS] Error creating project:', error)
    } finally {
      console.log('🏁 [PROJECTS] Setting isCreatingProject to false')
      setIsCreatingProject(false)
    }
  }

  const handleOpenProject = (projectId: string) => {
    setCurrentProject(projectId)
    const projectData = useProjectStore.getState().getProjectData(projectId)
    
    if (projectData) {
      // Load project data into main store
      setRawData(projectData.rawData)
      setAnalysis(projectData.analysis)
      setDataSchema(projectData.dataSchema)
    }
    
    router.push(`/projects/${projectId}`)
  }

  const activeProjects = projects.filter(p => p.status === 'active')

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId)
    setShowDeleteConfirm(null)
  }

  // Delete Confirmation Dialog
  const DeleteConfirmDialog = ({ projectId }: { projectId: string }) => {
    const project = projects.find(p => p.id === projectId)
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowDeleteConfirm(null)
          }
        }}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
          </div>
          
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete <strong>"{project?.name}"</strong>? This action cannot be undone and will permanently remove all project data.
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDeleteProject(projectId)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors"
            >
              Delete Project
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">DataCrafted</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllProjects}
              className="text-red-600 hover:text-red-700"
            >
              Clear Projects
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/account/profile')}
            >
              Account
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Upload Section - Always Visible */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              {activeProjects.length === 0 ? 'Welcome to DataCrafted' : 'Upload New Dataset'}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {isCreatingProject ? 'Creating your project...' :
               activeProjects.length === 0 
                ? 'Turn your CSV or Excel files into beautiful, interactive dashboards in seconds'
                : 'Add another dataset to analyze'}
            </p>
          </div>

          {/* Upload Area - Always Visible */}
          <div className="max-w-4xl mx-auto">
            <FileUploadCore 
              onUploadComplete={handleFileUpload}
              onUploadError={(error) => {
                console.error('Upload error:', error)
                setIsCreatingProject(false)
              }}
              disabled={isCreatingProject}
            />
          </div>
        </div>

        {/* Projects Section */}
        {activeProjects.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Your Projects</h2>
                <p className="text-gray-600 mt-1">
                  {activeProjects.length} active project{activeProjects.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeProjects.map((project) => (
                <Card 
                  key={project.id} 
                  className="group hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onClick={() => handleOpenProject(project.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {project.description || 'No description available'}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDeleteConfirm(project.id)
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {project.fileInfo && (
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center space-x-4 text-sm">
                          <div>
                            <span className="text-gray-500">Rows:</span> <span className="font-medium">{project.fileInfo.rowCount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Columns:</span> <span className="font-medium">{project.fileInfo.columnCount}</span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          <span className="font-medium">File:</span> {project.fileInfo.fileName}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-2 text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(project.lastAccessedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && <DeleteConfirmDialog projectId={showDeleteConfirm} />}
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsContent />
    </ProtectedRoute>
  )
}