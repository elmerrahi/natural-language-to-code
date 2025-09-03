from contextlib import asynccontextmanager
from typing import AsyncIterator, TypedDict

import duckdb
import psycopg_pool
from anthropic import AsyncAnthropic
from cryptography.fernet import Fernet
from fastapi import FastAPI
from langgraph.checkpoint.postgres.aio import (
    AsyncPostgresSaver,
)
from langgraph.graph.state import CompiledStateGraph
from loguru import logger

from app.config import get_settings
from app.connectors import ConnectionService
from app.db import (
    QueryStore,
    create_db_connection_pool,
)
from app.graphs import create_chat_graph
from app.tools import get_tool_handler
from app.utils import PromptStore


class AppState(TypedDict):
    db_pool: psycopg_pool.AsyncConnectionPool
    duck_db_conn: duckdb.DuckDBPyConnection
    graph: CompiledStateGraph
    prompt_store: PromptStore
    query_store: QueryStore
    connection_service: ConnectionService


_TABLE_DDL_KEYS = [
    "ddl.create_api_keys",
    "ddl.create_connections",
    "ddl.create_schema_catalog",
    "ddl.create_query_history",
    "ddl.create_usage_events",
    "ddl.create_indexes",
]


async def _initialize_tables(
    db_pool: psycopg_pool.AsyncConnectionPool,
    query_store: QueryStore,
) -> None:
    async with db_pool.connection() as conn:
        async with conn.transaction():
            for key in _TABLE_DDL_KEYS:
                try:
                    ddl = query_store.get_query(key)
                    await conn.execute(ddl)  # type: ignore
                except KeyError:
                    logger.warning(
                        "DDL query {key} not found, "
                        "skipping.",
                        key=key,
                    )
    logger.info("Application tables initialized")


@asynccontextmanager
async def lifespan(
    app: FastAPI,
) -> AsyncIterator[AppState]:
    settings = get_settings()

    if settings.is_production and not settings.fernet_key:
        raise RuntimeError(
            "FERNET_KEY must be set in production. "
            "Generate one with: python -c "
            "\"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )

    db_pool = create_db_connection_pool(
        settings=settings
    )
    await db_pool.open()
    logger.info("Database pool ready")

    duck_db_conn = duckdb.connect(database=":memory:")
    anthropic_client = AsyncAnthropic()
    logger.info("Services initialized")

    if settings.fernet_key:
        cipher = Fernet(settings.fernet_key.encode())
    else:
        cipher = Fernet(Fernet.generate_key())
        logger.warning(
            "No FERNET_KEY set. Using ephemeral key. "
            "Encrypted data will not survive restarts."
        )

    connection_service = ConnectionService(
        db_pool=db_pool, cipher=cipher
    )

    tool_handler = get_tool_handler(
        dependencies={
            "conn": duck_db_conn,
            "connection_service": connection_service,
        }
    )
    prompt_store = PromptStore(
        prompts_dir=settings.paths.prompts_dir
    )
    query_store = QueryStore(
        base_query_path=settings.paths.queries_dir
    )

    await _initialize_tables(db_pool, query_store)

    checkpointer = AsyncPostgresSaver(
        conn=db_pool
    )  # type: ignore

    graph = create_chat_graph(
        anthropic_client=anthropic_client,
        tool_handler=tool_handler,
        prompt_store=prompt_store,
        checkpointer=checkpointer,
    )

    yield {
        "db_pool": db_pool,
        "duck_db_conn": duck_db_conn,
        "graph": graph,
        "prompt_store": prompt_store,
        "query_store": query_store,
        "connection_service": connection_service,
    }

    logger.info("Shutting down services")
    await db_pool.close()
    duck_db_conn.close()
    await anthropic_client.close()
    logger.info("Shutdown complete")
