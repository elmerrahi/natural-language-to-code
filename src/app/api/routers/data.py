import re
import tempfile
import xml.etree.ElementTree as ET
from typing import Annotated, Any

import duckdb
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.encoders import jsonable_encoder
from loguru import logger
from nanoid import generate

from ..dependencies import (
    get_api_key_id,
    get_duckdb_connection,
)

router = APIRouter(tags=["data"])

_SAFE_TABLE_RE = re.compile(r"^[A-Za-z0-9_]+$")


def make_safe_table_name(raw: str) -> str:
    base = raw.removesuffix(".csv")
    safe = re.sub(r"[^A-Za-z0-9_]", "_", base)
    prefix = generate(
        alphabet="_abcdefghijklmnopqrst", size=4
    ).lower()
    return f"{prefix}_{safe.lower()}"


def schemas_to_xml_str(
    payload: dict[str, Any],
) -> str:
    root = ET.Element("tables_schema")
    for tbl in payload.get("schemas", []):
        table_el = ET.SubElement(
            root, "table", {"name": tbl["table_name"]}
        )
        for col in tbl.get("schema", []):
            ((col_name, data_type),) = col.items()
            ET.SubElement(
                table_el,
                "column",
                {
                    "name": col_name,
                    "data_type": data_type,
                },
            )

    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    return ET.tostring(root, encoding="unicode")


def _validate_table_name(name: str) -> str:
    if not _SAFE_TABLE_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid table name. "
                "Only alphanumeric and underscore "
                "characters are allowed."
            ),
        )
    return name


@router.post(
    "/upload", status_code=status.HTTP_200_OK
)
async def upload_dataset(
    files: list[UploadFile],
    api_key_id: Annotated[
        str, Depends(get_api_key_id)
    ],
    duck_db_conn: Annotated[
        duckdb.DuckDBPyConnection,
        Depends(get_duckdb_connection),
    ],
) -> Any:
    schemas = []
    for file in files:
        table_name = make_safe_table_name(
            raw=file.filename or "uploaded_file.csv"
        )

        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=".csv", delete=True
        ) as tmp:
            await file.seek(0)
            chunk_size = 1024 * 1024
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                tmp.write(chunk)

            tmp.flush()
            duck_db_conn.execute(
                f"CREATE TABLE {table_name} AS "
                "SELECT * FROM read_csv_auto(?)",
                [tmp.name],
            )

        cols = duck_db_conn.execute(
            f'PRAGMA table_info("{table_name}")'
        ).fetchall()
        schema = [{c[1]: c[2]} for c in cols]
        schemas.append(
            {
                "table_name": table_name,
                "schema": schema,
            }
        )

    return jsonable_encoder(
        {
            "status": "success",
            "tables": [
                file.filename for file in files
            ],
            "tables_schema_xml": schemas_to_xml_str(
                {"schemas": schemas}
            ),
        }
    )


@router.get("/tables")
async def list_tables(
    api_key_id: Annotated[
        str, Depends(get_api_key_id)
    ],
    duck_db_conn: Annotated[
        duckdb.DuckDBPyConnection,
        Depends(get_duckdb_connection),
    ],
):
    tables_info = duck_db_conn.execute(
        """
        SELECT 
            table_name,
            estimated_size,
            column_count
        FROM duckdb_tables()
        WHERE NOT starts_with(table_name, 'duckdb_')
        ORDER BY estimated_size DESC
    """
    ).fetchall()

    tables = []
    for table in tables_info:
        tables.append(
            {
                "name": table[0],
                "rows": table[1],
                "columns": table[2],
            }
        )
    return jsonable_encoder(
        {
            "tables": tables,
            "total_tables": len(tables),
        }
    )


@router.delete("/tables/{table_name}")
async def drop_table(
    table_name: str,
    api_key_id: Annotated[
        str, Depends(get_api_key_id)
    ],
    duck_db_conn: Annotated[
        duckdb.DuckDBPyConnection,
        Depends(get_duckdb_connection),
    ],
):
    safe_name = _validate_table_name(table_name)
    try:
        duck_db_conn.execute(
            f'DROP TABLE "{safe_name}"'
        )
        return {
            "status": "success",
            "message": (
                f"Table '{safe_name}' "
                "dropped successfully"
            ),
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to drop table: {e}",
        )


@router.delete("/tables")
async def clear_all_tables(
    api_key_id: Annotated[
        str, Depends(get_api_key_id)
    ],
    duck_db_conn: Annotated[
        duckdb.DuckDBPyConnection,
        Depends(get_duckdb_connection),
    ],
):
    tables = duck_db_conn.execute(
        "SHOW TABLES"
    ).fetchall()

    dropped = []
    for (tbl_name,) in tables:
        try:
            duck_db_conn.execute(
                f'DROP TABLE "{tbl_name}"'
            )
            dropped.append(tbl_name)
        except Exception as e:
            logger.error(
                "Error dropping table "
                "{table_name}: {e}",
                table_name=tbl_name,
                e=e,
            )

    return {
        "status": "success",
        "dropped_tables": dropped,
        "count": len(dropped),
    }
