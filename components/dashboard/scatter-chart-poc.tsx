'use client';

/**
 * SCATTER/BUBBLE CHART PROOF OF CONCEPT
 *
 * This component demonstrates the CORRECT way to implement scatter/bubble charts in Recharts.
 *
 * KEY INSIGHTS:
 * 1. Multiple <Scatter> components: Each data series (campaign) needs its own <Scatter> component
 * 2. ZAxis for bubble sizing: Use <ZAxis> with type="number" and dataKey for the size dimension
 * 3. Data grouping: Group your data by the categorical dimension (campaign) BEFORE rendering
 * 4. NO Cell components: Unlike bar charts, scatter charts don't use <Cell> for coloring
 * 5. Color per Scatter: Each <Scatter> component gets its own fill color
 *
 * APPROACH:
 * - Raw data contains all points with multiple dimensions (x, y, size, category)
 * - Group data by campaign (or whatever categorical dimension)
 * - Render one <Scatter> component per campaign
 * - Each scatter component renders all points for that campaign
 * - ZAxis controls bubble size based on impressions (or size dimension)
 */

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

// Sample data structure - advertising efficiency example
const SAMPLE_DATA = [
  { spend: 5.23, sales: 89.45, impressions: 15234, campaign: 'Campaign A' },
  { spend: 15.67, sales: 50.12, impressions: 42156, campaign: 'Campaign B' },
  { spend: 8.91, sales: 120.34, impressions: 28945, campaign: 'Campaign A' },
  { spend: 22.45, sales: 180.67, impressions: 55678, campaign: 'Campaign C' },
  { spend: 12.34, sales: 95.23, impressions: 35421, campaign: 'Campaign B' },
  { spend: 18.76, sales: 210.45, impressions: 48932, campaign: 'Campaign A' },
  { spend: 25.89, sales: 145.67, impressions: 62143, campaign: 'Campaign C' },
  { spend: 9.45, sales: 78.90, impressions: 25678, campaign: 'Campaign D' },
  { spend: 31.23, sales: 265.34, impressions: 71234, campaign: 'Campaign B' },
  { spend: 14.56, sales: 156.78, impressions: 38765, campaign: 'Campaign A' },
  { spend: 20.34, sales: 190.23, impressions: 52341, campaign: 'Campaign C' },
  { spend: 11.78, sales: 98.45, impressions: 31245, campaign: 'Campaign D' },
  { spend: 28.90, sales: 245.67, impressions: 68453, campaign: 'Campaign E' },
  { spend: 16.45, sales: 175.34, impressions: 44567, campaign: 'Campaign B' },
  { spend: 7.89, sales: 102.45, impressions: 22134, campaign: 'Campaign A' },
  { spend: 24.67, sales: 198.76, impressions: 58976, campaign: 'Campaign C' },
  { spend: 13.21, sales: 115.67, impressions: 36789, campaign: 'Campaign D' },
  { spend: 19.87, sales: 220.34, impressions: 50123, campaign: 'Campaign E' },
  { spend: 10.56, sales: 125.45, impressions: 29876, campaign: 'Campaign A' },
  { spend: 26.78, sales: 230.12, impressions: 64321, campaign: 'Campaign B' },
];

// Color palette for campaigns
const CAMPAIGN_COLORS: Record<string, string> = {
  'Campaign A': '#8b5cf6', // Purple
  'Campaign B': '#3b82f6', // Blue
  'Campaign C': '#10b981', // Green
  'Campaign D': '#f59e0b', // Orange
  'Campaign E': '#ef4444', // Red
};

interface DataPoint {
  spend: number;
  sales: number;
  impressions: number;
  campaign: string;
}

interface GroupedData {
  [campaign: string]: DataPoint[];
}

// Custom tooltip to show all dimensions
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DataPoint;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-2">{data.campaign}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Spend: ${data.spend.toFixed(2)}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Sales: ${data.sales.toFixed(2)}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Impressions: {data.impressions.toLocaleString()}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          ROI: {((data.sales / data.spend) * 100).toFixed(0)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function ScatterChartPOC() {
  // Step 1: Group data by campaign
  const groupedData = useMemo(() => {
    console.log('=== SCATTER CHART POC: Data Transformation ===');
    console.log('Raw data points:', SAMPLE_DATA.length);

    const grouped = SAMPLE_DATA.reduce<GroupedData>((acc, point) => {
      if (!acc[point.campaign]) {
        acc[point.campaign] = [];
      }
      acc[point.campaign].push(point);
      return acc;
    }, {});

    console.log('Grouped by campaign:', Object.keys(grouped));
    Object.entries(grouped).forEach(([campaign, points]) => {
      console.log(`  ${campaign}: ${points.length} points`);
    });

    return grouped;
  }, []);

  // Step 2: Calculate size range for ZAxis
  const sizeRange = useMemo(() => {
    const allImpressions = SAMPLE_DATA.map(d => d.impressions);
    const min = Math.min(...allImpressions);
    const max = Math.max(...allImpressions);
    console.log('Impressions range:', { min, max });
    return [min, max];
  }, []);

  return (
    <div className="w-full h-full p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Scatter/Bubble Chart POC
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Advertising Efficiency: Spend vs Sales (bubble size = impressions)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart
          margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          {/* X-Axis: Spend */}
          <XAxis
            type="number"
            dataKey="spend"
            name="Spend"
            label={{ value: 'Ad Spend ($)', position: 'bottom', offset: 0 }}
            domain={[0, 'auto']}
          />

          {/* Y-Axis: Sales */}
          <YAxis
            type="number"
            dataKey="sales"
            name="Sales"
            label={{ value: 'Sales ($)', angle: -90, position: 'insideLeft' }}
            domain={[0, 'auto']}
          />

          {/* Z-Axis: Controls bubble size based on impressions */}
          <ZAxis
            type="number"
            dataKey="impressions"
            range={[50, 400]} // Min and max bubble sizes in pixels
            name="Impressions"
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/*
            CRITICAL: Render one <Scatter> component per campaign
            Each scatter gets its own color and renders all points for that campaign
          */}
          {Object.entries(groupedData).map(([campaign, points]) => (
            <Scatter
              key={campaign}
              name={campaign}
              data={points}
              fill={CAMPAIGN_COLORS[campaign]}
              fillOpacity={0.6}
              stroke={CAMPAIGN_COLORS[campaign]}
              strokeWidth={2}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Debug info */}
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs">
        <p className="font-semibold mb-2">Implementation Details:</p>
        <ul className="space-y-1 text-gray-700 dark:text-gray-300">
          <li>Total data points: {SAMPLE_DATA.length}</li>
          <li>Campaigns: {Object.keys(groupedData).length}</li>
          <li>X-axis: spend (0-35)</li>
          <li>Y-axis: sales (0-280)</li>
          <li>Z-axis (size): impressions ({sizeRange[0].toLocaleString()} - {sizeRange[1].toLocaleString()})</li>
          <li className="mt-2 font-semibold">Check console for data transformation logs</li>
        </ul>
      </div>
    </div>
  );
}
