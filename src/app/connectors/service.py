import json
import xml.etree.ElementTree as ET

import psycopg_pool
from cryptography.fernet import Fernet
from loguru import logger

from app.crypto import decrypt_value, encrypt_value

from .base import (
    ConnectorError,
    DatabaseConnector,
    TableInfo,
)
from .mysql import MySQLConnector
from .postgres import PostgresConnector


def _create_connector(connector_type: str, config: dict) -> DatabaseConnector:
    if connector_type == "postgres":
        return PostgresConnector(**config)
    elif connector_type == "mysql":
        return MySQLConnector(**config)
    raise ValueError(f"Unsupported connector type: {connector_type}")


def tables_to_xml(tables: list[TableInfo]) -> str:
    root = ET.Element("tables_schema")
    for table in tables:
        tbl_el = ET.SubElement(root, "table", {"name": table.name})
        for col in table.columns:
            ET.SubElement(
                tbl_el,
                "column",
                {
                    "name": col.name,
                    "data_type": col.data_type,
                },
            )
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    return ET.tostring(root, encoding="unicode")


class ConnectionService:
    def __init__(
        self,
        db_pool: psycopg_pool.AsyncConnectionPool,
        cipher: Fernet,
    ) -> None:
        self.db_pool = db_pool
        self.cipher = cipher

    def encrypt_config(self, config: dict) -> str:
        return encrypt_value(self.cipher, json.dumps(config))

    def decrypt_config(self, token: str) -> dict:
        return json.loads(decrypt_value(self.cipher, token))

    async def get_connection_config(
        self, connection_id: str, api_key_id: str
    ) -> tuple[str, dict]:
        async with self.db_pool.connection() as conn:
            cur = await conn.execute(
                "SELECT connector_type, encrypted_config "
                "FROM connections "
                "WHERE id = %s AND api_key_id = %s "
                "AND is_active = true",
                (connection_id, api_key_id),
            )
            row = await cur.fetchone()
        if not row:
            raise ConnectorError(f"Connection {connection_id} not found")
        connector_type: str = row[0]
        config: dict = self.decrypt_config(row[1])
        return connector_type, config

    async def execute_query(
        self, connection_id: str, api_key_id: str, query: str
    ) -> str:
        connector_type, config = await self.get_connection_config(
            connection_id, api_key_id
        )
        connector = _create_connector(connector_type, config)
        try:
            return await connector.execute_query(query)
        finally:
            await connector.close()

    async def introspect_schema(
        self, connection_id: str, api_key_id: str
    ) -> str:
        connector_type, config = await self.get_connection_config(
            connection_id, api_key_id
        )
        connector = _create_connector(connector_type, config)
        try:
            tables = await connector.introspect_schema()
            return tables_to_xml(tables)
        finally:
            await connector.close()

    async def test_connection_by_id(
        self, connection_id: str, api_key_id: str
    ) -> bool:
        connector_type, config = await self.get_connection_config(
            connection_id, api_key_id
        )
        connector = _create_connector(connector_type, config)
        try:
            return await connector.test_connection()
        finally:
            await connector.close()

    async def test_connection_direct(
        self,
        connector_type: str,
        config: dict,
    ) -> bool:
        connector = _create_connector(connector_type, config)
        try:
            return await connector.test_connection()
        except Exception:
            logger.opt(exception=True).warning(
                "Connection test failed for {connector_type}.",
                connector_type=connector_type,
            )
            return False
        finally:
            await connector.close()

    async def get_cached_schema(
        self, connection_id: str, api_key_id: str
    ) -> str | None:
        async with self.db_pool.connection() as conn:
            cur = await conn.execute(
                "SELECT sc.schema_xml "
                "FROM schema_catalog sc "
                "JOIN connections c ON c.id = sc.connection_id "
                "WHERE sc.connection_id = %s "
                "AND c.api_key_id = %s AND c.is_active = true",
                (connection_id, api_key_id),
            )
            row = await cur.fetchone()
        return row[0] if row else None

    async def refresh_schema(self, connection_id: str, api_key_id: str) -> str:
        schema_xml = await self.introspect_schema(connection_id, api_key_id)
        async with self.db_pool.connection() as conn:
            async with conn.transaction():
                await conn.execute(
                    "INSERT INTO schema_catalog "
                    "(connection_id, schema_xml) "
                    "VALUES (%s, %s) "
                    "ON CONFLICT (connection_id) "
                    "DO UPDATE SET "
                    "schema_xml = EXCLUDED.schema_xml, "
                    "introspected_at = now()",
                    (connection_id, schema_xml),
                )
        return schema_xml
