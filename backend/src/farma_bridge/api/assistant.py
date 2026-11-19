"""Farma Bridge assistant endpoints. Chatting needs no login (that is the point); photo checks use /crop-doctor/diagnose, which does."""
import os

from fastapi import APIRouter, Depends

from config.ratelimit import limit
from config.security import OptionalUser
from schemas.assistant import MAX_USER_CHARS, AssistantStatus, ChatReply, ChatRequest
from service import assistant
from service.crop_doctor import is_enabled

router = APIRouter(prefix="/assistant", tags=["assistant"])

# The chat is public and costs money per message, so it is limited per IP address.
_PER_10_MIN = int(os.getenv("ASSISTANT_PER_10MIN", "30"))


@router.get("/status", response_model=AssistantStatus)
def status():
    return AssistantStatus(enabled=is_enabled(), max_message_chars=MAX_USER_CHARS)


@router.post("/chat", response_model=ChatReply, dependencies=[Depends(limit("assistant", _PER_10_MIN, 600))])
async def chat(payload: ChatRequest, viewer: OptionalUser = None):
    return await assistant.chat(payload.messages, signed_in=viewer is not None)
