import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DataRow, AnalysisResult, DataSchema } from '@/lib/store'
import { EnhancedAnalysisResult } from '@/lib/types/recommendation'
import { projectDataStorage } from '@/lib/project-data-storage'
import { auth } from '@/lib/config/firebase'
import { retryWithBackoff } from '@/lib/utils/retry'

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
  loadingProjectData: Record<string, boolean> // Track which projects are currently loading data
  loadingPromises: Map<string, Promise<any>> // Promise deduplication for concurrent loads
  isDirty: boolean // Track if there are unsaved changes
  lastSavedAt: string | null // Track when the project was last saved

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
  saveProjectData: (projectId: string, data: DataRow[], analysis?: AnalysisResult | EnhancedAnalysisResult, schema?: DataSchema) => Promise<void>
  getProjectData: (projectId: string) => { rawData: DataRow[], analysis: AnalysisResult | EnhancedAnalysisResult | null, dataSchema: DataSchema | null } | null
  loadProjectDataAsync: (projectId: string) => Promise<{ rawData: DataRow[], analysis: AnalysisResult | EnhancedAnalysisResult | null, dataSchema: DataSchema | null } | null>

  // Dashboard configuration management
  saveDashboardConfig: (projectId: string, config: {
    chartCustomizations: Record<string, any>
    currentLayout: any
    filters: any[]
    theme: any
    dateRange?: any
    granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year'
    chatMessages?: any[]
  }) => Promise<void>
  loadDashboardConfig: (projectId: string) => Promise<{
    chartCustomizations: Record<string, any>
    currentLayout: any
    filters: any[]
    theme: any
    dateRange?: any
    granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year'
    chatMessages?: any[]
  } | null>

  // Dirty state management
  markAsDirty: () => void
  markAsClean: () => void
  resetDirtyState: () => void

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
      loadingProjectData: {}, // Initialize empty loading state
      loadingPromises: new Map(), // Initialize promise deduplication map
      isDirty: false,
      lastSavedAt: null,

      createProject: async (projectData) => {
        console.log('🔵 [PROJECT_STORE] createProject called with:', projectData)
        console.log('🔍 [PROJECT_STORE] Current projects count:', get().projects.length)

        // Import and check auth state FIRST
        const { auth: firebaseAuth } = await import('@/lib/config/firebase')
        const isAuthenticated = !!firebaseAuth.currentUser

        console.log('🔍 [PROJECT_STORE] Auth check:', {
          isAuthenticated,
          userId: firebaseAuth.currentUser?.uid
        })

        // If NOT authenticated, skip API call and create locally
        if (!isAuthenticated) {
          console.warn('⚠️ [PROJECT_STORE] User not authenticated, creating project locally')

          const newProject: Project = {
            ...projectData,
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            status: 'active'
          }

          console.log('🆕 [PROJECT_STORE] Generated local project:', { id: newProject.id, name: newProject.name })

          set((state) => ({
            projects: [...state.projects, newProject]
          }))

          console.log('🏁 [PROJECT_STORE] Local project created successfully:', newProject.id)
          return newProject
        }

        // User IS authenticated - try API creation
        try {
          console.log('🌐 [PROJECT_STORE] User authenticated, creating project via API...')

          const token = await firebaseAuth.currentUser?.getIdToken()

          console.log('🔍 [PROJECT_STORE] Token retrieved:', {
            hasToken: !!token,
            tokenLength: token?.length || 0
          })

          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(projectData)
          })

          console.log('🔍 [PROJECT_STORE] API response:', {
            status: response.status,
            ok: response.ok
          })

          if (response.ok) {
            const data = await response.json()

            console.log('🔍 [PROJECT_STORE] API response data:', {
              hasProject: !!data.project,
              projectId: data.project?.id,
              fullData: data
            })

            // Verify we got a valid project back
            if (data.project && data.project.id) {
              const newProject: Project = {
                ...data.project,
                status: 'active'
              }

              console.log('✅ [PROJECT_STORE] Project created via API:', newProject.id)

              // Add to local state
              set((state) => ({
                projects: [...state.projects, newProject]
              }))

              return newProject
            } else {
              console.warn('⚠️ [PROJECT_STORE] API returned success but no project data, falling back to local')
              throw new Error('No project data in API response')
            }
          } else {
            console.warn('⚠️ [PROJECT_STORE] API project creation failed, falling back to local')
            throw new Error('API creation failed')
          }
        } catch (error) {
          // Fallback to local creation if API fails
          console.warn('⚠️ [PROJECT_STORE] API failed, creating project locally:', error)

          const newProject: Project = {
            ...projectData,
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            status: 'active'
          }

          console.log('🆕 [PROJECT_STORE] Generated local project:', { id: newProject.id, name: newProject.name })

          set((state) => ({
            projects: [...state.projects, newProject]
          }))

          console.log('🏁 [PROJECT_STORE] createProject completed (local fallback), returning:', newProject.id)
          return newProject
        }
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
          // Fetch projects from the backend API
          console.log('🌐 [PROJECT_STORE] Fetching projects from API...')
          const response = await fetch('/api/projects', {
            headers: {
              'Authorization': `Bearer ${await import('@/lib/config/firebase').then(m => m.auth.currentUser?.getIdToken())}`
            }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`)
          }

          const data = await response.json()
          const fetchedProjects = data.projects || []
          console.log('📦 [PROJECT_STORE] Fetched', fetchedProjects.length, 'projects from API')

          // Merge with local projects (keep local-only projects for offline support)
          const localProjects = get().projects
          console.log('💾 [PROJECT_STORE] Local projects count:', localProjects.length)

          // Create a map of fetched projects by ID for quick lookup
          const fetchedProjectsMap = new Map(fetchedProjects.map((p: Project) => [p.id, p]))

          // Create a map of local projects by ID for quick lookup
          const localProjectsMap = new Map(localProjects.map(p => [p.id, p]))

          // Merge: prefer fetched project metadata, but preserve local data references
          const mergedProjects = [
            ...fetchedProjects.map((fetchedProject: Project) => {
              const localProject = localProjectsMap.get(fetchedProject.id)
              // If we have local data for this project, merge it in
              if (localProject) {
                return {
                  ...fetchedProject,
                  // Preserve client-side data storage references
                  debugData: localProject.debugData,
                  dataStorageId: localProject.dataStorageId,
                }
              }
              return fetchedProject
            }),
            // Add local-only projects that aren't in the database yet
            ...localProjects.filter(p => !fetchedProjectsMap.has(p.id) && p.userId === userId)
          ]

          console.log('✅ [PROJECT_STORE] Merged projects count:', mergedProjects.length)

          // Update the store with merged projects
          set({ projects: mergedProjects, isLoading: false })
        } catch (error) {
          console.error('❌ [PROJECT_STORE] Error in loadProjects:', error)

          // Fallback to local projects if API fails
          console.warn('⚠️ [PROJECT_STORE] Falling back to local projects')
          const allProjects = get().projects
          const userProjects = allProjects.filter(p => p.userId === userId && p.status !== 'deleted')
          console.log('💾 [PROJECT_STORE] Using', userProjects.length, 'local projects as fallback')

          set({
            error: error instanceof Error ? error.message : 'Failed to load projects',
            isLoading: false
          })
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
        console.log('🔵 [PROJECT_STORE] saveProjectData called:', {
          projectId,
          dataRows: data.length,
          hasAnalysis: !!analysis,
          hasSchema: !!schema
        })

        // Validate inputs
        if (!projectId) {
          throw new Error('Project ID is required for saveProjectData')
        }
        if (!data || data.length === 0) {
          throw new Error('Data is required and must not be empty')
        }

        let savedToDatabase = false
        let savedToIndexedDB = false
        let apiError: Error | null = null

        // Step 1: Try to save to database API first (with retry)
        try {
          // Debug auth state
          console.log('🔍 [PROJECT_STORE] Auth check:', {
            hasAuth: !!auth,
            hasCurrentUser: !!auth.currentUser,
            userId: auth.currentUser?.uid
          })

          const token = await auth.currentUser?.getIdToken()

          console.log('🔍 [PROJECT_STORE] Token for data save:', {
            hasToken: !!token,
            tokenLength: token?.length || 0
          })

          if (!token) {
            console.warn('⚠️ [PROJECT_STORE] No auth token available, skipping database save')
            throw new Error('No authentication token available')
          }

          console.log('🌐 [PROJECT_STORE] Attempting to save data via API with retry...')

          // Save to database API with retry logic
          await retryWithBackoff(
            async () => {
              const response = await fetch(`/api/projects/${projectId}/data`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  data,
                  analysis, // Include analysis in request
                  metadata: {
                    fileName: schema?.fileName || 'Unknown',
                    fileSize: JSON.stringify(data).length,
                    mimeType: 'application/json'
                  }
                })
              })

              if (!response.ok) {
                const errorText = await response.text()
                const error = new Error(`API save failed: ${response.status} ${errorText}`)
                ;(error as any).status = response.status
                throw error
              }

              const result = await response.json()
              console.log('✅ [PROJECT_STORE] Data saved to database successfully:', {
                id: result.id,
                version: result.version,
                rowCount: result.metadata.rowCount
              })

              return result
            },
            {
              maxRetries: 3,
              initialDelay: 1000,
              onRetry: (attempt, error) => {
                console.log(`🔄 [PROJECT_STORE] API save retry ${attempt}/3:`, error.message)
              }
            }
          )

          savedToDatabase = true
        } catch (error) {
          apiError = error instanceof Error ? error : new Error(String(error))
          console.error('❌ [PROJECT_STORE] API save failed after retries:', apiError.message)
          // Don't throw yet - try IndexedDB first
        }

        // Step 2: Save to IndexedDB as backup/fallback (for offline support)
        try {
          console.log('💾 [PROJECT_STORE] Saving to IndexedDB as backup...')
          const dataStorageId = await projectDataStorage.saveProjectData(projectId, data, analysis, schema)
          console.log('✅ [PROJECT_STORE] Data saved to IndexedDB:', dataStorageId)
          savedToIndexedDB = true

          // Step 3: Update project metadata in store
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
                      fileSize: JSON.stringify(data).length,
                      rowCount: data.length,
                      columnCount: Object.keys(data[0] || {}).length
                    },
                    updatedAt: new Date().toISOString()
                  }
                : p
            )
          }))
        } catch (indexedDBError) {
          console.error('❌ [PROJECT_STORE] Failed to save to IndexedDB:', indexedDBError)

          // If both API and IndexedDB failed, this is critical
          if (!savedToDatabase) {
            throw new Error(
              `Failed to save project data to both database and IndexedDB. ` +
              `Database error: ${apiError?.message || 'Unknown'}. ` +
              `IndexedDB error: ${indexedDBError instanceof Error ? indexedDBError.message : 'Unknown'}`
            )
          }
        }

        // Summary and result
        console.log('🏁 [PROJECT_STORE] saveProjectData completed:', {
          savedToDatabase,
          savedToIndexedDB
        })

        // If database save failed but IndexedDB succeeded, throw an error to notify the UI
        if (!savedToDatabase && savedToIndexedDB) {
          throw new Error(
            `Data saved locally but failed to save to database. ` +
            `You may need to sync this project later. Error: ${apiError?.message || 'Unknown'}`
          )
        }

        // If database saved but IndexedDB failed, log warning but don't throw
        if (savedToDatabase && !savedToIndexedDB) {
          console.warn('⚠️ [PROJECT_STORE] Data saved to database but IndexedDB backup failed')
        }

        // Both succeeded or database succeeded - return success
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
        console.log('🔵 [PROJECT_STORE] loadProjectDataAsync called:', projectId)

        // Check if already loading - return the existing promise
        const existingPromise = get().loadingPromises.get(projectId)
        if (existingPromise) {
          console.log('🔄 [PROJECT_STORE] Reusing existing load promise for:', projectId)
          return existingPromise
        }

        const project = get().projects.find(p => p.id === projectId)
        if (!project) {
          console.warn('⚠️ [PROJECT_STORE] Project not found:', projectId)
          return null
        }

        // If data is in localStorage, return it immediately (fastest)
        if (project.debugData) {
          console.log('✅ [PROJECT_STORE] Returning data from localStorage (debugData)')
          return {
            rawData: project.debugData.rawData,
            analysis: project.debugData.analysis,
            dataSchema: project.debugData.dataSchema
          }
        }

        // Create new promise and store it for deduplication
        const promise = (async () => {
          // Set loading flag
          set((state) => ({
            loadingProjectData: { ...state.loadingProjectData, [projectId]: true }
          }))

          try {
            // Step 1: Try to load from database API first (primary source)
            try {
              console.log('🌐 [PROJECT_STORE] Attempting to load data from API...')
              const token = await auth.currentUser?.getIdToken()

              if (token) {
                const response = await fetch(`/api/projects/${projectId}/data`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                })

                if (response.ok) {
                  const result = await response.json()
                  console.log('✅ [PROJECT_STORE] Data loaded from database:', {
                    version: result.version,
                    rowCount: result.metadata.rowCount,
                    isSample: result.isSample
                  })

                  // Transform API response to match expected format
                  return {
                    rawData: result.data,
                    analysis: result.analysis, // Return saved analysis from API
                    dataSchema: {
                      fileName: result.metadata.originalFileName,
                      columns: result.metadata.columnNames.map((name: string) => ({
                        name,
                        type: result.metadata.columnTypes[name] || 'string',
                        nullable: true
                      }))
                    }
                  }
                } else {
                  const errorText = await response.text()
                  console.warn('⚠️ [PROJECT_STORE] API load failed:', response.status, errorText)
                }
              } else {
                console.warn('⚠️ [PROJECT_STORE] No auth token available, skipping API load')
              }
            } catch (apiError) {
              console.warn('⚠️ [PROJECT_STORE] API load error:', apiError)
            }

            // Step 2: Fallback to IndexedDB if API fails
            if (project.dataStorageId) {
              try {
                console.log('💾 [PROJECT_STORE] Loading from IndexedDB as fallback...')
                const data = await projectDataStorage.loadProjectData(projectId)
                if (data) {
                  console.log('✅ [PROJECT_STORE] Data loaded from IndexedDB:', {
                    rowCount: data.rawData.length,
                    hasAnalysis: !!data.analysis,
                    hasSchema: !!data.dataSchema
                  })
                  return data
                }
              } catch (error) {
                console.error('❌ [PROJECT_STORE] Failed to load project data from IndexedDB:', error)
              }
            }

            console.warn('⚠️ [PROJECT_STORE] No data found in any storage location')
            return null
          } finally {
            // Clean up loading state and promise
            const promises = get().loadingPromises
            promises.delete(projectId)

            set((state) => ({
              loadingProjectData: { ...state.loadingProjectData, [projectId]: false },
              loadingPromises: new Map(promises)
            }))
          }
        })()

        // Store promise before starting execution
        const promises = get().loadingPromises
        promises.set(projectId, promise)
        set((state) => ({
          loadingPromises: new Map(promises)
        }))

        return promise
      },

      saveDashboardConfig: async (projectId, config) => {
        const now = new Date().toISOString()

        // Step 1: Save to database API first
        try {
          console.log('🌐 [PROJECT_STORE] Saving dashboard config to database...')
          const token = await auth.currentUser?.getIdToken()

          if (token) {
            const response = await fetch(`/api/projects/${projectId}/config`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                chartCustomizations: config.chartCustomizations,
                currentTheme: config.theme,
                currentLayout: config.currentLayout,
                dashboardFilters: config.filters,
                dateRange: config.dateRange,
                granularity: config.granularity,
                chatMessages: config.chatMessages
              })
            })

            if (response.ok) {
              const result = await response.json()
              console.log('✅ [PROJECT_STORE] Dashboard config saved to database:', result.configId)
            } else {
              const errorText = await response.text()
              console.warn('⚠️ [PROJECT_STORE] Failed to save dashboard config to database:', errorText)
            }
          } else {
            console.warn('⚠️ [PROJECT_STORE] No auth token, skipping database save')
          }
        } catch (error) {
          console.error('❌ [PROJECT_STORE] Error saving dashboard config to database:', error)
          // Don't throw - continue with localStorage save
        }

        // Step 2: Save to localStorage (for offline support and quick access)
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  dashboardConfig: {
                    ...config,
                    lastModified: now
                  },
                  updatedAt: now
                }
              : p
          ),
          isDirty: false,
          lastSavedAt: now
        }))

        console.log('✅ [PROJECT_STORE] Dashboard config saved to localStorage')
      },

      loadDashboardConfig: async (projectId) => {
        // Step 1: Try to load from database API first
        try {
          console.log('🌐 [PROJECT_STORE] Loading dashboard config from database...')
          const token = await auth.currentUser?.getIdToken()

          if (token) {
            const response = await fetch(`/api/projects/${projectId}/config`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })

            if (response.ok) {
              const result = await response.json()
              console.log('✅ [PROJECT_STORE] Dashboard config loaded from database')

              // Save to localStorage for quick access
              const now = new Date().toISOString()
              set((state) => ({
                projects: state.projects.map(p =>
                  p.id === projectId
                    ? {
                        ...p,
                        dashboardConfig: {
                          chartCustomizations: result.chartCustomizations,
                          currentLayout: result.currentLayout,
                          filters: result.dashboardFilters,
                          theme: result.currentTheme,
                          lastModified: result.lastModified || now
                        },
                        updatedAt: now
                      }
                    : p
                ),
                isDirty: false,
                lastSavedAt: result.lastModified || now
              }))

              return {
                chartCustomizations: result.chartCustomizations,
                currentLayout: result.currentLayout,
                filters: result.dashboardFilters,
                theme: result.currentTheme,
                dateRange: result.dateRange,
                granularity: result.granularity,
                chatMessages: result.chatMessages
              }
            } else {
              // Log specific error status for debugging
              const errorText = await response.text().catch(() => 'Unable to read error')
              console.warn(`⚠️ [PROJECT_STORE] Failed to load dashboard config from database: ${response.status} ${response.statusText}`, errorText)

              // IMPORTANT: Don't retry on permanent errors
              // 403 = Authorization failed (user doesn't own project)
              // 404 = Project not found
              // These are not transient errors and should not trigger retries
              if (response.status === 403 || response.status === 404) {
                console.log('ℹ️ [PROJECT_STORE] Permanent error detected, falling back to localStorage without retry')
              }
            }
          } else {
            console.warn('⚠️ [PROJECT_STORE] No auth token, skipping database load')
          }
        } catch (error) {
          console.error('❌ [PROJECT_STORE] Error loading dashboard config from database:', error)
        }

        // Step 2: Fallback to localStorage
        console.log('💾 [PROJECT_STORE] Loading dashboard config from localStorage')
        const project = get().projects.find(p => p.id === projectId)
        if (project?.dashboardConfig) {
          const { lastModified, ...config } = project.dashboardConfig
          // Reset dirty state when loading config
          set({ isDirty: false, lastSavedAt: project.dashboardConfig.lastModified })
          return config
        }

        console.log('⚠️ [PROJECT_STORE] No dashboard config found')
        return null
      },

      // Dirty state management
      markAsDirty: () => {
        set({ isDirty: true })
      },

      markAsClean: () => {
        set({ isDirty: false, lastSavedAt: new Date().toISOString() })
      },

      resetDirtyState: () => {
        set({ isDirty: false, lastSavedAt: null })
      },

      clearStore: () => {
        set({
          projects: [],
          currentProjectId: null,
          isLoading: false,
          error: null,
          isDirty: false,
          lastSavedAt: null
        })
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