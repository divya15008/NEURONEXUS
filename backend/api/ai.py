from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.ai_service import (
    analyze_contribution,
    analyze_methodology,
    analyze_novelty,
    analyze_quality,
    analyze_writing,
    generate_improvements,
    generate_journal_match,
    generate_readiness_report,
)
from backend.config import AI_MODE

router = APIRouter(prefix="/api")


@router.get("/ai/status")
async def ai_status():
    """Report which analysis mode the server uses. Never exposes API keys."""
    return {
        "mode": AI_MODE,
        "local": AI_MODE == "local",
        "label": "Local heuristic assessment" if AI_MODE == "local" else f"External provider ({AI_MODE})",
        "note": (
            "Manuscript processing stays within the application/server."
            if AI_MODE == "local"
            else "Selected manuscript information may be sent to the configured third-party AI provider."
        ),
    }


class AnalysisPayload(BaseModel):
    document_id: str
    analysis: dict | None = None
    journal_id: str | None = None
    quality_analysis: dict | None = None
    selected_journal: str | None = None
    focus: str | None = None


@router.post("/quality/analyze")
async def quality_analyze(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return analyze_quality(payload.document_id, payload.analysis)


@router.post("/novelty/analyze")
async def novelty_analyze(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return analyze_novelty(payload.document_id, payload.analysis)


@router.post("/methodology/analyze")
async def methodology_analyze(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return analyze_methodology(payload.document_id, payload.analysis)


@router.post("/contribution/analyze")
async def contribution_analyze(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return analyze_contribution(payload.document_id, payload.analysis)


@router.post("/writing/analyze")
async def writing_analyze(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return analyze_writing(payload.document_id, payload.analysis)


@router.post("/improvement/generate")
async def improvement_generate(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return generate_improvements(payload.document_id, payload.analysis, payload.focus)


@router.post("/journal/match")
async def journal_match(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return generate_journal_match(payload.document_id, payload.analysis, payload.journal_id)


@router.post("/report/generate")
async def report_generate(payload: AnalysisPayload):
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="Document ID is required.")
    return generate_readiness_report(
        payload.document_id,
        payload.analysis,
        payload.quality_analysis,
        payload.selected_journal,
    )
