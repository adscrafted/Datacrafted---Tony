/**
 * JSON Extractor Test Suite
 *
 * Comprehensive test cases demonstrating the utility's capabilities
 * Run with: npm test json-extractor.test.ts
 */

import {
  extractJSON,
  parseJSONFromString,
  safeExtractJSON,
  type ExtractionResult
} from './json-extractor'

// Test data types
interface TestData {
  name: string
  value: number
}

interface ChartConfig {
  chartConfig: Array<{
    type: string
    title: string
  }>
  insights: string[]
}

describe('JSON Extractor', () => {
  describe('Direct JSON parsing', () => {
    it('should parse clean JSON object', () => {
      const input = '{"name": "test", "value": 42}'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.strategy).toBe('direct-parse')
      expect(result.data).toEqual({ name: 'test', value: 42 })
    })

    it('should parse clean JSON array', () => {
      const input = '[1, 2, 3, 4, 5]'
      const result = extractJSON<number[]>(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([1, 2, 3, 4, 5])
    })

    it('should parse JSON with whitespace', () => {
      const input = '\n\n  {"name": "test"}  \n\n'
      const result = extractJSON(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'test' })
    })
  })

  describe('Markdown fence removal', () => {
    it('should extract from ```json fence', () => {
      const input = '```json\n{"name": "test", "value": 42}\n```'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.strategy).toBe('json-fence-removal')
      expect(result.data).toEqual({ name: 'test', value: 42 })
    })

    it('should extract from ```json fence without newlines', () => {
      const input = '```json{"name": "test"}```'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'test' })
    })

    it('should extract from ``` json fence (with space)', () => {
      const input = '``` json\n{"name": "test"}\n```'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'test' })
    })
  })

  describe('Generic fence removal', () => {
    it('should extract from generic ``` fence', () => {
      const input = '```\n{"name": "test", "value": 42}\n```'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.strategy).toBe('generic-fence-removal')
      expect(result.data).toEqual({ name: 'test', value: 42 })
    })

    it('should handle language identifier on first line', () => {
      const input = '```typescript\n{"name": "test"}\n```'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'test' })
    })
  })

  describe('Object extraction from text', () => {
    it('should extract JSON object from surrounding text', () => {
      const input = 'Here is your data: {"name": "test", "value": 42} - hope this helps!'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.strategy).toBe('object-extraction')
      expect(result.data).toEqual({ name: 'test', value: 42 })
    })

    it('should handle nested objects', () => {
      const input = 'Response: {"outer": {"inner": "value"}} end'
      const result = extractJSON(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ outer: { inner: 'value' } })
    })
  })

  describe('Array extraction from text', () => {
    it('should extract JSON array from surrounding text', () => {
      const input = 'The numbers are: [1, 2, 3, 4, 5] as requested'
      const result = extractJSON<number[]>(input)

      expect(result.success).toBe(true)
      expect(result.strategy).toBe('array-extraction')
      expect(result.data).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle array of objects', () => {
      const input = 'Results: [{"id": 1}, {"id": 2}] done'
      const result = extractJSON(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
    })
  })

  describe('Complex real-world scenarios', () => {
    it('should handle OpenAI-style response with markdown', () => {
      const input = `Here's your analysis:

\`\`\`json
{
  "chartConfig": [
    {
      "type": "bar",
      "title": "Sales by Region"
    }
  ],
  "insights": [
    "Revenue increased 25%",
    "Q4 was strongest quarter"
  ]
}
\`\`\`

Let me know if you need anything else!`

      const result = extractJSON<ChartConfig>(input)

      expect(result.success).toBe(true)
      expect(result.data?.chartConfig).toHaveLength(1)
      expect(result.data?.insights).toHaveLength(2)
    })

    it('should handle malformed fence with extra backticks', () => {
      const input = '````json\n{"name": "test"}\n````'
      const result = extractJSON<TestData>(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'test' })
    })
  })

  describe('Error handling', () => {
    it('should throw error for invalid JSON by default', () => {
      const input = 'not valid json at all'

      expect(() => extractJSON(input)).toThrow('JSON extraction failed')
    })

    it('should return error result when throwOnError is false', () => {
      const input = 'invalid json'
      const result = extractJSON(input, { throwOnError: false })

      expect(result.success).toBe(false)
      expect(result.error).toContain('JSON extraction failed')
    })

    it('should handle empty string', () => {
      const input = ''
      const result = extractJSON(input, { throwOnError: false })

      expect(result.success).toBe(false)
      expect(result.error).toContain('non-empty string')
    })

    it('should handle null input', () => {
      const result = extractJSON(null as any, { throwOnError: false })

      expect(result.success).toBe(false)
      expect(result.error).toContain('non-empty string')
    })

    it('should use custom error prefix', () => {
      const input = 'invalid'
      const result = extractJSON(input, {
        throwOnError: false,
        errorPrefix: 'Custom error'
      })

      expect(result.error).toContain('Custom error')
    })
  })

  describe('Convenience functions', () => {
    it('parseJSONFromString should return data directly', () => {
      const input = '{"name": "test"}'
      const data = parseJSONFromString<TestData>(input)

      expect(data.name).toBe('test')
    })

    it('parseJSONFromString should throw on error', () => {
      const input = 'invalid'

      expect(() => parseJSONFromString(input)).toThrow()
    })

    it('safeExtractJSON should return null on error', () => {
      const input = 'invalid'
      const data = safeExtractJSON(input)

      expect(data).toBeNull()
    })

    it('safeExtractJSON should return data on success', () => {
      const input = '{"name": "test"}'
      const data = safeExtractJSON<TestData>(input)

      expect(data).not.toBeNull()
      expect(data?.name).toBe('test')
    })
  })

  describe('Type safety', () => {
    it('should work with typed interfaces', () => {
      const input = '{"name": "test", "value": 42}'
      const result = extractJSON<TestData>(input)

      if (result.success && result.data) {
        // TypeScript should recognize these properties
        expect(result.data.name).toBe('test')
        expect(result.data.value).toBe(42)
      }
    })

    it('should work with complex nested types', () => {
      interface Complex {
        items: Array<{ id: number; nested: { value: string } }>
      }

      const input = '{"items": [{"id": 1, "nested": {"value": "test"}}]}'
      const result = extractJSON<Complex>(input)

      expect(result.success).toBe(true)
      expect(result.data?.items[0].nested.value).toBe('test')
    })
  })

  describe('Verbose mode', () => {
    it('should log strategies when verbose is true', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const input = '```json\n{"name": "test"}\n```'

      extractJSON(input, { verbose: true })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Success with strategy')
      )

      consoleSpy.mockRestore()
    })
  })
})

