import hashlib
import time
from collections import defaultdict

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class RateLimitMiddleware:
    """Token-bucket rate limiter keyed on API key or client IP."""

    def __init__(
        self,
        app: ASGIApp,
        requests_per_minute: int = 60,
    ) -> None:
        self.app = app
        self.rpm = requests_per_minute
        self._requests: dict[str, list[float]] = (
            defaultdict(list)
        )

    def _get_key(self, scope: Scope) -> str:
        headers = dict(scope.get("headers", []))
        api_key = headers.get(
            b"x-api-key", b""
        ).decode()
        if api_key:
            return hashlib.sha256(
                api_key.encode()
            ).hexdigest()[:16]
        client = scope.get("client")
        if client:
            return client[0]
        return "unknown"

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        if path.startswith("/v1/api/health") or path == "/docs":
            await self.app(scope, receive, send)
            return

        key = self._get_key(scope)
        now = time.time()
        window = now - 60

        self._requests[key] = [
            t
            for t in self._requests[key]
            if t > window
        ]

        if len(self._requests[key]) >= self.rpm:
            response = JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
            )
            await response(scope, receive, send)
            return

        self._requests[key].append(now)
        await self.app(scope, receive, send)
