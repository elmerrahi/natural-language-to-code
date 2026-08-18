import hashlib
import secrets
from typing import Annotated, Any

import psycopg_pool
from fastapi import APIRouter, Depends, HTTPException
from fastapi.requests import HTTPConnection
from pydantic import BaseModel

from ..dependencies import get_api_key_id

router = APIRouter(tags=["keys"])


class CreateKeyRequest(BaseModel):
    name: str


async def _get_db_pool(
    request: HTTPConnection,
) -> psycopg_pool.AsyncConnectionPool:
    return request.state.db_pool


@router.post("/keys")
async def create_api_key(
    body: CreateKeyRequest,
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
) -> dict[str, Any]:
    raw_key = f"sk-{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:8]

    async with db_pool.connection() as conn:
        async with conn.transaction():
            cur = await conn.execute(
                "INSERT INTO api_keys "
                "(key_hash, key_prefix, name) "
                "VALUES (%s, %s, %s) "
                "RETURNING id, created_at",
                (key_hash, key_prefix, body.name),
            )
            row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=500,
            detail="Failed to create API key",
        )
    return {
        "id": str(row[0]),
        "key": raw_key,
        "key_prefix": key_prefix,
        "name": body.name,
        "created_at": str(row[1]),
    }


@router.get("/keys")
async def list_api_keys(
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
) -> dict[str, Any]:
    async with db_pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, key_prefix, name, "
            "created_at, is_active "
            "FROM api_keys "
            "ORDER BY created_at DESC"
        )
        rows = await cur.fetchall()
    return {
        "keys": [
            {
                "id": str(r[0]),
                "key_prefix": r[1],
                "name": r[2],
                "created_at": str(r[3]),
                "is_active": r[4],
            }
            for r in rows
        ]
    }


@router.delete("/keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
) -> dict[str, str]:
    async with db_pool.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE api_keys SET is_active = false WHERE id = %s",
                (key_id,),
            )
    return {"status": "revoked"}
