import hashlib
import time
from typing import Annotated, AsyncIterator

import duckdb
import psycopg
from fastapi import Depends, HTTPException
from fastapi.requests import HTTPConnection
from langgraph.graph.state import CompiledStateGraph
from pydantic import UUID4

from app.connectors import ConnectionService
from app.models.api.requests import (
    ChatbotRequest,
    ChatbotResumeRequest,
)
from app.utils.prompts_utils import PromptStore

_key_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 300


async def get_api_key_id(
    request: HTTPConnection,
) -> str:
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing X-API-Key header",
        )

    key_hash = hashlib.sha256(api_key.encode()).hexdigest()

    cached = _key_cache.get(key_hash)
    if cached and time.time() - cached[1] < _CACHE_TTL:
        return cached[0]

    db_pool = request.state.db_pool
    async with db_pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id FROM api_keys WHERE key_hash = %s AND is_active = true",
            (key_hash,),
        )
        row = await cur.fetchone()

    if not row:
        _key_cache.pop(key_hash, None)
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )

    api_key_id = str(row[0])
    _key_cache[key_hash] = (api_key_id, time.time())
    return api_key_id


async def get_db_connection(
    request: HTTPConnection,
) -> AsyncIterator[psycopg.AsyncConnection]:
    async with request.state.db_pool.connection() as conn:
        yield conn


async def get_graph(
    request: HTTPConnection,
) -> CompiledStateGraph:
    return request.state.graph


async def get_prompt_store(
    request: HTTPConnection,
) -> PromptStore:
    return request.state.prompt_store


async def get_duckdb_connection(
    request: HTTPConnection,
) -> duckdb.DuckDBPyConnection:
    return request.state.duck_db_conn


async def get_connection_service(
    request: HTTPConnection,
) -> ConnectionService:
    return request.state.connection_service


class ChatRouteDependencies:
    def __init__(
        self,
        user_id: UUID4,
        thread_id: UUID4,
        request: ChatbotRequest,
        graph: Annotated[CompiledStateGraph, Depends(get_graph)],
        connection_service: Annotated[
            ConnectionService,
            Depends(get_connection_service),
        ],
    ):
        if user_id == thread_id:
            raise HTTPException(
                status_code=400,
                detail=("`user_id` cannot be the same as `thread_id`"),
            )

        self.user_id = user_id
        self.thread_id = thread_id
        self.request = request
        self.graph = graph
        self.connection_service = connection_service


class ResumeRouteDependencies:
    def __init__(
        self,
        user_id: UUID4,
        thread_id: UUID4,
        request: ChatbotResumeRequest,
        graph: Annotated[CompiledStateGraph, Depends(get_graph)],
    ):
        if user_id == thread_id:
            raise HTTPException(
                status_code=400,
                detail=("`user_id` cannot be the same as `thread_id`"),
            )

        self.user_id = user_id
        self.thread_id = thread_id
        self.request = request
        self.graph = graph
