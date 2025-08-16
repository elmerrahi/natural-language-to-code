from pydantic import BaseModel, SecretStr


class DatabaseConfig(BaseModel):
    host: str
    database: str
    user: str
    password: SecretStr
    port: int


class PostgresDatabaseConfig(DatabaseConfig):
    schema_name: str
    pool_min_size: int = 0
    pool_max_size: int = 5

    sslmode: str = "prefer"

    @property
    def connection_string(self) -> str:
        return (
            f"dbname={self.database} "
            f"user={self.user} "
            f"password="
            f"{self.password.get_secret_value()} "
            f"host={self.host} "
            f"port={self.port} "
            f"sslmode={self.sslmode}"
        )
