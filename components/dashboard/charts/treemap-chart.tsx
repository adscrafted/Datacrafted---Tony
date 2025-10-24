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
  // Stabilize colors to prevent unnecessary recalculation
  const colors = useMemo(() =>
    customization.colors || DEFAULT_COLORS,
    [customization.colors]
  );

  const treeData = useMemo((): TreeNode => {
    if (!data || data.length === 0) {
      return { name: 'root', children: [] };
    }

    // Check if we have parent-child hierarchy
    const hasParent = dataMapping.parentCategory &&
      data.some(row => row[dataMapping.parentCategory!]);

    if (hasParent && dataMapping.parentCategory) {
      // Build hierarchical structure WITH 80/20 rule applied at each level
      const parentMap = new Map<string, TreeNode>();

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

      // Apply 80/20 rule to each parent's children (but keep at least top 3)
      parentMap.forEach((parentNode) => {
        if (parentNode.children && parentNode.children.length > 1) {
          // Sort children by size
          const sortedChildren = [...parentNode.children].sort((a, b) =>
            (b.size || 0) - (a.size || 0)
          );

          // Always keep at least top 3-5 items OR items that make up 80% of value
          const minItemsToShow = Math.min(5, sortedChildren.length);
          const total = sortedChildren.reduce((sum, child) => sum + (child.size || 0), 0);
          const threshold = total * 0.8;

          let cumulative = 0;
          const mainChildren: TreeNode[] = [];
          const otherChildren: TreeNode[] = [];

          sortedChildren.forEach((child, index) => {
            // Keep item if: (1) it's in top 5 OR (2) we haven't reached 80% threshold yet
            if (index < minItemsToShow || cumulative < threshold) {
              mainChildren.push(child);
              cumulative += child.size || 0;
            } else {
              otherChildren.push(child);
            }
          });

          // Group remaining into "Others" (only if there are items to group)
          if (otherChildren.length > 0) {
            const othersTotal = otherChildren.reduce((sum, child) => sum + (child.size || 0), 0);
            mainChildren.push({
              name: 'Others',
              size: othersTotal,
              color: '#94a3b8', // gray
            });
          }

          parentNode.children = mainChildren;
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

      // Also apply 80/20 rule to root level (but keep at least top 5-8 roots)
      const sortedRoots = roots.sort((a, b) => {
        const aTotal = a.size || (a.children?.reduce((sum, c) => sum + (c.size || 0), 0) || 0);
        const bTotal = b.size || (b.children?.reduce((sum, c) => sum + (c.size || 0), 0) || 0);
        return bTotal - aTotal;
      });

      const minRootsToShow = Math.min(8, sortedRoots.length);
      const rootTotal = sortedRoots.reduce((sum, node) => {
        const nodeTotal = node.size || (node.children?.reduce((s, c) => s + (c.size || 0), 0) || 0);
        return sum + nodeTotal;
      }, 0);

      const rootThreshold = rootTotal * 0.8;
      let rootCumulative = 0;
      const mainRoots: TreeNode[] = [];
      const otherRoots: TreeNode[] = [];

      sortedRoots.forEach((root, index) => {
        const rootValue = root.size || (root.children?.reduce((s, c) => s + (c.size || 0), 0) || 0);
        // Keep item if: (1) it's in top 8 OR (2) we haven't reached 80% threshold yet
        if (index < minRootsToShow || rootCumulative < rootThreshold) {
          mainRoots.push(root);
          rootCumulative += rootValue;
        } else {
          otherRoots.push(root);
        }
      });

      // Group other roots (only if there are items to group)
      if (otherRoots.length > 0) {
        const othersTotal = otherRoots.reduce((sum, root) => {
          return sum + (root.size || (root.children?.reduce((s, c) => s + (c.size || 0), 0) || 0));
        }, 0);
        mainRoots.push({
          name: 'Others',
          size: othersTotal,
          color: '#94a3b8',
        });
      }

      return {
        name: 'root',
        children: mainRoots,
      };
    } else {
      // Flat structure - group by category with 80/20 rule
      const categoryMap = new Map<string, number>();

      data.forEach((row) => {
        const category = String(row[dataMapping.category] || 'Unknown');
        const value = Number(row[dataMapping.value]) || 0;

        categoryMap.set(
          category,
          (categoryMap.get(category) || 0) + value
        );
      });

      // Sort categories by value (descending)
      const sortedCategories = Array.from(categoryMap.entries()).sort(
        ([, a], [, b]) => b - a
      );

      // Calculate total value
      const totalValue = sortedCategories.reduce((sum, [, value]) => sum + value, 0);

      // Apply 80/20 rule: keep categories until we reach 80% of total value
      let cumulativeValue = 0;
      const threshold = totalValue * 0.8;
      const mainCategories: TreeNode[] = [];
      const otherCategories: Array<[string, number]> = [];

      sortedCategories.forEach(([name, size], index) => {
        if (cumulativeValue < threshold) {
          // Add to main categories
          mainCategories.push({
            name,
            size,
            color: colors[index % colors.length],
          });
          cumulativeValue += size;
        } else {
          // Add to "Others" group
          otherCategories.push([name, size]);
        }
      });

      // Create "Others" category if there are grouped items
      const children: TreeNode[] = [...mainCategories];
      if (otherCategories.length > 0) {
        const othersTotal = otherCategories.reduce((sum, [, value]) => sum + value, 0);
        children.push({
          name: 'Others',
          size: othersTotal,
          color: '#94a3b8', // gray color for "Others"
        });
      }

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

    // Don't render the root node wrapper (depth 0)
    if (depth === 0 || name === 'root') {
      return null;
    }

    // Don't render boxes that are too small
    if (width < 20 || height < 20) {
      return null;
    }

    // Use the provided color, or fallback
    const fillColor = color || DEFAULT_COLORS[0];

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
          data={[treeData]}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#fff"
          fill="transparent"
          content={<CustomContent />}
          isAnimationActive={false}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
