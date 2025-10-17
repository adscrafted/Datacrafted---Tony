/**
 * Data Sampling Utilities for Chart Performance Optimization
 *
 * These functions reduce the number of data points rendered in charts
 * while preserving the visual shape and trends of the data.
 */

import { DataRow } from '@/lib/store';

/**
 * Simple downsampling: Take every nth point
 * Fast but may miss important peaks/valleys
 */
export function simpleDownsample(
  data: DataRow[],
  targetPoints: number
): DataRow[] {
  if (data.length <= targetPoints) return data;

  const step = Math.ceil(data.length / targetPoints);
  return data.filter((_, index) => index % step === 0 || index === data.length - 1);
}

/**
 * LTTB (Largest Triangle Three Buckets) Algorithm
 *
 * Intelligently downsamples data while preserving visual shape
 * by selecting points that form the largest triangles.
 *
 * Reference: https://github.com/sveinn-steinarsson/flot-downsample
 */
export function lttbDownsample(
  data: DataRow[],
  targetPoints: number,
  xKey: string = 'x',
  yKey: string = 'y'
): DataRow[] {
  if (data.length <= targetPoints) return data;
  if (targetPoints < 3) return [data[0], data[data.length - 1]];

  const sampled: DataRow[] = [];
  const bucketSize = (data.length - 2) / (targetPoints - 2);

  // Always include first point
  sampled.push(data[0]);

  for (let i = 0; i < targetPoints - 2; i++) {
    // Calculate average point in next bucket for triangle area calculation
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(
      Math.floor((i + 2) * bucketSize) + 1,
      data.length
    );

    let avgX = 0;
    let avgY = 0;
    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += getNumericValue(data[j], xKey);
      avgY += getNumericValue(data[j], yKey);
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    // Get the current bucket
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

    // Point a (previous selected point)
    const pointAX = getNumericValue(sampled[sampled.length - 1], xKey);
    const pointAY = getNumericValue(sampled[sampled.length - 1], yKey);

    let maxArea = -1;
    let maxAreaPoint = data[rangeStart];

    for (let j = rangeStart; j < rangeEnd; j++) {
      const pointX = getNumericValue(data[j], xKey);
      const pointY = getNumericValue(data[j], yKey);

      // Calculate triangle area
      const area = Math.abs(
        (pointAX - avgX) * (pointY - pointAY) -
        (pointAX - pointX) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = data[j];
      }
    }

    sampled.push(maxAreaPoint);
  }

  // Always include last point
  sampled.push(data[data.length - 1]);

  return sampled;
}

/**
 * Time-based sampling: Sample at regular time intervals
 * Best for time-series data
 */
export function timeBasedSample(
  data: DataRow[],
  targetPoints: number,
  dateKey: string = 'date'
): DataRow[] {
  if (data.length <= targetPoints) return data;

  // Sort by date first
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a[dateKey] as string | Date).getTime();
    const dateB = new Date(b[dateKey] as string | Date).getTime();
    return dateA - dateB;
  });

  const firstDate = new Date(sortedData[0][dateKey] as string | Date).getTime();
  const lastDate = new Date(sortedData[sortedData.length - 1][dateKey] as string | Date).getTime();
  const timeInterval = (lastDate - firstDate) / (targetPoints - 1);

  const sampled: DataRow[] = [sortedData[0]];

  let nextTargetTime = firstDate + timeInterval;
  for (let i = 1; i < sortedData.length - 1; i++) {
    const currentTime = new Date(sortedData[i][dateKey] as string | Date).getTime();

    if (currentTime >= nextTargetTime) {
      sampled.push(sortedData[i]);
      nextTargetTime += timeInterval;
    }
  }

  sampled.push(sortedData[sortedData.length - 1]);

  return sampled;
}

/**
 * Min-Max sampling: Preserve peaks and valleys
 * Shows the range of values in each bucket
 */
export function minMaxSample(
  data: DataRow[],
  targetPoints: number,
  yKey: string = 'y'
): DataRow[] {
  if (data.length <= targetPoints) return data;

  const bucketSize = Math.ceil(data.length / (targetPoints / 2));
  const sampled: DataRow[] = [];

  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, i + bucketSize);

    let minPoint = bucket[0];
    let maxPoint = bucket[0];
    let minValue = getNumericValue(bucket[0], yKey);
    let maxValue = getNumericValue(bucket[0], yKey);

    for (const point of bucket) {
      const value = getNumericValue(point, yKey);
      if (value < minValue) {
        minValue = value;
        minPoint = point;
      }
      if (value > maxValue) {
        maxValue = value;
        maxPoint = point;
      }
    }

    // Add both min and max to preserve range
    if (minPoint !== maxPoint) {
      sampled.push(minPoint);
      sampled.push(maxPoint);
    } else {
      sampled.push(minPoint);
    }
  }

  return sampled;
}

/**
 * Auto-select best sampling strategy based on data characteristics
 */
export function autoSample(
  data: DataRow[],
  targetPoints: number = 500,
  options?: {
    xKey?: string;
    yKey?: string;
    dateKey?: string;
  }
): DataRow[] {
  if (data.length <= targetPoints) return data;

  const { xKey, yKey, dateKey } = options || {};

  // Detect if data has date column
  const hasDateColumn = dateKey && data[0]?.[dateKey];

  // Use time-based sampling for time-series data
  if (hasDateColumn) {
    return timeBasedSample(data, targetPoints, dateKey);
  }

  // Use LTTB for x/y scatter data
  if (xKey && yKey) {
    return lttbDownsample(data, targetPoints, xKey, yKey);
  }

  // Fallback to simple downsampling
  return simpleDownsample(data, targetPoints);
}

/**
 * Get numeric value from DataRow, handling various data types
 */
function getNumericValue(row: DataRow, key: string): number {
  const value = row[key];

  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * Calculate optimal target points based on container width
 */
export function calculateOptimalPoints(containerWidth: number): number {
  // Rule of thumb: 1 data point per 2 pixels for smooth visualization
  const basePoints = Math.floor(containerWidth / 2);

  // Clamp between reasonable limits
  return Math.min(Math.max(basePoints, 100), 1000);
}

/**
 * Performance-aware data processor
 * Automatically samples data if it exceeds performance threshold
 */
export function processDataForChart(
  data: DataRow[],
  containerWidth: number,
  options?: {
    xKey?: string;
    yKey?: string;
    dateKey?: string;
    forceSampling?: boolean;
  }
): {
  processedData: DataRow[];
  wasSampled: boolean;
  originalCount: number;
  sampledCount: number;
} {
  const targetPoints = calculateOptimalPoints(containerWidth);
  const shouldSample = options?.forceSampling || data.length > targetPoints;

  if (!shouldSample) {
    return {
      processedData: data,
      wasSampled: false,
      originalCount: data.length,
      sampledCount: data.length,
    };
  }

  const sampledData = autoSample(data, targetPoints, options);

  return {
    processedData: sampledData,
    wasSampled: true,
    originalCount: data.length,
    sampledCount: sampledData.length,
  };
}

/**
 * Example usage in a chart component:
 *
 * Use processDataForChart with your data and container width,
 * then render the processedData in your chart component.
 * The wasSampled flag indicates if sampling occurred.
 */
