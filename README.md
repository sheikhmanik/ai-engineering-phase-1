# Phase 1 --- LLM Application Development

A practical AI Engineering project focused on building
production-oriented LLM applications with APIs, structured outputs,
conversation history, context management, validation, token budgeting,
cost awareness, latency, and rate limiting.

This phase builds on AI foundations and focuses on an important idea:

> An LLM is a component inside an application --- the backend is
> responsible for controlling how the model is accessed, what context it
> receives, and how its output is handled.

## 🎯 Goals

By completing this phase, I learned how to:

-   Work with LLM provider APIs and SDKs
-   Securely manage API keys and environment variables
-   Understand system, user, and assistant messages
-   Persist conversations and messages
-   Construct conversation context for the model
-   Generate and validate structured output
-   Use runtime schemas with Zod
-   Manage token limits and context windows
-   Budget input and output tokens
-   Understand the relationship between tokens, cost, and latency
-   Implement application-level rate limiting
-   Distinguish application limits from provider limits
-   Build a complete authenticated AI Chat API

------------------------------------------------------------------------

## 🏗️ Architecture

``` text
┌──────────────┐
│   Next.js    │
│   Frontend   │
└──────┬───────┘
       │
       │ HTTP + JWT
       ▼
┌────────────────────────┐
│        Fastify         │
│        Backend         │
│                        │
│  Authentication        │
│  Validation            │
│  Rate Limiting         │
│  Conversation Logic    │
│  Context Management    │
└──────┬─────────┬───────┘
       │         │
       │         │ PostgreSQL
       │         ▼
       │    ┌───────────┐
       │    │  Prisma   │
       │    │   ORM     │
       │    └─────┬─────┘
       │          │
       │          ▼
       │    ┌───────────┐
       │    │   User    │
       │    │Conversation│
       │    │  Message  │
       │    └───────────┘
       │
       │ Groq SDK
       ▼
┌────────────────────────┐
│     Groq Provider      │
│          ↓             │
│         LLM            │
└────────────────────────┘
```

------------------------------------------------------------------------

## 🧠 Core Mental Model

The application does not simply send a prompt to an LLM.

For every request, the backend constructs a bounded inference context:

``` text
User Request
     ↓
Authentication
     ↓
Request Validation
     ↓
Rate Limiting
     ↓
Retrieve Conversation
     ↓
Select Context
     ↓
System Instructions
+ Conversation History
+ Current User Message
     ↓
Token Budget
     ↓
LLM Provider API
     ↓
Model Inference
     ↓
Assistant Response
     ↓
Validation / Persistence
     ↓
Frontend
```

The database may contain hundreds of messages, but the model only
receives the context selected by the backend.

------------------------------------------------------------------------

## 📚 Topics Covered

### 1. LLM APIs & SDKs

Understanding the layers:

``` text
Application
    ↓
SDK
    ↓
Provider API
    ↓
Model
```

The SDK provides a developer-friendly interface, while the provider
exposes access to the underlying models and infrastructure.

------------------------------------------------------------------------

### 2. Messages & Conversation History

The application uses three conceptual message roles:

``` text
system
user
assistant
```

Conversation history is stored in PostgreSQL and reconstructed by the
backend before each model request.

The LLM does not automatically know the application's previous
conversations.

The backend must explicitly provide the relevant history.

------------------------------------------------------------------------

### 3. Authentication & Ownership

The frontend sends the JWT rather than trusting a client-provided
`userId`.

The backend derives the authenticated user:

``` text
JWT
 ↓
Authentication middleware
 ↓
request.userId
```

Conversation queries are scoped to the authenticated user.

For example:

``` text
conversationId + userId
```

This prevents one authenticated user from accessing another user's
conversation.

------------------------------------------------------------------------

### 4. Structured Outputs

LLMs primarily generate text, but applications often need predictable
machine-readable data.

Example:

``` json
{
  "intent": "book_restaurant",
  "partySize": 4,
  "date": "2026-10-05"
}
```

The application defines the expected structure and validates the result
before trusting it.

------------------------------------------------------------------------

### 5. Runtime Validation with Zod

TypeScript types provide compile-time guarantees, but LLM responses and
HTTP requests are runtime data.

Zod is used for runtime validation:

``` text
External Data
     ↓
Zod Schema
     ↓
Valid?
  ↙     ↘
Yes      No
 ↓        ↓
Process   Reject / Handle
```

------------------------------------------------------------------------

### 6. Token Limits & Context Management

A model has a finite context window.

Conceptually:

``` text
Input Tokens + Maximum Output Tokens
≤ Context Window
```

Example:

``` text
Context window     = 16,000
System             = 1,000
History            = 10,000
Current user       = 1,000
Output budget      = 4,000
--------------------------------
Total              = 16,000
```

A database message count is not equivalent to a token count.

For example:

``` text
20 short messages → relatively small context

20 very large messages → potentially huge context
```

