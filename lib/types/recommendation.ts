/**
 * Enhanced recommendation system types
 * Provides comprehensive type definitions for AI-powered chart recommendations
 * with quality scoring, user feedback integration, and learning capabilities.
 */

/**
 * Chart recommendation with quality scoring and confidence metrics
 * Extends basic recommendations with ML-driven quality assessment
 */
export interface ChartRecommendation {
  /** Unique identifier for this recommendation */
  id: string;

  /** Priority ranking (1-10, lower = higher priority) */
  priority: number;

  /** AI's confidence in this recommendation (0-1) */
  confidence: number;

  /** Computed quality score (0-100) */
  qualityScore?: number;

  /** Breakdown of quality score components */
  qualityFactors?: {
    /** How well data types fit the chart type (0-40) */
    dataTypeMatch: number;

    /** Average confidence of columns used (0-30) */
    columnConfidence: number;

    /** Strength of patterns/correlations detected (0-20) */
    patternStrength: number;

    /** Bonus for using user-corrected columns (0-10) */
    userCorrectionBoost: number;
  };

  /** Chart type to render */
  type: 'scorecard' | 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'table' | 'combo' | 'waterfall' | 'funnel' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap' | 'sankey' | 'sparkline';

  /** Display title for the chart */
  title: string;

  /** Brief description of what this chart shows */
  description: string;

  /** AI's reasoning for recommending this chart */
  reasoning: string;

  /** Business value explanation */
  businessValue: string;

  /** Data mapping configuration */
  dataMapping: {
    /** Column for x-axis */
    xAxis?: string;

    /** Columns for y-axis (can be multiple for multi-series) */
    yAxis: string[];

    /** Column for categorical grouping */
    category?: string;

    /** Column containing time/date data */
    timeColumn?: string;

    /** Filters to apply to the data */
    filters?: Array<{
      column: string;
      operator: string;
      value: any;
    }>;

    /** Confidence score per column mapping (0-1) */
    columnConfidences?: Record<string, number>;
  };

  /** Chart-specific configuration */
  chartConfig: {
    /** Aggregation method for grouped data */
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile';

    /** Column to sort by */
    sortBy?: string;

    /** Sort direction */
    sortOrder?: 'asc' | 'desc';

    /** Maximum number of data points to show */
    limit?: number;

    /** Whether to show trend line */
    showTrend?: boolean;

    /** Custom color palette */
    colors?: string[];

    /** Whether to stack bar/area charts */
    stacked?: boolean;
  };

  /** Learning and feedback metadata */
  metadata?: {
    /** Whether this recommendation uses user-corrected schema */
    usesUserCorrections: boolean;

    /** List of columns that were corrected by user */
    correctedColumns?: string[];

    /** Generation version for A/B testing */
    generationVersion: number;
  };

  /** Tags for categorization and filtering */
  tags?: string[];

  /** IDs of related recommendations */
  relatedTo?: string[];
}

/**
 * Domain context detected from data analysis
 * Helps tailor recommendations to business domain
 */
export interface DataContext {
  /** Business domain classification */
  domain: 'marketing' | 'sales' | 'finance' | 'operations' | 'general';

  /** Description of the data's purpose */
  description: string;

  /** Key business entities identified in data */
  keyEntities: string[];

  /** Time granularity of the data */
  timeGranularity: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';

  /** Suggested business questions this data can answer */
  suggestedQuestions: string[];
}

/**
 * User-corrected column definition from data tab
 * Captures user feedback on schema inference
 */
export interface CorrectedColumn {
  /** Column name */
  name: string;

  /** Data type (string, number, date, boolean, etc.) */
  type: string;

  /** User-provided description of column purpose */
  description: string;

  /** Whether this column was manually corrected by user */
  userCorrected: boolean;

  /** Original inferred type before correction */
  originalType?: string;

  /** Timestamp of correction */
  correctedAt?: string;
}

/**
 * Complete analysis result with enhanced recommendations
 * Combines AI insights, recommendations, and data context
 */
export interface EnhancedAnalysisResult {
  /** Natural language insights about the data */
  insights: string[];

  /** Prioritized chart recommendations */
  recommendations?: ChartRecommendation[];

