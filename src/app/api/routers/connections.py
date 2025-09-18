from typing import Annotated, Any

import psycopg_pool
from fastapi import APIRouter, Depends, HTTPException
from fastapi.requests import HTTPConnection

from app.connectors import ConnectionService
from app.models.api.requests.connections import (
    CreateConnectionRequest,
)

from ..dependencies import get_api_key_id

router = APIRouter(tags=["connections"])


async def _get_db_pool(
    request: HTTPConnection,
) -> psycopg_pool.AsyncConnectionPool:
    return request.state.db_pool


async def _get_conn_service(
    request: HTTPConnection,
) -> ConnectionService:
    return request.state.connection_service


@router.post("/connections")
async def create_connection(
    body: CreateConnectionRequest,
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
    conn_service: Annotated[
        ConnectionService,
        Depends(_get_conn_service),
    ],
) -> dict[str, Any]:
    config_dict = body.config.model_dump()

    ok = await conn_service.test_connection_direct(
        connector_type=body.connector_type,
        config=config_dict,
    )
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Could not connect to the database. "
            "Please verify your credentials.",
        )

    encrypted = conn_service.encrypt_config(config_dict)

    async with db_pool.connection() as conn:
        async with conn.transaction():
            cur = await conn.execute(
                "INSERT INTO connections "
                "(api_key_id, name, connector_type, "
                "encrypted_config) "
                "VALUES (%s, %s, %s, %s) "
                "RETURNING id, created_at",
                (
                    api_key_id,
                    body.name,
                    body.connector_type,
                    encrypted,
                ),
            )
            row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=500,
            detail="Failed to create connection",
        )

    connection_id = str(row[0])

    schema_xml = await conn_service.refresh_schema(
        connection_id
    )

    return {
        "id": connection_id,
        "name": body.name,
        "connector_type": body.connector_type,
        "host": body.config.host,
        "port": body.config.port,
        "database": body.config.database,
        "created_at": str(row[1]),
        "schema_xml": schema_xml,
    }


@router.get("/connections")
async def list_connections(
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
    conn_service: Annotated[
        ConnectionService,
        Depends(_get_conn_service),
    ],
) -> dict[str, Any]:
    async with db_pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, name, connector_type, "
            "encrypted_config, created_at, is_active "
            "FROM connections "
            "WHERE api_key_id = %s "
            "ORDER BY created_at DESC",
            (api_key_id,),
        )
        rows = await cur.fetchall()

    results = []
    for r in rows:
        entry: dict[str, Any] = {
            "id": str(r[0]),
            "name": r[1],
            "connector_type": r[2],
            "created_at": str(r[4]),
            "is_active": r[5],
        }
        try:
            config = conn_service.decrypt_config(r[3])
            entry["host"] = config.get("host", "")
            entry["database"] = config.get(
                "database", ""
            )
        except Exception:
            entry["host"] = ""
            entry["database"] = ""
        results.append(entry)

    return {"connections": results}


@router.post("/connections/{connection_id}/test")
async def test_connection(
    connection_id: str,
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    conn_service: Annotated[
        ConnectionService,
        Depends(_get_conn_service),
    ],
) -> dict[str, Any]:
    ok = await conn_service.test_connection_by_id(
        connection_id
    )
    return {
        "connection_id": connection_id,
        "status": "ok" if ok else "failed",
    }


@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    db_pool: Annotated[
        psycopg_pool.AsyncConnectionPool,
        Depends(_get_db_pool),
    ],
) -> dict[str, str]:
    async with db_pool.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE connections "
                "SET is_active = false "
                "WHERE id = %s AND api_key_id = %s",
                (connection_id, api_key_id),
            )
    return {"status": "deleted"}
