import psycopg_pool

from app.config import Settings


def create_db_connection_pool(
    settings: Settings,
) -> psycopg_pool.AsyncConnectionPool:
    return psycopg_pool.AsyncConnectionPool(
        conninfo=settings.db.connection_string,
        open=False,
        min_size=settings.db.pool_min_size,
        max_size=settings.db.pool_max_size,
    )
