"use client";

import React, { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface TreemapChartProps {
  data: any[];
  dataMapping: {
    category: string;
    value: string;
    parentCategory?: string;
  };
  customization?: {
    colors?: string[];
    showLabels?: boolean;
  };
}

interface TreeNode {
  name: string;
  size?: number;
  children?: TreeNode[];
  color?: string;
  [key: string]: any;  // Index signature for recharts compatibility
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
];

const lightenColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
};

export default function TreemapChart({
  data,
  dataMapping,
  customization = {},
}: TreemapChartProps) {
  const colors = customization.colors || DEFAULT_COLORS;

  const treeData = useMemo((): TreeNode => {
    if (!data || data.length === 0) {
      return { name: 'root', children: [] };
    }

    // Check if we have parent-child hierarchy
    const hasParent = dataMapping.parentCategory &&
      data.some(row => row[dataMapping.parentCategory!]);

    if (hasParent && dataMapping.parentCategory) {
      // Build hierarchical structure
      const parentMap = new Map<string, TreeNode>();
      const orphans: TreeNode[] = [];

      data.forEach((row, index) => {
        const category = String(row[dataMapping.category] || 'Unknown');
        const parent = row[dataMapping.parentCategory!]
          ? String(row[dataMapping.parentCategory!])
          : null;
        const value = Number(row[dataMapping.value]) || 0;

        const node: TreeNode = {
          name: category,
          size: value,
          color: colors[index % colors.length],
        };

        if (parent) {
          // Has a parent - add to parent's children
          if (!parentMap.has(parent)) {
            parentMap.set(parent, {
              name: parent,
              children: [],
              color: colors[Math.floor(index / 2) % colors.length],
            });
          }
          const parentNode = parentMap.get(parent)!;
          if (!parentNode.children) {
            parentNode.children = [];
          }
          parentNode.children.push(node);
        } else {
          // No parent - could be a root category
          if (!parentMap.has(category)) {
            parentMap.set(category, node);
          }
        }
      });

      // Collect all root nodes
      const roots = Array.from(parentMap.values()).filter(node => {
        // A node is root if it's not a child of any other node
        const isChild = Array.from(parentMap.values()).some(parent =>
          parent.children?.some(child => child.name === node.name)
        );
        return !isChild;
      });

      return {
        name: 'root',
        children: roots.length > 0 ? roots : orphans,
      };
    } else {
      // Flat structure - group by category
      const categoryMap = new Map<string, number>();

      data.forEach((row) => {
        const category = String(row[dataMapping.category] || 'Unknown');
        const value = Number(row[dataMapping.value]) || 0;

        categoryMap.set(
          category,
          (categoryMap.get(category) || 0) + value
        );
      });

      const children: TreeNode[] = Array.from(categoryMap.entries()).map(
        ([name, size], index) => ({
          name,
          size,
          color: colors[index % colors.length],
        })
      );

      return {
        name: 'root',
        children,
      };
    }
  }, [data, dataMapping, colors]);

  if (!treeData.children || treeData.children.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
        No data available for treemap
      </div>
    );
  }

  const CustomContent = (props: any) => {
    const { x, y, width, height, name, value, depth, color } = props;

    // Don't render if too small
    if (width < 20 || height < 20) return null;

    // Lighten child nodes
    const fillColor = depth > 1 ? lightenColor(color, 20) : color;

    // Calculate if we can show text
    const showText = width > 40 && height > 25;
    const showValue = width > 60 && height > 40;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fillColor,
            stroke: '#fff',
            strokeWidth: 2,
            strokeOpacity: 1,
          }}
        />
        {showText && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - (showValue ? 8 : 0)}
              textAnchor="middle"
              fill="#fff"
              fontSize={Math.min(14, width / 6)}
              fontWeight="600"
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
            >
              {name.length > width / 8 ? `${name.slice(0, Math.floor(width / 8))}...` : name}
            </text>
            {showValue && value && (
              <text
                x={x + width / 2}
                y={y + height / 2 + 12}
                textAnchor="middle"
                fill="#fff"
                fontSize={Math.min(12, width / 8)}
                fontWeight="400"
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
              >
                {typeof value === 'number' ? value.toLocaleString() : value}
              </text>
            )}
          </>
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
        <p className="font-semibold text-sm">{data.name}</p>
        {data.size !== undefined && (
          <p className="text-sm text-gray-600">
            Value: {data.size.toLocaleString()}
          </p>
        )}
        {data.children && data.children.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {data.children.length} sub-categories
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treeData.children}
          dataKey="size"
          stroke="#fff"
          fill="#3b82f6"
          content={<CustomContent />}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
