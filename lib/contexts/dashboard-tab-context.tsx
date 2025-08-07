'use client'

import React, { createContext, useContext } from 'react'

interface DashboardTabContextType {
  activeTabId: string
  tabAnalyses: Record<string, any>
  setTabAnalyses: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

const DashboardTabContext = createContext<DashboardTabContextType | undefined>(undefined)

export function DashboardTabProvider({ 
  children, 
  activeTabId,
  tabAnalyses,
  setTabAnalyses 
}: {
  children: React.ReactNode
  activeTabId: string
  tabAnalyses: Record<string, any>
  setTabAnalyses: React.Dispatch<React.SetStateAction<Record<string, any>>>
}) {
  return (
    <DashboardTabContext.Provider value={{ activeTabId, tabAnalyses, setTabAnalyses }}>
      {children}
    </DashboardTabContext.Provider>
  )
}

export function useDashboardTab() {
  const context = useContext(DashboardTabContext)
  if (context === undefined) {
    throw new Error('useDashboardTab must be used within a DashboardTabProvider')
  }
  return context
}