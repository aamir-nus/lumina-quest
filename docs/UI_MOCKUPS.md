# UI Mockups (Mermaid)

## LLM Integration Workflow (Updated)

This diagram shows the complete flow of LLM-powered game actions, from user input to resolution:

```mermaid
sequenceDiagram
    actor Player
    participant API as Express API
    participant Engine as Session Engine
    participant LLM as LLM Resolver
    participant LMStudio as LMStudio Local
    participant Metrics as Resolver Metrics
    participant DB as MongoDB

    Player->>API: POST /sessions/action
    Note over Player,API: sessionId, userInput, tone

    API->>Engine: processSessionAction()

    Engine->>DB: Load session + game
    DB-->>Engine: session, currentScene

    Engine->>Engine: Check if terminal/max turns
    alt Terminal state
        Engine-->>API: terminal resolution
        API-->>Player: "Game complete"
    end

    Note over Engine,LLM: CLASSIFICATION STAGE
    Engine->>LLM: classifyRoute(input, avenues)
    Note over Engine,LLM: Game title, Scene narrative
    Note over Engine,LLM: Avenues with labels and keywords

    LLM->>LLM: Check API key availability
    alt No API key
        LLM-->>Engine: heuristic classification
    else API key present
        LLM->>LLM: Build classification prompt
        Note over LLM: Game context, Scene narrative, Player input, Avenue options, Confidence guidelines, JSON schema
        LLM->>LMStudio: POST /v1/chat/completions
        Note over LLM,LMStudio: Model: google/gemma-3-4b, Base URL: http://127.0.0.1:1234/v1
        LMStudio-->>LLM: JSON response
        Note over LLM: routeType, avenueId, confidence, explanation
    end

    LLM->>Metrics: Record route type, tokens, latency
    LLM-->>Engine: classification result

    alt routeType is clarification
        Engine-->>API: Clarification needed
        API-->>Player: "Please be more specific"
    end

    Note over Engine,LLM: RESOLUTION STAGE
    Engine->>Engine: Validate and apply route
    Note over Engine: Update points, Update turns, Check win/loss

    Engine->>DB: Save session state

    Note over Engine,LLM: NARRATION STAGE
    Engine->>LLM: generateNarration()
    Note over Engine,LLM: Resolution type, Route label, New scene narrative, Tone

    LLM->>LMStudio: POST /v1/chat/completions
    LMStudio-->>LLM: narration text
    LLM->>Metrics: Record usage

    LLM-->>Engine: narration with usage

    Engine->>Engine: Update history with narration
    Engine->>DB: Save final session state

    Engine-->>API: session, currentScene, resolution

    API-->>Player: 200 OK with session state and resolution
```

## Confidence Calibration Flow

```mermaid
flowchart TD
    A["LLM Receives Input"] --> B{"Input Analysis"}
    B -->|"Exact keyword/phrase match"| C["Confidence: 0.9-1.0"]
    B -->|"Strong semantic match"| D["Confidence: 0.7-0.9"]
    B -->|"Moderate confidence"| E["Confidence: 0.5-0.7"]
    B -->|"Low confidence"| F["Confidence: 0.3-0.5"]
    B -->|"Very low confidence"| G["Confidence: 0.0-0.3"]

    C --> H{"Route Type"}
    D --> H
    E --> H
    F --> H
    G --> H

    H -->|"confidence >= 0.5"| I["avenue or wildcard"]
    H -->|"confidence < 0.5"| J["clarification"]

    I --> K["Apply Resolution"]
    J --> L["Request Clarification"]

    C -.->|"I want to go to the forest"| M["95% confidence"]
    D -.->|"Head towards the trees"| N["90% confidence"]
    E -.->|"Exploring nature"| O["80% confidence"]
    F -.->|"What should I do?"| P["60% confidence"]
```

## Admin Workflow Mockup

```mermaid
flowchart TD
    A["Admin Login"] --> B["Create or Select Game"]
    B --> C["Graph View and Analysis"]
    C --> D["Publish or Playtest"]
    D --> E["Resolver Observability Panel"]
    E --> E1["Widget: Tokens in/out/total"]
    E --> E2["Widget: Compute and Memory Approx"]
    E --> F["Iterate Story Balance"]
```

