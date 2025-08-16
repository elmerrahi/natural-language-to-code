from typing import Any, Literal

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)

from app.config.database import PostgresDatabaseConfig
from app.config.paths import PathsConfig


class Settings(BaseSettings):
    db: PostgresDatabaseConfig = Field(default=...)
    paths: PathsConfig = Field(
        default_factory=PathsConfig
    )
    fernet_key: str = ""
    environment: Literal[
        "development", "production"
    ] = "development"
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_nested_delimiter="__",
    )

    def model_post_init(self, __context: Any) -> None:
        load_dotenv(dotenv_path=".env")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def parsed_cors_origins(self) -> list[str]:
        return [
            o.strip()
            for o in self.cors_origins.split(",")
            if o.strip()
        ]
