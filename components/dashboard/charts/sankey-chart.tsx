'use client'

import React, { useMemo } from 'react'
import { ResponsiveSankey } from '@nivo/sankey'

interface SankeyChartProps {
  data: any[]
  dataMapping: {
    source: string
    target: string
    value: string
  }
  customization?: {
    nodeWidth?: number
    nodePadding?: number
    colors?: string[]
  }
}

interface SankeyNode {
  id: string
}

interface SankeyLink {
  source: string
  target: string
  value: number
}

interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

/**
 * Transforms tabular edge-list data into Sankey diagram format
 * Input: Array of objects with source, target, value columns
 * Output: { nodes: [...], links: [...] }
 */
function transformToSankeyData(
  data: any[],
  mapping: { source: string; target: string; value: string }
): SankeyData {
  if (!data || data.length === 0) {
    return { nodes: [], links: [] }
  }

  const uniqueNodes = new Set<string>()
  const links: SankeyLink[] = []

  // Process each row to extract nodes and links
  data.forEach((row) => {
    const source = row[mapping.source]
    const target = row[mapping.target]
    const value = row[mapping.value]

    // Skip invalid rows
    if (!source || !target || value == null) {
      return
    }

    // Convert value to number
    const numericValue = typeof value === 'number' ? value : parseFloat(value)

    if (isNaN(numericValue) || numericValue <= 0) {
      return
    }

    // Add nodes
    uniqueNodes.add(String(source))
    uniqueNodes.add(String(target))

    // Add link
    links.push({
      source: String(source),
      target: String(target),
      value: numericValue
    })
  })

  // Convert set to array of node objects
  const nodes: SankeyNode[] = Array.from(uniqueNodes).map(id => ({ id }))

  return { nodes, links }
}

/**
 * Default color scheme for Sankey diagram
 */
const DEFAULT_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
]

export default function SankeyChart({
  data,
  dataMapping,
  customization
}: SankeyChartProps) {
  // Transform data
  const sankeyData = useMemo(() => {
    return transformToSankeyData(data, dataMapping)
  }, [data, dataMapping])

  // Extract customization options with defaults
  const nodeWidth = customization?.nodeWidth ?? 12
  const nodePadding = customization?.nodePadding ?? 24
  const colors = customization?.colors ?? DEFAULT_COLORS

  // Handle empty data
  if (sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-sm font-medium">No data available</p>
          <p className="text-xs mt-1">
            Sankey diagrams require source, target, and value columns
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ResponsiveSankey
        data={sankeyData}
        margin={{ top: 20, right: 120, bottom: 20, left: 120 }}
        align="justify"
        colors={colors}
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.35}
        nodeThickness={nodeWidth}
        nodeSpacing={nodePadding}
        nodeBorderWidth={0}
        nodeBorderColor={{
          from: 'color',
          modifiers: [['darker', 0.8]]
        }}
        nodeBorderRadius={3}
        linkOpacity={0.5}
        linkHoverOthersOpacity={0.1}
        linkContract={3}
        enableLinkGradient={true}
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={16}
        labelTextColor={{
          from: 'color',
          modifiers: [['darker', 1]]
        }}
        // Custom label formatting
        label={(node: any) => {
          const maxLength = 20
          const label = node.id
          return label.length > maxLength
            ? `${label.substring(0, maxLength)}...`
            : label
        }}
        // Tooltip configuration
        tooltip={({ node, link }: any) => {
          if (link) {
            return (
              <div className="bg-white px-3 py-2 shadow-lg rounded-md border border-gray-200">
                <div className="text-xs font-semibold text-gray-900">
                  {link.source.id} → {link.target.id}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Value: <span className="font-medium">{link.value.toLocaleString()}</span>
                </div>
              </div>
            )
          }

          if (node) {
            return (
              <div className="bg-white px-3 py-2 shadow-lg rounded-md border border-gray-200">
                <div className="text-xs font-semibold text-gray-900">{node.id}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Total: <span className="font-medium">{node.value?.toLocaleString()}</span>
                </div>
              </div>
            )
          }

          return null
        }}
        // Animation
        animate={true}
        motionConfig="gentle"
      />
    </div>
  )
}
