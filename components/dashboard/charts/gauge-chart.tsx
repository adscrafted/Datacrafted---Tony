"use client";

import React, { useMemo } from 'react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

interface GaugeChartProps {
  data: any[];
  dataMapping: {
    metric: string;
    target?: string;
  };
  customization?: {
    min?: number;
    max?: number;
    thresholds?: Array<{ value: number; color: string; label: string }>;
  };
}

interface Threshold {
  value: number;
  color: string;
  label: string;
}

const DEFAULT_THRESHOLDS: Threshold[] = [
  { value: 30, color: '#ef4444', label: 'Low' },      // Red
  { value: 70, color: '#fbbf24', label: 'Medium' },   // Yellow
  { value: 100, color: '#10b981', label: 'High' },    // Green
];

export default function GaugeChart({
  data,
  dataMapping,
  customization = {},
}: GaugeChartProps) {
  const {
    min = 0,
    max: customMax,
    thresholds = DEFAULT_THRESHOLDS,
  } = customization;

  // Transform and calculate gauge data
  const gaugeData = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    try {
      // Extract metric and target values
      const metricValue = Number(data[0]?.[dataMapping.metric]) || 0;
      const targetValue = dataMapping.target
        ? Number(data[0]?.[dataMapping.target]) || undefined
        : undefined;

      // Determine max value
      const max = customMax ?? targetValue ?? 100;

      // Validate values
      if (isNaN(metricValue) || metricValue < 0) {
        console.warn('GaugeChart: Invalid metric value');
        return null;
      }

      // Calculate percentage
      const percentage = Math.min(((metricValue - min) / (max - min)) * 100, 100);

      // Determine color based on thresholds
      const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
      let color = sortedThresholds[0]?.color || '#gray';
      let label = sortedThresholds[0]?.label || 'Low';

      for (const threshold of sortedThresholds) {
        if (percentage >= threshold.value) {
          color = threshold.color;
          label = threshold.label;
        }
      }

      // Calculate target percentage if target exists
      const targetPercentage = targetValue
        ? Math.min(((targetValue - min) / (max - min)) * 100, 100)
        : undefined;

      return {
        value: metricValue,
        percentage,
        max,
        min,
        color,
        label,
        target: targetValue,
        targetPercentage,
      };
    } catch (error) {
      console.error('GaugeChart: Error transforming data', error);
      return null;
    }
  }, [data, dataMapping, min, customMax, thresholds]);

  // Error handling - no data
  if (!gaugeData) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No data available for gauge chart
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            Please check your data mapping configuration
          </p>
        </div>
      </div>
    );
  }

  // Error handling - invalid data structure
  if (!dataMapping.metric) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 text-sm">
            Invalid data mapping configuration
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            Metric field is required
          </p>
        </div>
      </div>
    );
  }

  // Prepare data for RadialBarChart
  const chartData = [
    {
      name: 'Value',
      value: gaugeData.percentage,
      fill: gaugeData.color,
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="70%"
          innerRadius="80%"
          outerRadius="100%"
          barSize={20}
          data={chartData}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: '#e5e7eb' }}
            dataKey="value"
            cornerRadius={10}
            fill={gaugeData.color}
            isAnimationActive={true}
            animationDuration={1000}
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Center label with value and percentage */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/4 text-center">
        <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          {gaugeData.value.toLocaleString()}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {gaugeData.percentage.toFixed(1)}%
        </div>
        <div className="text-xs font-medium mt-1" style={{ color: gaugeData.color }}>
          {gaugeData.label}
        </div>
      </div>

      {/* Target indicator line */}
      {gaugeData.target !== undefined && gaugeData.targetPercentage !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 text-center pb-2">
          <div className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span>Target: {gaugeData.target.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Min and Max labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 pb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {gaugeData.min}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {gaugeData.max}
        </span>
      </div>
    </div>
  );
}
