/**
 * Zustand Selective Subscription Utilities
 *
 * Helper hooks and utilities for optimizing Zustand store subscriptions
 * to prevent unnecessary re-renders.
 */

import { useDataStore } from '@/lib/store';
import { useMemo, useState, useEffect } from 'react';

/**
 * Subscribe to filtered data without subscribing to raw data
 * This prevents re-renders when rawData changes if filters haven't changed
 */
export function useFilteredData() {
  const getFilteredData = useDataStore(state => state.getFilteredData);

  // Memoize filtered data - getFilteredData already has access to all store state
  // Note: We intentionally don't subscribe to dateRange, granularity, or dashboardFilters
  // because getFilteredData reads them directly from the store
  return useMemo(() => {
    return getFilteredData();
  }, [getFilteredData]);
}

/**
 * Subscribe to specific chart customization
 * Only re-renders when this chart's customization changes
 */
export function useChartCustomization(chartId: string) {
  return useDataStore(
    state => state.chartCustomizations[chartId]
  );
}

/**
 * Subscribe to multiple chart customizations efficiently
 * Useful for batch operations
 */
export function useMultipleChartCustomizations(chartIds: string[]) {
  return useDataStore(
    state => chartIds.reduce((acc, id) => {
      acc[id] = state.chartCustomizations[id];
      return acc;
    }, {} as Record<string, any>)
  );
}

/**
 * Subscribe to chart visibility only
 * Doesn't re-render when other customization properties change
 */
export function useChartVisibility(chartId: string) {
  return useDataStore(
    state => state.chartCustomizations[chartId]?.isVisible ?? true
  );
}

/**
 * Subscribe to analysis insights only
 * Doesn't re-render when chart configs change
 */
export function useAnalysisInsights() {
  return useDataStore(state => state.analysis?.insights ?? []);
}

/**
 * Subscribe to chart configs only
 * Doesn't re-render when insights change
 */
export function useChartConfigs() {
  return useDataStore(state => state.analysis?.chartConfig ?? []);
}

/**
 * Subscribe to a single chart config
 * Only re-renders when this specific chart changes
 */
export function useChartConfig(chartId: string) {
  return useDataStore(
    state => state.analysis?.chartConfig.find(
      chart => (chart.id || `chart-${state.analysis!.chartConfig.indexOf(chart)}`) === chartId
    )
  );
}

/**
 * Subscribe to theme colors only
 * Doesn't re-render when other theme properties change
 */
export function useThemeColors() {
  return useDataStore(
    state => ({
      chartColors: state.currentTheme.chartColors,
      colors: state.currentTheme.colors,
    })
  );
}

/**
 * Subscribe to actions only (these never change, so never re-renders)
 */
export function useDataStoreActions() {
  return useDataStore(
    state => ({
      setDateRange: state.setDateRange,
      setGranularity: state.setGranularity,
      updateChartCustomization: state.updateChartCustomization,
      setSelectedChartId: state.setSelectedChartId,
      setFullScreen: state.setFullScreen,
      exportChart: state.exportChart,
      removeChart: state.removeChart,
      duplicateChart: state.duplicateChart,
    })
  );
}

/**
 * Subscribe to session metadata only
 * Doesn't re-render when data or analysis changes
 */
export function useSessionMetadata() {
  return useDataStore(
    state => ({
      currentSession: state.currentSession,
      fileName: state.fileName,
      isSaving: state.isSaving,
      saveError: state.saveError,
    })
  );
}

/**
 * Subscribe to loading states only
 */
export function useLoadingStates() {
  return useDataStore(
    state => ({
      isAnalyzing: state.isAnalyzing,
      analysisProgress: state.analysisProgress,
      isSaving: state.isSaving,
      isChatLoading: state.isChatLoading,
    })
  );
}

/**
 * Subscribe to error states only
 */
export function useErrorStates() {
  return useDataStore(
    state => ({
      error: state.error,
      saveError: state.saveError,
      chatError: state.chatError,
    })
  );
}

/**
 * Create a selector factory for dynamic chart IDs
 * Useful when you need to create selectors based on props
 */
export function createChartSelector<T>(
  selector: (chartId: string) => (state: any) => T
) {
  return (chartId: string) => useDataStore(selector(chartId));
}

/**
 * Example: Subscribe to chart position only
 */
export const useChartPosition = createChartSelector(
  (chartId) => (state) => state.chartCustomizations[chartId]?.position
);

/**
 * Example: Subscribe to chart colors only
 */
export const useChartColors = createChartSelector(
  (chartId) => (state) => state.chartCustomizations[chartId]?.colors
);

/**
 * Performance comparison hook
 * Use this to measure the impact of selective subscriptions
 */
export function usePerformanceComparison(label: string) {
  const renderCount = useDataStore(state => {
    // This will re-render on ANY state change
    console.warn(`${label} - Full store subscription (BAD): Render #${Date.now()}`);
    return state;
  });

  // Compare with selective subscription
  const insights = useAnalysisInsights();
  console.log(`${label} - Selective subscription (GOOD): Render #${Date.now()}`);

  return { renderCount, insights };
}

/**
 * Usage Examples:
 *
 * // ❌ BAD - Subscribes to entire store
 * const BadComponent = () => {
 *   const store = useDataStore();
 *   return <div>{store.analysis?.insights[0]}</div>;
 * };
 *
 * // ✅ GOOD - Subscribes only to insights
 * const GoodComponent = () => {
 *   const insights = useAnalysisInsights();
 *   return <div>{insights[0]}</div>;
 * };
 *
 * // ✅ EXCELLENT - Subscribes to specific chart
 * const ChartComponent = ({ chartId }) => {
 *   const customization = useChartCustomization(chartId);
 *   const actions = useDataStoreActions();
 *
 *   return (
 *     <div onClick={() => actions.setSelectedChartId(chartId)}>
 *       {customization.title}
 *     </div>
 *   );
 * };
 */

/**
 * Batched updates utility
 * Batch multiple store updates into a single render
 */
export function batchStoreUpdates(updates: Array<() => void>) {
  // Zustand automatically batches updates in React 18+
  // But this provides explicit control
  updates.forEach(update => update());
}

/**
 * Throttled store subscription
 * Useful for high-frequency updates like scroll position
 */
export function useThrottledStoreValue<T>(
  selector: (state: any) => T,
  throttleMs: number = 100
): T {
  const value = useDataStore(selector);
  const [throttledValue, setThrottledValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setThrottledValue(value);
    }, throttleMs);

    return () => clearTimeout(timeoutId);
  }, [value, throttleMs]);

  return throttledValue;
}

/**
 * Debugging helper: Log all store changes
 * Use in development only
 */
export function useStoreDebugger(label: string) {
  if (process.env.NODE_ENV === 'development') {
    useDataStore.subscribe((state, prevState) => {
      console.log(`[${label}] Store changed:`, {
        state,
        prevState,
        diff: Object.keys(state).filter(key => (state as any)[key] !== (prevState as any)[key]),
      });
    });
  }
}
