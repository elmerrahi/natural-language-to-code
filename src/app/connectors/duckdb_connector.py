import json
from typing import Any

import duckdb

from .base import (
    ColumnInfo,
    ConnectorError,
    DatabaseConnector,
    TableInfo,
)


class DuckDBConnector(DatabaseConnector):
    def __init__(
        self, conn: duckdb.DuckDBPyConnection
    ) -> None:
        self.conn = conn

    async def test_connection(self) -> bool:
        try:
            self.conn.execute("SELECT 1")
            return True
        except Exception:
            return False

    async def introspect_schema(
        self,
    ) -> list[TableInfo]:
        tables_raw = self.conn.execute(
            "SELECT table_name "
            "FROM duckdb_tables() "
            "WHERE NOT starts_with("
            "table_name, 'duckdb_')"
        ).fetchall()

        tables: list[TableInfo] = []
        for (table_name,) in tables_raw:
            cols: list[Any] = self.conn.execute(
                f'PRAGMA table_info("{table_name}")'
            ).fetchall()
            columns = [
                ColumnInfo(name=c[1], data_type=c[2])
                for c in cols
            ]
            tables.append(
                TableInfo(
                    name=table_name, columns=columns
                )
            )
        return tables

    async def execute_query(
        self, query: str, limit: int = 50
    ) -> str:
        try:
            self.conn.execute(query)
            if self.conn.description is None:
                return json.dumps(
                    {
                        "message": (
                            "Query executed successfully"
                        ),
                        "rows_affected": getattr(
                            self.conn, "rowcount", None
                        ),
                    }
                )
            columns = [
                desc[0]
                for desc in self.conn.description
            ]
            rows = self.conn.fetchmany(limit)
            result = [
                dict(zip(columns, r)) for r in rows
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
        pass
