from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.ai_service import AIProviderError
from backend.api.ai import router as ai_router
from backend.api.auth import router as auth_router
from backend.api.documents import router as documents_router
from backend.api.citations import router as citations_router
from backend.api.generation import router as generation_router
from backend.api.improvements import router as improvements_router
from backend.api.journals import router as journals_router
from backend.database import init_db
from backend.journal.database import seed_journals


async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    seed_journals()
    yield


app = FastAPI(title="Research Publication Pipeline", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router)
app.include_router(auth_router)
app.include_router(citations_router)
app.include_router(journals_router)
app.include_router(ai_router)
app.include_router(improvements_router)
app.include_router(generation_router)


@app.exception_handler(AIProviderError)
async def handle_ai_provider_error(_, exc: AIProviderError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
