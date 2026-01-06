# AI Provider Architecture - System Design

## High-Level Architecture

```mermaid
graph TB
    subgraph "API Layer"
        A1[/api/analyze]
        A2[/api/chat]
        A3[/api/generate-chart-title]
        A4[/api/recommendations/refresh]
        A5[/api/analyze-simple]
    end

    subgraph "Service Layer"
        B[AI Service<br/>Singleton]
    end

    subgraph "Factory Layer"
        C[Provider Factory<br/>Singleton]
    end

    subgraph "Provider Layer"
        D1[OpenAI Provider]
        D2[Gemini Provider]
        D3[Future Providers...]
    end

    subgraph "External APIs"
        E1[OpenAI API]
        E2[Google Gemini API]
    end

    subgraph "Normalization Layer"
        F[Response Normalizer]
    end

    A1 --> B
    A2 --> B
    A3 --> B
    A4 --> B
    A5 --> B

    B --> C
    B --> F

    C --> D1
    C --> D2
    C --> D3

    D1 --> E1
    D2 --> E2

    style B fill:#4CAF50
    style C fill:#2196F3
    style D1 fill:#FF9800
    style D2 fill:#9C27B0
    style F fill:#00BCD4
```

---

## Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as API Route
    participant Service as AI Service
    participant Factory as Provider Factory
    participant Provider as AI Provider
    participant Normalizer as Response Normalizer
    participant External as External API

    Client->>API: POST /api/analyze
    API->>Service: analyzeData(prompt)
    Service->>Factory: getProvider(type)
    Factory->>Factory: Check AI_PROVIDER env
    Factory-->>Service: Return provider instance
    Service->>Provider: complete(options)
    Provider->>Provider: Transform messages
    Provider->>External: API Request
    External-->>Provider: API Response
    Provider->>Provider: Normalize errors
    Provider-->>Service: Unified response
    Service->>Normalizer: normalizeResponse()
    Normalizer->>Normalizer: Map field names
    Normalizer-->>Service: Normalized response
    Service-->>API: Result
    API-->>Client: JSON Response
```

---

## Message Transformation Flow

### OpenAI (Native Support)

```mermaid
graph LR
    A[System Message] --> B[OpenAI API]
    C[User Message] --> B
    D[Assistant Message] --> B
    B --> E[Response]

    style A fill:#4CAF50
    style B fill:#FF9800
```

### Gemini (Transformed)

```mermaid
graph LR
    A[System Message] --> T[Transform]
    C[User Message] --> T
    T --> M[Merged User Message]
    M --> B[Gemini API]
    D[Assistant → Model] --> T2[Transform]
    T2 --> B
    B --> E[Response]

    style A fill:#4CAF50
    style T fill:#2196F3
    style M fill:#00BCD4
    style B fill:#9C27B0
```

**Transformation Logic:**
```
System: "You are an expert analyst"
User: "Analyze this data: [...]"

↓ TRANSFORMS TO ↓

User: "You are an expert analyst\n\nAnalyze this data: [...]"
```

---

## Response Normalization Flow

```mermaid
graph TB
    subgraph "OpenAI Response"
        O1[insights: array]
        O2[chartConfig: array]
        O3[summary: object]
    end

    subgraph "Gemini Response"
        G1[analysis: array]
        G2[charts: array]
        G3[metadata: object]
    end

    subgraph "Normalizer"
        N[Response Normalizer]
    end

    subgraph "Unified Output"
        U1[insights: array]
        U2[chartConfig: array]
        U3[summary: object]
    end

    O1 --> N
    O2 --> N
    O3 --> N

    G1 --> N
    G2 --> N
    G3 --> N

    N --> U1
    N --> U2
    N --> U3

    style N fill:#00BCD4
    style U1 fill:#4CAF50
    style U2 fill:#4CAF50
    style U3 fill:#4CAF50
