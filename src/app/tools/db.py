import json
from typing import Annotated, Any, Literal

import duckdb
import sqlglot
from langgraph.types import interrupt
from loguru import logger
from pydantic import BaseModel, Field

from app.connectors.service import ConnectionService
from app.graphs.chat.state import ChatGraphState
from app.models.graph.interrupts import (
    QueryExecutorHumanFeedback,
)
from app.tools.base import BaseTool


def validate_read_only(sql: str) -> bool:
    try:
        statements = sqlglot.parse(sql)
        for stmt in statements:
            if stmt is None:
                continue
            if not isinstance(stmt, sqlglot.exp.Select):
                return False
        return True
    except sqlglot.errors.ParseError:
        return False


class QueryExecutorInput(BaseModel):
    purpose: Annotated[
        Literal["intermediate", "final"],
        Field(
            description=(
                "Indicates the query's role. "
                "'final' queries directly answer "
                "the user's question, "
                "'intermediate' queries are for "
                "data exploration."
            )
        ),
    ]
    query: Annotated[
        str,
        Field(
            description=("SQL query to execute against the database"),
        ),
    ]


class QueryExecutorTool(
    BaseTool[ChatGraphState, QueryExecutorInput, str],
    arbitrary_types_allowed=True,
):
    name: str = "query_executor"
    description: str = (
        "Executes a read-only SQL query against the connected database."
    )
    input_schema: type[QueryExecutorInput] = QueryExecutorInput

    conn: duckdb.DuckDBPyConnection
    connection_service: Any = None

    async def __call__(
        self,
        input_data: QueryExecutorInput,
        state: ChatGraphState,
    ) -> str:
        if not validate_read_only(input_data.query):
            return json.dumps(
                {
                    "error": "REJECTED",
                    "message": (
                        "Only SELECT queries are "
                        "allowed. DDL and DML "
                        "statements are blocked."
                    ),
                }
            )

        should_interrupt = state.interrupt_policy == "always" or (
            state.interrupt_policy == "final" and input_data.purpose == "final"
        )
        query_modified = False
        human_reason = None

        if should_interrupt:
            human_feedback = interrupt(value=input_data.query)
            human_feedback = QueryExecutorHumanFeedback.model_validate(
                obj=human_feedback
            )
            if human_feedback.query != input_data.query:
                logger.debug("Human modified proposed query.")
                query_modified = True
                human_reason = human_feedback.reason
                input_data.query = human_feedback.query

                if not validate_read_only(input_data.query):
                    return json.dumps(
                        {
                            "error": "REJECTED",
                            "message": (
                                "Modified query must also be SELECT-only."
                            ),
                        }
                    )

        if state.connection_id and self.connection_service:
            if not state.api_key_id:
                return json.dumps(
                    {
                        "error": "REJECTED",
                        "message": "Authenticated connection owner is missing.",
                    }
                )
            return await self._execute_via_connector(
                input_data,
                state,
                query_modified,
                human_reason,
            )
        return await self._execute_via_duckdb(
            input_data,
            query_modified,
            human_reason,
        )

    async def _execute_via_connector(
        self,
        input_data: QueryExecutorInput,
        state: ChatGraphState,
        query_modified: bool,
        human_reason: str | None,
    ) -> str:
        try:
            svc: ConnectionService = self.connection_service
            raw = await svc.execute_query(
                state.connection_id,  # type: ignore
                state.api_key_id,  # type: ignore
                input_data.query,
            )
            result = json.loads(raw)
            if query_modified:
                result["executed_query"] = input_data.query
                result["reason"] = human_reason or "No reason provided."
                result["message"] = "User modified the proposed query."
            return json.dumps(result, default=str)
        except Exception as exc:
            logger.exception(
                "Connector query execution failed.",
                exc=exc,
            )
            return json.dumps(
                {
                    "error": str(exc.__class__),
                    "message": str(exc),
                },
                default=str,
            )

    async def _execute_via_duckdb(
        self,
        input_data: QueryExecutorInput,
        query_modified: bool,
        human_reason: str | None,
    ) -> str:
        try:
            self.conn.execute(input_data.query)

            if self.conn.description is None:
                rows_affected = getattr(self.conn, "rowcount", None)
                return json.dumps(
                    dict(
                        message=("Query executed successfully"),
                        rows_affected=rows_affected,
                    ),
                    default=str,
                )

            columns = [desc[0] for desc in self.conn.description]
            rows = self.conn.fetchall()
            result = [dict(zip(columns, r)) for r in rows]
            logger.info(
                "Query returned {n} rows.",
                n=len(result),
            )

            if query_modified:
                return json.dumps(
                    obj=dict(
                        message=("User modified the proposed query."),
                        executed_query=input_data.query,
                        reason=(human_reason or "No reason provided."),
                        results=result,
                    ),
                    default=str,
                )
            return json.dumps(
                obj=dict(
                    message=("Query executed successfully"),
                    results=result,
                ),
                default=str,
            )

        except Exception as exc:
            code = str(exc.__class__)
            logger.exception(
                "DuckDB query execution failed.",
                exc=exc,
            )
            return json.dumps(
                {
                    "error": code,
                    "message": str(exc),
                },
                default=str,
            )
