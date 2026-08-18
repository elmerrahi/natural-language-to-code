from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.requests import HTTPConnection

from app.connectors import ConnectionService

from ..dependencies import get_api_key_id

router = APIRouter(tags=["catalog"])


async def _get_conn_service(
    request: HTTPConnection,
) -> ConnectionService:
    return request.state.connection_service


@router.get("/connections/{connection_id}/catalog")
async def get_catalog(
    connection_id: str,
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    conn_service: Annotated[
        ConnectionService,
        Depends(_get_conn_service),
    ],
) -> dict[str, Any]:
    cached = await conn_service.get_cached_schema(connection_id)
    if not cached:
        raise HTTPException(
            status_code=404,
            detail="No cached schema found. "
            "Call POST .../catalog/refresh first.",
        )
    return {
        "connection_id": connection_id,
        "schema_xml": cached,
    }


@router.post("/connections/{connection_id}/catalog/refresh")
async def refresh_catalog(
    connection_id: str,
    api_key_id: Annotated[str, Depends(get_api_key_id)],
    conn_service: Annotated[
        ConnectionService,
        Depends(_get_conn_service),
    ],
) -> dict[str, Any]:
    schema_xml = await conn_service.refresh_schema(connection_id)
    return {
        "connection_id": connection_id,
        "schema_xml": schema_xml,
        "status": "refreshed",
    }
