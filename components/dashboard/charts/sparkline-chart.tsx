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
  color = DEFAULT_COLOR,
  showTooltip = true,
  showDots = false,
  strokeWidth = 2,
  fillArea = false,
}: SparklineChartProps) {
  const transformedData = useMemo((): TransformedDataPoint[] => {
    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row) => {
      const xValue = row[dataMapping.xAxis];
      const yValue = parseNumericValue(row[dataMapping.yAxis]) ?? 0;

      return {
        x: xValue,
        y: yValue,
        xLabel: String(xValue),
      };
    });
  }, [data, dataMapping]);

  if (transformedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  // Calculate min/max/current for scaling - memoized to prevent recalculation
  const { minValue, maxValue, padding } = useMemo(() => {
    const values = transformedData.map(d => d.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || 1;
    return { minValue: min, maxValue: max, padding: pad };
  }, [transformedData]);

  const CustomTooltip = useMemo(() => {
    return ({ active, payload }: any) => {
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
  }, []);

  // Follow the same pattern as other charts - just ResponsiveContainer with 100% dimensions
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={transformedData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
      >
        <YAxis
          hide
          domain={[minValue - padding, maxValue + padding]}
          type="number"
        />

        {showTooltip && <Tooltip content={<CustomTooltip />} />}

        <Line
          type="monotone"
          dataKey="y"
          stroke={color}
          strokeWidth={strokeWidth}
          dot={showDots ? { r: 3, fill: color } : false}
          fill={fillArea ? color : 'none'}
          fillOpacity={fillArea ? 0.1 : 0}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
