# LLM Prompt Engineering Best Practices for Structured JSON Output

**Focus:** OpenAI GPT Models (GPT-4, GPT-4o, GPT-4.1)
**Use Case:** Dashboard Chart Generation & Data Visualization
**Last Updated:** October 2025
**Research Date:** Based on 2024-2025 resources

---

## Table of Contents

1. [Top 10 Key Principles](#top-10-key-principles)
2. [Structured Output Methods](#structured-output-methods)
3. [Prompt Structure & Formatting](#prompt-structure--formatting)
4. [System vs User Messages](#system-vs-user-messages)
5. [Token Efficiency Techniques](#token-efficiency-techniques)
6. [Chain-of-Thought vs Direct Instruction](#chain-of-thought-vs-direct-instruction)
7. [Example Placement & Quantity](#example-placement--quantity)
8. [Common Anti-Patterns to Avoid](#common-anti-patterns-to-avoid)
9. [JSON Schema Best Practices](#json-schema-best-practices)
10. [Error Handling Instructions](#error-handling-instructions)
11. [Recommended Prompt Template](#recommended-prompt-template)
12. [Dashboard Chart Generation Examples](#dashboard-chart-generation-examples)
13. [Sources & References](#sources--references)

---

## Top 10 Key Principles

### 1. **Use Structured Outputs (Not Just JSON Mode)**
- **Why:** GPT-4o-2024-08-06 with Structured Outputs achieves 100% accuracy on complex JSON schema following, vs <40% for older models
- **Implementation:** Use `response_format: { type: "json_schema", json_schema: {...} }` or function calling with `strict: true`
- **Models:** Available on gpt-4o-2024-08-06+, gpt-4o-mini-2024-07-18+, o1-2024-12-17+, o3-mini-2025-01-31+
- **Key Difference:** JSON Mode only ensures valid JSON; Structured Outputs guarantee schema adherence

### 2. **Clarity Over Complexity**
- **Why:** Most prompt failures stem from ambiguity, not model limitations
- **Practice:** Use clear, explicit instructions; avoid clever wording or overly complex phrasing
- **GPT-4.1 Advantage:** Trained to follow instructions more literally and closely than predecessors

### 3. **Leverage Few-Shot Examples**
- **Why:** Examples demonstrate desired behavior more effectively than descriptions
- **Practice:** Include 1-3 input-output pairs showing the exact format and reasoning you want
- **Evidence:** Few-shot learning significantly improves task performance, especially for complex outputs

### 4. **Specify Professional Context**
- **Why:** Role-based framing produces specialized, focused responses
- **Practice:** Begin prompts with "You are an expert data analyst..." or "As a visualization specialist..."
- **Impact:** Shifts model's approach from generic to domain-specific reasoning

### 5. **Use Positive Language**
- **Why:** Models respond better to "do" instructions than "don't" instructions
- **Practice:** Say "Ensure all fields are populated" instead of "Don't leave fields empty"
- **Evidence:** Positive framing reduces ambiguity and improves compliance

### 6. **Separate Instructions from Input Data**
- **Why:** Clear boundaries prevent instruction confusion with input processing
- **Practice:** Use delimiters (###, """, <>, XML tags) to wrap distinct sections
- **Example:** `<instructions>...</instructions>` `<data>...</data>`

### 7. **Iterate and Test**
- **Why:** Prompts are never one-and-done efforts; refinement improves results
- **Practice:** Start simple, add constraints incrementally, test edge cases
- **Approach:** A/B test different prompt variations with representative data

### 8. **Match Technique to Model Type**
- **Why:** Different models optimize for different prompting strategies
- **Standard Models (GPT-4):** Chain-of-thought helps with complex reasoning
- **Reasoning Models (o1, o3):** Direct instructions perform better; built-in reasoning
- **GPT-4.1:** Highly steerable; responds best to specific, literal instructions

### 9. **Design Schemas for Simplicity**
- **Why:** Complex schemas increase latency and can cause errors
- **Practice:** Limit to 100 object properties total, max 5 levels of nesting
- **Constraint:** Root must be `type: "object"` not `type: "array"` for Structured Outputs

### 10. **Implement Verification Processes**
- **Why:** AI outputs can contain inaccuracies, logical fallacies, or hallucinations
- **Practice:** Validate outputs against business rules, check for completeness, verify data types
- **Chart Generation:** Validate chart types against data shapes, ensure required fields exist

---

## Structured Output Methods

### Method 1: JSON Schema with response_format (Recommended for GPT-4o)

**When to use:** Complex, nested structures requiring 100% schema compliance

```javascript
const response = await openai.chat.completions.create({
  model: "gpt-4o-2024-08-06",
  messages: [
    { role: "system", content: "You are a data visualization expert..." },
    { role: "user", content: "Analyze this data and suggest charts..." }
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "chart_recommendations",
      strict: true,
      schema: {
        type: "object",
        properties: {
          charts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                chartType: { type: "string" },
                title: { type: "string" },
                xAxis: { type: "string" },
                yAxis: { type: "string" },
                reasoning: { type: "string" }
              },
              required: ["chartType", "title", "xAxis", "yAxis", "reasoning"],
              additionalProperties: false
            }
          }
        },
        required: ["charts"],
        additionalProperties: false
      }
    }
  }
});
```

**Performance:**
- First call with new schema: <10 seconds latency (complex schemas up to 1 minute)
- Subsequent calls: Normal latency
- Accuracy: 100% schema adherence

### Method 2: Function Calling with strict: true

**When to use:** Tool-based interactions, multi-step workflows

```javascript
const tools = [{
  type: "function",
  function: {
    name: "generate_chart_config",
    strict: true,
    description: "Generate chart configuration based on data analysis",
    parameters: {
      type: "object",
      properties: {
        chartType: {
          type: "string",
          enum: ["bar", "line", "scatter", "pie", "area"]
        },
        title: { type: "string" },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              x: { type: "string" },
              y: { type: "number" }
            },
            required: ["x", "y"],
            additionalProperties: false
          }
        }
      },
      required: ["chartType", "title", "data"],
      additionalProperties: false
    }
  }
}];

const response = await openai.chat.completions.create({
  model: "gpt-4o-2024-08-06",
  messages: messages,
  tools: tools,
  tool_choice: "required"
});
```

### Method 3: JSON Mode (Legacy - Less Reliable)

**When to use:** Simple use cases where exact schema match isn't critical

```javascript
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [
    {
      role: "system",
      content: "You are a helpful assistant designed to output JSON."
    },
    {
      role: "user",
      content: "Generate chart data..."
    }
  ],
  response_format: { type: "json_object" }
});
```

**Limitations:**
- Only guarantees valid JSON, not schema compliance
- No type safety or validation
- Requires "JSON" in prompt or system message
- Less reliable for complex structures

### Comparison Table

| Feature | Structured Outputs | Function Calling | JSON Mode |
|---------|-------------------|------------------|-----------|
| Schema Adherence | 100% guaranteed | 100% guaranteed (with strict) | Not guaranteed |
| Complexity Support | High (nested, recursive) | High | Low-Medium |
| Latency (first call) | Higher (schema compilation) | Higher (schema compilation) | Normal |
| Use Case | Complex JSON | Tool interactions | Simple JSON |
| Available Models | GPT-4o-2024-08-06+ | GPT-4+ | All chat models |

---

## Prompt Structure & Formatting

### Optimal Structure

```
[ROLE/CONTEXT]
Define the AI's expertise and perspective

[TASK/OBJECTIVE]
Clear statement of what needs to be accomplished

[CONSTRAINTS/REQUIREMENTS]
Specific rules, boundaries, and quality criteria

[INPUT DATA] (if applicable)
Clearly delimited data to process

[OUTPUT FORMAT]
Expected structure, using schema or examples

[EXAMPLES] (optional but recommended)
1-3 demonstrations of input → output

[REASONING GUIDANCE] (for complex tasks)
How to approach the problem
```

### Formatting Best Practices

1. **Use Headers/Sections:** Organize instructions into clear blocks
2. **Numbered Lists:** For sequential steps or ordered requirements
3. **Bullet Points:** For unordered requirements or options
4. **Delimiters:** Triple quotes, XML tags, or ### to separate sections
5. **Whitespace:** Single spaces (avoid consecutive whitespace - each is a token)
6. **Bold/Emphasis:** Use sparingly; models don't always respond to markdown emphasis

### Example: Well-Structured Prompt

```
You are an expert data visualization analyst specializing in business intelligence dashboards.

TASK:
Analyze the provided dataset and recommend the most appropriate chart types for visualizing key insights.

REQUIREMENTS:
1. Suggest 2-4 different chart types
2. Each chart must include: type, title, axis labels, and reasoning
3. Prioritize charts that reveal trends, comparisons, or distributions
4. Ensure chart types match the data structure (e.g., scatter plots need 2+ numeric columns)
5. Provide actionable insights for business decision-makers

INPUT DATA:
"""
{data_here}
"""

OUTPUT FORMAT:
Return a JSON object matching this schema:
{
  "charts": [
    {
      "chartType": "string (bar|line|scatter|pie|area|table)",
      "title": "string (descriptive, actionable title)",
      "xAxis": "string (column name)",
      "yAxis": "string (column name or aggregation)",
      "reasoning": "string (why this chart reveals important insights)"
    }
  ]
}

EXAMPLE:
For sales data with columns [date, product, revenue, units]:
{
  "charts": [
    {
      "chartType": "line",
      "title": "Revenue Trend Over Time",
      "xAxis": "date",
      "yAxis": "revenue",
      "reasoning": "Line chart shows temporal trends, helping identify seasonal patterns and growth trajectory"
    }
  ]
}
```

---

## System vs User Messages

### Key Differences (GPT-4 Era)

| Aspect | System Message | User Message |
|--------|---------------|--------------|
| **Purpose** | Set behavior, role, constraints | Provide task and input data |
| **Visibility** | "Hidden" instructions | Conversational input |
| **Priority** | Higher (especially GPT-4+) | Lower |
| **Best For** | Rules, persona, output format | Specific requests, data |
| **Token Cost** | Counted in every request | Varies with conversation |

### GPT Model Behavior

- **GPT-3.5-Turbo:** Limited awareness of system messages; often ignores them
- **GPT-4:** Much stronger adherence to system messages; detailed compliance
- **GPT-4.1:** Highly steerable; follows system instructions literally and closely
- **GPT-4o:** Similar to GPT-4; excellent system message compliance

### Best Practices

#### System Message - Use For:

1. **Role/Persona:** "You are an expert data analyst with 10 years of experience..."
2. **Output Format:** "Always respond with valid JSON following this schema..."
3. **Constraints:** "Never include personally identifiable information..."
4. **Style/Tone:** "Use professional, concise language suitable for executives..."
5. **General Rules:** "When uncertain, ask clarifying questions..."

#### User Message - Use For:

1. **Specific Task:** "Analyze this sales data and suggest 3 charts..."
2. **Input Data:** "Here is the dataset: {...}"
3. **Contextual Information:** "This data represents Q4 2024 performance..."
4. **Clarifications:** "Focus on year-over-year comparisons..."
5. **Follow-ups:** "Now generate the configuration for the bar chart..."

#### Important Notes:

- **Single System Message:** Only one system message at the start of conversation
- **System Message Jailbreaking:** System messages are easier to override; don't rely on them for security
- **Context in System > Context in User:** Information in system messages yields more specific results
- **Keep System Short:** Start simple, iterate based on testing; avoid contradictions

### Example Message Structure

```javascript
const messages = [
  {
    role: "system",
    content: `You are a data visualization expert specializing in business dashboards.

RULES:
- Always output valid JSON matching the provided schema
- Prioritize actionable insights over decorative visualizations
- Consider data types when recommending chart types
- Provide clear, concise reasoning for each recommendation

CONSTRAINTS:
- Maximum 5 chart recommendations per request
- Only suggest chart types: bar, line, scatter, pie, area, table
- All titles must be action-oriented (e.g., "Track Revenue Growth" not "Revenue Chart")`
  },
  {
    role: "user",
    content: `Analyze this dataset and recommend the best charts for a CEO dashboard.

DATASET:
"""
${JSON.stringify(data)}
"""

FOCUS AREAS:
- Revenue trends
- Product performance comparison
- Customer segmentation insights`
  }
];
```

---

## Token Efficiency Techniques

### Why Token Efficiency Matters

- **Cost:** GPT-4 pricing is token-based (input + output tokens)
- **Latency:** Fewer tokens = faster response times
- **Context Window:** More efficient prompts leave room for complex outputs

### Cost Comparison (as of 2024)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4o | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| GPT-4-turbo | $10.00 | $30.00 |
| GPT-4 | $30.00 | $60.00 |

**Example:** 76% cost reduction possible through prompt optimization

### Optimization Strategies

#### 1. Concise Instructions

**Bad (Verbose):**
```
I would like you to please analyze the following dataset and then provide me with some recommendations about what kinds of charts might be good to use for visualizing this information in a way that would be helpful for business users.
```

**Good (Concise):**
```
Analyze this dataset and recommend optimal chart types for business visualization.
```

**Savings:** ~60% fewer tokens

#### 2. Use Tables Instead of JSON for Input Data

**Inefficient:**
```json
[
  {"date": "2024-01-01", "revenue": 1000, "units": 50},
  {"date": "2024-01-02", "revenue": 1200, "units": 60}
]
```

**Efficient:**
```
date       | revenue | units
2024-01-01 | 1000    | 50
2024-01-02 | 1200    | 60
```

**Savings:** ~40% fewer tokens for tabular data

#### 3. Avoid Consecutive Whitespace

**Bad:** `"value    :    result"` (each space is a token)
**Good:** `"value: result"`

#### 4. Abbreviate in Schemas (Where Appropriate)

**Less Efficient:**
```json
{
  "visualizationRecommendations": [
    {
      "recommendedChartType": "string",
      "visualizationTitle": "string"
    }
  ]
}
```

**More Efficient:**
```json
{
  "charts": [
    {
      "type": "string",
      "title": "string"
    }
  ]
}
```

**Note:** Balance brevity with clarity; don't sacrifice understanding

#### 5. Batch Similar Requests

Instead of 5 separate API calls for 5 datasets, process multiple in one request:

```
Analyze each of these 3 datasets and provide chart recommendations for each:

DATASET 1:
[data]

DATASET 2:
[data]

DATASET 3:
[data]
```

#### 6. Use Enums to Constrain Output

```json
{
  "chartType": {
    "type": "string",
    "enum": ["bar", "line", "scatter", "pie", "area"]
  }
}
```

**Benefit:** Reduces token usage in output + increases accuracy

#### 7. Skeleton-of-Thought Prompting

For complex outputs, request an outline first, then details:

**Request 1:** "List the chart types you'd recommend (types only)"
**Request 2:** "Now provide full configuration for the bar chart"

**Benefit:** Up to 2.39x faster generation; pay for only what you need

#### 8. Date Format Optimization

**Verbose:** `2024-01-15` (5 tokens)
**Efficient:** `Jan 15 2024` (4 tokens) or `January 15, 2024` (4 tokens)

**Evidence:** Spelling out month names is more space-efficient than numeric formats

#### 9. Smart Example Selection

- **Don't:** Include 10 examples when 2 will suffice
- **Do:** Use representative edge cases that cover the spectrum of scenarios
- **Balance:** More examples improve quality but increase cost

#### 10. Reuse System Messages Across Sessions

System message tokens are charged on every request. For repeated use cases:
- Refine once, reuse extensively
- Cache system messages client-side
- Consider if instructions belong in system vs. user message based on frequency

---

## Chain-of-Thought vs Direct Instruction

### Chain-of-Thought (CoT) Prompting

**Definition:** Prompting technique that includes intermediate reasoning steps before the final answer

**When to Use:**
- Complex reasoning tasks (calculations, multi-step logic)
- Tasks requiring explanation or transparency
- When you need to audit the AI's reasoning process
- Standard models: GPT-4, GPT-4-turbo, GPT-4o

**Example:**

```
Analyze this sales dataset and recommend chart types.

APPROACH:
1. First, identify the column types (numeric, categorical, temporal)
2. Next, determine the key business questions this data could answer
3. Then, match chart types to those questions based on visualization best practices
4. Finally, rank recommendations by business impact

Provide your step-by-step reasoning, then output the final JSON.
```

**Output:**
```
Step 1: Column Analysis
- date: temporal (daily granularity)
- product: categorical (5 unique values)
- revenue: numeric (continuous)
- units: numeric (discrete)

Step 2: Key Questions
- How has revenue trended over time?
- Which products generate the most revenue?
- Is there a relationship between units sold and revenue?

Step 3: Chart Matching
- Temporal trend → Line chart (date vs revenue)
- Categorical comparison → Bar chart (product vs revenue)
- Numeric relationship → Scatter plot (units vs revenue)

Step 4: Business Impact Ranking
1. Line chart - reveals growth trajectory (high impact)
2. Bar chart - identifies top products (high impact)
3. Scatter plot - shows pricing efficiency (medium impact)

{
  "charts": [...]
}
```

**Advantages:**
- More explainable decisions
- Easier to debug incorrect outputs
- Often higher quality for complex tasks
- Builds trust with stakeholders

**Disadvantages:**
- Higher token cost (reasoning + answer)
- Slower response time
- Can be verbose

### Direct Instruction

**Definition:** Concise prompts that request immediate output without showing work

**When to Use:**
- Simple, well-defined tasks
- Token efficiency is critical
- Fast response time needed
- Reasoning models: o1, o1-mini, o3-mini (built-in reasoning)

**Example:**

```
Analyze this sales dataset and output JSON chart recommendations.

DATASET:
[data]

OUTPUT:
Follow the provided schema exactly.
```

**Output:**
```json
{
  "charts": [...]
}
```

**Advantages:**
- Minimal token usage
- Faster responses
- Clean, focused output
- Works well with newer models trained for instruction-following

**Disadvantages:**
- Less transparency
- Harder to debug errors
- May sacrifice quality on complex tasks

### Model-Specific Guidance

| Model | Recommended Approach | Reasoning |
|-------|---------------------|-----------|
| GPT-3.5-turbo | Direct (simple tasks only) | Weak CoT performance |
| GPT-4 | CoT for complex, Direct for simple | Benefits from reasoning steps |
| GPT-4-turbo | CoT for complex, Direct for simple | Strong instruction following |
| GPT-4o | CoT for complex, Direct for simple | Excellent balance |
| GPT-4.1 | Direct (highly literal) | Extremely steerable; prefers clarity |
| o1, o1-mini | Direct | Built-in reasoning; CoT can interfere |
| o3-mini | Direct | Built-in reasoning; CoT can interfere |

### Hybrid Approach (Recommended for Chart Generation)

Combine both techniques for optimal results:

```
You are an expert data visualization analyst.

ANALYSIS PROCESS:
When analyzing data, consider:
1. Data types and cardinality
2. Business context and key questions
3. Visualization best practices
4. Cognitive load and clarity

OUTPUT:
Provide concise reasoning for each chart recommendation in the "reasoning" field.
Do not show your step-by-step thought process; incorporate it directly into your recommendations.

SCHEMA:
{
  "charts": [
    {
      "chartType": "string",
      "title": "string",
      "xAxis": "string",
      "yAxis": "string",
      "reasoning": "string (1-2 sentences explaining why this chart is valuable)"
    }
  ]
}
```

**Benefits:**
- Reasoning is captured but token-efficient
- Faster than full CoT
- More transparent than pure direct instruction
- Actionable insights included in output

### Special Case: o1 and o3 Reasoning Models

These models (released late 2024 / early 2025) have built-in reasoning capabilities:

**Do:**
- Provide clear, direct instructions
- Specify desired output format explicitly
- Give context about the task's importance

**Don't:**
- Add "think step by step" instructions (interferes with built-in reasoning)
- Request verbose explanations (happens automatically when beneficial)
- Use traditional CoT prompting patterns

**Evidence:** Research shows o1/o3 models perform better with direct instructions; instructing them to "spend more time reasoning" can improve outputs, but explicit CoT patterns may reduce performance.

---

## Example Placement & Quantity

### The Power of Examples

**Evidence:** Few-shot prompting (including 1+ examples) significantly outperforms zero-shot (no examples) for complex tasks, especially structured output generation.

### Optimal Quantity

| Task Complexity | Recommended Examples | Reasoning |
|----------------|---------------------|-----------|
| Simple/Common | 0-1 | Model has strong priors |
| Moderate | 1-2 | Demonstrates format and patterns |
| Complex/Novel | 2-3 | Shows edge cases and variations |
| Highly Specific | 3-5 | Covers spectrum of scenarios |

**Diminishing Returns:** Beyond 3-5 examples, improvement plateaus while token cost increases linearly.

### Placement Strategies

#### Strategy 1: Examples in System Message (Recommended for Repeated Use)

```javascript
{
  role: "system",
  content: `You are a chart recommendation engine.

EXAMPLE 1:
Input: Sales data with [date, product, revenue]
Output: {
  "charts": [
    {
      "chartType": "line",
      "title": "Track Revenue Over Time",
      "xAxis": "date",
      "yAxis": "revenue",
      "reasoning": "Line chart reveals temporal trends and seasonality"
    }
  ]
}

EXAMPLE 2:
Input: Employee data with [department, headcount, budget]
Output: {
  "charts": [
    {
      "chartType": "bar",
      "title": "Compare Headcount by Department",
      "xAxis": "department",
      "yAxis": "headcount",
      "reasoning": "Bar chart enables easy comparison across categories"
    }
  ]
}`
}
```

**Best for:** Stable use cases, repeated requests, setting global patterns

#### Strategy 2: Examples in User Message (Recommended for Varied Use)

```javascript
{
  role: "user",
  content: `Analyze this dataset and suggest charts.

EXAMPLE OUTPUT FORMAT:
{
  "charts": [
    {
      "chartType": "scatter",
      "title": "Analyze Price vs Quality Relationship",
      "xAxis": "price",
      "yAxis": "quality_score",
      "reasoning": "Scatter plot reveals correlations between two numeric variables"
    }
  ]
}

ACTUAL DATA TO ANALYZE:
${JSON.stringify(data)}`
}
```

**Best for:** One-off requests, task-specific context, dynamic examples

#### Strategy 3: Interleaved Examples (Advanced)

For multi-turn conversations or complex pattern learning:

```javascript
[
  { role: "system", content: "You are a chart expert." },
  { role: "user", content: "Sales data: [date, revenue, units]" },
  { role: "assistant", content: '{"charts": [{"chartType": "line", ...}]}' },
  { role: "user", content: "Employee data: [department, headcount, salary]" },
  { role: "assistant", content: '{"charts": [{"chartType": "bar", ...}]}' },
  { role: "user", content: "Now analyze this customer data: [...]" }
]
```

**Best for:** Training the model on your specific patterns, complex multi-step tasks

### Example Quality Matters

**Bad Example (Vague):**
```json
{
  "chartType": "bar",
  "title": "Chart 1",
  "xAxis": "x",
  "yAxis": "y",
  "reasoning": "This is a good chart"
}
```

**Good Example (Specific, Realistic):**
```json
{
  "chartType": "bar",
  "title": "Identify Top-Performing Sales Regions",
  "xAxis": "region",
  "yAxis": "total_revenue",
  "reasoning": "Bar chart ranks regions by revenue, making it easy to identify high and low performers for resource allocation decisions"
}
```

**Characteristics of Good Examples:**
- Realistic data structures and column names
- Actionable, descriptive titles (not generic)
- Clear reasoning tied to business value
- Proper use of field names and types
- Edge cases when relevant (e.g., handling missing data)

### Example Order Matters

**Research Finding:** The sequence of few-shot examples can impact model performance.

**Best Practice:**
1. Start with the most common/representative case
2. Follow with edge cases or variations
3. End with the most complex example

**Example Order for Chart Generation:**

```
EXAMPLE 1 (Common): Time series line chart
EXAMPLE 2 (Variation): Categorical bar chart
EXAMPLE 3 (Edge Case): Multi-axis chart with complex aggregation
```

### Template vs. Concrete Examples

**Template Example (Abstract):**
```
Input: <dataset_description>
Output: <json_structure>
```

**Concrete Example (Specific):**
```
Input: E-commerce orders with [order_date, product_id, quantity, price]
Output: {
  "charts": [
    {
      "chartType": "line",
      "title": "Track Daily Order Volume",
      "xAxis": "order_date",
      "yAxis": "count(order_id)",
      "reasoning": "Shows ordering patterns and helps identify peak shopping days"
    }
  ]
}
```

**Recommendation:** Use concrete examples; models learn patterns better from real data

### Zero-Shot vs Few-Shot Decision Matrix

| Scenario | Use Zero-Shot | Use Few-Shot |
|----------|--------------|--------------|
| Standard task (e.g., summarization) | ✓ | |
| Well-known format (e.g., JSON) | ✓ | |
| Custom schema | | ✓ |
| Domain-specific output | | ✓ |
| Novel task | | ✓ |
| Consistent quality required | | ✓ |
| Token budget is tight | ✓ | |

---

## Common Anti-Patterns to Avoid

### 1. Ambiguity Over Clarity

**Anti-Pattern:**
```
Make some charts for this data that look good and are useful.
```

**Problem:**
- "Some" - how many?
- "Look good" - aesthetic vs. functional?
- "Useful" - useful for what purpose?

**Solution:**
```
Generate exactly 3 chart recommendations for this dataset.
Prioritize charts that help executives identify:
1. Revenue trends over time
2. Top-performing product categories
3. Customer acquisition patterns

Each chart must include a title, axis labels, and business reasoning.
```

### 2. Confusing Style with Target Audience

**Anti-Pattern:**
```
Write in a professional style for business users.
```

**Problem:** "Professional style" (tone) and "business users" (audience) are conflated

**Solution:**
```
TARGET AUDIENCE: C-level executives (non-technical)
STYLE: Concise, action-oriented, avoiding jargon
VOCABULARY: Business metrics (ROI, KPI, conversion rate) not technical terms
```

### 3. Seeking Short Answers for Complex Tasks

**Anti-Pattern:**
```
Analyze this dataset and tell me the best chart type in one word.
```

**Problem:** Stifles the model's generative strengths; loses valuable context

**Solution:**
```
Analyze this dataset and recommend the best chart type.
Include:
- Chart type and configuration
- Reasoning for why it's optimal
- Alternative chart types considered
- Key insights this visualization will reveal
```

### 4. Contradictory Instructions

**Anti-Pattern:**
```
Provide a detailed summary of this data.
Keep your response brief.
```

**Problem:** "Detailed" vs. "brief" creates confusion

**Solution:**
```
Provide a summary of this data in 3-5 sentences.
Include: key trends, outliers, and business implications.
```

### 5. Using Negative Language

**Anti-Pattern:**
```
Don't suggest pie charts.
Don't use generic titles.
Don't ignore missing data.
```

**Problem:** Negative instructions are less effective and can be ambiguous

**Solution:**
```
Suggest chart types: bar, line, scatter, area, or table only.
Use specific, action-oriented titles (e.g., "Track Revenue Growth").
Handle missing data by noting it in the reasoning field.
```

### 6. Not Testing and Iterating

**Anti-Pattern:** Writing one prompt and assuming it works for all cases

**Problem:** Edge cases, data variations, and ambiguous scenarios will break untested prompts

**Solution:**
- Test with representative datasets (small, large, sparse, dense)
- Test edge cases (missing values, all zeros, outliers)
- A/B test prompt variations
- Monitor production failures and refine iteratively
- Version your prompts

### 7. Ignoring Delimiters

**Anti-Pattern:**
```
Analyze this dataset: {data} and provide recommendations.
```

**Problem:** LLMs struggle to separate instructions from data without clear boundaries

**Solution:**
```
Analyze the dataset below and provide recommendations.

DATASET:
"""
{data}
"""

INSTRUCTIONS:
- Focus on revenue metrics
- Suggest 2-3 charts
```

### 8. Not Leveraging In-Context Learning

**Anti-Pattern:**
```
Generate a chart config for sales data.
```

**Problem:** No examples of desired format, style, or quality

**Solution:**
```
Generate a chart config for sales data.

EXAMPLE OUTPUT:
{
  "chartType": "line",
  "title": "Track Monthly Revenue Growth",
  "xAxis": "month",
  "yAxis": "total_revenue",
  "reasoning": "Line chart shows revenue trajectory, helping identify growth rate and seasonality patterns"
}

NOW ANALYZE THIS DATASET:
[data]
```

### 9. Failing to Specify Professional Role

**Anti-Pattern:**
```
Analyze this data.
```

**Problem:** Generic framing produces generic responses

**Solution:**
```
You are an expert business intelligence analyst with 10 years of experience in e-commerce analytics.

Analyze this data from the perspective of optimizing customer lifetime value.
```

### 10. Applying Wrong Technique to Wrong Model

**Anti-Pattern (using o1/o3):**
```
Think step by step and show all your reasoning before answering.
```

**Problem:** o1/o3 models have built-in reasoning; explicit CoT interferes

**Solution (for o1/o3):**
```
Analyze this dataset and recommend optimal chart types.
Focus on actionable business insights.
```

### 11. Accepting Outputs Without Verification

**Anti-Pattern:**
```javascript
const response = await openai.chat.completions.create({...});
const config = JSON.parse(response.choices[0].message.content);
// Immediately use config without validation
```

**Problem:** AI can hallucinate fields, use wrong types, or miss edge cases

**Solution:**
```javascript
const response = await openai.chat.completions.create({...});
const config = JSON.parse(response.choices[0].message.content);

// Validate
if (!config.charts || !Array.isArray(config.charts)) {
  throw new Error("Invalid response structure");
}

config.charts.forEach(chart => {
  if (!VALID_CHART_TYPES.includes(chart.chartType)) {
    throw new Error(`Invalid chart type: ${chart.chartType}`);
  }
  if (!dataColumns.includes(chart.xAxis)) {
    throw new Error(`xAxis ${chart.xAxis} not found in data`);
  }
  // Additional validations...
});
```

### 12. Overcomplicating Prompts

**Anti-Pattern:**
```
You are a highly sophisticated, state-of-the-art data visualization recommendation engine powered by advanced machine learning algorithms and extensive training on best practices in information design, visual perception theory, and business intelligence dashboard optimization. Your mission, should you choose to accept it, is to meticulously analyze the provided dataset with extreme attention to detail, considering every possible nuance...
```

**Problem:**
- Wastes tokens
- Doesn't improve performance
- Can confuse the model
- Slower response time

**Solution:**
```
You are a data visualization expert.
Analyze this dataset and recommend optimal chart types for a business dashboard.
```

### 13. Schema Complexity Violations

**Anti-Pattern:**
```json
{
  "type": "object",
  "properties": {
    "charts": {
      "type": "object",
      "properties": {
        "recommendations": {
          "type": "object",
          "properties": {
            "primary": {
              "type": "object",
              "properties": {
                "visualization": {
                  "type": "object",
                  "properties": {
                    "config": {
                      "type": "object",
                      ...
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Problem:**
- Exceeds 5 levels of nesting (Structured Outputs limit)
- Unnecessarily complex
- Increases latency
- Higher error rate

**Solution:**
```json
{
  "type": "object",
  "properties": {
    "charts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "chartType": { "type": "string" },
          "config": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "xAxis": { "type": "string" },
              "yAxis": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

### 14. Root-Level Array Schema (Structured Outputs)

**Anti-Pattern:**
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {...}
  }
}
```

**Problem:** Structured Outputs require root to be `type: "object"`

**Solution:**
```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {...}
      }
    }
  }
}
```

### 15. Not Setting additionalProperties: false

**Anti-Pattern:**
```json
{
  "type": "object",
  "properties": {
    "chartType": { "type": "string" },
    "title": { "type": "string" }
  }
}
```

**Problem:** Model can add unexpected fields, breaking strict schema compliance

**Solution:**
```json
{
  "type": "object",
  "properties": {
    "chartType": { "type": "string" },
    "title": { "type": "string" }
  },
  "required": ["chartType", "title"],
  "additionalProperties": false
}
```

---

## JSON Schema Best Practices

### Core Principles

1. **Simplicity:** Keep schemas as simple as possible while meeting requirements
2. **Constraints:** Use enums, min/max, patterns to constrain outputs
3. **Strictness:** Always set `additionalProperties: false` for Structured Outputs
4. **Descriptions:** Include clear descriptions for complex fields (helps model understanding)
5. **Validation:** Define `required` fields explicitly

### Schema Limitations (Structured Outputs)

| Constraint | Limit | Workaround |
|------------|-------|------------|
| Total object properties | 100 max | Split into multiple schemas |
| Nesting depth | 5 levels max | Flatten structure |
| Root type | Must be "object" | Wrap arrays in object |
| Additional properties | Must be false | Explicitly list all properties |
| First request latency | <10s typical, up to 60s | Cache schema, reuse |

### Schema Design Patterns

#### Pattern 1: Flat Structure (Preferred)

```json
{
  "type": "object",
  "properties": {
    "chartType": { "type": "string", "enum": ["bar", "line", "scatter"] },
    "title": { "type": "string", "minLength": 5, "maxLength": 100 },
    "xAxis": { "type": "string" },
    "yAxis": { "type": "string" },
    "reasoning": { "type": "string", "minLength": 20 }
  },
  "required": ["chartType", "title", "xAxis", "yAxis", "reasoning"],
  "additionalProperties": false
}
```

**Advantages:**
- Fast schema compilation
- Easy to validate
- Low nesting depth
- Clear structure

#### Pattern 2: Nested Objects (Use Sparingly)

```json
{
  "type": "object",
  "properties": {
    "chart": {
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "config": {
          "type": "object",
          "properties": {
            "axes": {
              "type": "object",
              "properties": {
                "x": { "type": "string" },
                "y": { "type": "string" }
              },
              "required": ["x", "y"],
              "additionalProperties": false
            }
          },
          "required": ["axes"],
          "additionalProperties": false
        }
      },
      "required": ["type", "config"],
      "additionalProperties": false
    }
  },
  "required": ["chart"],
  "additionalProperties": false
}
```

**When to use:** Logical grouping is important, but keep depth ≤ 3 levels

#### Pattern 3: Arrays of Objects (Common for Charts)

```json
{
  "type": "object",
  "properties": {
    "charts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "chartType": { "type": "string" },
          "title": { "type": "string" }
        },
        "required": ["chartType", "title"],
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 10
    }
  },
  "required": ["charts"],
  "additionalProperties": false
}
```

**Best practices:**
- Set `minItems` and `maxItems` to constrain array length
- Always define `items` schema
- Use `additionalProperties: false` in item schema

#### Pattern 4: Enums for Constrained Values (Highly Recommended)

```json
{
  "type": "object",
  "properties": {
    "chartType": {
      "type": "string",
      "enum": ["bar", "line", "scatter", "pie", "area", "table"],
      "description": "The type of chart to render"
    },
    "aggregation": {
      "type": "string",
      "enum": ["sum", "avg", "count", "min", "max"],
      "description": "How to aggregate the y-axis data"
    }
  },
  "required": ["chartType"],
  "additionalProperties": false
}
```

**Advantages:**
- Guarantees valid values
- Reduces output tokens (model picks from list)
- Self-documenting
- Easier validation

#### Pattern 5: Optional vs Required Fields

```json
{
  "type": "object",
  "properties": {
    "chartType": { "type": "string" },
    "title": { "type": "string" },
    "subtitle": { "type": "string" },  // Optional
    "description": { "type": "string" }  // Optional
  },
  "required": ["chartType", "title"],
  "additionalProperties": false
}
```

**Guidance:**
- Mark fields `required` if they're critical to functionality
- Use optional fields for nice-to-haves (model may omit)
- Too many optional fields increases schema complexity

#### Pattern 6: String Constraints

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 5,
      "maxLength": 100,
      "pattern": "^[A-Z].*$",
      "description": "Must start with capital letter, 5-100 characters"
    },
    "columnName": {
      "type": "string",
      "pattern": "^[a-z_][a-z0-9_]*$",
      "description": "Valid column name (lowercase, underscores, no spaces)"
    }
  },
  "required": ["title"],
  "additionalProperties": false
}
```

**Use cases:**
- Enforce formatting rules
- Validate identifiers
- Ensure quality outputs

#### Pattern 7: Numeric Constraints

```json
{
  "type": "object",
  "properties": {
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score between 0 and 1"
    },
    "priority": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "description": "Priority ranking from 1 (highest) to 5 (lowest)"
    }
  },
  "additionalProperties": false
}
```

### Schema Validation Best Practices

#### Client-Side Validation

```javascript
import Ajv from "ajv";

const ajv = new Ajv();
const schema = {
  type: "object",
  properties: {
    charts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chartType: { type: "string", enum: ["bar", "line", "scatter"] },
          title: { type: "string", minLength: 5 }
        },
        required: ["chartType", "title"],
        additionalProperties: false
      }
    }
  },
  required: ["charts"],
  additionalProperties: false
};

const validate = ajv.compile(schema);

// After receiving AI response
const valid = validate(response);
if (!valid) {
  console.error("Schema validation failed:", validate.errors);
  // Handle error: retry, use fallback, alert user
}
```

#### Runtime Type Checking (TypeScript)

```typescript
// Define TypeScript types matching your schema
interface ChartConfig {
  chartType: "bar" | "line" | "scatter" | "pie" | "area" | "table";
  title: string;
  xAxis: string;
  yAxis: string;
  reasoning: string;
}

interface ChartRecommendationResponse {
  charts: ChartConfig[];
}

// Type guard function
function isValidChartConfig(obj: any): obj is ChartConfig {
  return (
    typeof obj === "object" &&
    ["bar", "line", "scatter", "pie", "area", "table"].includes(obj.chartType) &&
    typeof obj.title === "string" &&
    obj.title.length >= 5 &&
    typeof obj.xAxis === "string" &&
    typeof obj.yAxis === "string" &&
    typeof obj.reasoning === "string"
  );
}

// Usage
const response = await getAIResponse();
if (!response.charts.every(isValidChartConfig)) {
  throw new Error("Invalid chart configuration received from AI");
}
```

### Describing Schemas to the Model

Even with Structured Outputs, providing context helps:

```javascript
const systemMessage = `You are a chart recommendation engine.

OUTPUT SCHEMA:
You will return a JSON object with the following structure:

{
  "charts": [
    {
      "chartType": "string - one of: bar, line, scatter, pie, area, table",
      "title": "string - action-oriented title (e.g., 'Track Revenue Growth')",
      "xAxis": "string - exact column name from dataset for x-axis",
      "yAxis": "string - exact column name or aggregation (e.g., 'sum(revenue)')",
      "reasoning": "string - 1-2 sentences explaining business value"
    }
  ]
}

REQUIREMENTS:
- Suggest 2-5 charts
- chartType must match data structure (e.g., scatter needs 2 numeric columns)
- Titles must be specific and actionable
- reasoning must connect chart to business decision-making`;
```

**Note:** With `strict: true`, schema is enforced automatically, but descriptions improve quality

---

## Error Handling Instructions

### Types of Errors

1. **Schema Validation Errors:** Output doesn't match expected structure
2. **Business Logic Errors:** Valid JSON but nonsensical content (e.g., scatter plot with 1 column)
3. **API Errors:** Rate limits, network issues, model errors
4. **Refusal Responses:** Model refuses due to safety concerns

### Handling Refusals (Structured Outputs Feature)

**New in 2024:** Structured Outputs include a `refusal` field in API responses

```javascript
const response = await openai.chat.completions.create({
  model: "gpt-4o-2024-08-06",
  messages: messages,
  response_format: { type: "json_schema", json_schema: schema }
});

const choice = response.choices[0];

// Check for refusal
if (choice.message.refusal) {
  console.error("Model refused to respond:", choice.message.refusal);
  // Handle refusal:
  // - Log for review
  // - Show user-friendly error
  // - Use fallback logic
  return;
}

// Process normal response
const config = JSON.parse(choice.message.content);
```

### Prompting for Error Prevention

Include error handling guidance in your prompt:

```
You are a chart recommendation engine.

RULES:
1. Only suggest chart types that match the data structure:
   - Bar charts: 1 categorical + 1 numeric column
   - Line charts: 1 temporal/numeric + 1 numeric column
   - Scatter plots: 2 numeric columns
   - Pie charts: 1 categorical + 1 numeric column (max 10 categories)
   - Area charts: 1 temporal + 1 numeric column
   - Table: any combination

2. If the dataset is unsuitable for visualization:
   - Set charts to empty array []
   - Include a "message" field explaining why

3. If column names are unclear:
   - Make reasonable inferences based on data types
   - Note assumptions in reasoning field

4. If data quality is poor:
   - Still provide recommendations
   - Flag issues in reasoning (e.g., "Note: 30% missing values in revenue column")

SCHEMA:
{
  "charts": [...],
  "message": "optional string - use only if charts array is empty or data has issues"
}
```

### Retry Logic

```javascript
async function getChartRecommendations(data, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: buildMessages(data),
        response_format: { type: "json_schema", json_schema: chartSchema }
      });

      const choice = response.choices[0];

      // Check for refusal
      if (choice.message.refusal) {
        throw new Error(`Model refused: ${choice.message.refusal}`);
      }

      // Parse and validate
      const result = JSON.parse(choice.message.content);
      validateChartConfig(result);  // Custom validation function

      return result;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        // All retries exhausted, use fallback
        return getFallbackChartConfig(data);
      }

      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}

function validateChartConfig(config) {
  if (!config.charts || !Array.isArray(config.charts)) {
    throw new Error("Invalid charts array");
  }

  config.charts.forEach((chart, index) => {
    if (!VALID_CHART_TYPES.includes(chart.chartType)) {
      throw new Error(`Invalid chart type at index ${index}: ${chart.chartType}`);
    }
    // Additional validations...
  });
}

function getFallbackChartConfig(data) {
  // Return safe default based on data structure
  const numericColumns = data.columns.filter(col => isNumeric(data[col]));
  const categoricalColumns = data.columns.filter(col => isCategorical(data[col]));

  if (numericColumns.length >= 1 && categoricalColumns.length >= 1) {
    return {
      charts: [{
        chartType: "bar",
        title: "Data Overview",
        xAxis: categoricalColumns[0],
        yAxis: numericColumns[0],
        reasoning: "Default visualization (AI recommendation failed)"
      }]
    };
  }

  return { charts: [], message: "Unable to generate chart recommendations" };
}
```

### Logging and Monitoring

```javascript
async function getChartRecommendationsWithLogging(data) {
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({...});

    // Log successful request
    logger.info({
      event: "chart_recommendation_success",
      duration: Date.now() - startTime,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      cost: calculateCost(response.usage),
      chartCount: response.charts?.length || 0
    });

    return response;

  } catch (error) {
    // Log failure
    logger.error({
      event: "chart_recommendation_failure",
      duration: Date.now() - startTime,
      error: error.message,
      stack: error.stack,
      dataShape: {
        rows: data.length,
        columns: Object.keys(data[0] || {}).length
      }
    });

    throw error;
  }
}
```

### User-Facing Error Messages

```javascript
function handleChartGenerationError(error) {
  // Technical error
  if (error.message.includes("rate_limit")) {
    return "Our chart generation service is currently busy. Please try again in a moment.";
  }

  if (error.message.includes("Invalid chart type")) {
    return "We encountered an issue generating chart recommendations. Using default visualization.";
  }

  if (error.message.includes("Model refused")) {
    return "Unable to analyze this dataset. Please ensure it doesn't contain sensitive information.";
  }

  // Generic fallback
  return "We couldn't generate chart recommendations. Please try again or contact support.";
}
```

### Graceful Degradation

```javascript
async function generateDashboard(data) {
  let chartConfig;

  try {
    // Try AI-powered recommendations
    chartConfig = await getAIChartRecommendations(data);
  } catch (error) {
    console.warn("AI recommendation failed, using rule-based fallback:", error);

    // Fallback to rule-based chart selection
    chartConfig = getRuleBasedChartRecommendations(data);
  }

  return renderDashboard(chartConfig);
}

function getRuleBasedChartRecommendations(data) {
  const recommendations = [];

  // Simple heuristics
  const columns = Object.keys(data[0] || {});
  const numericCols = columns.filter(col => typeof data[0][col] === 'number');
  const dateCols = columns.filter(col => isDate(data[0][col]));

  if (dateCols.length > 0 && numericCols.length > 0) {
    recommendations.push({
      chartType: "line",
      title: "Trend Over Time",
      xAxis: dateCols[0],
      yAxis: numericCols[0],
      reasoning: "Time series visualization"
    });
  }

  if (numericCols.length >= 2) {
    recommendations.push({
      chartType: "scatter",
      title: "Relationship Analysis",
      xAxis: numericCols[0],
      yAxis: numericCols[1],
      reasoning: "Correlation analysis"
    });
  }

  return { charts: recommendations };
}
```

---

## Recommended Prompt Template

### Complete Template for Dashboard Chart Generation

```javascript
const CHART_RECOMMENDATION_SYSTEM_PROMPT = `You are an expert business intelligence analyst specializing in data visualization and dashboard design.

ROLE & EXPERTISE:
- 10+ years experience in BI and analytics
- Expert in chart selection based on data types and business questions
- Focused on actionable insights for decision-makers

OUTPUT RULES:
1. Return valid JSON matching the provided schema exactly
2. Suggest 2-5 chart types based on data structure and business value
3. Prioritize charts that reveal trends, comparisons, distributions, or relationships
4. Use action-oriented titles (e.g., "Track Revenue Growth" not "Revenue Chart")
5. Provide concise reasoning explaining the business value of each chart

CHART SELECTION CRITERIA:
- Bar charts: Compare categorical data (e.g., sales by region)
- Line charts: Show trends over time or continuous variables
- Scatter plots: Reveal relationships between two numeric variables
- Pie charts: Display part-to-whole relationships (max 7 categories)
- Area charts: Emphasize magnitude of change over time
- Tables: Present detailed data or when visualization isn't suitable

DATA VALIDATION:
- Only suggest charts appropriate for the data structure
- If data is unsuitable for visualization, explain why in a message
- Note data quality issues in reasoning (e.g., missing values, outliers)

TONE: Professional, concise, focused on business outcomes`;

const CHART_RECOMMENDATION_USER_PROMPT = (data, context) => `Analyze the dataset below and recommend optimal chart types for a business dashboard.

BUSINESS CONTEXT:
${context.businessContext || "General business intelligence dashboard"}

TARGET AUDIENCE:
${context.audience || "Executives and managers (non-technical)"}

FOCUS AREAS:
${context.focusAreas?.join('\n') || "- Overall trends\n- Key comparisons\n- Actionable insights"}

DATASET:
"""
Columns: ${Object.keys(data[0] || {}).join(', ')}
Row count: ${data.length}
Sample data:
${JSON.stringify(data.slice(0, 3), null, 2)}
"""

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "charts": [
    {
      "chartType": "bar|line|scatter|pie|area|table",
      "title": "Action-oriented title",
      "xAxis": "exact_column_name",
      "yAxis": "exact_column_name or aggregation (e.g., sum(revenue))",
      "reasoning": "1-2 sentences explaining business value"
    }
  ],
  "message": "optional - use only if no charts are suitable or data has critical issues"
}

EXAMPLE OUTPUT:
{
  "charts": [
    {
      "chartType": "line",
      "title": "Track Revenue Growth Over Time",
      "xAxis": "order_date",
      "yAxis": "total_revenue",
      "reasoning": "Line chart reveals revenue trajectory and seasonality patterns, helping identify growth trends and plan for peak periods"
    },
    {
      "chartType": "bar",
      "title": "Compare Product Category Performance",
      "xAxis": "product_category",
      "yAxis": "sum(revenue)",
      "reasoning": "Bar chart enables direct comparison across categories, making it easy to identify top performers and underperforming products for resource allocation"
    }
  ]
}`;

// Schema definition
const CHART_SCHEMA = {
  name: "chart_recommendations",
  strict: true,
  schema: {
    type: "object",
    properties: {
      charts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            chartType: {
              type: "string",
              enum: ["bar", "line", "scatter", "pie", "area", "table"],
              description: "Type of chart to render"
            },
            title: {
              type: "string",
              minLength: 10,
              maxLength: 100,
              description: "Action-oriented chart title"
            },
            xAxis: {
              type: "string",
              description: "Column name for x-axis"
            },
            yAxis: {
              type: "string",
              description: "Column name or aggregation for y-axis"
            },
            reasoning: {
              type: "string",
              minLength: 20,
              maxLength: 300,
              description: "Business justification for this chart"
            }
          },
          required: ["chartType", "title", "xAxis", "yAxis", "reasoning"],
          additionalProperties: false
        },
        minItems: 0,
        maxItems: 5
      },
      message: {
        type: "string",
        description: "Optional message if no charts are suitable"
      }
    },
    required: ["charts"],
    additionalProperties: false
  }
};

// Usage
async function getChartRecommendations(data, context = {}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: [
      { role: "system", content: CHART_RECOMMENDATION_SYSTEM_PROMPT },
      { role: "user", content: CHART_RECOMMENDATION_USER_PROMPT(data, context) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: CHART_SCHEMA
    },
    temperature: 0.7,  // Balance creativity and consistency
    max_tokens: 2000   // Sufficient for 5 charts with reasoning
  });

  // Check for refusal
  if (response.choices[0].message.refusal) {
    throw new Error(`Model refused: ${response.choices[0].message.refusal}`);
  }

  const result = JSON.parse(response.choices[0].message.content);

  // Log usage for monitoring
  console.log({
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    totalTokens: response.usage.total_tokens,
    estimatedCost: calculateCost(response.usage, "gpt-4o-2024-08-06")
  });

  return result;
}
```

---

## Dashboard Chart Generation Examples

### Example 1: E-commerce Sales Data

**Input Data:**
```javascript
const salesData = [
  { order_date: "2024-01-01", product_category: "Electronics", revenue: 5000, units: 25, customer_segment: "B2B" },
  { order_date: "2024-01-02", product_category: "Clothing", revenue: 3000, units: 150, customer_segment: "B2C" },
  { order_date: "2024-01-03", product_category: "Electronics", revenue: 7500, units: 35, customer_segment: "B2B" },
  // ... more rows
];

const context = {
  businessContext: "E-commerce company analyzing Q1 2024 performance",
  audience: "CEO and VP of Sales",
  focusAreas: [
    "Revenue growth trends",
    "Product category performance",
    "Customer segment insights"
  ]
};
```

**AI Response:**
```json
{
  "charts": [
    {
      "chartType": "line",
      "title": "Track Daily Revenue Trend",
      "xAxis": "order_date",
      "yAxis": "sum(revenue)",
      "reasoning": "Line chart shows revenue trajectory over time, helping identify growth patterns, seasonal trends, and anomalies for forecasting and strategic planning"
    },
    {
      "chartType": "bar",
      "title": "Compare Revenue by Product Category",
      "xAxis": "product_category",
      "yAxis": "sum(revenue)",
      "reasoning": "Bar chart enables direct comparison of category performance, making it easy to identify top-performing and underperforming categories for inventory and marketing decisions"
    },
    {
      "chartType": "scatter",
      "title": "Analyze Unit Price vs Volume Relationship",
      "xAxis": "units",
      "yAxis": "revenue",
      "reasoning": "Scatter plot reveals the relationship between volume and revenue, helping identify pricing sweet spots and opportunities for bundle deals or volume discounts"
    },
    {
      "chartType": "pie",
      "title": "Visualize Revenue Split by Customer Segment",
      "xAxis": "customer_segment",
      "yAxis": "sum(revenue)",
      "reasoning": "Pie chart shows the proportion of revenue from B2B vs B2C segments, informing resource allocation and go-to-market strategy"
    }
  ]
}
```

### Example 2: Marketing Campaign Performance

**Input Data:**
```javascript
const campaignData = [
  { campaign_name: "Summer Sale", channel: "Email", impressions: 50000, clicks: 2500, conversions: 125, cost: 1000 },
  { campaign_name: "Product Launch", channel: "Social Media", impressions: 100000, clicks: 5000, conversions: 250, cost: 3000 },
  // ... more rows
];

const context = {
  businessContext: "Marketing team analyzing campaign ROI",
  audience: "CMO and digital marketing team",
  focusAreas: [
    "Campaign effectiveness comparison",
    "Channel performance",
    "Cost efficiency (CPC, CPA)"
  ]
};
```

**AI Response:**
```json
{
  "charts": [
    {
      "chartType": "bar",
      "title": "Compare Conversion Rate by Campaign",
      "xAxis": "campaign_name",
      "yAxis": "conversions / clicks * 100",
      "reasoning": "Bar chart ranks campaigns by conversion rate, helping identify which campaigns resonate best with audiences and deserve increased budget allocation"
    },
    {
      "chartType": "scatter",
      "title": "Evaluate Cost vs Conversions Efficiency",
      "xAxis": "cost",
      "yAxis": "conversions",
      "reasoning": "Scatter plot reveals which campaigns deliver the best ROI, showing the relationship between spending and results to optimize budget distribution"
    },
    {
      "chartType": "bar",
      "title": "Analyze Channel Performance by CTR",
      "xAxis": "channel",
      "yAxis": "clicks / impressions * 100",
      "reasoning": "Bar chart compares click-through rates across channels (Email, Social Media, etc.), informing channel mix strategy and creative optimization priorities"
    }
  ]
}
```

### Example 3: Employee HR Data

**Input Data:**
```javascript
const employeeData = [
  { employee_id: 1, department: "Engineering", tenure_years: 3.5, salary: 120000, performance_rating: 4.2, training_hours: 40 },
  { employee_id: 2, department: "Sales", tenure_years: 2.0, salary: 90000, performance_rating: 3.8, training_hours: 25 },
  // ... more rows
];

const context = {
  businessContext: "HR analytics for talent management and retention",
  audience: "CHRO and department heads",
  focusAreas: [
    "Compensation analysis",
    "Performance trends",
    "Training investment impact"
  ]
};
```

**AI Response:**
```json
{
  "charts": [
    {
      "chartType": "scatter",
      "title": "Assess Training Impact on Performance",
      "xAxis": "training_hours",
      "yAxis": "performance_rating",
      "reasoning": "Scatter plot reveals the correlation between training investment and performance outcomes, helping justify L&D budgets and identify optimal training levels"
    },
    {
      "chartType": "bar",
      "title": "Compare Average Salary by Department",
      "xAxis": "department",
      "yAxis": "avg(salary)",
      "reasoning": "Bar chart shows compensation distribution across departments, supporting equitable pay analysis and budget planning for competitive talent acquisition"
    },
    {
      "chartType": "scatter",
      "title": "Analyze Tenure vs Performance Relationship",
      "xAxis": "tenure_years",
      "yAxis": "performance_rating",
      "reasoning": "Scatter plot identifies whether longer-tenured employees perform better, informing retention strategies and onboarding program effectiveness"
    }
  ]
}
```

### Example 4: Unsuitable Data (Error Handling)

**Input Data:**
```javascript
const unsuitableData = [
  { id: 1, name: "John Doe", email: "john@example.com", phone: "555-1234" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", phone: "555-5678" },
  // All text fields, no numeric data
];
```

**AI Response:**
```json
{
  "charts": [],
  "message": "This dataset contains only categorical identifiers (ID, name, email, phone) with no numeric or temporal data suitable for quantitative visualization. Consider using a table view to display this information, or enriching the dataset with metrics like user activity, engagement scores, or timestamps for meaningful chart generation."
}
```

---

## Sources & References

### Official OpenAI Documentation
1. **Structured Outputs Guide** - https://platform.openai.com/docs/guides/structured-outputs
   (Introduces Structured Outputs, JSON schemas, function calling with strict mode)

2. **Prompt Engineering Guide** - https://platform.openai.com/docs/guides/prompt-engineering
   (Official best practices from OpenAI)

3. **Introducing Structured Outputs in the API** - https://openai.com/index/introducing-structured-outputs-in-the-api/
   (August 2024 announcement, performance metrics)

### Academic & Technical Resources
4. **Prompt Engineering Guide (promptingguide.ai)** - https://www.promptingguide.ai/
   (Comprehensive guide on techniques: CoT, few-shot, zero-shot)

5. **Microsoft Azure OpenAI - Prompt Engineering Techniques**
   https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/prompt-engineering

6. **Chain-of-Thought Prompting Research**
   https://www.promptingguide.ai/techniques/cot

### Best Practices & Optimization
7. **Token Optimization for GPT-4** - https://portkey.ai/blog/optimize-token-efficiency-in-prompts/
   (Token efficiency strategies, cost reduction techniques)

8. **OpenAI Cookbook - GPT-4.1 Prompting Guide**
   https://cookbook.openai.com/examples/gpt4-1_prompting_guide

9. **System Messages: Best Practices & Experiments** - PromptHub
   https://www.prompthub.us/blog/everything-system-messages-how-to-use-them-real-world-experiments-prompt-injection-protectors

### Anti-Patterns & Common Mistakes
10. **Beyond "Prompt and Pray": 14 Prompt Engineering Mistakes** - Open Data Science
    https://opendatascience.com/beyond-prompt-and-pray-14-prompt-engineering-mistakes-youre-probably-still-making/

11. **Prompt Engineering in 2025: Latest Best Practices**
    https://www.news.aakashg.com/p/prompt-engineering

### Model-Specific Information
12. **GPT-4o Explained** - TechTarget
    https://www.techtarget.com/whatis/feature/GPT-4o-explained-Everything-you-need-to-know

13. **Structured Outputs in GPT-4o with JSON Schemas**
    https://old.onl/blog/structured-outputs-gpt-4o/

### Community Discussions (OpenAI Forums)
14. **Best Practices for Nested JSON Data** - OpenAI Developer Community
    https://community.openai.com/t/best-practices-to-help-gpt-understand-heavily-nested-json-data-and-analyse-such-data/922339

15. **System vs User Messages Discussion** - OpenAI Developer Community
    https://community.openai.com/t/should-i-use-system-or-user-messages-when-i-only-need-one/967210

### Implementation Examples
16. **Using JSON Schema for Structured Output (.NET)** - Microsoft DevBlogs
    https://devblogs.microsoft.com/semantic-kernel/using-json-schema-for-structured-output-in-net-for-openai-models/

17. **Using JSON Schema for Structured Output (Python)** - Microsoft DevBlogs
    https://devblogs.microsoft.com/semantic-kernel/using-json-schema-for-structured-output-in-python-for-openai-models/

### Additional Reading
18. **How to Write Expert Prompts for ChatGPT** - Towards Data Science
    https://towardsdatascience.com/how-to-write-expert-prompts-for-chatgpt-gpt-4-and-other-language-models-23133dc85550/

19. **Prompt Engineering Best Practices for ChatGPT** - OpenAI Help Center
    https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt

20. **12 Prompt Engineering Best Practices and Tips** - TechTarget
    https://www.techtarget.com/searchenterpriseai/tip/Prompt-engineering-tips-and-best-practices

---

## Summary: Quick Reference

### Top 5 Must-Dos for Chart Generation

1. **Use Structured Outputs** (GPT-4o-2024-08-06+) with `strict: true` for 100% schema compliance
2. **Include 1-3 concrete examples** showing desired output format and quality
3. **Use clear delimiters** (""", ###, XML tags) to separate instructions from data
4. **Set explicit constraints** (enums for chart types, min/max for counts, required fields)
5. **Implement validation & fallbacks** (verify outputs, retry on failure, graceful degradation)

### Top 5 Must-Avoids

1. **Don't use ambiguous language** - Be specific about quantities, formats, and expectations
2. **Don't skip examples** - Few-shot learning dramatically improves structured output quality
3. **Don't ignore token efficiency** - Use concise prompts, tables for data, and batch requests
4. **Don't accept outputs blindly** - Always validate against schema and business rules
5. **Don't use root-level arrays** - Structured Outputs require `type: "object"` at root

### Model Selection Matrix

| Use Case | Recommended Model | Reasoning |
|----------|------------------|-----------|
| Complex JSON with strict schema | GPT-4o-2024-08-06 | 100% structured output accuracy |
| Cost-sensitive applications | GPT-4o-mini | 90% cheaper, good performance |
| Reasoning-heavy tasks | o1 or o3-mini | Built-in chain-of-thought |
| Maximum context window | GPT-4.1 | 1M token input context |
| Legacy systems | GPT-4-turbo | Widely compatible |

---

**Document Version:** 1.0
**Last Updated:** October 2025
**Maintained By:** AI Engineering Team
**Next Review:** January 2026
