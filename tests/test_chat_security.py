from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import (
    get_connection_service,
    get_graph,
)
from app.api.routers.chat import router


class _Cursor:
    def __init__(self, row: tuple[str] | None) -> None:
        self.row = row

    async def fetchone(self) -> tuple[str] | None:
        return self.row


class _Connection:
    def __init__(self, row: tuple[str] | None) -> None:
        self.row = row

    async def execute(self, query: str, params: tuple[str]) -> _Cursor:
        return _Cursor(self.row)


class _ConnectionContext:
    def __init__(self, row: tuple[str] | None) -> None:
        self.connection = _Connection(row)

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, *args: object) -> None:
        return None


class _Pool:
    def __init__(self, api_key_id: str) -> None:
        self.api_key_id = api_key_id

    def connection(self) -> _ConnectionContext:
        return _ConnectionContext((self.api_key_id,))


class _Graph:
    def __init__(self, values: dict[str, str] | None = None) -> None:
        self.values = values or {}
        self.streamed = False

    async def aget_state(self, config: dict) -> SimpleNamespace:
        return SimpleNamespace(values=self.values)

    async def astream(self, *args: object, **kwargs: object):
        self.streamed = True
        yield "custom", {"text": "ok"}


class _ConnectionService:
    def __init__(self) -> None:
        self.schema_requests: list[tuple[str, str]] = []

    async def get_cached_schema(
        self, connection_id: str, api_key_id: str
    ) -> str:
        self.schema_requests.append((connection_id, api_key_id))
        return "<tables_schema />"


def _create_app(
    graph: _Graph,
    service: _ConnectionService,
    api_key_id: str = "owner-key-id",
) -> FastAPI:
    app = FastAPI()

    @app.middleware("http")
    async def add_db_pool(request, call_next):
        request.state.db_pool = _Pool(api_key_id)
        return await call_next(request)

    app.dependency_overrides[get_graph] = lambda: graph
    app.dependency_overrides[get_connection_service] = lambda: service
    app.include_router(router)
    return app


def _stream_path(suffix: str = "") -> str:
    return f"/stream/{uuid4()}/{uuid4()}{suffix}"


def test_chat_without_api_key_is_rejected_before_streaming() -> None:
    graph = _Graph()
    app = _create_app(graph, _ConnectionService())

    response = TestClient(app).post(
        _stream_path(),
        json={
            "content": "show the first rows",
            "tables_schema_xml": "<tables_schema />",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing X-API-Key header"
    assert graph.streamed is False


def test_resume_without_api_key_is_rejected_before_streaming() -> None:
    graph = _Graph()
    app = _create_app(graph, _ConnectionService())

    response = TestClient(app).post(
        _stream_path("/resume"),
        json={"query": "SELECT 1"},
    )

    assert response.status_code == 401
    assert graph.streamed is False


def test_thread_owned_by_another_api_key_is_not_accessible() -> None:
    graph = _Graph({"api_key_id": "different-owner"})
    app = _create_app(graph, _ConnectionService())

    response = TestClient(app).post(
        _stream_path(),
        headers={"X-API-Key": "valid-key"},
        json={
            "content": "show the first rows",
            "tables_schema_xml": "<tables_schema />",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found"
    assert graph.streamed is False


def test_thread_owner_can_resume_authenticated_conversation() -> None:
    graph = _Graph({"api_key_id": "owner-key-id"})
    app = _create_app(graph, _ConnectionService())

    response = TestClient(app).post(
        _stream_path("/resume"),
        headers={"X-API-Key": "valid-key"},
        json={"query": "SELECT 1"},
    )

    assert response.status_code == 200
    assert graph.streamed is True


def test_authenticated_owner_can_stream_with_owned_connection() -> None:
    graph = _Graph()
    service = _ConnectionService()
    app = _create_app(graph, service)
    connection_id = str(uuid4())

    response = TestClient(app).post(
        _stream_path(),
        headers={"X-API-Key": "valid-key"},
        json={
            "content": "show the first rows",
            "connection_id": connection_id,
        },
    )

    assert response.status_code == 200
    assert service.schema_requests == [(connection_id, "owner-key-id")]
    assert graph.streamed is True
