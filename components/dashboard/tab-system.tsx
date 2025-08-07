'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Plus, X, FileText, BarChart3, Edit2, Check, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { DateRangeSelector } from './date-range-selector'

export interface Tab {
  id: string
  name: string
  type: 'dashboard' | 'schema'
  isEditing?: boolean
  data?: any // Store dashboard-specific configurations
}

interface TabSystemProps {
  tabs: Tab[]
  activeTabId: string
  onTabChange: (tabId: string) => void
  onTabCreate: () => void
  onTabDelete: (tabId: string) => void
  onTabRename: (tabId: string, newName: string) => void
  onTabReorder?: (tabs: Tab[]) => void
}

export function TabSystem({
  tabs,
  activeTabId,
  onTabChange,
  onTabCreate,
  onTabDelete,
  onTabRename,
  onTabReorder
}: TabSystemProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [draggedTab, setDraggedTab] = useState<Tab | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  const handleStartEdit = (tab: Tab) => {
    setEditingTabId(tab.id)
    setEditingName(tab.name)
  }

  const handleSaveEdit = () => {
    if (editingTabId && editingName.trim()) {
      onTabRename(editingTabId, editingName.trim())
    }
    setEditingTabId(null)
    setEditingName('')
  }

  const handleCancelEdit = () => {
    setEditingTabId(null)
    setEditingName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleDeleteTab = (tabId: string) => {
    onTabDelete(tabId)
    setShowDeleteConfirm(null)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tab: Tab) => {
    setDraggedTab(tab)
    e.dataTransfer.effectAllowed = 'move'
    // Add a custom drag image or style
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    setDraggedTab(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (!draggedTab || !onTabReorder) return
    
    const draggedIndex = tabs.findIndex(t => t.id === draggedTab.id)
    if (draggedIndex === dropIndex) return
    
    const newTabs = [...tabs]
    const [removed] = newTabs.splice(draggedIndex, 1)
    newTabs.splice(dropIndex, 0, removed)
    
    onTabReorder(newTabs)
    setDragOverIndex(null)
  }

  // Check if we can add more tabs (max 5)
  const canAddMoreTabs = tabs.length < 5

  // Delete Confirmation Dialog
  const DeleteConfirmDialog = ({ tabId }: { tabId: string }) => {
    const tab = tabs.find(t => t.id === tabId)
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
            <h3 className="text-lg font-semibold text-gray-900">Delete Tab</h3>
          </div>
          
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete the tab <strong>"{tab?.name}"</strong>? This action cannot be undone.
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
              onClick={() => handleDeleteTab(tabId)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors"
            >
              Delete Tab
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between border-b bg-gray-50 sticky top-0 z-30">
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
        {/* Tabs */}
        <div className="flex items-center">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tab)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                "group relative flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer",
                activeTabId === tab.id
                  ? "border-blue-500 text-blue-600 bg-white"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                dragOverIndex === index && "bg-blue-50 border-blue-300"
              )}
              onClick={() => onTabChange(tab.id)}
            >
              {/* Drag Handle */}
              <GripVertical className={cn(
                "h-3 w-3 mr-1 cursor-move",
                "opacity-0 group-hover:opacity-50 transition-opacity",
                draggedTab?.id === tab.id && "opacity-100"
              )} />
              {/* Tab Icon */}
              {tab.type === 'schema' ? (
                <FileText className="h-4 w-4 mr-2" />
              ) : (
                <BarChart3 className="h-4 w-4 mr-2" />
              )}

              {/* Tab Name */}
              {editingTabId === tab.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-b border-blue-500 outline-none w-24"
                />
              ) : (
                <span className="whitespace-nowrap">{tab.name}</span>
              )}

              {/* Tab Actions - Temporarily disabled dropdown for debugging */}
              {tab.type !== 'schema' && (
                <div className="ml-2 flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
                      activeTabId === tab.id && "opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartEdit(tab)
                    }}
                    title="Rename"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  {/* Only show delete if not the last dashboard tab */}
                  {!(tab.type === 'dashboard' && tabs.filter(t => t.type === 'dashboard').length <= 1) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600",
                        activeTabId === tab.id && "opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDeleteConfirm(tab.id)
                      }}
                      title="Delete"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add New Tab Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onTabCreate}
            disabled={!canAddMoreTabs}
            className="ml-2 h-8 px-2"
            title={canAddMoreTabs ? "Add new dashboard" : "Maximum 5 tabs allowed"}
          >
            <Plus className="h-4 w-4" />
            {canAddMoreTabs && <span className="ml-1 text-xs">New</span>}
          </Button>
        </div>
      </div>
      
      {/* Date Range Selector */}
      <div className="px-4">
        <DateRangeSelector />
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && <DeleteConfirmDialog tabId={showDeleteConfirm} />}
    </div>
  )
}