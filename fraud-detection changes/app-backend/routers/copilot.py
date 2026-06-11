"""routers/copilot.py — XAI copilot chat with SSE token streaming."""
from __future__ import annotations

import asyncio
import json
from typing import List, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth.rbac import require_any
from db.postgres import User
from services.copilot_brain import build_copilot_answer

router = APIRouter(prefix="/copilot", tags=["Copilot"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list)


@router.post("/chat")
async def copilot_chat(
    body: ChatRequest,
    current_user: User = Depends(require_any),
):
    """Stream copilot response as Server-Sent Events."""
    user_msgs = [m for m in body.messages if m.role == "user" and m.content.strip()]
    last_user = user_msgs[-1].content if user_msgs else "Summarize current fraud posture."

    answer = build_copilot_answer(last_user, username=current_user.username)

    async def event_stream():
        words = answer.split(" ")
        buffer = ""
        for i, word in enumerate(words):
            buffer += word + (" " if i < len(words) - 1 else "")
            payload = json.dumps({"token": word + " ", "done": False})
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.028)
        yield f"data: {json.dumps({'token': '', 'done': True, 'content': answer})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat/sync")
async def copilot_chat_sync(
    body: ChatRequest,
    current_user: User = Depends(require_any),
):
    """Non-streaming fallback for clients that cannot parse SSE."""
    user_msgs = [m for m in body.messages if m.role == "user" and m.content.strip()]
    last_user = user_msgs[-1].content if user_msgs else "Summarize current fraud posture."
    content = build_copilot_answer(last_user, username=current_user.username)
    return {"role": "assistant", "content": content}