// Example usage demonstrations
export const examples = {
  // Example 1: Basic usage
  basic: () => {
    const jsonString = '{"user": "Alice", "age": 30}'
    const result = extractJSON(jsonString)
    console.log(result.data) // { user: "Alice", age: 30 }
  },

  // Example 2: Markdown code block
  markdown: () => {
    const markdown = `
\`\`\`json
{
  "status": "success",
  "data": [1, 2, 3]
}
\`\`\`
    `
    const result = extractJSON(markdown)
    console.log(result.data) // { status: "success", data: [1, 2, 3] }
  },

  // Example 3: JSON embedded in text
  embedded: () => {
    const text = 'The configuration is {"port": 3000, "host": "localhost"} as shown'
    const result = extractJSON(text)
    console.log(result.data) // { port: 3000, host: "localhost" }
  },

  // Example 4: Type-safe extraction
  typeSafe: () => {
    interface Config {
      port: number
      host: string
    }

    const input = '{"port": 3000, "host": "localhost"}'
    const config = parseJSONFromString<Config>(input)
    console.log(`Server running on ${config.host}:${config.port}`)
  },

  // Example 5: Safe extraction without throwing
  safe: () => {
    const maybeJSON = 'might not be valid'
    const data = safeExtractJSON(maybeJSON)

    if (data === null) {
      console.log('Failed to parse, using defaults')
    } else {
      console.log('Parsed successfully:', data)
    }
  },

  // Example 6: OpenAI API response
  openai: () => {
    const apiResponse = `
Here's your analysis:

\`\`\`json
{
  "insights": ["Sales increased", "Q4 strong"],
  "chartConfig": [
    {"type": "bar", "title": "Revenue"}
  ]
}
\`\`\`

Hope this helps!
    `

    interface AIResponse {
      insights: string[]
      chartConfig: Array<{ type: string; title: string }>
    }

    const analysis = parseJSONFromString<AIResponse>(apiResponse)
    console.log(`Found ${analysis.insights.length} insights`)
    console.log(`Generated ${analysis.chartConfig.length} charts`)
  }
}