```

**Field Mappings:**
- `insights` ← `analysis`, `keyFindings`, `findings`, `insights`
- `chartConfig` ← `charts`, `visualizations`, `chartRecommendations`, `chartConfig`
- `summary` ← `metadata`, `context`, `summary`

---

## Error Handling Flow

```mermaid
graph TB
    A[API Request] --> B{Provider Call}
    B -->|Success| C[Response Normalizer]
    B -->|Error| D[Provider Error Handler]

    D --> E{Error Type}

    E -->|Rate Limit| F1[429 Rate Limit<br/>retryable: true]
    E -->|Quota| F2[402 Quota Exceeded<br/>retryable: false]
    E -->|Auth| F3[401 Auth Error<br/>retryable: false]
    E -->|Server| F4[5xx Server Error<br/>retryable: true]
    E -->|Unknown| F5[Unknown Error<br/>retryable: false]

    C --> G[Normalized Response]
    F1 --> H[Unified Error Format]
    F2 --> H
    F3 --> H
    F4 --> H
    F5 --> H

    G --> I[Success Response]
    H --> J[Error Response]

    style D fill:#FF5722
    style H fill:#FF9800
    style G fill:#4CAF50
```

---

## Provider Selection Logic

```mermaid
graph TD
    A[getProvider()] --> B{Provider Type<br/>Specified?}

    B -->|Yes| C[Use Specified]
    B -->|No| D{Check AI_PROVIDER<br/>Environment Var}

    D -->|gemini| E[Use Gemini]
    D -->|openai| F[Use OpenAI]
    D -->|Not Set| G[Default: OpenAI]

    C --> H{Provider<br/>Available?}
    E --> H
    F --> H
    G --> H

    H -->|Yes| I[Return Provider<br/>Instance]
    H -->|No| J[Throw Error:<br/>Provider not configured]

    style I fill:#4CAF50
    style J fill:#FF5722
```

---

## Streaming Architecture

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Service
    participant Provider
    participant External

    Client->>API: POST /api/chat (streaming)
    API->>Service: streamChat(messages)
    Service->>Provider: stream(options)

    loop Streaming
        Provider->>External: Stream request
        External-->>Provider: Chunk
        Provider->>Provider: Normalize chunk
        Provider-->>Service: Yield chunk
        Service-->>API: Forward chunk
        API-->>Client: SSE: data: {...}
    end

    Provider-->>Service: Yield final (isComplete: true)
    Service-->>API: Complete signal
    API-->>Client: SSE: data: [DONE]
```

---

## JSON Mode Configuration

```mermaid
graph TB
    A[AI Service Request<br/>jsonMode: true] --> B{Provider Type}

    B -->|OpenAI| C[Set response_format:<br/>type: 'json_object']
    B -->|Gemini| D[Set generationConfig:<br/>responseMimeType: 'application/json']

    C --> E[OpenAI API]
    D --> F[Gemini API]

    E --> G[JSON Response]
    F --> G

    G --> H[Parse JSON]
    H --> I[Normalize Fields]

    style A fill:#2196F3
    style C fill:#FF9800
    style D fill:#9C27B0
    style I fill:#00BCD4
```

---

## Class Diagram

```mermaid
classDiagram
    class AIService {
        +analyzeData(prompt, provider?) Promise~NormalizedAnalysisResponse~
        +chat(messages, provider?) Promise~string~
        +streamChat(messages, provider?) AsyncGenerator~string~
        +generateChartTitle(chartType, dataMapping, sampleData, provider?) Promise~object~
    }

    class AIProviderFactory {
        -providers Map
        +getProvider(type?) AIProviderInterface
        +isProviderAvailable(type) boolean
        +getAvailableProviders() AIProvider[]
        -getDefaultProvider() AIProvider
    }

    class AIProviderInterface {
        <<interface>>
        +complete(options) Promise~AICompletionResponse~
        +stream(options) AsyncGenerator~AIStreamChunk~
        +getName() string
        +isAvailable() boolean
    }

    class OpenAIProvider {
        -client OpenAI
        +complete(options) Promise~AICompletionResponse~
        +stream(options) AsyncGenerator~AIStreamChunk~
        +getName() string
        +isAvailable() boolean
        -normalizeError(error) AIError
    }

    class GeminiProvider {
        -client GoogleGenerativeAI
        +complete(options) Promise~AICompletionResponse~
        +stream(options) AsyncGenerator~AIStreamChunk~
        +getName() string
        +isAvailable() boolean
        -transformMessages(messages) object
        -normalizeError(error) AIError
    }

    class ResponseNormalizer {
        <<static>>
        +normalizeAnalysisResponse(raw) NormalizedAnalysisResponse
        +validateResponse(response) void
    }

    AIService --> AIProviderFactory : uses
    AIService --> ResponseNormalizer : uses
    AIProviderFactory --> AIProviderInterface : creates
    OpenAIProvider ..|> AIProviderInterface : implements
    GeminiProvider ..|> AIProviderInterface : implements
```

