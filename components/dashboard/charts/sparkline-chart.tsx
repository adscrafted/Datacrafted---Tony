"use client";

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';
import { parseNumericValue } from '@/lib/utils/data-calculations';

interface SparklineChartProps {
  data: any[];
  dataMapping: {
    xAxis: string;
    yAxis: string;
  };
  width?: number;
  height?: number;
  color?: string;
  showTooltip?: boolean;
  showDots?: boolean;
  strokeWidth?: number;
  fillArea?: boolean;
}

interface TransformedDataPoint {
  x: any;
  y: number;
  xLabel: string;
}

const DEFAULT_COLOR = '#3b82f6'; // blue-500

export default function SparklineChart({
  data,
  dataMapping,
  width,
  height = 40,
  color = DEFAULT_COLOR,
  showTooltip = true,
  showDots = false,
  strokeWidth = 2,
  fillArea = false,
}: SparklineChartProps) {
  const transformedData = useMemo((): TransformedDataPoint[] => {
    if (!data || data.length === 0) {
      console.log('🔍 [SPARKLINE] No data provided');
      return [];
    }

    console.log('🔍 [SPARKLINE] Processing data:', {
      dataLength: data.length,
      xAxis: dataMapping.xAxis,
      yAxis: dataMapping.yAxis,
      firstRow: data[0],
      sampleValues: data.slice(0, 3).map(row => ({ x: row[dataMapping.xAxis], y: row[dataMapping.yAxis] }))
    });

    const transformed = data.map((row) => {
      const xValue = row[dataMapping.xAxis];
      const yValue = parseNumericValue(row[dataMapping.yAxis]) ?? 0;

      return {
        x: xValue,
        y: yValue,
        xLabel: String(xValue),
      };
    });

    console.log('🔍 [SPARKLINE] Transformed data:', {
      count: transformed.length,
      firstFew: transformed.slice(0, 5),
      yValues: transformed.map(d => d.y)
    });

    return transformed;
  }, [data, dataMapping]);

  if (transformedData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-xs"
        style={{ width: width || '100%', height }}
      >
        No data
      </div>
    );
  }

  // Calculate min/max/current for better scaling and display
  const values = transformedData.map(d => d.y);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const currentValue = values[values.length - 1]; // Last value
  const previousValue = values.length > 1 ? values[values.length - 2] : currentValue;
  const percentChange = previousValue !== 0
    ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
    : 0;
  const isPositiveTrend = percentChange >= 0;
  const padding = (maxValue - minValue) * 0.1 || 1;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white px-2 py-1 border border-gray-200 rounded shadow-sm text-xs">
        <p className="font-medium">{data.xLabel}</p>
        <p className="text-gray-600">
          {data.y.toLocaleString()}
        </p>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Top section with current value and trend */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {currentValue.toLocaleString()}
          </div>
          <div className={`text-xs font-medium ${isPositiveTrend ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositiveTrend ? '↑' : '↓'} {Math.abs(percentChange).toFixed(1)}%
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
          <div>Max: {maxValue.toLocaleString()}</div>
          <div>Min: {minValue.toLocaleString()}</div>
        </div>
      </div>

      {/* Sparkline chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={transformedData}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            {/* Hidden Y-axis for proper scaling */}
            <YAxis
              hide
              domain={[minValue - padding, maxValue + padding]}
              type="number"
            />

            {showTooltip && <Tooltip content={<CustomTooltip />} />}

            <Line
              type="monotone"
              dataKey="y"
              stroke={isPositiveTrend ? '#10b981' : '#ef4444'}
              strokeWidth={strokeWidth}
              dot={showDots ? { r: 2, fill: isPositiveTrend ? '#10b981' : '#ef4444' } : false}
              fill={fillArea ? (isPositiveTrend ? '#10b981' : '#ef4444') : 'none'}
              fillOpacity={fillArea ? 0.1 : 0}
              isAnimationActive={true}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
