import { create } from 'zustand'
import { DataRow, DataSchema, AnalysisResult, useDataStore } from './store'

export interface DatasetInfo {
  id: string
  name: string
  data: DataRow[]
  schema?: DataSchema
  analysis?: AnalysisResult
}

interface MultiDatasetStore {
  // Multiple datasets support
  datasets: DatasetInfo[]
  activeDatasetId: string | null
  
  // Actions
  addDataset: (dataset: DatasetInfo) => void
  setActiveDataset: (datasetId: string) => void
  updateDataset: (datasetId: string, updates: Partial<DatasetInfo>) => void
  removeDataset: (datasetId: string) => void
  clearAllDatasets: () => void
  getActiveDataset: () => DatasetInfo | null
  
  // Integration with main store
  syncActiveDatasetToMainStore: () => void
}

export const useMultiDatasetStore = create<MultiDatasetStore>((set, get) => ({
  datasets: [],
  activeDatasetId: null,
  
  addDataset: (dataset) => set((state) => ({
    datasets: [...state.datasets, dataset]
  })),
  
  setActiveDataset: (datasetId) => {
    set({ activeDatasetId: datasetId })
    // Sync to main store when active dataset changes
    get().syncActiveDatasetToMainStore()
  },
  
  updateDataset: (datasetId, updates) => set((state) => ({
    datasets: state.datasets.map(ds => 
      ds.id === datasetId ? { ...ds, ...updates } : ds
    )
  })),
  
  removeDataset: (datasetId) => set((state) => {
    const newDatasets = state.datasets.filter(ds => ds.id !== datasetId)
    const newActiveId = state.activeDatasetId === datasetId 
      ? (newDatasets[0]?.id || null)
      : state.activeDatasetId
    
    return {
      datasets: newDatasets,
      activeDatasetId: newActiveId
    }
  }),
  
  clearAllDatasets: () => set({
    datasets: [],
    activeDatasetId: null
  }),
  
  getActiveDataset: () => {
    const state = get()
    return state.datasets.find(ds => ds.id === state.activeDatasetId) || null
  },
  
  syncActiveDatasetToMainStore: () => {
    const activeDataset = get().getActiveDataset()
    const mainStore = useDataStore.getState()
    
    if (activeDataset) {
      mainStore.setRawData(activeDataset.data)
      if (activeDataset.schema) {
        mainStore.setDataSchema(activeDataset.schema)
      }
      if (activeDataset.analysis) {
        mainStore.setAnalysis(activeDataset.analysis)
      }
    }
  }
}))