---

## File Structure

```
lib/services/ai/
├── types.ts                    # Base interfaces and types
├── normalizer.ts               # Response normalization
├── factory.ts                  # Provider factory (singleton)
├── service.ts                  # Unified AI service (singleton)
└── providers/
    ├── openai-provider.ts      # OpenAI implementation
    └── gemini-provider.ts      # Gemini implementation

app/api/
├── analyze/
│   └── route.ts                # Uses AI Service
├── analyze-simple/
│   └── route.ts                # Uses AI Service
├── chat/
│   └── route.ts                # Uses AI Service (streaming)
├── generate-chart-title/
│   └── route.ts                # Uses AI Service
└── recommendations/
    └── refresh/
        └── route.ts            # Uses AI Service
```

---

## Configuration Flow

```mermaid
graph TB
    A[.env.local] --> B[Environment Variables]

    B --> C[AI_PROVIDER]
    B --> D[OPENAI_API_KEY]
    B --> E[GEMINI_API_KEY]
    B --> F[OPENAI_MODEL<br/>optional]
    B --> G[GEMINI_MODEL<br/>optional]

    C --> H{Provider Factory}
    D --> I[OpenAI Provider]
    E --> J[Gemini Provider]

    H -->|openai| I
    H -->|gemini| J

    F --> I
    G --> J

    I --> K[Uses: gpt-4o-mini<br/>or custom model]
    J --> L[Uses: gemini-1.5-flash<br/>or custom model]

    style A fill:#2196F3
    style H fill:#FF9800
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        A[Load Balancer]
        B1[App Instance 1]
        B2[App Instance 2]
        B3[App Instance N]
    end

    subgraph "Configuration"
        C[Environment Vars<br/>AI_PROVIDER=gemini]
    end

    subgraph "External Services"
        D[OpenAI API]
        E[Gemini API]
    end

    subgraph "Monitoring"
        F[Logs]
        G[Metrics]
        H[Error Tracking]
    end

    A --> B1
    A --> B2
    A --> B3

    C --> B1
    C --> B2
    C --> B3

    B1 --> D
    B1 --> E
    B2 --> D
    B2 --> E
    B3 --> D
    B3 --> E

    B1 --> F
    B2 --> F
    B3 --> F

    B1 --> G
    B2 --> G
    B3 --> G

    B1 --> H
    B2 --> H
    B3 --> H

    style C fill:#4CAF50
```

**Key Points:**
- All instances read same environment configuration
- Provider switching affects all instances simultaneously
- No code deployment needed to switch providers
- Monitoring tracks provider performance across all instances

---

## Migration Strategy

```mermaid
graph TB
    A[Current State<br/>Direct OpenAI] --> B[Phase 1:<br/>Create Abstraction]

    B --> C[Phase 2:<br/>Update API Routes]

    C --> D[Phase 3:<br/>Testing]

    D --> E{Tests Pass?}

    E -->|Yes| F[Phase 4:<br/>Staging Deployment]
    E -->|No| G[Fix Issues]
    G --> D

    F --> H{Staging OK?}

    H -->|Yes| I[Phase 5:<br/>Production Deployment<br/>AI_PROVIDER=openai]
    H -->|No| J[Debug & Fix]
    J --> F

    I --> K{Production Stable?}

    K -->|Yes| L[Switch to Gemini<br/>AI_PROVIDER=gemini]
    K -->|No| M[Rollback]
    M --> I

    L --> N{Gemini OK?}

    N -->|Yes| O[Success:<br/>50% Cost Reduction]
    N -->|No| P[Rollback to OpenAI<br/>AI_PROVIDER=openai]

    style A fill:#FF9800
    style O fill:#4CAF50
    style M fill:#FF5722
    style P fill:#FF5722
```

