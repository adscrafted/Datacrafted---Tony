"use client";

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Rectangle,
} from 'recharts';

interface BulletChartProps {
  data: any[];
  dataMapping: {
    category: string;
    actual: string;
    target?: string;
    ranges?: string[]; // [poor, satisfactory, good] columns
  };
  customization?: {
    colors?: {
      poor?: string;
      satisfactory?: string;
      good?: string;
      actual?: string;
      target?: string;
    };
    showGrid?: boolean;
    showLabels?: boolean;
  };
}

interface TransformedDataPoint {
  category: string;
  actual: number;
  target?: number;
  poor?: number;
  satisfactory?: number;
  good?: number;
  maxRange: number;
}

const DEFAULT_COLORS = {
  poor: '#fecaca',      // red-200
  satisfactory: '#fef08a', // yellow-200
  good: '#bbf7d0',      // green-200
  actual: '#3b82f6',    // blue-500
  target: '#ef4444',    // red-500
};

export default function BulletChart({
  data,
  dataMapping,
  customization = {},
}: BulletChartProps) {
  const colors = { ...DEFAULT_COLORS, ...customization.colors };

  const transformedData = useMemo((): TransformedDataPoint[] => {
    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row) => {
      const category = String(row[dataMapping.category] || 'Unknown');
      const actual = Number(row[dataMapping.actual]) || 0;
      const target = dataMapping.target ? Number(row[dataMapping.target]) || undefined : undefined;

      const ranges = dataMapping.ranges || [];
      const poor = ranges[0] ? Number(row[ranges[0]]) || 0 : 0;
      const satisfactory = ranges[1] ? Number(row[ranges[1]]) || 0 : 0;
      const good = ranges[2] ? Number(row[ranges[2]]) || 0 : 0;

      // Calculate max range for scaling
      const maxRange = Math.max(poor, satisfactory, good, actual, target || 0);

      return {
        category,
        actual,
        target,
        poor,
        satisfactory,
        good,
        maxRange,
      };
    });
  }, [data, dataMapping]);

  if (transformedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
        No data available for bullet chart
      </div>
    );
  }

  // Calculate global max for consistent scaling
  const globalMax = Math.max(...transformedData.map(d => d.maxRange));

  const CustomBar = (props: any) => {
    const { x, y, width, height, dataKey } = props;

    // Make the bar thinner for actual values
    if (dataKey === 'actual') {
      const barHeight = height * 0.4; // 40% of full height
      const yOffset = (height - barHeight) / 2;
      return (
        <Rectangle
          x={x}
          y={y + yOffset}
          width={width}
          height={barHeight}
          fill={colors.actual}
        />
      );
    }

    return <Rectangle {...props} />;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={transformedData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
        >
          {customization.showGrid !== false && (
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          )}

          <XAxis
            type="number"
            domain={[0, globalMax * 1.1]}
            tickFormatter={(value) => value.toLocaleString()}
          />

          <YAxis
            type="category"
            dataKey="category"
            width={90}
            tick={{ fontSize: 12 }}
          />

          <Tooltip
            formatter={(value: any, name: string) => {
              const displayName = name === 'actual' ? 'Actual' :
                                 name === 'target' ? 'Target' :
                                 name === 'poor' ? 'Poor Range' :
                                 name === 'satisfactory' ? 'Satisfactory Range' :
                                 name === 'good' ? 'Good Range' : name;
              return [Number(value).toLocaleString(), displayName];
            }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />

          {/* Background ranges */}
          {dataMapping.ranges && dataMapping.ranges[0] && (
            <Bar
              dataKey="poor"
              fill={colors.poor}
              stackId="ranges"
              radius={[0, 4, 4, 0]}
            />
          )}

          {dataMapping.ranges && dataMapping.ranges[1] && (
            <Bar
              dataKey="satisfactory"
              fill={colors.satisfactory}
              stackId="ranges"
            />
          )}

          {dataMapping.ranges && dataMapping.ranges[2] && (
            <Bar
              dataKey="good"
              fill={colors.good}
              stackId="ranges"
              radius={[0, 4, 4, 0]}
            />
          )}

          {/* Actual value bar (rendered on top) */}
          <Bar
            dataKey="actual"
            fill={colors.actual}
            shape={<CustomBar />}
            radius={[0, 4, 4, 0]}
          />

          {/* Target reference lines */}
          {dataMapping.target && transformedData.map((point, index) => (
            point.target !== undefined && (
              <ReferenceLine
                key={`target-${index}`}
                x={point.target}
                stroke={colors.target}
                strokeWidth={2}
                strokeDasharray="4 4"
                segment={[
                  { x: point.target, y: index },
                  { x: point.target, y: index + 1 }
                ]}
              />
            )
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
