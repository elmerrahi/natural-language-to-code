import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(
        asyncio.WindowsSelectorEventLoopPolicy()
    )

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lifespan
from app.api.rate_limit import RateLimitMiddleware
from app.api.routers import (
    catalog_router,
    chat_router,
    connections_router,
    data_router,
    health_router,
    history_router,
    keys_router,
    usage_router,
)
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Text-to-SQL Agent",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins,
    allow_credentials="*" not in settings.parsed_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.add_middleware(
    RateLimitMiddleware,  # type: ignore
    requests_per_minute=60,
)

api_router = APIRouter(prefix="/v1/api")
api_router.include_router(
    router=health_router, prefix="/health"
)
api_router.include_router(router=keys_router)
api_router.include_router(router=chat_router)
api_router.include_router(
    router=data_router, prefix="/data"
)
api_router.include_router(router=connections_router)
api_router.include_router(router=catalog_router)
api_router.include_router(router=history_router)
api_router.include_router(router=usage_router)
app.include_router(router=api_router)
