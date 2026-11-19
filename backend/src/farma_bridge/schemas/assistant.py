from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_USER_CHARS = 600


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]          # 'system' (or anything else) from a client is rejected
    content: str = Field(min_length=1, max_length=1500)


class ChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def _last_is_a_short_user_message(self):
        last = self.messages[-1]
        if last.role != "user":
            raise ValueError("The last message must be from the user")
        if len(last.content) > MAX_USER_CHARS:
            raise ValueError(f"Messages can be at most {MAX_USER_CHARS} characters")
        return self


class ChatReply(BaseModel):
    reply: str
    on_topic: bool


class AssistantStatus(BaseModel):
    enabled: bool
    max_message_chars: int


class GuardVerdict(BaseModel):
    """Output of the topic gate (also the strict JSON schema sent to the model)."""
    model_config = ConfigDict(extra="forbid")
    on_topic: bool
    language: Literal["English", "Telugu", "Hindi", "Other"]
    topics: list[str] = []
