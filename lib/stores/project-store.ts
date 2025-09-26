import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DataRow, AnalysisResult, DataSchema } from '@/lib/store'
import { projectDataStorage } from '@/lib/project-data-storage'

export interface Project {
  id: string
  userId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  lastAccessedAt: string
  fileInfo?: {
    fileName: string
    fileSize: number
    rowCount: number
    columnCount: number
  }
  status: 'active' | 'archived' | 'deleted'
  tags?: string[]
  // In debug mode, we store data locally
  // In production, this would reference BigQuery tables
  debugData?: {
    rawData: DataRow[]
    analysis: AnalysisResult | null
    dataSchema: DataSchema | null
  }
  // Reference to IndexedDB stored data for large datasets
  dataStorageId?: string
  // Dashboard layout and customization persistence
  dashboardConfig?: {
    chartCustomizations: Record<string, any>
    currentLayout: any
    filters: any[]
    theme: any
    lastModified: string
  }
}

interface ProjectStore {
  projects: Project[]
  currentProjectId: string | null
  isLoading: boolean
  error: string | null

  // Project CRUD operations
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'status'>) => Promise<Project>
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  archiveProject: (projectId: string) => Promise<void>
  
  // Project data operations
  loadProjects: (userId: string) => Promise<void>
  loadProject: (projectId: string) => Promise<Project | null>
  setCurrentProject: (projectId: string | null) => void
  
  // Project data management (debug mode)
  saveProjectData: (projectId: string, data: DataRow[], analysis?: AnalysisResult, schema?: DataSchema) => Promise<void>
  getProjectData: (projectId: string) => { rawData: DataRow[], analysis: AnalysisResult | null, dataSchema: DataSchema | null } | null
  loadProjectDataAsync: (projectId: string) => Promise<{ rawData: DataRow[], analysis: AnalysisResult | null, dataSchema: DataSchema | null } | null>

  // Dashboard configuration management
  saveDashboardConfig: (projectId: string, config: {
    chartCustomizations: Record<string, any>
    currentLayout: any
    filters: any[]
    theme: any
  }) => Promise<void>
  loadDashboardConfig: (projectId: string) => {
    chartCustomizations: Record<string, any>
    currentLayout: any
    filters: any[]
    theme: any
  } | null

  // Utility
  clearStore: () => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      isLoading: false,
      error: null,

      createProject: async (projectData) => {
        console.log('🔵 [PROJECT_STORE] createProject called with:', projectData)
        console.log('🔍 [PROJECT_STORE] Current projects count:', get().projects.length)
        
        const newProject: Project = {
          ...projectData,
          id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          status: 'active'
        }

        console.log('🆕 [PROJECT_STORE] Generated project:', { id: newProject.id, name: newProject.name })

        set((state) => {
          console.log('🔄 [PROJECT_STORE] Adding project to state, current count:', state.projects.length)
          const newProjects = [...state.projects, newProject]
          console.log('✅ [PROJECT_STORE] New projects count will be:', newProjects.length)
          return { projects: newProjects }
        })

        console.log('🏁 [PROJECT_STORE] createProject completed, returning:', newProject.id)
        return newProject
      },

      updateProject: async (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map(p => 
            p.id === projectId 
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          )
        }))
      },

      deleteProject: async (projectId) => {
        set((state) => ({
          projects: state.projects.map(p => 
            p.id === projectId 
              ? { ...p, status: 'deleted' as const }
              : p
          )
        }))
      },

      archiveProject: async (projectId) => {
        set((state) => ({
          projects: state.projects.map(p => 
            p.id === projectId 
              ? { ...p, status: 'archived' as const }
              : p
          )
        }))
      },

      loadProjects: async (userId) => {
        console.log('🔵 [PROJECT_STORE] loadProjects called for userId:', userId)
        set({ isLoading: true, error: null })
        try {
          // Get the current projects from store (which includes persisted data)
          const allProjects = get().projects
          console.log('🔍 [PROJECT_STORE] All projects in store:', allProjects.length)

          // Filter by userId and status - but DON'T overwrite the projects array
          // The projects array should contain ALL projects, we just track which ones to display
          const userProjects = allProjects.filter(p => p.userId === userId && p.status !== 'deleted')
          console.log('✅ [PROJECT_STORE] Filtered user projects:', userProjects.length)

          // Don't overwrite projects array - just update loading state
          set({ isLoading: false })
        } catch (error) {
          console.error('❌ [PROJECT_STORE] Error in loadProjects:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to load projects', isLoading: false })
        }
      },

      loadProject: async (projectId) => {
        const project = get().projects.find(p => p.id === projectId)
        if (project) {
          // Update last accessed time
          await get().updateProject(projectId, { lastAccessedAt: new Date().toISOString() })
        }
        return project || null
      },

      setCurrentProject: (projectId) => {
        set({ currentProjectId: projectId })
      },

      saveProjectData: async (projectId, data, analysis, schema) => {
        try {
          // For large datasets (>1000 rows), use IndexedDB
          if (data.length > 1000) {
            const dataStorageId = await projectDataStorage.saveProjectData(projectId, data, analysis, schema)
            
            set((state) => ({
              projects: state.projects.map(p => 
                p.id === projectId 
                  ? { 
                      ...p, 
                      dataStorageId,
                      // Clear debugData to avoid localStorage quota issues
                      debugData: undefined,
                      fileInfo: {
                        fileName: schema?.fileName || 'Unknown',
                        fileSize: 0,
                        rowCount: data.length,
                        columnCount: Object.keys(data[0] || {}).length
                      },
                      updatedAt: new Date().toISOString()
                    }
                  : p
              )
            }))
          } else {
            // For small datasets, store in localStorage as before
            set((state) => ({
              projects: state.projects.map(p => 
                p.id === projectId 
                  ? { 
                      ...p, 
                      debugData: { 
                        rawData: data, 
                        analysis: analysis || null,
                        dataSchema: schema || null
                      },
                      dataStorageId: undefined,
                      fileInfo: {
                        fileName: schema?.fileName || 'Unknown',
                        fileSize: 0,
                        rowCount: data.length,
                        columnCount: Object.keys(data[0] || {}).length
                      },
                      updatedAt: new Date().toISOString()
                    }
                  : p
              )
            }))
          }
        } catch (error) {
          console.error('Failed to save project data:', error)
          // Fallback: try to save only metadata without data
          set((state) => ({
            projects: state.projects.map(p => 
              p.id === projectId 
                ? { 
                    ...p, 
                    debugData: undefined,
                    dataStorageId: undefined,
                    fileInfo: {
                      fileName: schema?.fileName || 'Unknown',
                      fileSize: 0,
                      rowCount: data.length,
                      columnCount: Object.keys(data[0] || {}).length
                    },
                    updatedAt: new Date().toISOString()
                  }
                : p
            )
          }))
          throw error
        }
      },

      getProjectData: (projectId) => {
        const project = get().projects.find(p => p.id === projectId)
        if (project?.debugData) {
          return {
            rawData: project.debugData.rawData,
            analysis: project.debugData.analysis,
            dataSchema: project.debugData.dataSchema
          }
        }
        return null
      },

      loadProjectDataAsync: async (projectId) => {
        const project = get().projects.find(p => p.id === projectId)
        if (!project) return null

        // If data is in localStorage, return it immediately
        if (project.debugData) {
          return {
            rawData: project.debugData.rawData,
            analysis: project.debugData.analysis,
            dataSchema: project.debugData.dataSchema
          }
        }

        // If data is in IndexedDB, load it
        if (project.dataStorageId) {
          try {
            return await projectDataStorage.loadProjectData(projectId)
          } catch (error) {
            console.error('Failed to load project data from IndexedDB:', error)
            return null
          }
        }

        return null
      },

      saveDashboardConfig: async (projectId, config) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  dashboardConfig: {
                    ...config,
                    lastModified: new Date().toISOString()
                  },
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },

      loadDashboardConfig: (projectId) => {
        const project = get().projects.find(p => p.id === projectId)
        if (project?.dashboardConfig) {
          const { lastModified, ...config } = project.dashboardConfig
          return config
        }
        return null
      },

      clearStore: () => {
        set({ projects: [], currentProjectId: null, isLoading: false, error: null })
      }
    }),
    {
      name: 'datacrafted-projects',
      partialize: (state) => ({
        projects: state.projects.map(project => ({
          ...project,
          // Exclude debugData from localStorage to avoid quota issues
          debugData: undefined
        })),
        currentProjectId: state.currentProjectId
      })
    }
  )
)