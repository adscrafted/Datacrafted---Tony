/**
 * Cleanup Utility for Local Test Projects
 *
 * This utility removes all local projects (with pattern project-{timestamp}-{random})
 * from both the project store and IndexedDB.
 */

import { useProjectStore } from '@/lib/stores/project-store'
import { projectDataStorage } from '@/lib/project-data-storage'
import { auth } from '@/lib/config/firebase'

export interface CleanupResult {
  removedFromStore: number
  removedFromIndexedDB: number
  removedFromDatabase: number
  errors: Array<{ projectId: string; error: string }>
}

/**
 * Remove all local test projects
 * This includes projects with IDs matching: project-{timestamp}-{randomid}
 */
export async function cleanupLocalProjects(
  options: {
    deleteFromDatabase?: boolean
    dryRun?: boolean
  } = {}
): Promise<CleanupResult> {
  const { deleteFromDatabase = false, dryRun = false } = options

  console.log('🧹 [CLEANUP] Starting cleanup of local test projects...')
  if (dryRun) {
    console.log('🔍 [CLEANUP] DRY RUN MODE - No changes will be made')
  }

  const result: CleanupResult = {
    removedFromStore: 0,
    removedFromIndexedDB: 0,
    removedFromDatabase: 0,
    errors: []
  }

  try {
    // Get all projects from store
    const { projects } = useProjectStore.getState()

    // Filter for local test projects (with timestamp-based IDs)
    const localProjects = projects.filter(project => {
      const isLocalProject = /^project-\d+-[a-z0-9]+$/.test(project.id)
      return isLocalProject
    })

    console.log(`📊 [CLEANUP] Found ${localProjects.length} local test projects to remove`)

    if (localProjects.length === 0) {
      console.log('✅ [CLEANUP] No local projects to clean up')
      return result
    }

    // Log all projects that will be removed
    console.log('🗑️  [CLEANUP] Projects to be removed:')
    localProjects.forEach(p => {
      console.log(`  - ${p.id} (${p.name})`)
    })

    if (dryRun) {
      console.log('🔍 [CLEANUP] Dry run complete - no changes made')
      return result
    }

    // Get auth token if we need to delete from database
    let token: string | undefined
    if (deleteFromDatabase) {
      try {
        const user = auth.currentUser
        if (user) {
          token = await user.getIdToken()
        } else {
          console.warn('⚠️ [CLEANUP] Not authenticated - skipping database cleanup')
        }
      } catch (error) {
        console.error('❌ [CLEANUP] Failed to get auth token:', error)
      }
    }

    // Remove each project
    for (const project of localProjects) {
      try {
        console.log(`🗑️  [CLEANUP] Removing project: ${project.id}`)

        // Step 1: Remove from IndexedDB
        if (project.dataStorageId) {
          try {
            await projectDataStorage.deleteProjectData(project.id)
            result.removedFromIndexedDB++
            console.log(`  ✅ Removed from IndexedDB`)
          } catch (error) {
            console.error(`  ❌ Failed to remove from IndexedDB:`, error)
            result.errors.push({
              projectId: project.id,
              error: `IndexedDB deletion failed: ${error instanceof Error ? error.message : String(error)}`
            })
          }
        }

        // Step 2: Remove from database (if requested and authenticated)
        if (deleteFromDatabase && token) {
          try {
            const response = await fetch(`/api/projects/${project.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })

            if (response.ok) {
              result.removedFromDatabase++
              console.log(`  ✅ Removed from database`)
            } else {
              const errorText = await response.text()
              console.warn(`  ⚠️ Failed to remove from database: ${response.status} ${errorText}`)
            }
          } catch (error) {
            console.error(`  ❌ Failed to remove from database:`, error)
            result.errors.push({
              projectId: project.id,
              error: `Database deletion failed: ${error instanceof Error ? error.message : String(error)}`
            })
          }
        }

        // Step 3: Remove from store (do this last so we don't lose reference)
        useProjectStore.setState((state) => ({
          projects: state.projects.filter(p => p.id !== project.id)
        }))
        result.removedFromStore++
        console.log(`  ✅ Removed from store`)

      } catch (error) {
        console.error(`❌ [CLEANUP] Failed to remove project ${project.id}:`, error)
        result.errors.push({
          projectId: project.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    console.log('🏁 [CLEANUP] Cleanup complete:', {
      removedFromStore: result.removedFromStore,
      removedFromIndexedDB: result.removedFromIndexedDB,
      removedFromDatabase: result.removedFromDatabase,
      errors: result.errors.length
    })

    return result
  } catch (error) {
    console.error('❌ [CLEANUP] Cleanup failed:', error)
    throw error
  }
}

/**
 * Get a list of all local test projects (for preview before deletion)
 */
export function getLocalProjects() {
  const { projects } = useProjectStore.getState()

  return projects.filter(project => {
    const isLocalProject = /^project-\d+-[a-z0-9]+$/.test(project.id)
    return isLocalProject
  })
}
