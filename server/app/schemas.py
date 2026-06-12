from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    content: str


class DocumentRead(BaseModel):
    id: int
    content: str
    current_version_id: Optional[int] = None


class VersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    version_number: int
    created_at: datetime


class VersionReadWithContent(VersionRead):
    content: str


class AIEditRequest(BaseModel):
    document_html: str
    instruction: str
    context_file_content: Optional[str] = None


class AIEditResponse(BaseModel):
    updated_html: str