  /** Chart configurations (alias for recommendations for backward compatibility) */
  chartConfig: Array<{
    id?: string
    type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table' | 'combo' | 'waterfall' | 'funnel' | 'heatmap' | 'gauge' | 'cohort' | 'bullet' | 'treemap' | 'sankey' | 'sparkline'
    title: string
    description: string
    dataMapping?: {
      category?: string
      values?: string[]
      xAxis?: string
      yAxis?: string | string[]
      value?: string
      metric?: string
      comparison?: string
      size?: string
      color?: string
      columns?: string[]
      aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile'
    }
    dataKey?: string[]
    xAxis?: string | string[]
    yAxis?: string | string[]
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'mode' | 'std' | 'variance' | 'percentile'
    confidence?: number
    reasoning?: string
    qualityScore?: number
    qualityFactors?: any
  }>

  /** Domain and business context */
  dataContext?: DataContext;

  /** Summary statistics and metadata */
  summary: {
    /** Total number of rows in dataset */
    rowCount: number;

    /** Total number of columns */
    columnCount: number;

    /** Column definitions with inferred types */
    columns: any[];

    /** Overall data quality assessment */
    dataQuality?: string;

    /** Key findings from analysis */
    keyFindings?: string;

    /** High-level recommendation summary */
    recommendations?: string;

    /** List of columns corrected by user */
    correctedColumns?: string[];

    /** Notes on how corrections improved recommendations */
    improvementNotes?: string;
  };
}

/**
 * Request payload for analyze API endpoint
 */
export interface AnalyzeRequest {
  /** Raw data array to analyze */
  data: any[];

  /** Original inferred schema */
  schema?: any;

  /** User-corrected schema with feedback */
  correctedSchema?: CorrectedColumn[];

  /** Additional user feedback or instructions */
  feedback?: string;

  /** Original filename for context */
  fileName?: string;
}

/**
 * Response from analyze API endpoint
 * Extends EnhancedAnalysisResult for API compatibility
 */
export interface AnalyzeResponse extends EnhancedAnalysisResult {}

/**
 * Chart instance stored in dashboard
 * Represents a materialized chart from a recommendation
 */
export interface ChartInstance {
  /** Unique chart ID */
  id: string;

  /** Reference to original recommendation */
  recommendationId?: string;

  /** Chart configuration */
  type: ChartRecommendation['type'];
  title: string;
  dataMapping: ChartRecommendation['dataMapping'];
  chartConfig: ChartRecommendation['chartConfig'];

  /** Layout position */
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** User customizations */
  customizations?: {
    overrideTitle?: string;
    overrideColors?: string[];
    pinnedToTop?: boolean;
  };

  /** Creation metadata */
  createdAt: string;
  modifiedAt?: string;
}

/**
 * User feedback on a chart recommendation
 * Used for learning and improving future recommendations
 */
export interface RecommendationFeedback {
  /** Recommendation ID */
  recommendationId: string;

  /** Whether user accepted this recommendation */
  accepted: boolean;

  /** Whether user explicitly rejected it */
  rejected?: boolean;

  /** User's reason for rejection */
  rejectionReason?: string;

  /** User modifications made to the recommendation */
  modifications?: {
    field: string;
    originalValue: any;
    newValue: any;
  }[];

  /** Timestamp of feedback */
  timestamp: string;
}

/**
 * Quality scoring weights for tuning
 * Allows adjustment of quality factor importance
 */
export interface QualityScoringWeights {
  dataTypeMatch: number;
  columnConfidence: number;
  patternStrength: number;
  userCorrectionBoost: number;
}

/**
 * Default quality scoring weights (sum to 100)
 */
export const DEFAULT_QUALITY_WEIGHTS: QualityScoringWeights = {
  dataTypeMatch: 40,
  columnConfidence: 30,
  patternStrength: 20,
  userCorrectionBoost: 10,
};

/**
 * Type guard to check if analysis result is enhanced
 */
export function isEnhancedAnalysisResult(
  result: any
): result is EnhancedAnalysisResult {
  return (
    result &&
    typeof result === 'object' &&
    'insights' in result &&
    'recommendations' in result &&
    'dataContext' in result &&
    'summary' in result
  );
}

/**
 * Type guard to check if recommendation has quality scoring
 */
export function hasQualityScore(
  recommendation: ChartRecommendation
): recommendation is ChartRecommendation & { qualityScore: number } {
  return (
    recommendation.qualityScore !== undefined &&
    recommendation.qualityScore !== null
  );
}