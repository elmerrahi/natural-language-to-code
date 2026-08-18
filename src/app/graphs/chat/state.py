from dataclasses import dataclass, field
from typing import Annotated, Any

from app.models.graph.interrupts import InterruptPolicy


def merge_lists(old: list[Any], new: list[Any]) -> list[Any]:
    return old + new


@dataclass(slots=True)
class ChatGraphState:
    messages: Annotated[list[dict[Any, Any]], merge_lists]
    stop_reason: str = field(default_factory=str)
    interrupt_policy: InterruptPolicy = "never"
    connection_id: str | None = None
