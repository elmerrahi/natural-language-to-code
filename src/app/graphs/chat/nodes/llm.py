import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from anthropic import AsyncAnthropic
from langchain_core.runnables.config import RunnableConfig
from langgraph.types import StreamWriter
from loguru import logger
from pydantic.json_schema import JsonSchemaValue

from app.graphs import Node
from app.utils import PromptStore

from ..state import ChatGraphState


def _get_block_display_type(content_block: Any) -> str:
    """Map content block type to display type.

    Attributes:
        content_block: The content block to map.

    Returns:
        The display type for the content block.
    """
    return (
        "tool-input"
        if content_block.type == "tool_use"
        else content_block.type
    )


class LLM(Node[ChatGraphState]):
    """Interacts with Anthropic models through Amazon Bedrock.

    Attributes:
        name: Identifier for the node in the graph.
    """

    name = "llm"

    def __init__(
        self,
        anthropic_client: AsyncAnthropic,
        tool_schemas: dict[str, dict[str, str | JsonSchemaValue]],
        prompt_store: PromptStore,
    ) -> None:
        """Initializes the LLM node.

        Args:
            anthropic_client: Client for making LLM calls.
            tool_schemas: JSON schema for the tools available to the LLM.
            prompt_store: Store for managing prompts used in the graph.
        """
        self.anthropic_client = anthropic_client
        self.prompt_store = prompt_store
        self.tool_schemas = list(tool_schemas.values())
        self.tool_schemas[-1]["cache_control"] = {"type": "ephemeral"}

    def _validate_config(self, config: RunnableConfig) -> dict[str, Any]:
        node_config = config.get("configurable", {}).get(self.name)
        if not node_config:
            raise KeyError(
                f"Configuration for node "
                f"'{self.name}' is missing "
                f"in 'configurable'."
            )

        for key in ("primary_model", "secondary_model"):
            if key not in node_config:
                raise KeyError(
                    f"'{key}' is required in the "
                    f"configuration for "
                    f"node '{self.name}'."
                )

        return node_config

    @asynccontextmanager
    async def _stream_with_model(
        self,
        model_name: str,
        node_config: dict[str, Any],
        state: ChatGraphState,
    ) -> AsyncIterator[Any]:
        """Context manager for streaming with a specific model.

        Args:
            model_name: Name of the model to use
            node_config: Node configuration
            state: Current graph state

        Yields:
            Stream of messages from the model
        """

        mode = node_config.get("mode", "generate")
        tables = node_config.get("tables", "")
        rendered_prompt = self.prompt_store.get_prompt("system.jinja2").render(
            tables=tables, mode=mode
        )

        async with self.anthropic_client.messages.stream(
            model=model_name,
            max_tokens=node_config.get("max_tokens", 16_384),
            messages=state.messages,  # type: ignore
            tools=self.tool_schemas,  # type: ignore
            system=[
                {
                    "type": "text",
                    "text": (
                        "<current_date> "
                        f"{datetime.now(timezone.utc).date()}"  # noqa: E501
                        " </current_date>"
                    ),
                },
                {
                    "type": "text",
                    "text": rendered_prompt,
                    "cache_control": {"type": "ephemeral"},
                },
            ],
        ) as stream:
            yield stream

    async def _execute_with_model(
        self,
        model_name: str,
        node_config: dict[str, Any],
        state: ChatGraphState,
        writer: StreamWriter,
    ) -> ChatGraphState:
        """Execute LLM call with a specific model.

        Args:
            model_name: Name of the model to use
            node_config: Node configuration
            state: Current graph state
            writer: Stream writer for streaming custom events

        Returns:
            Updated graph state
        """
        content: list[dict[str, Any]] = []
        current_block: dict[str, Any] = {}
        stop_reason = "end_turn"

        async with self._stream_with_model(
            model_name=model_name, node_config=node_config, state=state
        ) as stream:
            async for event in stream:
                if event.type == "content_block_start":
                    block = event.content_block
                    current_block = {"type": block.type}
                    if block.type == "tool_use":
                        current_block["id"] = block.id
                        current_block["name"] = block.name
                        current_block["input"] = ""
                    elif block.type == "text":
                        current_block["text"] = ""
                    writer({"block-start": _get_block_display_type(block)})

                elif event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        current_block["text"] += event.delta.text
                        writer({"text": event.delta.text})
                    elif event.delta.type == "input_json_delta":
                        current_block["input"] += event.delta.partial_json
                        writer({"tool-input": event.delta.partial_json})

                elif event.type == "content_block_stop":
                    if current_block.get("type") == "tool_use":
                        raw = current_block.get("input", "{}")
                        current_block["input"] = json.loads(raw)
                    content.append(current_block)
                    writer(
                        {
                            "block-end": _get_block_display_type(
                                event.content_block
                            )
                        }
                    )
                    current_block = {}

                elif event.type == "message_delta":
                    stop_reason = (
                        getattr(event.delta, "stop_reason", None)
                        or stop_reason
                    )

        return ChatGraphState(
            messages=[{"role": "assistant", "content": content}],
            stop_reason=str(stop_reason),
            interrupt_policy=state.interrupt_policy,
            connection_id=state.connection_id,
            api_key_id=state.api_key_id,
        )

    async def __call__(
        self,
        state: ChatGraphState,
        config: RunnableConfig,
        writer: StreamWriter,
    ) -> ChatGraphState:
        """Invokes the LLM with fallback support.

        Args:
            state: Current state of the graph
            config: Configuration for the node execution
            writer: Stream writer for streaming custom events

        Returns:
            Updated graph state with new message and the llm stop reason.

        Raises:
            KeyError: If required configuration is missing.
            ValueError: If the content block type is unexpected.
            Exception: If both primary and fallback models fail.
        """
        node_config = self._validate_config(config=config)

        try:
            return await self._execute_with_model(
                model_name=node_config["primary_model"],
                node_config=node_config,
                state=state,
                writer=writer,
            )
        except Exception as primary_error:
            logger.opt(exception=True).warning(
                "Primary model `{model} failed.",
                model=node_config["primary_model"],
            )

            try:
                return await self._execute_with_model(
                    model_name=node_config["secondary_model"],
                    node_config=node_config,
                    state=state,
                    writer=writer,
                )
            except Exception as fallback_error:
                logger.error(
                    "Both primary and fallback models failed. Primary model error: `{primary_error}`, Fallback model error: `{fallback_error}`.",
                    primary_error=str(primary_error),
                    fallback_error=str(fallback_error),
                )
                raise Exception(
                    f"Both models failed - Primary ({node_config['primary_model']}): {primary_error}, "
                    f"Fallback ({node_config['secondary_model']}): {fallback_error}"
                ) from fallback_error
