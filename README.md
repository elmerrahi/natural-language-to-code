# Natural Language to Code

An open-source AI agent that converts natural language into SQL. Ask questions about your data in plain English -- the agent generates, executes, and explains SQL queries using Claude's extended thinking capabilities.

Built with LangGraph + FastAPI + Next.js. Supports PostgreSQL, MySQL, and CSV uploads.

![Python](https://img.shields.io/badge/python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-0.5-1C3C3C?logo=langchain&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

**[Live Demo](https://text-to-sql-frontend.vercel.app/)**

---

## What Is This?

A full-stack AI-powered SQL assistant. You provide a database connection (or upload CSVs), then ask questions like:

- *"What were the top 10 products by revenue last quarter?"*
- *"Show me customers who haven't ordered in 90 days"*
- *"Explain this query: SELECT ..."*
- *"Optimize this slow JOIN for me"*

The agent reasons through the problem, writes SQL, executes it, validates the results, and iterates if needed -- all streamed to a chat UI in real time.

### Three Modes

| Mode | What it does |
|------|-------------|
| **Generate** | Interprets your question, writes SQL, runs it, returns results with analysis |
| **Explain** | Takes a SQL query and breaks it down clause-by-clause in plain English |
| **Optimize** | Analyzes query performance and rewrites it with suggested indexes |

## What You'll Learn

This project is a practical reference for building production-grade AI agents. By reading the code, you'll learn:

- **Agent architecture with LangGraph** -- stateful graph with LLM and Tool nodes, conditional edges, and persistent checkpointing
- **Extended thinking** -- how Claude reasons step-by-step before generating SQL, and how interleaved reasoning improves accuracy
- **Human-in-the-loop** -- LangGraph `interrupt()` to let users review/modify SQL before execution
- **Streaming SSE from FastAPI** -- real-time token-by-token streaming over Server-Sent Events with a POST-based approach
- **Tool calling** -- structured tool definitions, input validation with Pydantic, and read-only SQL enforcement via `sqlglot`
- **Multi-database connectors** -- abstract connector pattern with PostgreSQL, MySQL, and DuckDB implementations
- **Prompt engineering** -- Jinja2 templates with conditional system prompts, XML-structured schema context, and mode-specific instructions
- **API key auth** -- SHA-256 hashed keys with in-memory TTL cache
- **Encrypted credential storage** -- Fernet symmetric encryption for stored database passwords
- **Full-stack deployment** -- Docker multi-stage builds, Compose orchestration, non-root containers

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              Next.js Frontend            │
                    │  Chat UI  ·  CSV Upload  ·  DB Connect  │
                    └──────────────────┬──────────────────────┘
                                       │ SSE (POST)
                    ┌──────────────────▼──────────────────────┐
                    │             FastAPI Backend              │
                    │                                         │
                    │  ┌───────────────────────────────────┐  │
                    │  │         LangGraph Agent            │  │
                    │  │                                    │  │
                    │  │   START ──► LLM Node ──► Tool Node │  │
                    │  │              ▲              │      │  │
                    │  │              └──────────────┘      │  │
                    │  │         (conditional loop)         │  │
                    │  └──────────────┬────────────────────┘  │
                    │                 │                        │
                    │    ┌────────────▼────────────┐          │
                    │    │    Query Executor Tool   │          │
                    │    │  sqlglot validation      │          │
                    │    │  human-in-the-loop       │          │
                    │    └─────┬──────────┬────────┘          │
                    │          │          │                    │
                    └──────────┼──────────┼────────────────────┘
                               │          │
              ┌────────────────▼─┐  ┌─────▼───────────────┐
              │     DuckDB       │  │  PostgreSQL / MySQL  │
              │  (CSV uploads)   │  │  (live connections)  │
              └──────────────────┘  └─────────────────────┘
```

**Agent loop:** The LLM node calls Claude, which may request tool calls. The conditional edge checks if the response contains tool calls -- if yes, route to the Tool node, which executes the query and returns results. The loop continues until the LLM produces a final text response.

**Checkpointing:** Every conversation turn is persisted to PostgreSQL via LangGraph's `AsyncPostgresSaver`, enabling multi-turn conversations with full history.

## Tech Stack

### Backend

| Component | Technology | Why |
|-----------|-----------|-----|
| LLM | [Anthropic Claude](https://docs.anthropic.com/) | Extended thinking for step-by-step SQL reasoning |
| Agent Framework | [LangGraph](https://langchain-ai.github.io/langgraph/) | Stateful graph with checkpointing, streaming, and interrupts |
| API | [FastAPI](https://fastapi.tiangolo.com/) | Async Python, SSE streaming, auto-generated OpenAPI docs |
| SQL Validation | [sqlglot](https://github.com/tobymao/sqlglot) | Parse and validate SQL is read-only before execution |
| CSV Engine | [DuckDB](https://duckdb.org/) | In-memory analytical SQL engine for uploaded CSVs |
| Checkpointing | [PostgreSQL](https://www.postgresql.org/) + psycopg3 | Persistent conversation state and app tables |
| Encryption | [cryptography](https://cryptography.io/) (Fernet) | Symmetric encryption for stored DB credentials |
| Prompts | [Jinja2](https://jinja.palletsprojects.com/) | Templated system prompts with conditional modes |
| Config | [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) | Type-safe settings from environment variables |
| Observability | [LangSmith](https://smith.langchain.com/) (optional) | Trace agent runs, debug prompt/tool interactions |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Markdown | react-markdown + remark-gfm |
| SSE Client | Custom fetch + ReadableStream parser |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Containers | Docker (multi-stage, non-root) |
| Orchestration | Docker Compose |
| Package Manager | [uv](https://docs.astral.sh/uv/) (Python), npm (Node) |
| Linting | [Ruff](https://docs.astral.sh/ruff/), [MyPy](https://mypy-lang.org/) |

## Getting Started

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js 20+
- PostgreSQL (local or remote)
- [Anthropic API key](https://console.anthropic.com/)

### 1. Clone the repo

```bash
git clone https://github.com/elmerrahi/natural-language-to-code.git
cd natural-language-to-code
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```
DB__HOST=localhost
DB__PORT=5432
DB__DATABASE=text_to_sql
DB__USER=postgres
DB__PASSWORD=your_password
DB__SCHEMA_NAME=public

ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Install dependencies

```bash
# Backend
uv sync --all-groups

# Frontend
cd frontend && npm install && cd ..
```

### 4. Initialize the database

```bash
uv run python scripts/initialize_db.py
```

This creates the PostgreSQL schema, LangGraph checkpoint tables, and all application tables (API keys, connections, query history, usage tracking).

### 5. Start the backend

```bash
make dev
```

API runs at http://localhost:8000 -- docs at http://localhost:8000/docs.

### 6. Start the frontend

```bash
cd frontend
cp .env.local.example .env.local
npm run dev
```

UI runs at http://localhost:3000.

### 7. Create an API key

```bash
curl -s -X POST http://localhost:8000/v1/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "dev"}' | python -m json.tool
```

Copy the `key` value and paste it into the frontend sidebar.

### 8. Start chatting

Upload a CSV or connect a database from the sidebar, then ask questions about your data.

## Docker Deployment

```bash
# Generate a Fernet key for credential encryption
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Configure .env with production values, then:
docker compose -f docker-compose.prod.yml --profile init up init-db   # one-time DB init
docker compose -f docker-compose.prod.yml up -d                       # start everything
```

This starts PostgreSQL, the backend, and the frontend. See the `docker-compose.prod.yml` for all configurable options.

## Project Structure

```
.
├── server.py                        # FastAPI app entry point
├── docker-compose.prod.yml          # Production deployment
├── Dockerfile                       # Backend container
├── .env.example                     # Environment template
│
├── prompts/
│   └── system.jinja2                # LLM system prompt (generate/explain/optimize modes)
│
├── queries/ddl/                     # SQL migration files
│   ├── create_schema.sql
│   ├── create_api_keys.sql
│   ├── create_connections.sql
│   ├── create_schema_catalog.sql
│   ├── create_query_history.sql
│   ├── create_usage_events.sql
│   └── create_indexes.sql
│
├── scripts/
│   └── initialize_db.py             # One-time DB bootstrap
│
├── src/app/
│   ├── api/
│   │   ├── lifespan.py              # App startup/shutdown lifecycle
│   │   ├── dependencies.py          # FastAPI dependency injection (auth, DB pool)
│   │   ├── rate_limit.py            # Token-bucket rate limiter middleware
│   │   └── routers/
│   │       ├── chat.py              # SSE streaming chat endpoint
│   │       ├── data.py              # CSV upload + DuckDB table management
│   │       ├── connections.py       # Database connection CRUD
│   │       ├── keys.py              # API key management
│   │       ├── catalog.py           # Schema introspection cache
│   │       ├── history.py           # Query history
│   │       └── usage.py             # Token usage tracking
│   │
│   ├── config/                      # pydantic-settings configuration
│   ├── connectors/                  # Database connector abstraction
│   │   ├── base.py                  # ABC: DatabaseConnector
│   │   ├── postgres.py              # PostgreSQL connector (psycopg)
│   │   ├── mysql.py                 # MySQL connector (aiomysql)
│   │   ├── duckdb_connector.py      # DuckDB connector
│   │   └── service.py              # ConnectionService (encrypt, introspect, execute)
│   │
│   ├── crypto/                      # Fernet encrypt/decrypt utilities
│   ├── db/                          # Connection pool + SQL query loader
│   │
│   ├── graphs/                      # LangGraph agent
│   │   └── chat/
│   │       ├── graph.py             # Graph construction (LLM → Tool loop)
│   │       ├── state.py             # ChatGraphState dataclass
│   │       ├── edges.py             # Conditional edge: is_tool_call
│   │       └── nodes/
│   │           ├── llm.py           # LLM node (streaming, primary/fallback models)
│   │           └── tool.py          # Tool execution node
│   │
│   ├── tools/
│   │   ├── base.py                  # Generic BaseTool[State, Input, Output]
│   │   ├── db.py                    # QueryExecutorTool (sqlglot validation, HITL interrupt)
│   │   └── handler.py              # Tool dispatch
│   │
│   └── models/                      # Pydantic request/response models
│
└── frontend/                        # Next.js 15 app
    ├── Dockerfile
    ├── src/
    │   ├── app/page.tsx             # Main page (sidebar + chat layout)
    │   ├── components/
    │   │   ├── ChatWindow.tsx       # Chat interface + SSE consumer
    │   │   ├── MessageBubble.tsx    # Message rendering (markdown, SQL, tables)
    │   │   ├── ChatInput.tsx        # Input + mode selector
    │   │   ├── CsvUpload.tsx        # Drag-and-drop CSV upload
    │   │   ├── ConnectionForm.tsx   # Database connection form
    │   │   └── SchemaViewer.tsx     # Collapsible schema display
    │   └── lib/
    │       ├── api.ts               # Typed API client
    │       ├── sse.ts               # POST-based SSE stream parser
    │       └── types.ts             # Shared TypeScript types
```

## API Endpoints

All routes are prefixed with `/v1/api`. Routes marked with a lock require the `X-API-Key` header.

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/keys` | | Create a new API key |
| `GET` | `/keys` | :lock: | List all API keys |
| `DELETE` | `/keys/{id}` | :lock: | Revoke an API key |
| `POST` | `/data/upload` | :lock: | Upload CSV files |
| `GET` | `/data/tables` | :lock: | List DuckDB tables |
| `DELETE` | `/data/tables/{name}` | :lock: | Drop a DuckDB table |
| `POST` | `/connections` | :lock: | Register a database connection |
| `GET` | `/connections` | :lock: | List connections |
| `POST` | `/connections/{id}/test` | :lock: | Test a connection |
| `DELETE` | `/connections/{id}` | :lock: | Remove a connection |
| `GET` | `/connections/{id}/schema` | :lock: | Get cached schema |
| `POST` | `/connections/{id}/schema/refresh` | :lock: | Re-introspect schema |
| `POST` | `/stream/{user_id}/{thread_id}` | | Chat (SSE stream) |
| `POST` | `/stream/{user_id}/{thread_id}/resume` | | Resume after interrupt |
| `GET` | `/connections/{id}/history` | :lock: | Query history |
| `GET` | `/usage` | :lock: | Token usage by day |
| `GET` | `/usage/summary` | :lock: | Monthly usage summary |
| `GET` | `/health/` | | Health check |

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DB__HOST` | Yes | -- | PostgreSQL host |
| `DB__PORT` | Yes | `5432` | PostgreSQL port |
| `DB__DATABASE` | Yes | -- | Database name |
| `DB__USER` | Yes | -- | Database user |
| `DB__PASSWORD` | Yes | -- | Database password |
| `DB__SCHEMA_NAME` | No | `public` | PostgreSQL schema |
| `DB__POOL_MIN_SIZE` | No | `0` | Min pool connections |
| `DB__POOL_MAX_SIZE` | No | `5` | Max pool connections |
| `FERNET_KEY` | Prod | -- | Encryption key (auto-generated in dev) |
| `ENVIRONMENT` | No | `development` | Set `production` to enforce FERNET_KEY and disable docs |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `ANTHROPIC_API_KEY` | Yes | -- | Anthropic API key |
| `LANGSMITH_TRACING` | No | `false` | Enable LangSmith tracing |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000/v1/api` | Frontend API URL |

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run linters: `uv run --group lint ruff check src/ server.py`
5. Commit (`git commit -m "Add my feature"`)
6. Push and open a Pull Request

## License

MIT
