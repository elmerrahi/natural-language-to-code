import json
from typing import Annotated, Any, AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command

from ..dependencies import (
    ChatRouteDependencies,
    ResumeRouteDependencies,
)

router = APIRouter(tags=["chat"])


def format_sse_event(event_type: str, data: dict[str, Any]) -> str:
    return (
        f"event: {event_type}\ndata: {json.dumps(jsonable_encoder(data))}\n\n"
    )


async def _execute_stream(
    graph: CompiledStateGraph,
    input: Any,
    config: dict[str, Any],
) -> AsyncIterator[str]:
    try:
        async for mode, event in graph.astream(
            input=input,
            config=config,  # type: ignore
            stream_mode=["custom", "updates"],
        ):
            if mode == "updates" and "__interrupt__" not in event:
                continue

            for event_type, event_data in event.items():  # type: ignore  # noqa: E501
                yield format_sse_event(
                    event_type=event_type,
                    data=event_data,
                )

        yield format_sse_event(
            event_type="complete",
            data={"status": "success"},
        )
    except Exception as e:
        error_payload = {
            "status": "error",
            "error": str(e),
        }
        yield format_sse_event(event_type="error", data=error_payload)


_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@router.post(
    "/stream/{user_id}/{thread_id}",
    status_code=200,
)
async def stream_chatbot_response(
    chat_dependencies: Annotated[
        ChatRouteDependencies,
        Depends(ChatRouteDependencies),
    ],
) -> StreamingResponse:
    req = chat_dependencies.request
    conn_id = req.connection_id

    tables_xml = req.tables_schema_xml
    if conn_id:
        svc = chat_dependencies.connection_service
        cached = await svc.get_cached_schema(conn_id)
        if cached:
            tables_xml = cached
        else:
            tables_xml = await svc.refresh_schema(conn_id)

    input = {
        "messages": [{"role": "user", "content": req.content}],
        "interrupt_policy": req.interrupt_policy,
        "connection_id": conn_id,
    }
    config = {
        "configurable": {
            "llm": {
                **req.chat_model_settings.model_dump(),
                "tables": tables_xml,
                "mode": req.mode,
            },
            "thread_id": str(chat_dependencies.thread_id),
        },
        "metadata": {"user_id": str(chat_dependencies.user_id)},
    }

    return StreamingResponse(
        content=_execute_stream(
            graph=chat_dependencies.graph,
            input=input,
            config=config,
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post(
    "/stream/{user_id}/{thread_id}/resume",
    status_code=200,
)
async def resume_chatbot_response(
    resume_dependencies: Annotated[
        ResumeRouteDependencies,
        Depends(ResumeRouteDependencies),
    ],
) -> StreamingResponse:
    req = resume_dependencies.request
    input: Any = Command(
        resume={
            "query": req.query,
            "reason": req.reason,
        }
    )
    config = {
        "configurable": {
            "llm": (req.chat_model_settings.model_dump()),
            "thread_id": str(resume_dependencies.thread_id),
        },
        "metadata": {"user_id": str(resume_dependencies.user_id)},
    }

    return StreamingResponse(
        content=_execute_stream(
            graph=resume_dependencies.graph,
            input=input,
            config=config,
        ),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
