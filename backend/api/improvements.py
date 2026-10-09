"""Persistent researcher decisions on improvement suggestions (Option A).

Stores per-document Accept / Reject / Edit decisions so a browser refresh
does not lose the researcher's review, and so the readiness report can
reflect review progress.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.database import connection
from backend.security import get_current_user, get_owned_document

router = APIRouter(prefix="/api/improvements", dependencies=[Depends(get_current_user)])

VALID_DECISIONS = {"accepted", "rejected", "edited"}


class DecisionPayload(BaseModel):
    document_id: str
    suggestion_id: str
    decision: str
    edited_text: str | None = None


@router.post("/decisions")
async def save_decision(payload: DecisionPayload, user: dict = Depends(get_current_user)):
    decision = (payload.decision or "").strip().lower()
    if decision not in VALID_DECISIONS:
        raise HTTPException(status_code=400, detail="Decision must be one of: accepted, rejected, edited.")
    if not payload.document_id or not payload.suggestion_id:
        raise HTTPException(status_code=400, detail="document_id and suggestion_id are required.")
    get_owned_document(payload.document_id, user["id"])
    with connection() as conn:
        conn.execute(
            "INSERT INTO suggestion_decisions (document_id, suggestion_id, decision, edited_text, updated_at) "
            "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(document_id, suggestion_id) DO UPDATE SET "
            "decision = excluded.decision, edited_text = excluded.edited_text, updated_at = CURRENT_TIMESTAMP",
            (payload.document_id, payload.suggestion_id, decision, payload.edited_text),
        )
    return {
        "document_id": payload.document_id,
        "suggestion_id": payload.suggestion_id,
        "decision": decision,
        "edited_text": payload.edited_text,
    }


@router.get("/decisions/{document_id}")
async def get_decisions(document_id: str, user: dict = Depends(get_current_user)):
    get_owned_document(document_id, user["id"])
    with connection() as conn:
        rows = conn.execute(
            "SELECT suggestion_id, decision, edited_text, updated_at FROM suggestion_decisions "
            "WHERE document_id = ? ORDER BY updated_at ASC",
            (document_id,),
        ).fetchall()
    return {
        "document_id": document_id,
        "decisions": [
            {
                "suggestion_id": row["suggestion_id"],
                "decision": row["decision"],
                "edited_text": row["edited_text"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ],
    }
