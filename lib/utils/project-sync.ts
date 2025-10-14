/**
 * Project Sync Utility
 * Syncs local projects to database after user authentication
 */

import { useProjectStore } from '@/lib/stores/project-store'
import { projectDataStorage } from '@/lib/project-data-storage'
import { auth } from '@/lib/config/firebase'

export interface SyncResult {
  projectsSynced: number
  projectsFailed: number
  errors: Array<{ projectId: string; error: string }>
}

/**
 * Sync all local projects that haven't been saved to the database
 * This should be called after user signs in
 */
export async function syncLocalProjectsToDatabase(): Promise<SyncResult> {
  console.log('🔄 [PROJECT_SYNC] Starting project sync to database...')

  const result: SyncResult = {
    projectsSynced: 0,
    projectsFailed: 0,
    errors: []
  }

  try {
    // Get all projects from the store
    const { projects } = useProjectStore.getState()
    console.log('🔍 [PROJECT_SYNC] Found projects:', {
      total: projects.length
    })

    // Check if user is authenticated
    const user = auth.currentUser
    if (!user) {
      console.warn('⚠️ [PROJECT_SYNC] User not authenticated, cannot sync')
      return result
    }

    // Filter projects that need syncing:
    // 1. Have dataStorageId (data in IndexedDB)
    // 2. User's own projects
    // 3. Created locally (check if they exist in DB)
    const projectsNeedingSync = projects.filter(project => {
      // Must have data in IndexedDB
      if (!project.dataStorageId) return false

      // Must belong to current user
      if (project.userId !== user.uid && project.userId !== 'anonymous') return false

      // Check if it's a local-only project (starts with 'project-' timestamp format)
      const isLocalProject = /^project-\d+-[a-z0-9]+$/.test(project.id)

      return isLocalProject
    })

    console.log('📊 [PROJECT_SYNC] Projects needing sync:', {
      count: projectsNeedingSync.length,
      projectIds: projectsNeedingSync.map(p => p.id)
    })

    if (projectsNeedingSync.length === 0) {
      console.log('✅ [PROJECT_SYNC] No projects need syncing')
      return result
    }

    // Sync each project
    for (const project of projectsNeedingSync) {
      try {
        console.log(`🔄 [PROJECT_SYNC] Syncing project: ${project.id}`)

        // Load data from IndexedDB
        const projectData = await projectDataStorage.loadProjectData(project.id)
        if (!projectData) {
          throw new Error('Project data not found in IndexedDB')
        }

        console.log(`📦 [PROJECT_SYNC] Loaded project data from IndexedDB:`, {
          projectId: project.id,
          dataRows: projectData.rawData.length,
          hasAnalysis: !!projectData.analysis
        })

        // Get ID token
        const token = await user.getIdToken()
        if (!token) {
          throw new Error('Failed to get authentication token')
        }

        // Save to database via API
        const response = await fetch(`/api/projects/${project.id}/data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            data: projectData.rawData,
            metadata: {
              fileName: projectData.dataSchema?.fileName || 'Unknown',
              fileSize: JSON.stringify(projectData.rawData).length,
              mimeType: 'application/json'
            }
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API save failed: ${response.status} ${errorText}`)
        }

        const apiResult = await response.json()
        console.log(`✅ [PROJECT_SYNC] Project synced to database:`, {
          projectId: project.id,
          databaseId: apiResult.id,
          version: apiResult.version
        })

        result.projectsSynced++
      } catch (error) {
        console.error(`❌ [PROJECT_SYNC] Failed to sync project ${project.id}:`, error)
        result.projectsFailed++
        result.errors.push({
          projectId: project.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    console.log('🏁 [PROJECT_SYNC] Sync complete:', result)
    return result
  } catch (error) {
    console.error('❌ [PROJECT_SYNC] Sync failed:', error)
    throw error
  }
}

/**
 * Check if a project needs syncing
 */
export function checkProjectNeedsSync(projectId: string): boolean {
  const { projects } = useProjectStore.getState()
  const project = projects.find(p => p.id === projectId)

  if (!project) return false

  // Has data in IndexedDB but might not be in database
  const hasLocalData = !!project.dataStorageId

  // Is a locally created project
  const isLocalProject = /^project-\d+-[a-z0-9]+$/.test(project.id)

  return hasLocalData && isLocalProject
}

/**
 * Sync a single project to the database
 * Useful for manual retry after failed sync
 */
export async function syncSingleProject(projectId: string): Promise<boolean> {
  console.log(`🔄 [PROJECT_SYNC] Syncing single project: ${projectId}`)

  try {
    const { projects, saveProjectData } = useProjectStore.getState()
    const project = projects.find(p => p.id === projectId)

    if (!project) {
      throw new Error('Project not found')
    }

    if (!project.dataStorageId) {
      throw new Error('No local data to sync')
    }

    // Load data from IndexedDB
    const projectData = await projectDataStorage.loadProjectData(projectId)
    if (!projectData) {
      throw new Error('Project data not found in IndexedDB')
    }

    // Use the store's saveProjectData which handles retries
    await saveProjectData(
      projectId,
      projectData.rawData,
      projectData.analysis || undefined,
      projectData.dataSchema || undefined
    )

    console.log(`✅ [PROJECT_SYNC] Single project synced: ${projectId}`)
    return true
  } catch (error) {
    console.error(`❌ [PROJECT_SYNC] Failed to sync single project ${projectId}:`, error)
    return false
  }
}
