import pytest
from cryptography.fernet import Fernet

from app.connectors.base import ConnectorError
from app.connectors.service import ConnectionService


class _Cursor:
    def __init__(self, row: tuple[str, str] | None) -> None:
        self.row = row

    async def fetchone(self) -> tuple[str, str] | None:
        return self.row


class _Connection:
    def __init__(self, row: tuple[str, str] | None) -> None:
        self.row = row
        self.query = ""
        self.params: tuple[str, str] | None = None

    async def execute(self, query: str, params: tuple[str, str]) -> _Cursor:
        self.query = query
        self.params = params
        return _Cursor(self.row)


class _ConnectionContext:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, *args: object) -> None:
        return None


class _Pool:
    def __init__(self, connection: _Connection) -> None:
        self.db_connection = connection

    def connection(self) -> _ConnectionContext:
        return _ConnectionContext(self.db_connection)


def _service_with_row(
    row: tuple[str, str] | None,
) -> tuple[ConnectionService, _Connection]:
    connection = _Connection(row)
    service = ConnectionService(
        db_pool=_Pool(connection),  # type: ignore[arg-type]
        cipher=Fernet(Fernet.generate_key()),
    )
    return service, connection


@pytest.mark.asyncio
async def test_connection_lookup_is_scoped_to_api_key_owner() -> None:
    service, connection = _service_with_row(None)
    encrypted = service.encrypt_config(
        {"host": "localhost", "database": "example"}
    )
    connection.row = ("postgres", encrypted)

    connector_type, config = await service.get_connection_config(
        "connection-id", "owner-key-id"
    )

    assert connector_type == "postgres"
    assert config["database"] == "example"
    assert "api_key_id = %s" in connection.query
    assert connection.params == ("connection-id", "owner-key-id")


@pytest.mark.asyncio
async def test_connection_lookup_hides_other_owners_connection() -> None:
    service, connection = _service_with_row(None)

    with pytest.raises(ConnectorError, match="not found"):
        await service.get_connection_config("connection-id", "attacker-key-id")

    assert "api_key_id = %s" in connection.query
    assert connection.params == ("connection-id", "attacker-key-id")
