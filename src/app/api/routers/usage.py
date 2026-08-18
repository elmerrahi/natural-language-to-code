from typing import Annotated, Any

import psycopg_pool
from fastapi import APIRouter, Depends, Query
from fastapi.requests import HTTPConnection

from ..dependencies import get_api_key_id

router = APIRouter(tags=["usage"])


async def _get_db_pool(
    request: HTTPConnection,
) -> psycopg_pool.AsyncConnectionPool:
    return request.state.db_pool


@router.get("/usage")
async def get_usage(
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict[str, Any]:
    async with db_pool.connection() as conn:
        cur = await conn.execute(
            "SELECT "
            "date_trunc('day', created_at)::date "
            "AS day, "
            "model, "
            "SUM(input_tokens) AS input_tokens, "
            "SUM(output_tokens) AS output_tokens, "
            "COUNT(*) AS requests "
            "FROM usage_events "
            "WHERE api_key_id = %s "
            "AND created_at >= now() "
            "- make_interval(days => %s) "
            "GROUP BY day, model "
            "ORDER BY day DESC, model",
            (api_key_id, days),
        )
        rows = await cur.fetchall()

    return {
        "usage": [
            {
                "day": str(r[0]),
                "model": r[1],
                "input_tokens": r[2],
                "output_tokens": r[3],
                "requests": r[4],
            }
            for r in rows
        ]
    }


@router.get("/usage/summary")
async def get_usage_summary(
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
) -> dict[str, Any]:
    async with db_pool.connection() as conn:
        cur = await conn.execute(
            "SELECT "
            "SUM(input_tokens) AS input_tokens, "
            "SUM(output_tokens) AS output_tokens, "
            "COUNT(*) AS total_requests "
            "FROM usage_events "
            "WHERE api_key_id = %s "
            "AND created_at >= "
            "date_trunc('month', now())",
            (api_key_id,),
        )
        row = await cur.fetchone()

    if not row or row[0] is None:
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_requests": 0,
            "period": "current_month",
        }

    return {
        "input_tokens": row[0],
        "output_tokens": row[1],
        "total_requests": row[2],
        "period": "current_month",
    }
