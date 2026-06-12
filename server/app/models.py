from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class Document(Base):
    __tablename__ = "document"
    id = Column(Integer, primary_key=True, index=True)
    current_version_id = Column(
        Integer,
        ForeignKey("document_version.id", use_alter=True, name="fk_document_current_version"),
        nullable=True,
    )

    versions = relationship(
        "DocumentVersion",
        primaryjoin="DocumentVersion.document_id == Document.id",
        foreign_keys="[DocumentVersion.document_id]",
        back_populates="document",
        order_by="DocumentVersion.version_number",
    )
    current_version = relationship(
        "DocumentVersion",
        primaryjoin="Document.current_version_id == DocumentVersion.id",
        foreign_keys="[Document.current_version_id]",
        uselist=False,
        post_update=True,
    )


class DocumentVersion(Base):
    __tablename__ = "document_version"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("document.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship(
        "Document",
        primaryjoin="DocumentVersion.document_id == Document.id",
        foreign_keys="[DocumentVersion.document_id]",
        back_populates="versions",
    )
