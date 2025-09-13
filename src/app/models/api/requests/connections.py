from typing import Literal

from pydantic import BaseModel, Field


class ConnectionConfig(BaseModel):
    host: str
    port: int
    database: str
    user: str
    password: str
    schema_name: str | None = Field(
        default=None,
        description=(
            "Database schema to use. "
            "Required for PostgreSQL, ignored for MySQL."
        ),
    )


class CreateConnectionRequest(BaseModel):
    name: str
    connector_type: Literal["postgres", "mysql"]
    config: ConnectionConfig
