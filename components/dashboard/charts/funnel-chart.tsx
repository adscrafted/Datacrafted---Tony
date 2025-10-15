"use client";

import React, { useMemo } from 'react';
import {
  FunnelChart as RechartsFunc,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface FunnelChartProps {
  data: any[];
  dataMapping: {
    stage: string;
    value: string;
  };
  customization?: {
    colors?: string[];
    showPercentages?: boolean;
  };
}

interface FunnelDataPoint {
  name: string;
  value: number;
  fill: string;
  percentage: number;
  conversionRate?: number;
}

const DEFAULT_COLORS = [
  '#8b5cf6', // Purple
  '#7c3aed', // Dark purple
  '#6d28d9', // Darker purple
  '#5b21b6', // Even darker purple
  '#4c1d95', // Darkest purple
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {data.name}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Count: <span className="font-medium text-gray-900 dark:text-gray-100">{data.value.toLocaleString()}</span>
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Percentage: <span className="font-medium text-gray-900 dark:text-gray-100">{data.percentage.toFixed(1)}%</span>
      </p>
      {data.conversionRate !== undefined && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Conversion from previous: <span className="font-medium text-green-600 dark:text-green-400">{data.conversionRate.toFixed(1)}%</span>
        </p>
      )}
    </div>
  );
};

const CustomLabel = (props: any) => {
  const { x, y, width, height, value, name, payload, showPercentages } = props;

  // Get percentage from payload if available
  const percentage = payload?.percentage;

  // Validate that we have all required data
  if (!value || !name) {
    return null;
  }

  return (
    <g>
      <text
        x={x + width / 2}
        y={y + height / 2 - 10}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-sm font-semibold"
      >
        {name}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-xs"
      >
        {showPercentages && percentage !== undefined
          ? `${percentage.toFixed(1)}% (${value.toLocaleString()})`
          : value.toLocaleString()}
      </text>
    </g>
  );
};

export default function FunnelChart({
  data,
  dataMapping,
  customization = {},
}: FunnelChartProps) {
  const {
    colors = DEFAULT_COLORS,
    showPercentages = true,
  } = customization;

  // Transform and enrich data with percentages and conversion rates
  const funnelData: FunnelDataPoint[] = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    try {
      // Extract and validate data
      const rawData = data.map((item) => ({
        name: String(item[dataMapping.stage] || 'Unknown'),
        value: Number(item[dataMapping.value]) || 0,
      }));

      // Filter out invalid entries
      const validData = rawData.filter((item) => !isNaN(item.value) && item.value >= 0);

      if (validData.length === 0) {
        console.warn('FunnelChart: No valid data points found');
        return [];
      }

      // Calculate total for percentages
      const total = validData[0].value || 1; // Use first stage as 100%

      // Enrich with percentages, conversion rates, and colors
      return validData.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const conversionRate = index > 0
          ? (item.value / validData[index - 1].value) * 100
          : undefined;

        return {
          ...item,
          fill: colors[index % colors.length],
          percentage,
          conversionRate,
        };
      });
    } catch (error) {
      console.error('FunnelChart: Error transforming data', error);
      return [];
    }
  }, [data, dataMapping, colors]);

  // Error handling - no data
  if (!funnelData || funnelData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No data available for funnel chart
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            Please check your data mapping configuration
          </p>
        </div>
      </div>
    );
  }

  // Error handling - invalid data structure
  if (!dataMapping.stage || !dataMapping.value) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 text-sm">
            Invalid data mapping configuration
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            Both stage and value fields are required
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsFunc>
        <Tooltip content={<CustomTooltip />} />
        <Funnel
          data={funnelData}
          dataKey="value"
          isAnimationActive={true}
          animationDuration={800}
          animationBegin={0}
        >
          {funnelData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
          <LabelList
            position="center"
            content={(props: any) => (
              <CustomLabel {...props} showPercentages={showPercentages} />
            )}
          />
        </Funnel>
      </RechartsFunc>
    </ResponsiveContainer>
  );
}
