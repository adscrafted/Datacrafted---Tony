# AI Chart Suggestion System

## Overview
This system allows AI to generate structured chart suggestions that can be automatically implemented as visualizations. Instead of just describing charts in text, the AI provides JSON specifications that the app can execute.

## How It Works

### 1. AI Response Format
The AI can provide suggestions in two formats:

#### JSON Format (Preferred)
```json
{
  "id": "top-10-high-acos-campaigns",
  "type": "table",
  "title": "Top 10 High Spend Campaigns with Bad ACOS",
  "description": "Campaigns spending the most money with ACOS above 50%",
  "dataTransform": {
    "filter": [
      {
        "column": "acos",
        "operator": "greater_than", 
        "value": 0.5
      }
    ],
    "columns": [
      {
        "name": "spend",
        "expression": "CAST(REPLACE(REPLACE(spend, '$', ''), ',', '') AS FLOAT)",
        "alias": "spend_numeric"
      }
    ],
    "orderBy": [
      {
        "column": "spend_numeric",
        "direction": "desc"
      }
    ],
    "limit": 10
  },
  "tableConfig": {
    "columns": [
      { "key": "campaign_name", "label": "Campaign Name", "type": "text" },
      { "key": "spend_numeric", "label": "Spend", "type": "currency", "format": "$0,0.00" },
      { "key": "acos_numeric", "label": "ACOS", "type": "percentage", "format": "0.0%" }
    ]
  },
  "confidence": 0.9,
  "reasoning": "High spend with bad ACOS indicates campaigns needing optimization",
  "tags": ["spend", "acos", "optimization"],
  "priority": "high"
}
```

#### Structured Text Format
```
CHART_SUGGESTION
Type: table
Title: Top 10 High Spend Campaigns with Bad ACOS
Columns: Campaign Name, Spend, ACOS, Impressions
Description: Shows campaigns with highest spend and poor ACOS performance
END_SUGGESTION
```

### 2. Data Transformation Engine
The system includes a powerful data transformation engine that can:

- **Filter data**: Support for complex conditions (equals, greater_than, contains, etc.)
- **Transform columns**: Convert text to numbers, handle currency/percentage formats
- **Sort data**: Multiple column sorting with ASC/DESC
- **Aggregate data**: SUM, AVG, COUNT, MIN, MAX operations
- **Group data**: Group by multiple columns with aggregations

### 3. Automatic Chart Creation
When a suggestion is accepted:
1. Data is transformed according to the specification
2. Chart is automatically added to the dashboard
3. User sees the result immediately

## Usage Examples

### For the User's Request
> "Create me a table about top 10 campaigns sorted by spend with a bad acos"

The AI would respond with:

```json
{
  "id": "top-campaigns-bad-acos",
  "type": "table", 
  "title": "Top 10 Campaigns by Spend with Poor ACOS",
  "description": "Highest spending campaigns with ACOS above 50% threshold",
  "dataTransform": {
    "filter": [
      {
        "column": "acos",
        "operator": "is_not_null",
        "value": null
      },
      {
        "column": "acos_numeric", 
        "operator": "greater_than",
        "value": 0.5
      }
    ],
    "columns": [
      {
        "name": "spend",
        "expression": "CAST(REPLACE(REPLACE(REPLACE(spend, '$', ''), ',', ''), ' ', '') AS FLOAT)",
        "alias": "spend_numeric"
      },
      {
        "name": "acos", 
        "expression": "CAST(REPLACE(acos, '%', '') AS FLOAT) / 100",
        "alias": "acos_numeric"
      }
    ],
    "orderBy": [
      {
        "column": "spend_numeric",
        "direction": "desc"
      }
    ],
    "limit": 10
  },
  "tableConfig": {
    "columns": [
      { "key": "campaign_name", "label": "Campaign", "type": "text", "sortable": true },
      { "key": "spend_numeric", "label": "Spend", "type": "currency", "format": "$0,0.00", "sortable": true },
      { "key": "acos_numeric", "label": "ACOS", "type": "percentage", "format": "0.0%", "sortable": true },
      { "key": "impressions", "label": "Impressions", "type": "number", "format": "0,0", "sortable": true },
      { "key": "clicks", "label": "Clicks", "type": "number", "format": "0,0", "sortable": true }
    ],
    "sortBy": "spend_numeric",
    "sortOrder": "desc",
    "pagination": true,
    "pageSize": 10
  },
  "confidence": 0.95,
  "reasoning": "High spend + bad ACOS = immediate optimization opportunity. Table format allows detailed analysis.",
  "tags": ["spend", "acos", "optimization", "performance"],
  "priority": "high"
}
```

## Benefits

### 1. Precise Implementation
- No ambiguity in what chart to create
- Exact data transformations specified
- Consistent formatting and styling

### 2. Immediate Results
- User sees chart instantly after AI response
- No manual configuration needed
- Charts work with existing dashboard system

### 3. Advanced Analytics
- Complex SQL-like transformations
- Handles data cleaning automatically
- Supports advanced aggregations

### 4. Quality Control
- Confidence scores help filter suggestions
- Reasoning explains why chart was suggested
- Tags help categorize and search

## Integration with Chat Interface

The system integrates seamlessly with the existing chat interface:

1. User asks for analysis or charts
2. AI processes request and includes JSON suggestion
3. System automatically parses and displays suggestion
4. User can preview and add to dashboard with one click

## Extension Possibilities

### 1. Machine Learning Suggestions
- Learn from user preferences
- Suggest charts based on data patterns
- Improve confidence scoring over time

### 2. Advanced Visualizations
- Custom chart types
- Interactive filters
- Drill-down capabilities

### 3. Export and Sharing
- Export suggestions as templates
- Share suggestion libraries
- Import community suggestions

## Implementation Status

✅ **Complete**:
- JSON parsing system
- Data transformation engine
- Chart suggestion builder component
- Integration hooks

🔄 **In Progress**:
- Chat interface integration
- AI response processing
- User feedback system

📋 **Planned**:
- Machine learning suggestions
- Template library
- Advanced visualizations

This system transforms the AI from a text-only assistant into a powerful chart creation tool that can understand user intent and immediately deliver actionable visualizations.