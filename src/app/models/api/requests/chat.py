from typing import Literal

from pydantic import BaseModel, model_validator

from app.models.graph.interrupts import InterruptPolicy


class ChatModelSettings(BaseModel):
    primary_model: str = "claude-sonnet-4-20250514"
    secondary_model: str = "claude-opus-4-1-20250805"
    max_tokens: int = 16_384


class ChatbotRequest(BaseModel):
    content: str
    interrupt_policy: InterruptPolicy = "never"
    tables_schema_xml: str | None = None
    connection_id: str | None = None
    mode: Literal["generate", "explain", "optimize"] = "generate"
    chat_model_settings: ChatModelSettings = ChatModelSettings()

    @model_validator(mode="after")
    def check_schema_source(self) -> "ChatbotRequest":
        if not self.tables_schema_xml and not self.connection_id:
            raise ValueError(
                "Either tables_schema_xml or connection_id must be provided"
            )
        return self


class ChatbotResumeRequest(BaseModel):
    query: str
    reason: str | None = None
    tables_schema_xml: str | None = None
    connection_id: str | None = None
    chat_model_settings: ChatModelSettings = ChatModelSettings()
