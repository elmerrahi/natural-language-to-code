from typing import Annotated, Any

import psycopg_pool
from fastapi import APIRouter, Depends, Query
from fastapi.requests import HTTPConnection

from ..dependencies import get_api_key_id

router = APIRouter(tags=["history"])


async def _get_db_pool(
    request: HTTPConnection,
) -> psycopg_pool.AsyncConnectionPool:
    return request.state.db_pool


@router.get("/connections/{connection_id}/history")
async def get_query_history(
    connection_id: str,
    api_key_id: Annotated[
        str, Depends(get_api_key_id)
    ],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
    limit: Annotated[
        int, Query(ge=1, le=200)
    ] = 50,
) -> dict[str, Any]:
    async with db_pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, natural_language_query, "
            "generated_sql, row_count, is_saved, "
            "created_at "
            "FROM query_history "
            "WHERE api_key_id = %s "
            "AND connection_id = %s "
            "ORDER BY created_at DESC "
            "LIMIT %s",
            (api_key_id, connection_id, limit),
        )
        rows = await cur.fetchall()
    return {
        "history": [
            {
                "id": str(r[0]),
                "natural_language_query": r[1],
                "generated_sql": r[2],
                "row_count": r[3],
                "is_saved": r[4],
                "created_at": str(r[5]),
            }
            for r in rows
        ]
    }


@router.post(
    "/connections/{connection_id}"
    "/history/{query_id}/save"
)
async def save_query(
    connection_id: str,
    query_id: str,
    api_key_id: Annotated[
        str, Depends(get_api_key_id)
    ],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
) -> dict[str, str]:
    async with db_pool.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE query_history "
                "SET is_saved = true "
                "WHERE id = %s "
                "AND api_key_id = %s "
                "AND connection_id = %s",
                (query_id, api_key_id, connection_id),
            )
    return {"status": "saved"}
