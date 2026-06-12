from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import app.ai as ai
import app.models as models
import app.schemas as schemas
from app.data import DOCUMENT_1, DOCUMENT_2
from app.db import Base, SessionLocal, engine, get_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for content in [DOCUMENT_1, DOCUMENT_2]:
            doc = models.Document()
            db.add(doc)
            db.flush()
            version = models.DocumentVersion(
                document_id=doc.id,
                version_number=1,
                content=content,
            )
            db.add(version)
            db.flush()
            doc.current_version_id = version.id
        db.commit()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helpers ---

def _get_document(document_id: int, db: Session) -> models.Document:
    doc = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
    return doc


def _get_version(document_id: int, version_id: int, db: Session) -> models.DocumentVersion:
    version = db.scalar(
        select(models.DocumentVersion).where(
            models.DocumentVersion.id == version_id,
            models.DocumentVersion.document_id == document_id,
        )
    )
    if version is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version_id} not found for document {document_id}",
        )
    return version


# --- Document endpoints ---

@app.get("/document/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db)) -> schemas.DocumentRead:
    doc = _get_document(document_id, db)
    if doc.current_version is None:
        raise HTTPException(status_code=404, detail="Document has no versions")
    return schemas.DocumentRead(
        id=doc.id,
        content=doc.current_version.content,
        current_version_id=doc.current_version_id,
    )


@app.post("/save/{document_id}")
def save(document_id: int, document: schemas.DocumentBase, db: Session = Depends(get_db)):
    doc = _get_document(document_id, db)
    if doc.current_version is None:
        raise HTTPException(status_code=404, detail="Document has no active version")
    doc.current_version.content = document.content
    db.commit()
    return {"document_id": document_id, "content": document.content}


# --- Versioning endpoints ---

@app.get("/document/{document_id}/versions")
def list_versions(
    document_id: int, db: Session = Depends(get_db)
) -> list[schemas.VersionRead]:
    _get_document(document_id, db)
    versions = db.scalars(
        select(models.DocumentVersion)
        .where(models.DocumentVersion.document_id == document_id)
        .order_by(models.DocumentVersion.version_number)
    ).all()
    return list(versions)


@app.get("/document/{document_id}/versions/{version_id}")
def get_version(
    document_id: int, version_id: int, db: Session = Depends(get_db)
) -> schemas.VersionReadWithContent:
    return _get_version(document_id, version_id, db)


@app.post("/document/{document_id}/versions")
def create_version(
    document_id: int,
    document: schemas.DocumentBase,
    db: Session = Depends(get_db),
) -> schemas.VersionReadWithContent:
    doc = _get_document(document_id, db)
    max_number = db.scalar(
        select(func.max(models.DocumentVersion.version_number)).where(
            models.DocumentVersion.document_id == document_id
        )
    )
    new_version = models.DocumentVersion(
        document_id=document_id,
        version_number=(max_number or 0) + 1,
        content=document.content,
    )
    db.add(new_version)
    db.flush()
    doc.current_version_id = new_version.id
    db.commit()
    db.refresh(new_version)
    return new_version


@app.put("/document/{document_id}/versions/{version_id}/activate")
def activate_version(
    document_id: int, version_id: int, db: Session = Depends(get_db)
) -> schemas.DocumentRead:
    version = _get_version(document_id, version_id, db)
    doc = _get_document(document_id, db)
    doc.current_version_id = version_id
    db.commit()
    return schemas.DocumentRead(
        id=doc.id,
        content=version.content,
        current_version_id=version_id,
    )


# --- AI editing endpoint ---

@app.post("/document/{document_id}/ai-edit")
async def ai_edit(
    document_id: int,
    request: schemas.AIEditRequest,
    db: Session = Depends(get_db),
) -> schemas.AIEditResponse:
    _get_document(document_id, db)
    try:
        updated_html = await ai.apply_edit_instruction(
            document_html=request.document_html,
            instruction=request.instruction,
            context_file_content=request.context_file_content,
        )
    except ai.AIServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e
    return schemas.AIEditResponse(updated_html=updated_html)