## Player Workflow Mockup

```mermaid
flowchart TD
    A["Player Login"] --> B["Start Session"]
    B --> C["Scene Narrative and 8-bit Stage"]
    C --> D["Submit Action"]
    D --> E["Resolution Badge"]
    E --> E1["Widget: Tokens Used"]
    E --> E2["Widget: Compute Approx"]
    E --> F["Transition Overlay and Visual State Delta"]
    F --> G["Replay Timeline and Ending Grade"]
```

## LLM Provider Configuration

```mermaid
flowchart LR
    subgraph Providers ["LLM Providers"]
        O["OpenRouter External API"]
        L["LMStudio Local API"]
    end

    subgraph Config ["Environment Configuration"]
        E1[".env file"]
        E2["LLM_PROVIDER equals openrouter"]
        E3["LLM_PROVIDER equals lmstudio"]
    end

    subgraph LM ["LMStudio Setup"]
        LM1["Install LMStudio"]
        LM2["Load model google/gemma-3-4b"]
        LM3["Server on port 1234"]
    end

    E1 --> E2
    E1 --> E3

    E2 --> O
    E3 --> L

    LM3 --> L

    O --> R["LLM Resolver classifyRoute and generateNarration"]
    L --> R

    R --> M["Metrics and Observability"]
```

## Debug Logging Flow

```mermaid
flowchart TD
    A["Player Action"] --> B["GAME_ENGINE Processing action"]
    B --> C["Log User input game turn"]

    C --> D["LLM_CLASSIFY Starting classification"]
    D --> E["Log Input available avenues"]
    E --> F["LLM_RESOLVER Getting provider config"]
    F --> G["Log Provider LMStudio model"]
    G --> H["Log Calling LLM provider"]
    H --> I["Log Got response parsing"]
    I --> J["Log Raw parsed result"]
    J --> K["Log Latency tokens"]

    K --> L["GAME_ENGINE Resolution applied"]
    L --> M["Log New scene points"]

    M --> N["LLM_NARRATE Generating narration"]
    N --> O["Log Resolution type route label"]
    O --> P["Log Calling LLM provider"]
    P --> Q["Log Got response parsing"]
    Q --> R["Log Narration preview"]
    R --> S["Log Latency tokens"]

    S --> T["GAME_ENGINE Session saved"]
    T --> U["Log Status points"]

    style B fill:#e1f5ff
    style D fill:#fff3cd
    style L fill:#d4edda
    style N fill:#f8d7da
    style T fill:#d1ecf1
```

## Backend Service Architecture

```mermaid
flowchart TB
    subgraph API ["Express API Routes"]
        A1["POST /sessions/action"]
        A2["GET /sessions/:sessionId"]
        A3["GET /sessions/:sessionId/history"]
    end

    subgraph Engine ["Session Engine Service"]
        B1["processSessionAction"]
        B2["getSessionSnapshot"]
        B3["startSessionForUser"]
    end

    subgraph LLM ["LLM Resolver Service"]
        C1["classifyRoute"]
        C2["generateNarration"]
        C3["getProviderConfig"]
        C4["createClient"]
    end

    subgraph Policy ["Wildcard Policy Service"]
        D1["evaluateWildcard"]
    end

    subgraph Metrics ["Resolver Metrics"]
        E1["recordLlmUsage"]
        E2["recordRouteType"]
        E3["recordFallback"]
        E4["getMetrics"]
    end

    subgraph Providers ["External Providers"]
        F1["LMStudio API port 1234"]
        F2["OpenRouter API"]
    end

    A1 --> B1
    A2 --> B2
    A3 --> B2

    B1 --> C1
    B1 --> D1
    B1 --> C2

    C1 --> C3
    C1 --> C4
    C2 --> C3
    C2 --> C4

    C3 --> F1
    C3 --> F2

    C1 --> E1
    C1 --> E2
    C2 --> E1

    B1 --> E3
    C1 --> E3

    D1 --> B1
```