The project initially uses a bounded recent-history strategy, while
recognizing that production systems can use more sophisticated
token-aware selection, summarization, retrieval, or hybrid approaches.

------------------------------------------------------------------------

### 7. Cost & Latency

LLM usage is generally related to token consumption.

Conceptually:

``` text
Cost =
(input tokens × input price)
+
(output tokens × output price)
```

Larger contexts can also increase processing work and latency.

Therefore context management is not only about staying within the
model's context window.

It also affects:

-   Cost
-   Latency
-   Throughput
-   User experience

------------------------------------------------------------------------

### 8. Rate Limiting

Application-level rate limiting protects the backend from excessive
requests.

Example:

``` text
20 requests / user / minute
```

The architecture distinguishes between:

``` text
Application rate limit
        ↓
Protects my API
```

and:

``` text
Provider rate limit
        ↓
Protects provider infrastructure
```

The application limiter is applied before the expensive LLM operation.

------------------------------------------------------------------------

## 🔐 Security Principles

Important security decisions in this project:

-   Provider API keys stay on the backend
-   Authentication is handled with JWT
-   `userId` is derived from authenticated identity
-   Client input is validated at runtime
-   Conversation access is scoped to the authenticated user
-   LLM outputs are treated as external/untrusted data
-   Rate limiting is applied to expensive AI operations

------------------------------------------------------------------------

## 🗄️ Database Model

The core data model is:

``` text
User
 │
 └── 1:N ── Conversation
                 │
                 └── 1:N ── Message
```

Conceptually:

``` text
User
├── Conversation 1
│   ├── User message
│   ├── Assistant message
│   ├── User message
│   └── Assistant message
│
├── Conversation 2
│   ├── User message
│   └── Assistant message
│
└── Conversation 3
    └── ...
```

The database stores the complete application state.

The backend decides which portion becomes LLM context.

------------------------------------------------------------------------

## 🔌 API

### Chat

``` http
POST /api/chat
Authorization: Bearer <JWT>
Content-Type: application/json
```

Request:

``` json
{
  "conversationId": 123,
  "message": "Explain context windows."
}
```

For a new conversation, `conversationId` can be omitted.

The backend creates the conversation and returns its ID.

Response:

``` json
{
  "conversationId": 123,
  "message": {
    "id": 456,
    "role": "assistant",
    "content": "..."
  }
}
```

### Conversations

``` http
GET /api/conversations
```

Returns the authenticated user's conversations.

### Conversation Messages

``` http
GET /api/conversations/:id/messages
```

Returns messages belonging to the authenticated user's conversation.

### Delete Conversation

``` http
DELETE /api/conversations/:id
```

Deletes an owned conversation and its messages.

------------------------------------------------------------------------

## 🛠️ Tech Stack

### Frontend

-   Next.js
-   TypeScript
-   Tailwind CSS

### Backend

-   Fastify
-   TypeScript
-   JWT authentication
-   Zod

### Database

-   PostgreSQL
-   Prisma

### AI

-   Groq SDK
-   LLM API

------------------------------------------------------------------------

## 🧩 Engineering Principles Learned

### The LLM is not the application

``` text
LLM ≠ Application
```

A useful AI application requires:

``` text
Authentication
+ Validation
+ State
+ Context Management
+ Business Logic
+ Persistence
+ Rate Limiting
+ LLM
```

### Database state ≠ model context

The database can store everything.

The backend decides what the model sees.

### Types ≠ runtime validation

TypeScript helps during development.

Runtime data still needs validation.

### Token count ≠ message count

Twenty messages can be tiny or enormous.

Context management should eventually become token-aware.

### Application limits ≠ provider limits

My backend controls access to my API.

The provider independently controls access to its infrastructure.

------------------------------------------------------------------------

## 🚀 Next Phase

### Phase 2 --- Streaming

The next phase extends this architecture from complete responses to
progressive responses:

``` text
Current:

Frontend
   ↓
Fastify
   ↓
LLM
   ↓
Complete response
   ↓
Frontend


Next:

Frontend
   ↑
   │ progressive chunks
Fastify
   ↑
   │ streaming response
LLM
```

Topics:

-   Streaming fundamentals
-   Async iteration
-   SSE
-   Progressive responses
-   Frontend stream consumption
-   Error handling
-   Client disconnects
-   Persisting the final response

Build target:

> **ChatGPT-style streaming chat**

------------------------------------------------------------------------

## 📌 Learning Philosophy

For AI Engineering, I follow this rule:

**MEMORIZE**

-   Concepts
-   Architecture
-   Runtime behavior
-   Reasoning

**UNDERSTAND**

-   Common implementation patterns

**LOOK UP**

-   Library syntax
-   SDK syntax
-   Provider-specific APIs
-   Configuration options

**GENERATE**

-   Boilerplate
-   Repetitive code
-   UI scaffolding

The goal is not to memorize every SDK method.

The goal is to understand **why the system works and where each
responsibility belongs**.