---

## Comparison Matrix

| Feature | OpenAI | Gemini | Abstraction Solution |
|---------|--------|--------|---------------------|
| System Role | ✅ Native | ❌ Not supported | Merge into user message |
| JSON Mode | `response_format` | `responseMimeType` | Provider-specific config |
| Streaming | ✅ Native | ✅ Native | Unified AsyncGenerator |
| Message Roles | system/user/assistant | user/model | Transform in provider |
| Error Format | OpenAI-specific | Gemini-specific | Normalized AIError |
| Response Fields | Standard | Varies | ResponseNormalizer |
| Cost (input) | $0.15/1M | $0.075/1M | 50% savings |
| Cost (output) | $0.60/1M | $0.30/1M | 50% savings |
| Speed | 1-3s | 0.5-2s | Generally faster |

---

## Testing Strategy

```mermaid
graph TB
    A[Unit Tests] --> B[Provider Tests]
    A --> C[Normalizer Tests]
    A --> D[Factory Tests]

    E[Integration Tests] --> F[Service Tests]
    E --> G[API Route Tests]

    H[E2E Tests] --> I[Full Flow Tests]
    H --> J[Provider Switch Tests]

    B --> K[Test Report]
    C --> K
    D --> K
    F --> K
    G --> K
    I --> K
    J --> K

    K --> L{All Pass?}
    L -->|Yes| M[Ready for Deployment]
    L -->|No| N[Fix & Retest]
    N --> A

    style K fill:#2196F3
    style M fill:#4CAF50
    style N fill:#FF5722
```

---

## Performance Monitoring

```mermaid
graph TB
    A[Request] --> B[Measure Start Time]
    B --> C[Provider Call]
    C --> D[Measure End Time]

    D --> E[Calculate Metrics]

    E --> F[Duration]
    E --> G[Token Usage]
    E --> H[Cost]
    E --> I[Success/Failure]

    F --> J[Log to Console]
    G --> J
    H --> J
    I --> J

    J --> K{Error?}
    K -->|Yes| L[Error Tracking]
    K -->|No| M[Success Metrics]

    L --> N[Alert if needed]
    M --> O[Analytics Dashboard]

    style J fill:#2196F3
    style L fill:#FF5722
    style M fill:#4CAF50
```

**Example Log:**
```json
{
  "event": "ai_request",
  "provider": "gemini",
  "route": "/api/analyze",
  "duration_ms": 1234,
  "tokens": {
    "input": 500,
    "output": 300,
    "total": 800
  },
  "cost_usd": 0.0003,
  "success": true
}
```

---

## Security Considerations

```mermaid
graph TB
    A[API Key Management] --> B[Environment Variables]
    B --> C[Never commit keys]
    B --> D[Use secrets manager in prod]

    E[Request Validation] --> F[Rate Limiting]
    E --> G[Input Sanitization]
    E --> H[Authentication]

    I[Error Handling] --> J[Don't expose API keys]
    I --> K[Generic error messages]
    I --> L[Detailed logging server-side]

    M[Data Privacy] --> N[Don't log sensitive data]
    M --> O[Comply with data policies]

    style A fill:#FF5722
    style E fill:#FF9800
    style I fill:#FFC107
    style M fill:#4CAF50
```

---

## Future Enhancements

```mermaid
graph TB
    A[Current Architecture] --> B[Future Additions]

    B --> C[Add Claude Provider]
    B --> D[Add Llama Provider]
    B --> E[Add Mistral Provider]

    B --> F[Intelligent Routing<br/>Route to best provider]
    B --> G[Fallback Mechanism<br/>Try backup on failure]
    B --> H[A/B Testing<br/>Compare providers]
    B --> I[Caching Layer<br/>Cache common responses]

    style A fill:#2196F3
    style B fill:#4CAF50
```

**Adding a new provider is easy:**
1. Implement `AIProviderInterface`
2. Add to factory
3. Set environment variable

**No changes needed to:**
- API routes
- AI Service
- Response normalizer
- Existing providers

---

This architecture provides a solid foundation for multi-provider AI support with minimal code changes and maximum flexibility.
