'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { AnalysisResult } from '@/lib/store'
import { TrendingUp, PieChart, AlertTriangle, Lightbulb } from 'lucide-react'

interface ExampleQuestionsProps {
  onQuestionClick: (question: string) => void
  analysis: AnalysisResult | null
}

export function ExampleQuestions({ onQuestionClick, analysis }: ExampleQuestionsProps) {
  // Detect if this is marketing data based on column names
  const isMarketingData = (columns: any[]) => {
    const marketingKeywords = [
      'campaign', 'impression', 'click', 'ctr', 'cpc', 'cost', 'conversion',
      'spend', 'budget', 'bid', 'keyword', 'ad', 'customer', 'acquisition',
      'roi', 'roas', 'acos', 'revenue', 'sale', 'order'
    ]
    
    return columns.some(col => 
      marketingKeywords.some(keyword => 
        col.name.toLowerCase().includes(keyword)
      )
    )
  }

  // Generate marketing-specific questions
  const getMarketingQuestions = (columns: any[]) => {
    const questions = []
    const numericColumns = columns.filter(col => col.type === 'number')
    const categoricalColumns = columns.filter(col => 
      col.type === 'string' && col.uniqueValues < 50
    )
    const dateColumns = columns.filter(col => col.type === 'date')
    
    // Performance and ROI questions
    const spendCol = columns.find(col => 
      col.name.toLowerCase().includes('spend') || 
      col.name.toLowerCase().includes('cost')
    )
    const revenueCol = columns.find(col => 
      col.name.toLowerCase().includes('revenue') || 
      col.name.toLowerCase().includes('sales')
    )
    const campaignCol = columns.find(col => 
      col.name.toLowerCase().includes('campaign')
    )
    
    if (spendCol && revenueCol) {
      questions.push({
        icon: TrendingUp,
        text: `What's my ROI and which campaigns are most profitable?`,
        category: 'roi'
      })
    }
    
    if (campaignCol && numericColumns.length > 0) {
      questions.push({
        icon: PieChart,
        text: `Which campaigns are driving the most conversions and at what cost?`,
        category: 'performance'
      })
    }
    
    // Click-through rate and engagement questions
    const ctrCol = columns.find(col => 
      col.name.toLowerCase().includes('ctr') || 
      col.name.toLowerCase().includes('click')
    )
    if (ctrCol) {
      questions.push({
        icon: TrendingUp,
        text: `How can I improve my click-through rates across campaigns?`,
        category: 'optimization'
      })
    }
    
    // Budget optimization questions
    if (spendCol && dateColumns.length > 0) {
      questions.push({
        icon: Lightbulb,
        text: `How should I reallocate my budget to maximize performance?`,
        category: 'budget'
      })
    }
    
    // Keyword/targeting questions
    const keywordCol = columns.find(col => 
      col.name.toLowerCase().includes('keyword') || 
      col.name.toLowerCase().includes('targeting')
    )
    if (keywordCol) {
      questions.push({
        icon: PieChart,
        text: `Which keywords or targeting criteria are underperforming?`,
        category: 'targeting'
      })
    }
    
    // Trend and seasonality questions
    if (dateColumns.length > 0 && numericColumns.length > 0) {
      questions.push({
        icon: TrendingUp,
        text: `What are my seasonal trends and how should I adjust my strategy?`,
        category: 'trends'
      })
    }
    
    // Cost efficiency questions
    const cpcCol = columns.find(col => 
      col.name.toLowerCase().includes('cpc') || 
      col.name.toLowerCase().includes('cost per')
    )
    if (cpcCol) {
      questions.push({
        icon: AlertTriangle,
        text: `Where are my costs per acquisition too high and how can I reduce them?`,
        category: 'efficiency'
      })
    }
    
    return questions
  }

  // Generate contextual questions based on the data analysis
  const getContextualQuestions = () => {
    const questions = []

    if (analysis && analysis.summary && analysis.summary.columns) {
      const numericColumns = analysis.summary.columns.filter(col => col.type === 'number')
      const categoricalColumns = analysis.summary.columns.filter(col => 
        col.type === 'string' && col.uniqueValues < 20
      )
      const dateColumns = analysis.summary.columns.filter(col => col.type === 'date')
      
      // Check if this is marketing data and return specialized questions
      if (isMarketingData(analysis.summary.columns)) {
        return getMarketingQuestions(analysis.summary.columns)
      }
      
      // Trend analysis questions - be specific about columns
      if (dateColumns.length > 0 && numericColumns.length > 0) {
        const dateCol = dateColumns[0].name
        const metricCol = numericColumns[0].name
        questions.push({
          icon: TrendingUp,
          text: `How has ${metricCol} changed over ${dateCol}?`,
          category: 'trends'
        })
        
        if (numericColumns.length > 1) {
          questions.push({
            icon: TrendingUp,
            text: `Show me the trend of ${numericColumns[1].name} by ${dateCol}`,
            category: 'trends'
          })
        }
      }
      
      // Performance/comparison questions - use actual column names
      if (categoricalColumns.length > 0 && numericColumns.length > 0) {
        const categoryCol = categoricalColumns[0].name
        const metricCol = numericColumns[0].name
        questions.push({
          icon: PieChart,
          text: `Compare ${metricCol} across different ${categoryCol} values`,
          category: 'performance'
        })
        
        if (categoricalColumns.length > 1) {
          questions.push({
            icon: PieChart,
            text: `Break down ${metricCol} by ${categoryCol} and ${categoricalColumns[1].name}`,
            category: 'performance'
          })
        }
      }
      
      // Correlation questions - specific to numeric columns
      if (numericColumns.length > 1) {
        questions.push({
          icon: TrendingUp,
          text: `What's the correlation between ${numericColumns[0].name} and ${numericColumns[1].name}?`,
          category: 'correlation'
        })
      }
      
      // Data quality questions - be specific about issues
      const columnsWithNulls = analysis.summary.columns.filter(col => col.nullCount > 0)
      if (columnsWithNulls.length > 0) {
        const nullPercent = Math.round((columnsWithNulls[0].nullCount / analysis.summary.rowCount) * 100)
        questions.push({
          icon: AlertTriangle,
          text: `Why does ${columnsWithNulls[0].name} have ${nullPercent}% missing values?`,
          category: 'quality'
        })
      }
      
      // Statistical questions based on numeric data
      if (numericColumns.length > 0) {
        const col = numericColumns[0]
        questions.push({
          icon: Lightbulb,
          text: `What are the outliers in ${col.name} and what might be causing them?`,
          category: 'outliers'
        })
      }
      
      // Forecasting questions if we have time series data
      if (dateColumns.length > 0 && numericColumns.length > 0) {
        questions.push({
          icon: TrendingUp,
          text: `Forecast ${numericColumns[0].name} for the next 3 months`,
          category: 'forecast'
        })
      }
      
      // Top/bottom analysis
      if (categoricalColumns.length > 0 && numericColumns.length > 0) {
        questions.push({
          icon: PieChart,
          text: `What are the top 5 ${categoricalColumns[0].name} by ${numericColumns[0].name}?`,
          category: 'ranking'
        })
      }
    }
    
    return questions
  }

  // Default questions when no analysis is available
  const defaultQuestions = [
    {
      icon: TrendingUp,
      text: "What are the main trends in this data?",
      category: 'trends'
    },
    {
      icon: PieChart,
      text: "Which categories or segments are performing best?",
      category: 'performance'
    },
    {
      icon: AlertTriangle,
      text: "Are there any outliers or anomalies I should investigate?",
      category: 'outliers'
    },
    {
      icon: Lightbulb,
      text: "What recommendations do you have based on this data?",
      category: 'recommendations'
    }
  ]

  const questions = analysis ? getContextualQuestions() : defaultQuestions

  // Ensure we have at least 3 questions by adding smart defaults if needed
  const ensureMinimumQuestions = (questionList: any[]) => {
    const additionalQuestions = [
      {
        icon: TrendingUp,
        text: "What patterns or trends should I be aware of?",
        category: 'trends'
      },
      {
        icon: Lightbulb,
        text: "What actions would you recommend based on this data?",
        category: 'recommendations'
      },
      {
        icon: PieChart,
        text: "How does performance compare across different segments?",
        category: 'comparison'
      },
      {
        icon: AlertTriangle,
        text: "Are there any data quality issues I should address?",
        category: 'quality'
      }
    ]
    
    // Add additional questions if we have less than 3
    const result = [...questionList]
    let addIndex = 0
    while (result.length < 3 && addIndex < additionalQuestions.length) {
      // Check if this question isn't too similar to existing ones
      const newQ = additionalQuestions[addIndex]
      const isDuplicate = result.some(q => 
        q.category === newQ.category || 
        q.text.toLowerCase().includes(newQ.category)
      )
      
      if (!isDuplicate) {
        result.push(newQ)
      }
      addIndex++
    }
    
    return result
  }

  // Ensure we have enough questions and avoid duplicates
  const allQuestions = ensureMinimumQuestions(questions).slice(0, 6) // Ensure at least 3, limit to 6

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-3">
          Questions based on your data:
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {allQuestions.map((question, index) => {
          const IconComponent = question.icon
          return (
            <Button
              key={index}
              variant="ghost"
              onClick={() => onQuestionClick(question.text)}
              className="h-auto p-3 text-left justify-start text-xs hover:bg-gray-50 border border-gray-200 rounded-lg"
            >
              <div className="flex items-start space-x-2 w-full">
                <IconComponent className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                <span className="text-wrap leading-relaxed">{question.text}</span>
              </div>
            </Button>
          )
        })}
      </div>
      
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Or ask your own question about the data
        </p>
      </div>
    </div>
  )
}