"use client";

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';

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
      return [];
    }

    return data.map((row) => {
      const xValue = row[dataMapping.xAxis];
      const yValue = Number(row[dataMapping.yAxis]) || 0;

      return {
        x: xValue,
        y: yValue,
        xLabel: String(xValue),
      };
    });
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

  // Calculate min/max for better scaling
  const values = transformedData.map(d => d.y);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
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

  const containerStyle: React.CSSProperties = {
    width: width || '100%',
    height,
  };

  return (
    <div style={containerStyle}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={transformedData}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
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
            stroke={color}
            strokeWidth={strokeWidth}
            dot={showDots ? { r: 2, fill: color } : false}
            fill={fillArea ? color : 'none'}
            fillOpacity={fillArea ? 0.1 : 0}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
