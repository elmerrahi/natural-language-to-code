import json

import psycopg

from .base import (
    ColumnInfo,
    ConnectorError,
    DatabaseConnector,
    TableInfo,
)


class PostgresConnector(DatabaseConnector):
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        schema_name: str | None = None,
    ) -> None:
        self.conninfo = (
            f"host={host} port={port} "
            f"dbname={database} "
            f"user={user} password={password}"
        )
        self.schema_name = schema_name or "public"
        self._conn: psycopg.AsyncConnection | None = None

    async def _get_conn(
        self,
    ) -> psycopg.AsyncConnection:
        if self._conn is None or self._conn.closed:
            self._conn = (
                await psycopg.AsyncConnection.connect(
                    self.conninfo
                )
            )
        return self._conn

    async def test_connection(self) -> bool:
        try:
            conn = await self._get_conn()
            await conn.execute("SELECT 1")
            return True
        except Exception:
            return False

    async def introspect_schema(
        self,
    ) -> list[TableInfo]:
        conn = await self._get_conn()
        cur = await conn.execute(
            "SELECT c.table_name, "
            "c.column_name, c.data_type "
            "FROM information_schema.columns c "
            "WHERE c.table_schema = %s "
            "ORDER BY c.table_name, "
            "c.ordinal_position",
            (self.schema_name,),
        )
        rows = await cur.fetchall()

        tables: dict[str, TableInfo] = {}
        for table_name, col_name, dtype in rows:
            if table_name not in tables:
                tables[table_name] = TableInfo(
                    name=table_name, columns=[]
                )
            tables[table_name].columns.append(
                ColumnInfo(name=col_name, data_type=dtype)
            )
        return list(tables.values())

    async def execute_query(
        self, query: str, limit: int = 50
    ) -> str:
        conn = await self._get_conn()
        try:
            cur = await conn.execute(query)
            if cur.description is None:
                return json.dumps(
                    {
                        "message": (
                            "Query executed successfully"
                        ),
                        "rows_affected": cur.rowcount,
                    }
                )
            columns = [
                desc[0] for desc in cur.description
            ]
            rows = await cur.fetchmany(limit)
            result = [
                dict(zip(columns, row)) for row in rows
            ]
            return json.dumps(
                {
                    "message": (
                        "Query executed successfully"
                    ),
                    "results": result,
                },
                default=str,
            )
        except Exception as e:
            raise ConnectorError(str(e)) from e

    async def close(self) -> None:
        if self._conn and not self._conn.closed:
            await self._conn.close()
