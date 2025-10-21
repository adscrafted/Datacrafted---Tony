'use client'

import { useState } from 'react'
import { cleanupLocalProjects, getLocalProjects, type CleanupResult } from '@/lib/utils/cleanup-local-projects'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function CleanupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<CleanupResult | null>(null)
  const [localProjects, setLocalProjects] = useState<any[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const handlePreview = () => {
    const projects = getLocalProjects()
    setLocalProjects(projects)
    setShowPreview(true)
  }

  const handleCleanup = async (deleteFromDatabase: boolean) => {
    if (!confirm(`Are you sure you want to delete ${localProjects.length} local test projects?${deleteFromDatabase ? ' This will also delete them from the database!' : ''}`)) {
      return
    }

    setIsLoading(true)
    try {
      const cleanupResult = await cleanupLocalProjects({
        deleteFromDatabase,
        dryRun: false
      })
      setResult(cleanupResult)

      // Refresh preview
      const projects = getLocalProjects()
      setLocalProjects(projects)
    } catch (error) {
      console.error('Cleanup failed:', error)
      alert('Cleanup failed: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Project Cleanup Utility</h1>
        <p className="text-gray-600 mb-8">
          Remove all local test projects (with timestamp-based IDs)
        </p>

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Preview Projects</h2>
          <Button onClick={handlePreview} disabled={isLoading}>
            Show Local Projects
          </Button>

          {showPreview && (
            <div className="mt-4">
              <p className="font-semibold mb-2">
                Found {localProjects.length} local test projects:
              </p>
              {localProjects.length === 0 ? (
                <p className="text-gray-500">No local projects found</p>
              ) : (
                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Project ID</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localProjects.map((project) => (
                        <tr key={project.id} className="border-t">
                          <td className="p-2 font-mono text-xs">{project.id}</td>
                          <td className="p-2">{project.name}</td>
                          <td className="p-2 text-gray-500">
                            {new Date(project.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>

        {showPreview && localProjects.length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Delete Projects</h2>
            <div className="space-y-3">
              <Button
                onClick={() => handleCleanup(false)}
                disabled={isLoading}
                className="mr-3"
                variant="destructive"
              >
                Delete from Local Storage Only
              </Button>
              <Button
                onClick={() => handleCleanup(true)}
                disabled={isLoading}
                variant="destructive"
              >
                Delete from Local Storage AND Database
              </Button>
              {isLoading && (
                <p className="text-sm text-gray-500 mt-2">
                  Cleaning up projects...
                </p>
              )}
            </div>
          </Card>
        )}

        {result && (
          <Card className="p-6 bg-green-50 border-green-200">
            <h2 className="text-xl font-semibold mb-4 text-green-800">
              Cleanup Complete!
            </h2>
            <div className="space-y-2 text-sm">
              <p>✅ Removed from Store: <strong>{result.removedFromStore}</strong></p>
              <p>✅ Removed from IndexedDB: <strong>{result.removedFromIndexedDB}</strong></p>
              <p>✅ Removed from Database: <strong>{result.removedFromDatabase}</strong></p>
              {result.errors.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="font-semibold text-yellow-800 mb-2">
                    ⚠️ Errors ({result.errors.length}):
                  </p>
                  <ul className="text-xs space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i} className="text-yellow-700">
                        {error.projectId}: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">ℹ️ What gets deleted?</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Projects with IDs matching pattern: <code>project-{'{timestamp}'}-{'{random}'}</code></li>
            <li>• Associated data from IndexedDB</li>
            <li>• Optionally: Associated data from PostgreSQL database</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
