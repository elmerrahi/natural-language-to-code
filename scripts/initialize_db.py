import asyncio
import sys

from langgraph.checkpoint.postgres.aio import (
    AsyncPostgresSaver,
)
from loguru import logger
from psycopg import sql

from app.config import get_settings
from app.db import (
    QueryStore,
    create_db_connection_pool,
)

_TABLE_DDL_KEYS = [
    "ddl.create_api_keys",
    "ddl.create_connections",
    "ddl.create_schema_catalog",
    "ddl.create_query_history",
    "ddl.create_usage_events",
    "ddl.create_indexes",
]


async def main():
    settings = get_settings()
    query_store = QueryStore(
        base_query_path=settings.paths.queries_dir
    )

    pool = create_db_connection_pool(settings=settings)
    await pool.open()

    async with pool.connection() as conn:
        async with conn.transaction():
            schema_query = sql.SQL(
                query_store.get_query(
                    "ddl.create_schema"
                )
            ).format(
                schema_name=sql.Identifier(
                    settings.db.schema_name
                )
            )
            await conn.execute(schema_query)
    logger.success(
        "Schema [{name}] creation complete.",
        name=settings.db.schema_name,
    )

    async with pool.connection() as conn:
        await conn.set_autocommit(True)
        try:
            checkpointer = AsyncPostgresSaver(
                conn=conn
            )  # type: ignore
            await checkpointer.setup()
            logger.success(
                "LangGraph schema setup complete."
            )
        finally:
            await conn.set_autocommit(False)

    async with pool.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                query=query_store.get_query(
                    "ddl.create_checkpoint_index"
                )
            )
    logger.success("Checkpoint index complete")

    async with pool.connection() as conn:
        async with conn.transaction():
            for key in _TABLE_DDL_KEYS:
                try:
                    ddl = query_store.get_query(key)
                    await conn.execute(ddl)
                    logger.success(
                        "DDL {key} executed.",
                        key=key,
                    )
                except KeyError:
                    logger.warning(
                        "DDL {key} not found, "
                        "skipping.",
                        key=key,
                    )
    logger.success("Application tables initialized")

    await pool.close()
    logger.success("Database pool closed.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(
            asyncio.WindowsSelectorEventLoopPolicy()
        )
    logger.info(
        "Running database initialization..."
    )
    asyncio.run(main())
