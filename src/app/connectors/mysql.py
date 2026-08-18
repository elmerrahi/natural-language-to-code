import json
from typing import Any

import aiomysql

from .base import (
    ColumnInfo,
    ConnectorError,
    DatabaseConnector,
    TableInfo,
)


class MySQLConnector(DatabaseConnector):
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        **_: Any,
    ) -> None:
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self._conn: aiomysql.Connection | None = None

    async def _get_conn(self) -> aiomysql.Connection:
        if self._conn is None or self._conn.closed:
            self._conn = await aiomysql.connect(
                host=self.host,
                port=self.port,
                db=self.database,
                user=self.user,
                password=self.password,
            )
        return self._conn

    async def test_connection(self) -> bool:
        try:
            conn = await self._get_conn()
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
            return True
        except Exception:
            return False

    async def introspect_schema(
        self,
    ) -> list[TableInfo]:
        conn = await self._get_conn()
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT TABLE_NAME, COLUMN_NAME, "
                "DATA_TYPE "
                "FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = %s "
                "ORDER BY TABLE_NAME, "
                "ORDINAL_POSITION",
                (self.database,),
            )
            rows = await cur.fetchall()

        tables: dict[str, TableInfo] = {}
        for table_name, col_name, dtype in rows:
            if table_name not in tables:
                tables[table_name] = TableInfo(name=table_name, columns=[])
            tables[table_name].columns.append(
                ColumnInfo(name=col_name, data_type=dtype)
            )
        return list(tables.values())

    async def execute_query(self, query: str, limit: int = 50) -> str:
        conn = await self._get_conn()
        try:
            async with conn.cursor() as cur:
                await cur.execute(query)
                if cur.description is None:
                    return json.dumps(
                        {
                            "message": ("Query executed successfully"),
                            "rows_affected": (cur.rowcount),
                        }
                    )
                columns = [d[0] for d in cur.description]
                rows = await cur.fetchmany(limit)
                result = [dict(zip(columns, row)) for row in rows]
                return json.dumps(
                    {
                        "message": ("Query executed successfully"),
                        "results": result,
                    },
                    default=str,
                )
        except Exception as e:
            raise ConnectorError(str(e)) from e

    async def close(self) -> None:
        if self._conn and not self._conn.closed:
            self._conn.close()
