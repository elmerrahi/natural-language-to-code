from abc import ABC, abstractmethod
from dataclasses import dataclass


class ConnectorError(Exception):
    pass


@dataclass
class ColumnInfo:
    name: str
    data_type: str


@dataclass
class TableInfo:
    name: str
    columns: list[ColumnInfo]


class DatabaseConnector(ABC):
    @abstractmethod
    async def test_connection(self) -> bool:
        pass

    @abstractmethod
    async def introspect_schema(self) -> list[TableInfo]:
        pass

    @abstractmethod
    async def execute_query(
        self, query: str, limit: int = 50
    ) -> str:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass
